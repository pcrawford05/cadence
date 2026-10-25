-- 005: custom daily reminders, e.g. "Apply for 5 jobs". [{id, text, done_on}] where done_on is the local date it was checked.
alter table public.user_settings add column if not exists reminders jsonb not null default '[]';
