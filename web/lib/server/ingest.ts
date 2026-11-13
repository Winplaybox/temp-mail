// Turns a ForwardEmail webhook payload (mailparser "simpleParser" JSON) into rows for tm_ingest.
import { extractOtp } from "./otp.ts";
import type { IngestAttachment, IngestInput } from "./store.ts";

const MAX_ATTACHMENT = 5 * 1024 * 1024;
const MAX_ATTACHMENTS_TOTAL = 10 * 1024 * 1024;

type AddressObj = { value?: { address?: string; name?: string }[]; text?: string };
type RawAttachment = {
  filename?: string;
  contentType?: string;
  size?: number;
  content?: string | { type?: string; data?: number[] };
};
export type ForwardEmailPayload = {
  recipients?: string[];
  session?: { recipient?: string; envelope?: { rcptTo?: { address?: string }[] } };
  to?: AddressObj | AddressObj[];
  from?: AddressObj;
  subject?: string;
  text?: string | false;
  html?: string | false;
  textAsHtml?: string;
  attachments?: RawAttachment[];
  raw?: string;
};

function toBase64(content: RawAttachment["content"]): string | null {
  if (!content) return null;
  if (typeof content === "string") return content; // already base64
  if (Array.isArray(content.data)) return Buffer.from(content.data).toString("base64");
  return null;
}

function stripTags(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/tr>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

/** Envelope recipients first (they include BCC), header To as a fallback. */
export function recipientsOf(p: ForwardEmailPayload, domains: string[]): string[] {
  const out = new Set<string>();
  const add = (a?: string) => {
    const v = (a ?? "").trim().toLowerCase().replace(/^<|>$/g, "");
    if (v && domains.some((d) => v.endsWith(`@${d}`))) out.add(v);
  };
  p.recipients?.forEach(add);
  p.session?.envelope?.rcptTo?.forEach((r) => add(r.address));
  add(p.session?.recipient);
  if (out.size === 0) {
    const tos = Array.isArray(p.to) ? p.to : p.to ? [p.to] : [];
    tos.forEach((t) => t.value?.forEach((v) => add(v.address)));
  }
  return [...out];
}

export function normalize(p: ForwardEmailPayload, recipient: string, rawSize: number): IngestInput {
  const html = typeof p.html === "string" && p.html.trim() ? p.html : null;
  let text = typeof p.text === "string" && p.text.trim() ? p.text : null;
  if (!text && html) text = stripTags(html);

  const attachments: IngestAttachment[] = [];
  let total = 0;
  for (const a of p.attachments ?? []) {
    const data = toBase64(a.content);
    if (!data) continue;
    const size = a.size ?? Math.floor((data.length * 3) / 4);
    if (size > MAX_ATTACHMENT || total + size > MAX_ATTACHMENTS_TOTAL) continue;
    total += size;
    attachments.push({
      filename: (a.filename || "attachment").replace(/[\\/\r\n]+/g, "_").slice(0, 200),
      content_type: a.contentType ?? null,
      size_bytes: size,
      data,
    });
  }

  const sender = p.from?.value?.[0];
  return {
    recipient,
    from_address: sender?.address?.toLowerCase() ?? null,
    from_name: sender?.name?.trim() || null,
    subject: p.subject?.trim() || null,
    text,
    html,
    otp: extractOtp(p.subject, text),
    size_bytes: rawSize,
    attachments,
  };
}
