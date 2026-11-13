# WinPlayBox Temp Mail

Disposable, receive-only inboxes at **https://temp-mail.winplaybox.in** — addresses look like
`brisk.otter421@temp-mail.winplaybox.in`.

```
Sender ─► MX temp-mail.winplaybox.in → ForwardEmail (free, catch-all)
             └─► POST https://temp-mail.winplaybox.in/api/ingest/<secret>   (retries for days if we're down)
                    └─► Supabase RPC tm_ingest → tm_messages / tm_attachments
                                               └─► Realtime "new_mail" ping → open tab refetches instantly
Browser ─► Next.js (pages + /api/*) on Hostinger Node.js ─► Supabase RPCs (tm_*)
Supabase pg_cron (10 min) ─► tm_cleanup_expired()
GitHub Actions (hourly) ─► Python worker: cleanup, stats, health, end-to-end self-test
```

| Folder | What | Runs on |
|---|---|---|
| `web/` | Next.js 15 site + API routes + mail webhook | Hostinger Node.js (always on, no cold start) |
| `worker-py/` | Python maintenance worker | GitHub Actions, hourly |
| `supabase/` | `tm_` schema, secure RPCs, cron | Supabase project `winplayboxsite` |

## Features
- Address ready on page load; copy, QR code, new address, choose your own name, delete
- Lifetime 10 min / 1 hour / 1 day, add time anytime (max 7 days), postmark countdown
- Several saved addresses per browser with quick switching
- Instant delivery via Realtime, 10 s polling fallback
- Verification-code detection with one-tap copy (list and reader)
- HTML mail in a sandboxed frame: scripts never run, tracking images blocked until allowed
- Attachments (5 MB each, 10 MB per mail) with direct download
- Browser notifications + unread count in the tab title
- English / हिन्दी, light / dark, mobile-first, keyboard and screen-reader friendly
- Rate limits per hashed IP, reserved names, receive-only, privacy + terms pages, SEO + FAQ schema, optional AdSense

## Security
- `tm_` tables have RLS on with no policies — the public key can't read them.
- All access goes through `SECURITY DEFINER` functions that require the server secret
  (only its SHA-256 is in the DB) **and**, for inbox data, the inbox token (only its SHA-256 is stored).
- The token lives in the visitor's browser; nothing else can open an inbox.
- The webhook path carries its own secret; unknown recipients are accepted and dropped.

## Local development
```bash
cd web && npm install
TEMPMAIL_DEV_MEMORY=1 NEXT_PUBLIC_DEV=1 npm run dev   # in-memory store, "Send test mail" button
npm test                                              # service + OTP tests

cd ../worker-py && pip install -r requirements.txt pytest && pytest
```

Deploy and operations: [docs/DEPLOY.md](docs/DEPLOY.md).
