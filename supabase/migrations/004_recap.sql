-- 004: AI recap (signals -> proposals -> reviewed interactions) and "When relevant" as default type.

-- Default reach-out type is purple ("When relevant"); fill existing blanks.
alter table public.contacts alter column type set default 'purple';
update public.contacts set type = 'purple' where type is null;

-- Contacts can now be created from the recap.
alter table public.contacts drop constraint if exists contacts_source_check;
alter table public.contacts add constraint contacts_source_check check (source in ('manual','import','linkedin','gmail','mcp','ai'));

-- Raw evidence from Gmail/Calendar sync. Nothing is logged until reviewed.
create table if not exists public.signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('gmail','calendar')),
  external_id text not null,
  occurred_at timestamptz not null,
  title text,
  detail text,
  participants jsonb not null default '[]', -- [{email, name}]
  processed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, source, external_id)
);
create index if not exists signals_pending_idx on public.signals(user_id, occurred_at desc) where not processed;

-- What the AI suggests logging; you approve, edit, or dismiss.
create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete cascade,
  new_contact jsonb,          -- {name, email, company, position, location, notes, type} when not yet in Cadence
  occurred_at timestamptz not null,
  kind text not null default 'meeting' check (kind in ('email','meeting','manual','call')),
  source text not null check (source in ('gmail','calendar','manual')),
  summary text,
  evidence text,
  confidence real,
  status text not null default 'pending' check (status in ('pending','approved','dismissed')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists proposals_pending_idx on public.proposals(user_id, occurred_at desc) where status = 'pending';

alter table public.signals enable row level security;
alter table public.proposals enable row level security;
create policy own_signals on public.signals for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_proposals on public.proposals for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.user_settings add column if not exists last_recap_at timestamptz;
