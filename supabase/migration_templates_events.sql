-- E2EE-capable templates and task events. Content is stored only in enc.
create table if not exists public.task_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  enc text not null,
  created_at bigint not null,
  updated_at bigint not null
);
create table if not exists public.task_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  enc text not null,
  created_at bigint not null
);
create index if not exists task_templates_user_idx on public.task_templates(user_id);
create index if not exists task_events_task_idx on public.task_events(task_id, created_at);
alter table public.task_templates enable row level security;
alter table public.task_events enable row level security;
grant select, insert, update, delete on public.task_templates, public.task_events to authenticated, service_role;
drop policy if exists "templates are private" on public.task_templates;
create policy "templates are private" on public.task_templates for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "events are private" on public.task_events;
create policy "events are private" on public.task_events for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
do $$ begin alter publication supabase_realtime add table public.task_templates; exception when duplicate_object then null; end $$;
