import { randomUUID } from "node:crypto";

export type Json = Record<string, unknown>;
export type InboxJson = {
  id: string;
  address: string;
  domain: string;
  is_custom: boolean;
  created_at: string;
  expires_at: string;
};
export type IngestAttachment = { filename: string; content_type: string | null; size_bytes: number; data: string };
export type IngestInput = {
  recipient: string;
  from_address: string | null;
  from_name: string | null;
  subject: string | null;
  text: string | null;
  html: string | null;
  otp: string | null;
  size_bytes: number;
  attachments: IngestAttachment[];
};

export type StoreErrorCode = "not_found" | "expired" | "rate_limited" | "taken" | "bad_domain" | "bad_ttl" | "forbidden" | "unavailable";

export class StoreError extends Error {
  code: StoreErrorCode;
  constructor(code: StoreErrorCode, detail?: string) {
    super(detail ?? code);
    this.code = code;
  }
}

export interface Store {
  listDomains(): Promise<{ domain: string; is_default: boolean }[]>;
  createInbox(i: {
    local_part: string;
    domain: string;
    token_hash: string;
    is_custom: boolean;
    ip_hash: string | null;
    ttl_minutes: number;
    max_per_hour: number;
  }): Promise<InboxJson>;
  getInbox(id: string, tokenHash: string): Promise<InboxJson>;
  extendInbox(id: string, tokenHash: string, minutes: number, maxLifeMinutes: number): Promise<InboxJson>;
  deleteInbox(id: string, tokenHash: string): Promise<void>;
  listMessages(id: string, tokenHash: string): Promise<{ expires_at: string; messages: Json[] }>;
  getMessage(id: string, tokenHash: string, messageId: string): Promise<Json>;
  deleteMessage(id: string, tokenHash: string, messageId: string): Promise<void>;
  getAttachment(id: string, tokenHash: string, attachmentId: string): Promise<{ filename: string; content_type: string | null; data: string }>;
  ingest(i: IngestInput): Promise<string | null>;
  cleanup(): Promise<number>;
  stats(): Promise<Json>;
  logIngest(e: { recipients: string[]; header_to: string | null; from: string | null; subject: string | null; stored: number; note: string }): Promise<void>;
}

// ------------------------------------------------------------------ Supabase (PostgREST RPC)
const KNOWN: StoreErrorCode[] = ["not_found", "expired", "rate_limited", "taken", "bad_domain", "bad_ttl", "forbidden"];

export class RpcStore implements Store {
  private url: string;
  private key: string;
  private secret: string;

  constructor(url: string, key: string, secret: string) {
    this.url = url.replace(/\/$/, "");
    this.key = key;
    this.secret = secret;
  }

