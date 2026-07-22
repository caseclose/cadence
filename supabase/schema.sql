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
  initial_eta_ms bigint,
  state text not null default 'waiting'
    check (state in ('waiting', 'due', 'polling', 'snoozed', 'done')),
  attempts int not null default 0,
  next_fire_at bigint not null,
  priority int not null default 0,
  created_at bigint not null,
  updated_at bigint not null,
  completed_at bigint,
  -- E2EE ciphertext for task body (title/note/etc.). When set, plaintext
  -- columns are placeholders except next_fire_at / state (needed for server push);
  -- webhook_title / webhook_note are populated only when Webhook plaintext is enabled.
  enc text,
  -- Optional plaintext mirror used only by explicitly enabled Webhooks.
  webhook_title text,
  webhook_note text,
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
-- service_role is used by the push-due Edge Function (bypasses RLS but still
-- needs table privileges).
grant select, insert, update, delete on public.tasks to authenticated, service_role;

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

grant select, insert, update, delete on public.push_subscriptions to authenticated, service_role;

drop policy if exists "push subscriptions are private" on public.push_subscriptions;
create policy "push subscriptions are private"
  on public.push_subscriptions
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- China-friendly chat webhooks (Feishu / WeCom / DingTalk)
-- ---------------------------------------------------------------------------

create table if not exists public.notification_webhooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null
    check (provider in ('feishu', 'wecom', 'dingtalk')),
  url text not null,
  -- Optional signing secret (钉钉 SEC / 飞书签名校验)
  secret text,
  enabled boolean not null default true,
  include_content boolean not null default false,
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint,
  updated_at bigint not null default (extract(epoch from now()) * 1000)::bigint,
  unique (user_id, provider)
);

create index if not exists notification_webhooks_user_idx
  on public.notification_webhooks (user_id);

alter table public.notification_webhooks enable row level security;

grant select, insert, update, delete on public.notification_webhooks to authenticated, service_role;

drop policy if exists "notification webhooks are private" on public.notification_webhooks;
create policy "notification webhooks are private"
  on public.notification_webhooks
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


-- E2EE task templates and task events used by client-side analytics.
create table if not exists public.task_templates (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  enc text not null, created_at bigint not null, updated_at bigint not null
);
create table if not exists public.task_events (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  enc text not null, created_at bigint not null
);
create index if not exists task_templates_user_idx on public.task_templates(user_id);
create index if not exists task_events_task_idx on public.task_events(task_id, created_at);
alter table public.task_templates enable row level security;
alter table public.task_events enable row level security;
grant select, insert, update, delete on public.task_templates, public.task_events to authenticated, service_role;
create policy "templates are private" on public.task_templates for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "events are private" on public.task_events for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
