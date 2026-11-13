// Framework-free request handling so it can be unit-tested without Next.js.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { normalize, recipientsOf, type ForwardEmailPayload } from "./ingest.ts";
import { randomLocalPart, validateLocalPart } from "./names.ts";
import { MemoryStore, RpcStore, StoreError, type Store } from "./store.ts";

export type Config = {
  ipSalt: string;
  ingestSecret: string;
  createPerHour: number;
  readsPerMinute: number;
  ttlChoices: number[];
  defaultTtl: number;
  maxLifeMinutes: number;
  dev: boolean;
};

export type Req = { method: string; path: string[]; ip: string; headers: Headers; body: () => Promise<unknown>; rawLength: number };
export type Res = { status: number; json?: unknown; bytes?: Uint8Array; headers?: Record<string, string> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

class Limiter {
  private hits = new Map<string, number[]>();
  limit: number;
  windowMs: number;
  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.windowMs = windowMs;
  }
  allow(key: string): boolean {
    const now = Date.now();
    const list = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (list.length >= this.limit) {
      this.hits.set(key, list);
      return false;
    }
    list.push(now);
    this.hits.set(key, list);
    if (this.hits.size > 50_000) this.hits.clear();
    return true;
  }
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");
const err = (status: number, error: string): Res => ({ status, json: { error } });

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function fromStoreError(e: unknown): Res {
  if (!(e instanceof StoreError)) throw e;
  switch (e.code) {
    case "not_found":
      return err(404, "Not found.");
    case "expired":
      return err(410, "This address has expired. Create a new one.");
    case "rate_limited":
      return err(429, "You created a lot of addresses. Try again in an hour.");
    case "taken":
      return err(409, "This address is already in use. Try a different name.");
    case "bad_domain":
      return err(400, "That domain isn't available. Pick one from the list.");
    case "bad_ttl":
      return err(400, "Pick a lifetime of 10 minutes, 1 hour or 1 day.");
    default:
      console.error("[temp-mail] store error", e.code, e.message);
      return err(503, "The mail service is busy. Try again in a moment.");
  }
}

export function createService(store: Store, cfg: Config) {
  const creates = new Limiter(cfg.createPerHour, 3600_000);
  const reads = new Limiter(cfg.readsPerMinute, 60_000);
  let domainCache: { at: number; list: { domain: string; is_default: boolean }[] } | null = null;

  async function domains() {
    if (!domainCache || Date.now() - domainCache.at > 60_000) {
      domainCache = { at: Date.now(), list: await store.listDomains() };
    }
    return domainCache.list;
  }

  async function handle(req: Req): Promise<Res> {
    const [head, id, sub, subId] = req.path;
    const ipHash = sha256(`${cfg.ipSalt}:${req.ip}`).slice(0, 32);
    const token = req.headers.get("x-inbox-token") ?? "";
    const th = sha256(token);

    try {
      // ------------------------------------------------------------ public
      if (head === "health" && req.method === "GET") {
        const list = await store.listDomains();
        return { status: 200, json: { ok: true, domains: list.length, time: new Date().toISOString() } };
      }

      if (head === "domains" && req.method === "GET") {
        return {
          status: 200,
          json: { domains: (await domains()).map((d) => d.domain), ttl_choices: cfg.ttlChoices, default_ttl: cfg.defaultTtl },
        };
      }

      if (head === "ingest" && req.method === "POST") {
        if (!cfg.ingestSecret || !id || !safeEqual(id, cfg.ingestSecret)) return err(404, "Not found.");
        const payload = (await req.body()) as ForwardEmailPayload;
        const known = (await domains()).map((d) => d.domain);
        const rcpts = recipientsOf(payload ?? {}, known);
        const stored: string[] = [];
        for (const r of rcpts) {
          const mid = await store.ingest(normalize(payload, r, req.rawLength));
          if (mid) stored.push(mid);
        }
        // Always 200 for unknown/expired recipients so the sender isn't retried for days.
        return { status: 200, json: { ok: true, stored: stored.length } };
      }

      if (head !== "inboxes") return err(404, "Not found.");

      // ------------------------------------------------------------ create
      if (!id && req.method === "POST") {
        if (!creates.allow(ipHash)) return err(429, "You created a lot of addresses. Try again in an hour.");
        const body = ((await req.body()) ?? {}) as { username?: unknown; domain?: unknown; ttl_minutes?: unknown };
        const list = await domains();
        if (!list.length) return err(503, "No email domain is configured yet.");
        const domain =
          (typeof body.domain === "string" && body.domain.toLowerCase()) ||
          list.find((d) => d.is_default)?.domain ||
          list[0].domain;
        const ttl = typeof body.ttl_minutes === "number" ? body.ttl_minutes : cfg.defaultTtl;
        const custom = typeof body.username === "string" && body.username.trim() !== "";
        let local = custom ? (body.username as string).trim().toLowerCase() : randomLocalPart();
        if (custom) {
          const msg = validateLocalPart(local);
          if (msg) return err(400, msg);
        }
        const tok = newToken();
        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            const inbox = await store.createInbox({
              local_part: local,
              domain,
              token_hash: sha256(tok),
              is_custom: custom,
              ip_hash: ipHash,
              ttl_minutes: ttl,
              max_per_hour: cfg.createPerHour,
            });
            return { status: 201, json: { ...inbox, token: tok } };
          } catch (e) {
            if (e instanceof StoreError && e.code === "taken" && !custom) {
              local = randomLocalPart();
              continue;
            }
            throw e;
          }
        }
        return err(503, "Couldn't create an address. Try again.");
      }

      // ------------------------------------------------------------ inbox-scoped
      if (!id || !UUID.test(id)) return err(404, "Not found.");
      if (!reads.allow(ipHash)) return err(429, "Too many requests. Wait a minute and try again.");

      if (!sub) {
        if (req.method === "GET") return { status: 200, json: await store.getInbox(id, th) };
        if (req.method === "DELETE") {
          await store.deleteInbox(id, th);
          return { status: 204 };
        }
      }

      if (sub === "extend" && req.method === "POST") {
        const body = ((await req.body()) ?? {}) as { ttl_minutes?: unknown };
        const minutes = typeof body.ttl_minutes === "number" ? body.ttl_minutes : 0;
        return { status: 200, json: await store.extendInbox(id, th, minutes, cfg.maxLifeMinutes) };
      }

      if (sub === "messages") {
        if (!subId && req.method === "GET") return { status: 200, json: await store.listMessages(id, th) };
        if (!subId || !UUID.test(subId)) return err(404, "Not found.");
        if (req.method === "GET") return { status: 200, json: await store.getMessage(id, th, subId) };
        if (req.method === "DELETE") {
          await store.deleteMessage(id, th, subId);
          return { status: 204 };
        }
      }

      if (sub === "attachments" && subId && UUID.test(subId) && req.method === "GET") {
        const a = await store.getAttachment(id, th, subId);
        const safe = a.filename.replace(/["\r\n]/g, "_");
        return {
          status: 200,
          bytes: new Uint8Array(Buffer.from(a.data, "base64")),
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Disposition": `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(a.filename)}`,
            "X-Content-Type-Options": "nosniff",
          },
        };
      }

      if (sub === "simulate" && req.method === "POST" && cfg.dev) {
        const inbox = await store.getInbox(id, th);
        const code = String(100000 + Math.floor(Math.random() * 900000));
        const mid = await store.ingest(
          normalize(
            {
              from: { value: [{ address: "no-reply@instagram.com", name: "Instagram" }] },
              subject: `${code} is your Instagram code`,
              text: `Hi,\n\nSomeone tried to sign up for an Instagram account with ${inbox.address}. If it was you, enter this confirmation code in the app:\n\n${code}\n\nThanks,\nThe Instagram team`,
              html: `<div style="font-family:Arial;padding:24px"><h2>Confirm your email</h2><p>Enter this confirmation code in the app:</p><p style="font-size:28px;letter-spacing:4px"><b>${code}</b></p><img src="https://example.com/pixel.gif" width="1" height="1"></div>`,
              attachments: [{ filename: "welcome.txt", contentType: "text/plain", content: Buffer.from("Welcome!").toString("base64") }],
            },
            inbox.address,
            2048,
          ),
        );
        return { status: 200, json: { id: mid } };
      }

      return err(404, "Not found.");
    } catch (e) {
      if (e instanceof SyntaxError) return err(400, "Invalid JSON body.");
      return fromStoreError(e);
    }
  }

  return { handle };
}

