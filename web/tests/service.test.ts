import { test } from "node:test";
import assert from "node:assert/strict";
import { createService, type Req } from "../lib/server/service.ts";
import { MemoryStore } from "../lib/server/store.ts";
import { recipientsOf } from "../lib/server/ingest.ts";

const DOMAIN = "temp-mail.winplaybox.in";

function setup(createPerHour = 5) {
  const store = new MemoryStore([DOMAIN]);
  const svc = createService(store, {
    ipSalt: "s",
    ingestSecret: "hook123",
    createPerHour,
    readsPerMinute: 1000,
    ttlChoices: [10, 60, 1440],
    defaultTtl: 60,
    maxLifeMinutes: 10080,
    dev: false,
  });
  const call = (method: string, path: string, body?: unknown, token?: string, ip = "1.1.1.1") => {
    const headers = new Headers(token ? { "x-inbox-token": token } : {});
    const req: Req = { method, path: path.split("/").filter(Boolean), ip, headers, rawLength: 100, body: async () => body ?? null };
    return svc.handle(req);
  };
  return { store, call };
}

async function newInbox(call: ReturnType<typeof setup>["call"], body: unknown = {}) {
  const r = await call("POST", "inboxes", body);
  assert.equal(r.status, 201, JSON.stringify(r.json));
  return r.json as { id: string; token: string; address: string; expires_at: string };
}

test("creates a random inbox on the default domain", async () => {
  const { call } = setup();
  const i = await newInbox(call);
  assert.match(i.address, /@temp-mail\.winplaybox\.in$/);
  assert.ok(i.token.length > 30);
});

test("custom name: validation, reserved, conflict", async () => {
  const { call } = setup();
  await newInbox(call, { username: "Sagar.Shop" });
  assert.equal((await call("POST", "inboxes", { username: "sagar.shop" })).status, 409);
  assert.equal((await call("POST", "inboxes", { username: "admin" })).status, 400);
  assert.equal((await call("POST", "inboxes", { username: "a" })).status, 400);
});

test("rejects unknown domain and bad ttl", async () => {
  const { call } = setup();
  assert.equal((await call("POST", "inboxes", { domain: "gmail.com" })).status, 400);
  assert.equal((await call("POST", "inboxes", { ttl_minutes: 5 })).status, 400);
});

test("token is required and inboxes are isolated", async () => {
  const { call } = setup();
  const a = await newInbox(call);
  const b = await newInbox(call);
  assert.equal((await call("GET", `inboxes/${a.id}/messages`)).status, 404);
  assert.equal((await call("GET", `inboxes/${a.id}/messages`, null, b.token)).status, 404);
  assert.equal((await call("GET", `inboxes/${a.id}/messages`, null, a.token)).status, 200);
});

test("ingest webhook stores mail, extracts code, keeps attachments", async () => {
  const { call } = setup();
  const i = await newInbox(call);
  const payload = {
    recipients: [i.address, "someone@gmail.com"],
    from: { value: [{ address: "No-Reply@Insta.com", name: "Instagram" }] },
    subject: "Confirm your account",
    text: "Your verification code is 482913",
    html: "<p>Your verification code is <b>482913</b></p>",
    attachments: [{ filename: "a.txt", contentType: "text/plain", size: 5, content: { type: "Buffer", data: [104, 101, 108, 108, 111] } }],
  };
  assert.equal((await call("POST", "ingest/wrong", payload)).status, 404);
  const r = await call("POST", "ingest/hook123", payload);
  assert.deepEqual(r.json, { ok: true, stored: 1 });

  const list = (await call("GET", `inboxes/${i.id}/messages`, null, i.token)).json as { messages: { id: string; otp: string; read: boolean; from_address: string }[] };
  assert.equal(list.messages[0].otp, "482913");
  assert.equal(list.messages[0].from_address, "no-reply@insta.com");
  assert.equal(list.messages[0].read, false);

  const full = (await call("GET", `inboxes/${i.id}/messages/${list.messages[0].id}`, null, i.token)).json as { attachments: { id: string }[] };
  const file = await call("GET", `inboxes/${i.id}/attachments/${full.attachments[0].id}`, null, i.token);
  assert.equal(Buffer.from(file.bytes!).toString(), "hello");
  assert.match(file.headers!["Content-Disposition"], /attachment; filename="a.txt"/);

  const again = (await call("GET", `inboxes/${i.id}/messages`, null, i.token)).json as { messages: { read: boolean }[] };
  assert.equal(again.messages[0].read, true);
});

test("ingest for unknown address returns 200 and stores nothing", async () => {
  const { call } = setup();
  const r = await call("POST", "ingest/hook123", { recipients: [`nobody@${DOMAIN}`], subject: "x", text: "y" });
  assert.deepEqual(r.json, { ok: true, stored: 0 });
});

test("expired inbox returns 410 and cleanup removes it", async () => {
  const { call, store } = setup();
  const i = await newInbox(call, { ttl_minutes: 10 });
  store.now = () => Date.now() + 11 * 60_000;
  assert.equal((await call("GET", `inboxes/${i.id}`, null, i.token)).status, 410);
  assert.equal(await store.cleanup(), 1);
});

test("extend adds time; delete removes inbox", async () => {
  const { call } = setup();
  const i = await newInbox(call, { ttl_minutes: 10 });
  const ext = await call("POST", `inboxes/${i.id}/extend`, { ttl_minutes: 60 }, i.token);
  assert.equal(ext.status, 200);
  assert.ok((ext.json as { expires_at: string }).expires_at > i.expires_at);
  assert.equal((await call("DELETE", `inboxes/${i.id}`, null, i.token)).status, 204);
  assert.equal((await call("GET", `inboxes/${i.id}`, null, i.token)).status, 404);
});

test("per-IP create limit", async () => {
  const { call } = setup(2);
  await newInbox(call);
  await newInbox(call);
  assert.equal((await call("POST", "inboxes", {})).status, 429);
  assert.equal((await call("POST", "inboxes", {}, undefined, "2.2.2.2")).status, 201);
});

test("recipients fall back to header To and ignore other domains", () => {
  assert.deepEqual(recipientsOf({ to: { value: [{ address: `X@${DOMAIN}` }, { address: "y@gmail.com" }] } }, [DOMAIN]), [`x@${DOMAIN}`]);
});
