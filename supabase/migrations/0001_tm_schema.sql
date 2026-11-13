-- WinPlayBox Temp Mail — lives inside the shared "winplayboxsite" Supabase project.
-- Every object is prefixed tm_ so it never clashes with other WinPlayBox tables.
--
-- Security model
--   * RLS is ON for every tm_ table with NO policies: the anon/publishable key reads nothing directly.
--   * The website server calls SECURITY DEFINER functions (tm_*) through PostgREST with the anon key
--     AND a server secret. The secret's SHA-256 is stored in tm_config; the secret itself lives only
--     in the server's environment variables.
--   * Inboxes are unlocked by a per-inbox token; the DB stores only its SHA-256.

create extension if not exists pgcrypto with schema extensions;

-- ------------------------------------------------------------------ tables
create table if not exists public.tm_config (
  key   text primary key,
  value text not null
);

create table if not exists public.tm_domains (
  domain     text primary key check (domain = lower(domain)),
  is_active  boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.tm_inboxes (
  id          uuid primary key default gen_random_uuid(),
  local_part  text not null check (local_part ~ '^[a-z0-9][a-z0-9._-]{2,30}[a-z0-9]$'),
  domain      text not null references public.tm_domains(domain) on update cascade,
  address     text generated always as (local_part || '@' || domain) stored,
  token_hash  text not null,
  is_custom   boolean not null default false,
  ip_hash     text,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  unique (local_part, domain)
);
create index if not exists tm_inboxes_expires_idx on public.tm_inboxes (expires_at);
create index if not exists tm_inboxes_ip_idx on public.tm_inboxes (ip_hash, created_at);

create table if not exists public.tm_messages (
  id              uuid primary key default gen_random_uuid(),
  inbox_id        uuid not null references public.tm_inboxes(id) on delete cascade,
  from_address    text,
  from_name       text,
  subject         text,
  text_body       text,
  html_body       text,
  otp             text,
  size_bytes      integer not null default 0,
  has_attachments boolean not null default false,
  received_at     timestamptz not null default now(),
  read_at         timestamptz
);
create index if not exists tm_messages_inbox_idx on public.tm_messages (inbox_id, received_at desc);

create table if not exists public.tm_attachments (
  id           uuid primary key default gen_random_uuid(),
  message_id   uuid not null references public.tm_messages(id) on delete cascade,
  inbox_id     uuid not null references public.tm_inboxes(id) on delete cascade,
  filename     text not null,
  content_type text,
  size_bytes   integer not null default 0,
  data         bytea not null
);
create index if not exists tm_attachments_message_idx on public.tm_attachments (message_id);
create index if not exists tm_attachments_inbox_idx on public.tm_attachments (inbox_id);

alter table public.tm_config      enable row level security;
alter table public.tm_domains     enable row level security;
alter table public.tm_inboxes     enable row level security;
alter table public.tm_messages    enable row level security;
alter table public.tm_attachments enable row level security;
revoke all on public.tm_config, public.tm_domains, public.tm_inboxes, public.tm_messages, public.tm_attachments
  from anon, authenticated;

-- ------------------------------------------------------------------ guards
create or replace function public.tm_assert_server(p_secret text)
returns void language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if p_secret is null or not exists (
    select 1 from public.tm_config
    where key = 'server_secret_sha256' and value = encode(extensions.digest(p_secret, 'sha256'), 'hex')
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end $$;

-- returns the inbox row or raises not_found / expired
create or replace function public.tm_open_inbox(p_id uuid, p_token_hash text)
returns public.tm_inboxes language plpgsql stable security definer set search_path = public as $$
declare r public.tm_inboxes;
begin
  select * into r from public.tm_inboxes where id = p_id;
  if not found or r.token_hash <> p_token_hash then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if r.expires_at <= now() then
    raise exception 'expired' using errcode = 'P0003';
  end if;
  return r;
end $$;

create or replace function public.tm_inbox_json(r public.tm_inboxes)
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'id', r.id, 'address', r.address, 'domain', r.domain, 'is_custom', r.is_custom,
    'created_at', r.created_at, 'expires_at', r.expires_at)
$$;

-- ------------------------------------------------------------------ API functions
create or replace function public.tm_list_domains(p_secret text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.tm_assert_server(p_secret);
  return coalesce((
    select jsonb_agg(jsonb_build_object('domain', domain, 'is_default', is_default) order by is_default desc, domain)
    from public.tm_domains where is_active), '[]'::jsonb);
end $$;

create or replace function public.tm_create_inbox(
  p_secret text, p_local_part text, p_domain text, p_token_hash text, p_is_custom boolean,
  p_ip_hash text, p_ttl_minutes integer, p_max_per_hour integer)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare r public.tm_inboxes;
begin
  perform public.tm_assert_server(p_secret);
  if p_ttl_minutes not in (10, 60, 1440) then
    raise exception 'bad_ttl' using errcode = '22023';
  end if;
  if not exists (select 1 from public.tm_domains where domain = p_domain and is_active) then
    raise exception 'bad_domain' using errcode = '22023';
  end if;
  if p_ip_hash is not null and (
    select count(*) from public.tm_inboxes where ip_hash = p_ip_hash and created_at > now() - interval '1 hour'
  ) >= p_max_per_hour then
    raise exception 'rate_limited' using errcode = 'P0004';
  end if;
  begin
    insert into public.tm_inboxes (local_part, domain, token_hash, is_custom, ip_hash, expires_at)
    values (p_local_part, p_domain, p_token_hash, p_is_custom, p_ip_hash, now() + make_interval(mins => p_ttl_minutes))
    returning * into r;
  exception when unique_violation then
    raise exception 'taken' using errcode = 'P0005';
  end;
  return public.tm_inbox_json(r);
end $$;

create or replace function public.tm_get_inbox(p_secret text, p_id uuid, p_token_hash text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.tm_assert_server(p_secret);
  return public.tm_inbox_json(public.tm_open_inbox(p_id, p_token_hash));
end $$;

create or replace function public.tm_extend_inbox(
  p_secret text, p_id uuid, p_token_hash text, p_minutes integer, p_max_life_minutes integer)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare r public.tm_inboxes;
begin
  perform public.tm_assert_server(p_secret);
  if p_minutes not in (10, 60, 1440) then
    raise exception 'bad_ttl' using errcode = '22023';
  end if;
  r := public.tm_open_inbox(p_id, p_token_hash);
  update public.tm_inboxes
     set expires_at = least(greatest(expires_at, now()) + make_interval(mins => p_minutes),
                            created_at + make_interval(mins => p_max_life_minutes))
   where id = p_id
   returning * into r;
  return public.tm_inbox_json(r);
end $$;

create or replace function public.tm_delete_inbox(p_secret text, p_id uuid, p_token_hash text)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.tm_assert_server(p_secret);
  delete from public.tm_inboxes where id = p_id and token_hash = p_token_hash;
end $$;

create or replace function public.tm_list_messages(p_secret text, p_id uuid, p_token_hash text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r public.tm_inboxes;
begin
  perform public.tm_assert_server(p_secret);
  r := public.tm_open_inbox(p_id, p_token_hash);
  return jsonb_build_object(
    'expires_at', r.expires_at,
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'from_address', m.from_address, 'from_name', m.from_name,
        'subject', coalesce(nullif(m.subject, ''), '(no subject)'),
        'preview', left(regexp_replace(coalesce(m.text_body, ''), '\s+', ' ', 'g'), 160),
        'otp', m.otp, 'has_attachments', m.has_attachments,
        'received_at', m.received_at, 'read', m.read_at is not null) order by m.received_at desc)
      from (select * from public.tm_messages where inbox_id = r.id order by received_at desc limit 100) m), '[]'::jsonb));
