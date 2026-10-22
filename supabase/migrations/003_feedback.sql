-- 003: in-app feedback. Saved first, then emailed; the row records whether the email went out.
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  email text,
  kind text not null default 'idea' check (kind in ('idea','bug','other')),
  message text not null check (length(message) between 1 and 5000),
  page text,
  user_agent text,
  emailed boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.feedback enable row level security;
-- Users can submit and see their own feedback only.
create policy own_feedback_insert on public.feedback for insert with check (user_id = auth.uid());
create policy own_feedback_select on public.feedback for select using (user_id = auth.uid());
-- Lets the app mark a submission as emailed after sending.
create policy own_feedback_update on public.feedback for update using (user_id = auth.uid()) with check (user_id = auth.uid());
