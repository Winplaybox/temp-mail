# Deploy & operations

## 1. Supabase (`winplayboxsite` project)
1. Run `supabase/migrations/0001_tm_schema.sql` (tables, RPCs, cron, seed domain).
2. Store the hash of the server secret (never the secret itself):
   ```sql
   insert into public.tm_config (key, value)
   values ('server_secret_sha256', encode(extensions.digest('<TEMPMAIL_SERVER_SECRET>', 'sha256'), 'hex'))
   on conflict (key) do update set value = excluded.value;
   ```
   (Or compute the SHA-256 locally and insert the hex string.)
3. Realtime → keep public broadcast allowed (only content-free "new mail" pings are sent).

## 2. Website on Hostinger
- Website: `temp-mail.winplaybox.in`, Node.js app, deployed from GitHub `Winplaybox/temp-mail` `main`,
  root directory `web`, Node 22, framework Next.js. Every push to `main` redeploys.
- Environment variables: see `web/.env.example`. `NEXT_PUBLIC_*` are build-time — redeploy after changing.

## 3. Mail routing (DNS on Hostinger)
Each mail domain gets two MX records and one TXT record at its name:

| Mail domain | DNS zone | Record name |
|---|---|---|
| `buzzstormnow.com` | buzzstormnow.com | `@` (whole domain — its Hostinger mailboxes no longer receive) |

Use whole domains only: ForwardEmail's free plan covers catch-all on a domain, while subdomains need a paid plan.

| Type | Value | Priority |
|---|---|---|
| MX | `mx1.forwardemail.net` | 10 |
| MX | `mx2.forwardemail.net` | 10 |
| TXT | `forward-email=https://temp-mail.winplaybox.in/api/ingest/<TEMPMAIL_INGEST_SECRET>?raw=false` | – |

Then `insert into public.tm_domains (domain) values ('<mail domain>');`. Disable one with
`update public.tm_domains set is_active = false where domain = '<mail domain>';` — saved addresses on it
are dropped from visitors' browsers on their next visit.

## 4. GitHub Actions secrets (optional — repo → Settings → Secrets → Actions)
Without them the hourly worker still checks site health and address create/delete; cleanup runs in pg_cron anyway.
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `TEMPMAIL_SERVER_SECRET`, `TEMPMAIL_INGEST_SECRET` — used by the hourly
Python worker (`.github/workflows/cron.yml`). Run it manually from the Actions tab after setup.

## Checks
- `https://temp-mail.winplaybox.in/api/health` → `{"ok":true,...}`
- Send a mail from Gmail to the address on the page — it should appear within seconds.
- Actions → "Maintenance (Python worker)" → summary shows cleanup, stats, health and self-test.

## Rotating secrets
- Server secret: update Hostinger env + GitHub secret, then update `tm_config.server_secret_sha256`.
- Ingest secret: update Hostinger env + GitHub secret + the TXT record together.

## Limits to watch
- Supabase free: 500 MB database (attachments are stored in it and deleted on expiry).
- ForwardEmail free: catch-all to webhook, 50 MB per message, spam filtering on.
- Some sites block disposable domains; add more domains later by inserting into `tm_domains` and
  pointing their MX/TXT the same way.
