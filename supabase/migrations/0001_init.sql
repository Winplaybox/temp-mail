-- WinPlayBox Temp Mail — initial schema
-- Run in Supabase SQL editor (or `supabase db push`).
-- Security model: RLS is ON for every table with NO policies, so the anon key
-- can read nothing. Only the Python backend and the Cloudflare Worker (both
-- using the service_role key, server-side) touch data.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- domains
create table if not exists public.domains (
  id          smallserial primary key,
  domain      text not null unique check (domain = lower(domain)),
  is_active   boolean not null default true,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- inboxes
create table if not exists public.inboxes (
  id            uuid primary key default gen_random_uuid(),
  local_part    text not null check (local_part ~ '^[a-z0-9][a-z0-9._-]{2,30}[a-z0-9]$'),
  domain        text not null references public.domains(domain) on update cascade,
  address       text generated always as (local_part || '@' || domain) stored,
  token_hash    text not null,             -- sha256(inbox token), token never stored
  is_custom     boolean not null default false,
  ip_hash       text,                      -- sha256(ip + salt), for rate limiting only
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  constraint inboxes_address_unique unique (local_part, domain)
);
create index if not exists inboxes_expires_idx on public.inboxes (expires_at);
create index if not exists inboxes_ip_created_idx on public.inboxes (ip_hash, created_at);
create index if not exists inboxes_address_idx on public.inboxes (address);

-- ---------------------------------------------------------------- messages
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  inbox_id        uuid not null references public.inboxes(id) on delete cascade,
  from_address    text,
  from_name       text,
  subject         text,
  text_body       text,
  html_body       text,
  otp             text,                    -- best-guess verification code
  size_bytes      integer not null default 0,
  has_attachments boolean not null default false,
  received_at     timestamptz not null default now(),
  read_at         timestamptz
);
create index if not exists messages_inbox_received_idx on public.messages (inbox_id, received_at desc);

-- ---------------------------------------------------------------- attachments
create table if not exists public.attachments (
  id            uuid primary key default gen_random_uuid(),
  message_id    uuid not null references public.messages(id) on delete cascade,
  inbox_id      uuid not null references public.inboxes(id) on delete cascade,
  filename      text not null,
  content_type  text,
  size_bytes    integer not null default 0,
  storage_path  text not null
);
create index if not exists attachments_message_idx on public.attachments (message_id);

-- ---------------------------------------------------------------- RLS (deny all to anon/authenticated)
alter table public.domains     enable row level security;
alter table public.inboxes     enable row level security;
alter table public.messages    enable row level security;
alter table public.attachments enable row level security;

-- ---------------------------------------------------------------- storage bucket (private)
insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 10485760)
on conflict (id) do nothing;

-- ---------------------------------------------------------------- helper: inbox lookup used by the worker
create or replace function public.active_inbox_for(addr text)
returns table (id uuid, expires_at timestamptz)
language sql stable security definer set search_path = public as $$
  select i.id, i.expires_at from public.inboxes i
  where i.address = lower(addr) and i.expires_at > now()
  limit 1;
$$;
revoke all on function public.active_inbox_for(text) from public, anon, authenticated;

-- ---------------------------------------------------------------- stats view for admin
create or replace view public.stats_today as
select
  (select count(*) from public.inboxes where created_at > now() - interval '24 hours') as inboxes_24h,
  (select count(*) from public.messages where received_at > now() - interval '24 hours') as messages_24h,
  (select count(*) from public.inboxes where expires_at > now()) as active_inboxes;
revoke all on public.stats_today from anon, authenticated;

-- ---------------------------------------------------------------- seed your email domain(s)
-- Replace with the domain you bought and connected to Cloudflare Email Routing.
-- insert into public.domains (domain, is_default) values ('wpbmail.xyz', true);
