-- Cadence schema. Run this in the Supabase SQL editor once for a new project.
-- Tasks are private per-user, E2EE-capable, and synced in realtime.
-- Push subscriptions enable background Web Push when tasks are due.

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  note text,
  strategy text not null default 'converging'
    check (strategy in ('converging', 'exponential')),
  eta_ms bigint not null,
  state text not null default 'waiting'
    check (state in ('waiting', 'due', 'polling', 'snoozed', 'done')),
  attempts int not null default 0,
  next_fire_at bigint not null,
  priority int not null default 0,
  created_at bigint not null,
  updated_at bigint not null,
  completed_at bigint,
  -- E2EE ciphertext for task body (title/note/etc.). When set, plaintext
  -- columns are placeholders except next_fire_at / state (needed for server push).
  enc text,
  -- Last next_fire_at value for which a Web Push was already sent (dedupe).
  notified_fire_at bigint
);

create index if not exists tasks_user_idx on public.tasks (user_id);
create index if not exists tasks_next_fire_idx on public.tasks (user_id, next_fire_at);
create index if not exists tasks_due_push_idx
  on public.tasks (next_fire_at)
  where state <> 'done';

alter table public.tasks enable row level security;

-- The project was created with "expose new tables" disabled, so we must
-- explicitly grant Data API access to logged-in users. RLS below still
-- restricts each user to their own rows.
grant select, insert, update, delete on public.tasks to authenticated;

drop policy if exists "tasks are private" on public.tasks;
create policy "tasks are private"
  on public.tasks
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Enable realtime so mac / phone stay in sync.
do $$
begin
  alter publication supabase_realtime add table public.tasks;
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Web Push subscriptions (one row per browser / device endpoint)
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- Optional: schedule push-due Edge Function every minute (pg_cron + pg_net).
-- Requires project secrets / vault setup — see docs/PUSH.md and migration_push.sql.
-- For a brand-new install you can instead run migration_push.sql after deploying
-- the Edge Function, which enables the cron job with your project URL.
-- ---------------------------------------------------------------------------
