# WinPlayBox Temp Mail

Disposable, receive-only inboxes at **temp-mail.winplaybox.in**.

```
Sender ──► MX (Cloudflare, mail domain e.g. wpbmail.xyz)
          └─► Email Routing catch-all ─► worker/ (parse) ─► Supabase (Postgres + Storage)
                                                     └─► Realtime broadcast "new_mail"
Browser (web/, Next.js on Hostinger) ──► backend/ (FastAPI on Render) ──► Supabase
        └── listens to Realtime ping → refetches inbox
Supabase pg_cron (every 10 min) ──► backend /internal/cleanup (deletes expired + keeps Render awake)
```

| Folder | What | Runs on |
|---|---|---|
| `web/` | Next.js 15 site — inbox UI, SEO pages, en/hi, dark mode | Hostinger Node.js |
| `backend/` | FastAPI — inboxes, messages, attachments, rate limits, cleanup | Render (free) |
| `worker/` | Cloudflare Email Worker — stores incoming mail | Cloudflare (free) |
| `supabase/` | SQL migrations — schema, RLS, storage bucket, cron | Supabase (free) |

## Features
- Random address on page load; copy, QR code, new address, custom name, delete
- Choose lifetime (10 min / 1 hour / 1 day) and add time; postmark countdown
- Several saved addresses per browser, quick switch
- Instant delivery (Realtime) with 10 s polling fallback
- Verification-code detection with one-tap copy
- HTML mail in a sandboxed frame, scripts never run, tracking images blocked until allowed
- Attachments (signed, 2-minute download links)
- Browser notifications + unread count in tab title
- English / हिन्दी, light / dark, mobile-first
- Rate limits per IP (hashed), reserved names, receive-only
- Privacy + Terms pages, sitemap, robots, FAQ structured data, optional AdSense

## Security model
- Every table has RLS on with **no policies** → the public anon key can't read anything.
- Only the backend and worker use the `service_role` key, server-side.
- Each inbox has a random 256-bit token kept in the browser; the DB stores only its SHA-256.
- IPs are stored only as salted hashes, for rate limiting.

## Local development
```bash
# API with in-memory store (no Supabase needed)
cd backend && pip install -r requirements.txt
DEV_MODE=1 uvicorn app.main:app --reload --port 8000

# Website
cd web && npm install
NEXT_PUBLIC_API_URL=http://localhost:8000 NEXT_PUBLIC_DEV=1 npm run dev
# → http://localhost:3000, use "Send test mail" to simulate a message
```

Tests: `cd backend && pytest` · `cd worker && npm test`

Deploy: see [docs/DEPLOY.md](docs/DEPLOY.md).
