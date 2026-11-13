-- Every 10 minutes Supabase calls the Python API's cleanup endpoint.
-- This both deletes expired inboxes (with their attachment files) and keeps the
-- free Render service awake, without spending GitHub Actions minutes.
--
-- Before running: enable the "pg_cron" and "pg_net" extensions
-- (Dashboard → Database → Extensions), then replace the two placeholders below.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('tempmail-cleanup')
where exists (select 1 from cron.job where jobname = 'tempmail-cleanup');

select cron.schedule(
  'tempmail-cleanup',
  '*/10 * * * *',
  $$
  select net.http_post(
    url     := 'https://YOUR-RENDER-SERVICE.onrender.com/internal/cleanup',
    headers := jsonb_build_object('X-Cron-Secret', 'YOUR_CRON_SECRET', 'Content-Type', 'application/json'),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- Safety net: if the API is down for a long time, drop inboxes expired > 1 day ago
-- so the database never fills up. Attachment files of those inboxes stay in
-- Storage (orphaned) — check Storage usage if the API was down for days.
select cron.unschedule('tempmail-hard-expire')
where exists (select 1 from cron.job where jobname = 'tempmail-hard-expire');

select cron.schedule(
  'tempmail-hard-expire',
  '17 * * * *',
  $$ delete from public.inboxes where expires_at < now() - interval '1 day'; $$
);