// ------------------------------------------------------------------ singleton for the Next.js runtime
type G = typeof globalThis & { __tmService?: ReturnType<typeof createService> };

export function service() {
  const g = globalThis as G;
  if (g.__tmService) return g.__tmService;
  const dev = process.env.TEMPMAIL_DEV_MEMORY === "1";
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  const secret = process.env.TEMPMAIL_SERVER_SECRET;
  let store: Store;
  if (dev) store = new MemoryStore(["buzzstormnow.com", "mail.householdia.in", "mail.smartbuyonline.in"]);
  else if (url && key && secret) store = new RpcStore(url, key, secret);
  else throw new Error("Set SUPABASE_URL, SUPABASE_ANON_KEY and TEMPMAIL_SERVER_SECRET (or TEMPMAIL_DEV_MEMORY=1).");

  g.__tmService = createService(store, {
    ipSalt: process.env.TEMPMAIL_IP_SALT || "dev-salt",
    ingestSecret: process.env.TEMPMAIL_INGEST_SECRET || (dev ? "dev" : ""),
    createPerHour: Number(process.env.TEMPMAIL_CREATE_PER_HOUR || 15),
    readsPerMinute: Number(process.env.TEMPMAIL_READS_PER_MINUTE || 240),
    ttlChoices: [10, 60, 1440],
    defaultTtl: 60,
    maxLifeMinutes: 7 * 24 * 60,
    dev,
  });
  return g.__tmService;
}
