-- Yield schema. Run this in the Supabase SQL editor once.
-- Tasks are private per-user and synced in realtime.

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
  enc text
);

create index if not exists tasks_user_idx on public.tasks (user_id);
create index if not exists tasks_next_fire_idx on public.tasks (user_id, next_fire_at);

alter table public.tasks enable row level security;

-- The project was created with "expose new tables" disabled, so we must
-- explicitly grant Data API access to logged-in users. RLS below still
-- restricts each user to their own rows.
grant select, insert, update, delete on public.tasks to authenticated;

-- Each user can only see and mutate their own tasks.
drop policy if exists "tasks are private" on public.tasks;
create policy "tasks are private"
  on public.tasks
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Enable realtime so mac / phone stay in sync.
alter publication supabase_realtime add table public.tasks;
