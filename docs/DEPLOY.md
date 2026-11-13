# Deploy guide

Order matters: Supabase → mail domain on Cloudflare → worker → backend → website → cron.

## 0. Buy a mail domain
Pick a cheap domain only for addresses (e.g. `wpbmail.xyz`). Keep `winplaybox.in` on Hostinger as is.
Add the new domain to **Cloudflare** (free plan) and switch its nameservers to the two Cloudflare gives you.

## 1. Supabase
1. Create a project (region: Mumbai `ap-south-1`).
2. SQL editor → run `supabase/migrations/0001_init.sql`.
3. Add your domain:
   ```sql
   insert into public.domains (domain, is_default) values ('wpbmail.xyz', true);
   ```
4. Project Settings → API → copy **Project URL**, **anon key**, **service_role key**.
5. Realtime → Settings: keep "Allow public access" on (only content-free "new mail" pings are sent).

## 2. Cloudflare Email Worker
```bash
cd worker
npm install
# edit wrangler.toml → SUPABASE_URL
npx wrangler login
npx wrangler secret put SUPABASE_SERVICE_KEY
npx wrangler deploy
```
Cloudflare dashboard → your mail domain → **Email → Email Routing** → enable (it adds MX + SPF records) →
**Routing rules → Catch-all address → Action: Send to a Worker → `wpb-temp-mail-ingest`** → Save.

## 3. Backend on Render
Render → **New → Blueprint** → pick this repo (uses `render.yaml`). Fill:
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- `ALLOWED_ORIGINS` = `https://temp-mail.winplaybox.in`
- `IP_SALT`, `CRON_SECRET` are generated — copy `CRON_SECRET` for step 5.

Check: `https://<service>.onrender.com/api/health` → `{"ok":true}`.

## 4. Website on Hostinger (temp-mail.winplaybox.in)
hPanel → **Websites → Add website → Node.js app** → domain `temp-mail.winplaybox.in`
(Hostinger creates the subdomain + DNS).
- Source: GitHub → `Winplaybox/temp-mail`, branch `main`
- Root directory: `web`
- Build: `npm run build` · Start: `npm start` · Node 22
- Environment variables (copy from `web/.env.example`):
  - `NEXT_PUBLIC_API_URL` = Render URL
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_SITE_URL` = `https://temp-mail.winplaybox.in`
  - `NEXT_PUBLIC_ADSENSE_CLIENT` (optional)

`NEXT_PUBLIC_*` values are baked in at build time — redeploy after changing them.

If the Hostinger form has no "root directory" option, deploy a branch that contains only `web/`
(`git subtree push --prefix web origin web-deploy`) and point Hostinger at `web-deploy`.

## 5. Cleanup + keep-warm cron
Supabase → Database → Extensions → enable `pg_cron` and `pg_net`.
Open `supabase/migrations/0002_cron.sql`, replace the Render URL and `YOUR_CRON_SECRET`, run it.
Check later: `select * from cron.job_run_details order by start_time desc limit 5;`

## 6. Test end to end
1. Open https://temp-mail.winplaybox.in → copy the address.
2. Send a mail to it from Gmail → it appears within a few seconds ("Live" dot is green).
3. Try a real sign-up OTP (e.g. a newsletter) → code chip appears.

## Adding more domains later
Add the domain to Cloudflare, enable Email Routing with the same catch-all → worker,
then `insert into public.domains (domain) values ('newdomain.xyz');`. It shows up in "Choose name".

## Free-tier limits to watch
- Supabase free: 500 MB database, 1 GB storage; project pauses after 7 days with no traffic.
- Render free: sleeps after 15 min idle; the 10-minute cron keeps it awake (~720 h/month, within the 750 h limit).
- Cloudflare Email Routing: max 25 MB per message (worker rejects > 10 MB by default).