  private async rpc<T>(fn: string, args: Json): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.url}/rest/v1/rpc/${fn}`, {
        method: "POST",
        headers: { apikey: this.key, Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_secret: this.secret, ...args }),
        cache: "no-store",
      });
    } catch (e) {
      throw new StoreError("unavailable", String(e));
    }
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const msg = String(data?.message ?? "");
      const code = KNOWN.find((k) => msg === k);
      throw new StoreError(code ?? "unavailable", `${fn}: ${res.status} ${msg}`);
    }
    return data as T;
  }

  listDomains() {
    return this.rpc<{ domain: string; is_default: boolean }[]>("tm_list_domains", {});
  }
  createInbox(i: Parameters<Store["createInbox"]>[0]) {
    return this.rpc<InboxJson>("tm_create_inbox", {
      p_local_part: i.local_part,
      p_domain: i.domain,
      p_token_hash: i.token_hash,
      p_is_custom: i.is_custom,
      p_ip_hash: i.ip_hash,
      p_ttl_minutes: i.ttl_minutes,
      p_max_per_hour: i.max_per_hour,
    });
  }
  getInbox(id: string, th: string) {
    return this.rpc<InboxJson>("tm_get_inbox", { p_id: id, p_token_hash: th });
  }
  extendInbox(id: string, th: string, minutes: number, maxLife: number) {
    return this.rpc<InboxJson>("tm_extend_inbox", { p_id: id, p_token_hash: th, p_minutes: minutes, p_max_life_minutes: maxLife });
  }
  async deleteInbox(id: string, th: string) {
    await this.rpc("tm_delete_inbox", { p_id: id, p_token_hash: th });
  }
  listMessages(id: string, th: string) {
    return this.rpc<{ expires_at: string; messages: Json[] }>("tm_list_messages", { p_id: id, p_token_hash: th });
  }
  getMessage(id: string, th: string, mid: string) {
    return this.rpc<Json>("tm_get_message", { p_id: id, p_token_hash: th, p_message_id: mid });
  }
  async deleteMessage(id: string, th: string, mid: string) {
    await this.rpc("tm_delete_message", { p_id: id, p_token_hash: th, p_message_id: mid });
  }
  getAttachment(id: string, th: string, aid: string) {
    return this.rpc<{ filename: string; content_type: string | null; data: string }>("tm_get_attachment", {
      p_id: id,
      p_token_hash: th,
      p_attachment_id: aid,
    });
  }
  ingest(i: IngestInput) {
    return this.rpc<string | null>("tm_ingest", {
      p_recipient: i.recipient,
      p_from_address: i.from_address,
      p_from_name: i.from_name,
      p_subject: i.subject,
      p_text: i.text,
      p_html: i.html,
      p_otp: i.otp,
      p_size_bytes: i.size_bytes,
      p_attachments: i.attachments,
    });
  }
  cleanup() {
    return this.rpc<number>("tm_cleanup", {});
  }
  stats() {
    return this.rpc<Json>("tm_stats", {});
  }
  async logIngest(e: Parameters<Store["logIngest"]>[0]) {
    await this.rpc("tm_log_ingest", {
      p_recipients: e.recipients,
      p_header_to: e.header_to,
      p_from: e.from,
      p_subject: e.subject,
      p_stored: e.stored,
      p_note: e.note,
    });
  }
}

// ------------------------------------------------------------------ in-memory (local dev + tests)
type MemInbox = InboxJson & { local_part: string; token_hash: string; ip_hash: string | null };
type MemMessage = Json & { id: string; inbox_id: string; received_at: string; read_at: string | null };
type MemAttachment = { id: string; message_id: string; inbox_id: string; filename: string; content_type: string | null; size_bytes: number; data: string };

export class MemoryStore implements Store {
  domains: { domain: string; is_default: boolean }[];
  inboxes = new Map<string, MemInbox>();
  messages = new Map<string, MemMessage>();
  attachments = new Map<string, MemAttachment>();
  now: () => number = () => Date.now();

  constructor(domains: string[] = ["example.test"]) {
    this.domains = domains.map((d, i) => ({ domain: d, is_default: i === 0 }));
  }

  private open(id: string, th: string): MemInbox {
    const r = this.inboxes.get(id);
    if (!r || r.token_hash !== th) throw new StoreError("not_found");
    if (new Date(r.expires_at).getTime() <= this.now()) throw new StoreError("expired");
    return r;
  }
  private pub(r: MemInbox): InboxJson {
    const { id, address, domain, is_custom, created_at, expires_at } = r;
    return { id, address, domain, is_custom, created_at, expires_at };
  }

  async listDomains() {
    return this.domains;
  }
  async createInbox(i: Parameters<Store["createInbox"]>[0]) {
    if (![10, 60, 1440].includes(i.ttl_minutes)) throw new StoreError("bad_ttl");
    if (!this.domains.some((d) => d.domain === i.domain)) throw new StoreError("bad_domain");
    const hourAgo = this.now() - 3600_000;
    const recent = [...this.inboxes.values()].filter((x) => x.ip_hash === i.ip_hash && new Date(x.created_at).getTime() > hourAgo);
    if (i.ip_hash && recent.length >= i.max_per_hour) throw new StoreError("rate_limited");
    const address = `${i.local_part}@${i.domain}`;
    if ([...this.inboxes.values()].some((x) => x.address === address)) throw new StoreError("taken");
    const r: MemInbox = {
      id: randomUUID(),
      address,
      domain: i.domain,
      local_part: i.local_part,
      is_custom: i.is_custom,
      token_hash: i.token_hash,
      ip_hash: i.ip_hash,
      created_at: new Date(this.now()).toISOString(),
      expires_at: new Date(this.now() + i.ttl_minutes * 60_000).toISOString(),
    };
    this.inboxes.set(r.id, r);
    return this.pub(r);
  }
  async getInbox(id: string, th: string) {
    return this.pub(this.open(id, th));
  }
  async extendInbox(id: string, th: string, minutes: number, maxLife: number) {
    if (![10, 60, 1440].includes(minutes)) throw new StoreError("bad_ttl");
    const r = this.open(id, th);
    const base = Math.max(new Date(r.expires_at).getTime(), this.now()) + minutes * 60_000;
    const cap = new Date(r.created_at).getTime() + maxLife * 60_000;
    r.expires_at = new Date(Math.min(base, cap)).toISOString();
    return this.pub(r);
  }
  async deleteInbox(id: string, th: string) {
    const r = this.inboxes.get(id);
    if (!r || r.token_hash !== th) return;
    this.inboxes.delete(id);
    for (const [k, m] of this.messages) if (m.inbox_id === id) this.messages.delete(k);
    for (const [k, a] of this.attachments) if (a.inbox_id === id) this.attachments.delete(k);
  }
  async listMessages(id: string, th: string) {
    const r = this.open(id, th);
    const list = [...this.messages.values()]
      .filter((m) => m.inbox_id === id)
      .sort((a, b) => b.received_at.localeCompare(a.received_at))
      .slice(0, 100)
      .map((m) => ({
        id: m.id,
        from_address: m.from_address,
        from_name: m.from_name,
        subject: (m.subject as string) || "(no subject)",
        preview: String(m.text_body ?? "").replace(/\s+/g, " ").slice(0, 160),
        otp: m.otp,
        has_attachments: m.has_attachments,
        received_at: m.received_at,
        read: m.read_at !== null,
      }));
    return { expires_at: r.expires_at, messages: list };
  }
  async getMessage(id: string, th: string, mid: string) {
    this.open(id, th);
    const m = this.messages.get(mid);
    if (!m || m.inbox_id !== id) throw new StoreError("not_found");
    m.read_at ??= new Date(this.now()).toISOString();
    const atts = [...this.attachments.values()]
      .filter((a) => a.message_id === mid)
      .map(({ id, filename, content_type, size_bytes }) => ({ id, filename, content_type, size_bytes }));
    return {
      id: m.id,
      from_address: m.from_address,
      from_name: m.from_name,
      subject: (m.subject as string) || "(no subject)",
      text: m.text_body,
      html: m.html_body,
      otp: m.otp,
      size_bytes: m.size_bytes,
      received_at: m.received_at,
      attachments: atts,
    };
  }
  async deleteMessage(id: string, th: string, mid: string) {
    this.open(id, th);
    const m = this.messages.get(mid);
    if (m?.inbox_id === id) this.messages.delete(mid);
  }
  async getAttachment(id: string, th: string, aid: string) {
    this.open(id, th);
    const a = this.attachments.get(aid);
    if (!a || a.inbox_id !== id) throw new StoreError("not_found");
    return { filename: a.filename, content_type: a.content_type, data: a.data };
  }
  async ingest(i: IngestInput) {
    const r = [...this.inboxes.values()].find(
      (x) => x.address === i.recipient.toLowerCase() && new Date(x.expires_at).getTime() > this.now(),
    );
    if (!r) return null;
    const id = randomUUID();
    this.messages.set(id, {
      id,
      inbox_id: r.id,
      from_address: i.from_address,
      from_name: i.from_name,
      subject: i.subject,
      text_body: i.text,
      html_body: i.html,
      otp: i.otp,
      size_bytes: i.size_bytes,
      has_attachments: i.attachments.length > 0,
      received_at: new Date(this.now()).toISOString(),
      read_at: null,
    });
    for (const a of i.attachments) {
      const aid = randomUUID();
      this.attachments.set(aid, { id: aid, message_id: id, inbox_id: r.id, ...a });
    }
    return id;
  }
  async cleanup() {
    let n = 0;
    for (const [id, r] of this.inboxes) {
      if (new Date(r.expires_at).getTime() < this.now()) {
        await this.deleteInbox(id, r.token_hash);
        n++;
      }
    }
    return n;
  }
  async stats() {
    return { active_inboxes: this.inboxes.size, messages: this.messages.size };
  }
  ingestLog: Parameters<Store["logIngest"]>[0][] = [];
  async logIngest(e: Parameters<Store["logIngest"]>[0]) {
    this.ingestLog.push(e);
  }
}
