-- Track each reminder destination independently so one successful channel cannot
-- suppress retries for another channel that failed.
create table if not exists public.notification_deliveries (
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  fire_at bigint not null,
  channel_id text not null,
  delivered_at timestamptz not null default now(),
  primary key (task_id, fire_at, channel_id)
);

create index if not exists notification_deliveries_user_idx
  on public.notification_deliveries (user_id, delivered_at desc);

alter table public.notification_deliveries enable row level security;
grant select on public.notification_deliveries to authenticated;
grant select, insert, update, delete on public.notification_deliveries to service_role;

drop policy if exists "notification deliveries are private" on public.notification_deliveries;
create policy "notification deliveries are private"
  on public.notification_deliveries for select to authenticated
  using (auth.uid() = user_id);
