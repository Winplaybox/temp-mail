// Cloudflare Email Worker — receives every mail sent to *@<your-domain>
// (Email Routing → catch-all → "Send to Worker") and stores it in Supabase.
import PostalMime from "postal-mime";
import { extractOtp } from "./otp";

export interface Env {
  SUPABASE_URL: string;          // https://xxxx.supabase.co
  SUPABASE_SERVICE_KEY: string;  // service_role key (secret)
  MAX_RAW_BYTES?: string;        // default 10 MB
}

const MAX_HTML = 1_000_000;
const MAX_TEXT = 300_000;

function headers(env: Env, extra: Record<string, string> = {}) {
  return {
    apikey: env.SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function findInbox(env: Env, address: string): Promise<string | null> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/active_inbox_for`, {
    method: "POST",
    headers: headers(env),
    body: JSON.stringify({ addr: address.toLowerCase() }),
  });
  if (!res.ok) throw new Error(`inbox lookup failed: ${res.status}`);
  const rows = (await res.json()) as { id: string }[];
  return rows[0]?.id ?? null;
}

function safeName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 120) || "file";
}

export default {
  async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext) {
    const maxRaw = Number(env.MAX_RAW_BYTES ?? 10 * 1024 * 1024);
    if (message.rawSize > maxRaw) {
      message.setReject("Message too large for this inbox");
      return;
    }

    const inboxId = await findInbox(env, message.to);
    if (!inboxId) {
      message.setReject("Address does not exist or has expired");
      return;
    }

    const raw = await new Response(message.raw).arrayBuffer();
    const email = await PostalMime.parse(raw);

    const text = (email.text ?? "").slice(0, MAX_TEXT);
    const html = email.html && email.html.length <= MAX_HTML ? email.html : null;
    const attachments = email.attachments ?? [];

    const insert = await fetch(`${env.SUPABASE_URL}/rest/v1/messages`, {
      method: "POST",
      headers: headers(env, { Prefer: "return=representation" }),
      body: JSON.stringify({
        inbox_id: inboxId,
        from_address: email.from?.address ?? message.from,
        from_name: email.from?.name || null,
        subject: (email.subject ?? "").slice(0, 500) || null,
        text_body: text || null,
        html_body: html,
        otp: extractOtp(email.subject, text || stripTags(html ?? "")),
        size_bytes: message.rawSize,
        has_attachments: attachments.length > 0,
      }),
    });
    if (!insert.ok) throw new Error(`message insert failed: ${insert.status} ${await insert.text()}`);
    const [row] = (await insert.json()) as { id: string; received_at: string }[];

    for (const att of attachments) {
      const filename = safeName(att.filename || "attachment");
      const path = `${inboxId}/${row.id}/${crypto.randomUUID().slice(0, 8)}-${filename}`;
      const body = typeof att.content === "string" ? new TextEncoder().encode(att.content) : att.content;
      const up = await fetch(`${env.SUPABASE_URL}/storage/v1/object/attachments/${path}`, {
        method: "POST",
        headers: {
          apikey: env.SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          "Content-Type": att.mimeType || "application/octet-stream",
        },
        body,
      });
      if (!up.ok) continue; // keep the mail even if one attachment fails
      await fetch(`${env.SUPABASE_URL}/rest/v1/attachments`, {
        method: "POST",
        headers: headers(env),
        body: JSON.stringify({
          message_id: row.id,
          inbox_id: inboxId,
          filename,
          content_type: att.mimeType || null,
          size_bytes: body.byteLength,
          storage_path: path,
        }),
      });
    }

    // Tell the open browser tab right away (payload carries no content).
    ctx.waitUntil(
      fetch(`${env.SUPABASE_URL}/realtime/v1/api/broadcast`, {
        method: "POST",
        headers: headers(env),
        body: JSON.stringify({
          messages: [{ topic: `inbox:${inboxId}`, event: "new_mail", payload: { id: row.id } }],
        }),
      }).catch(() => undefined),
    );
  },
};

function stripTags(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ");
}
