-- Cadence: coffee chat CRM schema. Every row is owned by one user; RLS enforces isolation.

create extension if not exists pgcrypto;

create type contact_type as enum ('red','orange','yellow','green','blue','purple');
create type contact_status as enum ('dormant','active','nurture','priority','new');

create table public.allowed_emails (
  email text primary key
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  photo_url text,
  company text,
  linkedin_url text,
  emails text[] not null default '{}',
  phone text,
  location text,
  date_met date,
  type contact_type,
  cadence_days_override int check (cadence_days_override > 0),
  statuses contact_status[] not null default '{}',
  priority_due date,
  linkedin_strength int check (linkedin_strength between 1 and 5),
  notes text,
  snoozed_until date,
  last_contact_at timestamptz,
  created_at timestamptz not null default now()
);
create index contacts_user_idx on public.contacts(user_id);
create index contacts_emails_idx on public.contacts using gin(emails);

create table public.interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  occurred_at timestamptz not null,
  kind text not null check (kind in ('email','meeting','manual','call')),
  source text not null check (source in ('gmail','calendar','manual','mcp','import')),
  summary text,
  external_id text,
  created_at timestamptz not null default now(),
  unique (user_id, source, external_id)
);
create index interactions_contact_idx on public.interactions(contact_id, occurred_at desc);

-- Keep contacts.last_contact_at = latest interaction.
create or replace function public.bump_last_contact() returns trigger language plpgsql as $$
begin
  update public.contacts set last_contact_at = greatest(coalesce(last_contact_at, new.occurred_at), new.occurred_at)
  where id = new.contact_id;
  return new;
end $$;
create trigger interactions_bump after insert on public.interactions
  for each row execute function public.bump_last_contact();

create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cadence jsonb not null default '{"red":14,"orange":30,"yellow":90,"green":180,"blue":365,"purple":null}',
  digest_hour int not null default 8 check (digest_hour between 0 and 23),
  timezone text not null default 'America/Los_Angeles',
  mcp_token_hash text unique,
  google_refresh_token text,          -- encrypted with TOKEN_ENCRYPTION_KEY before storage
  google_email text,
  google_last_sync timestamptz,
  last_digest_date date
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create table public.suggested_contacts (
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  message_count int not null default 1,
  last_seen timestamptz not null,
  dismissed boolean not null default false,
  primary key (user_id, email)
);

alter table public.contacts enable row level security;
alter table public.interactions enable row level security;
alter table public.user_settings enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.suggested_contacts enable row level security;
alter table public.allowed_emails enable row level security; -- no policies: service role only

create policy own_contacts on public.contacts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_interactions on public.interactions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_settings on public.user_settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_push on public.push_subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_suggestions on public.suggested_contacts for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Invite-only: reject signups whose email is not on the allowlist.
create or replace function public.enforce_allowlist() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.allowed_emails where lower(email) = lower(new.email)) then
    raise exception 'This email is not invited';
  end if;
  return new;
end $$;
create trigger on_auth_user_allowlist before insert on auth.users
  for each row execute function public.enforce_allowlist();

create or replace function public.init_user_settings() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_settings(user_id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.init_user_settings();

-- Private photo bucket; files stored under <user_id>/<contact_id>.
insert into storage.buckets (id, name, public) values ('photos', 'photos', false) on conflict do nothing;
create policy own_photos on storage.objects for all
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
