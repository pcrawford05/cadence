-- 002: relationship strength 1-7 (replaces LinkedIn level 1-5), LinkedIn import fields, triage inbox.

-- Strength: rename, rescale 1-5 -> 1-7 (1,2,3,4,5 -> 1,3,4,6,7), new bounds.
alter table public.contacts drop constraint if exists contacts_linkedin_strength_check;
alter table public.contacts rename column linkedin_strength to strength;
update public.contacts set strength = round(1 + (strength - 1) * 1.5) where strength is not null;
alter table public.contacts add constraint contacts_strength_check check (strength between 1 and 7);

-- LinkedIn and inbox fields. Existing contacts count as already sorted.
alter table public.contacts
  add column if not exists position text,
  add column if not exists source text not null default 'manual' check (source in ('manual','import','linkedin','gmail','mcp')),
  add column if not exists linkedin_connected_on date,
  add column if not exists triaged_at timestamptz default now();

create index if not exists contacts_inbox_idx on public.contacts(user_id) where triaged_at is null;

alter table public.user_settings
  add column if not exists inbox_daily int not null default 5 check (inbox_daily between 0 and 50);