end $$;

create or replace function public.tm_get_message(p_secret text, p_id uuid, p_token_hash text, p_message_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare r public.tm_inboxes; m public.tm_messages;
begin
  perform public.tm_assert_server(p_secret);
  r := public.tm_open_inbox(p_id, p_token_hash);
  update public.tm_messages set read_at = coalesce(read_at, now())
   where id = p_message_id and inbox_id = r.id
   returning * into m;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return jsonb_build_object(
    'id', m.id, 'from_address', m.from_address, 'from_name', m.from_name,
    'subject', coalesce(nullif(m.subject, ''), '(no subject)'),
    'text', m.text_body, 'html', m.html_body, 'otp', m.otp, 'size_bytes', m.size_bytes,
    'received_at', m.received_at,
    'attachments', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'filename', a.filename,
                                          'content_type', a.content_type, 'size_bytes', a.size_bytes))
      from public.tm_attachments a where a.message_id = m.id), '[]'::jsonb));
end $$;

create or replace function public.tm_delete_message(p_secret text, p_id uuid, p_token_hash text, p_message_id uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
declare r public.tm_inboxes;
begin
  perform public.tm_assert_server(p_secret);
  r := public.tm_open_inbox(p_id, p_token_hash);
  delete from public.tm_messages where id = p_message_id and inbox_id = r.id;
end $$;

create or replace function public.tm_get_attachment(p_secret text, p_id uuid, p_token_hash text, p_attachment_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r public.tm_inboxes; a public.tm_attachments;
begin
  perform public.tm_assert_server(p_secret);
  r := public.tm_open_inbox(p_id, p_token_hash);
  select * into a from public.tm_attachments where id = p_attachment_id and inbox_id = r.id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return jsonb_build_object('filename', a.filename, 'content_type', a.content_type,
                            'data', encode(a.data, 'base64'));
end $$;

-- Called by the inbound-mail webhook. Returns the new message id, or null when the
-- recipient has no active inbox (the mail is dropped, the sender is not retried).
create or replace function public.tm_ingest(
  p_secret text, p_recipient text, p_from_address text, p_from_name text, p_subject text,
  p_text text, p_html text, p_otp text, p_size_bytes integer, p_attachments jsonb)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare v_inbox uuid; v_msg uuid; v_count int; att jsonb;
begin
  perform public.tm_assert_server(p_secret);
  select id into v_inbox from public.tm_inboxes
   where address = lower(p_recipient) and expires_at > now();
  if v_inbox is null then
    return null;
  end if;

  -- keep the newest 100 mails per inbox
  select count(*) into v_count from public.tm_messages where inbox_id = v_inbox;
  if v_count >= 100 then
    delete from public.tm_messages where id in (
      select id from public.tm_messages where inbox_id = v_inbox order by received_at asc limit v_count - 99);
  end if;

  insert into public.tm_messages (inbox_id, from_address, from_name, subject, text_body, html_body, otp,
                                  size_bytes, has_attachments)
  values (v_inbox, left(p_from_address, 320), left(p_from_name, 200), left(p_subject, 500),
          left(p_text, 300000), case when length(p_html) <= 1000000 then p_html end, left(p_otp, 32),
          coalesce(p_size_bytes, 0), jsonb_array_length(coalesce(p_attachments, '[]'::jsonb)) > 0)
  returning id into v_msg;

  for att in select * from jsonb_array_elements(coalesce(p_attachments, '[]'::jsonb)) loop
    insert into public.tm_attachments (message_id, inbox_id, filename, content_type, size_bytes, data)
    values (v_msg, v_inbox, left(coalesce(att->>'filename', 'attachment'), 200), att->>'content_type',
            coalesce((att->>'size_bytes')::int, 0), decode(att->>'data', 'base64'));
  end loop;

  -- content-free ping so an open browser tab refetches immediately
  perform realtime.send(jsonb_build_object('id', v_msg), 'new_mail', 'inbox:' || v_inbox::text, false);
  return v_msg;
end $$;

create or replace function public.tm_cleanup_expired()
returns integer language plpgsql volatile security definer set search_path = public as $$
declare n int;
begin
  delete from public.tm_inboxes where expires_at < now();
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.tm_cleanup(p_secret text)
returns integer language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.tm_assert_server(p_secret);
  return public.tm_cleanup_expired();
end $$;

create or replace function public.tm_stats(p_secret text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.tm_assert_server(p_secret);
  return jsonb_build_object(
    'active_inboxes', (select count(*) from public.tm_inboxes where expires_at > now()),
    'inboxes_24h',    (select count(*) from public.tm_inboxes where created_at > now() - interval '24 hours'),
    'messages_24h',   (select count(*) from public.tm_messages where received_at > now() - interval '24 hours'),
    'stored_mb',      round(((select coalesce(sum(size_bytes), 0) from public.tm_messages)::numeric / 1048576), 2));
end $$;

-- ------------------------------------------------------------------ grants
do $$
declare f text;
begin
  foreach f in array array[
    'tm_list_domains(text)',
    'tm_create_inbox(text,text,text,text,boolean,text,integer,integer)',
    'tm_get_inbox(text,uuid,text)',
    'tm_extend_inbox(text,uuid,text,integer,integer)',
    'tm_delete_inbox(text,uuid,text)',
    'tm_list_messages(text,uuid,text)',
    'tm_get_message(text,uuid,text,uuid)',
    'tm_delete_message(text,uuid,text,uuid)',
    'tm_get_attachment(text,uuid,text,uuid)',
    'tm_ingest(text,text,text,text,text,text,text,text,integer,jsonb)',
    'tm_cleanup(text)',
    'tm_stats(text)'
  ] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated, service_role', f);
  end loop;
  -- internal helpers: never callable over the API
  revoke all on function public.tm_assert_server(text) from public, anon, authenticated;
  revoke all on function public.tm_open_inbox(uuid, text) from public, anon, authenticated;
  revoke all on function public.tm_cleanup_expired() from public, anon, authenticated;
end $$;

-- ------------------------------------------------------------------ schedule: delete expired inboxes every 10 min
select cron.unschedule('tm-cleanup') where exists (select 1 from cron.job where jobname = 'tm-cleanup');
select cron.schedule('tm-cleanup', '*/10 * * * *', $$ select public.tm_cleanup_expired(); $$);

-- ------------------------------------------------------------------ seed
insert into public.tm_domains (domain, is_default) values ('temp-mail.winplaybox.in', true)
on conflict (domain) do nothing;

-- Server secret (run once, separately — never commit the secret):
-- insert into public.tm_config (key, value) values ('server_secret_sha256', '<sha256 hex of TEMPMAIL_SERVER_SECRET>')
-- on conflict (key) do update set value = excluded.value;
