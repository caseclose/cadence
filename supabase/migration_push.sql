-- Migration: Web Push support for existing Cadence databases.
-- Run once in the Supabase SQL Editor AFTER deploying the push-due Edge Function.
-- See docs/PUSH.md for full setup (VAPID keys, secrets, cron).

-- 1) Dedup column on tasks
alter table public.tasks
  add column if not exists notified_fire_at bigint;

create index if not exists tasks_due_push_idx
  on public.tasks (next_fire_at)
  where state <> 'done';

-- 2) Push subscription table
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint,
  unique (endpoint)
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

grant select, insert, update, delete on public.push_subscriptions to authenticated;

drop policy if exists "push subscriptions are private" on public.push_subscriptions;
create policy "push subscriptions are private"
  on public.push_subscriptions
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3) Extensions for scheduled HTTP calls (Supabase Dashboard: Database → Extensions
--    if CREATE EXTENSION fails due to permissions).
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;

-- 4) Cron: every minute POST to the push-due Edge Function.
--    REPLACE the placeholders below with your project refs before running:
--
--    PROJECT_REF  → e.g. yqmgwwyhrbulesxrncsb
--    SERVICE_ROLE → Settings → API → service_role (secret) key
--
--    Or store the key in Vault and reference it (recommended for production).

-- Unschedule previous job if re-running this migration.
select cron.unschedule(jobid)
from cron.job
where jobname = 'cadence-push-due'
limit 1;

select cron.schedule(
  'cadence-push-due',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://PROJECT_REF.supabase.co/functions/v1/push-due',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer SERVICE_ROLE_KEY_HERE'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- After editing placeholders, verify with:
--   select * from cron.job where jobname = 'cadence-push-due';
--   select * from cron.job_run_details order by start_time desc limit 10;
