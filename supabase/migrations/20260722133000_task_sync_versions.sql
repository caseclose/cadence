-- Make task writes monotonic even when an older request arrives last.
alter table public.tasks
  add column if not exists revision text not null default '';

create or replace function public.upsert_task_if_newer(p_task jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if (p_task ->> 'user_id')::uuid <> auth.uid() then
    raise exception 'task user does not match authenticated user';
  end if;

  insert into public.tasks (
    id, user_id, title, note, strategy, eta_ms, initial_eta_ms, state,
    attempts, next_fire_at, priority, created_at, updated_at, revision,
    completed_at, enc, webhook_title, webhook_note
  )
  select
    id, user_id, title, note, strategy, eta_ms, initial_eta_ms, state,
    attempts, next_fire_at, priority, created_at, updated_at, revision,
    completed_at, enc, webhook_title, webhook_note
  from jsonb_populate_record(null::public.tasks, p_task)
  where not exists (
    select 1 from public.task_tombstones tombstone
    where tombstone.id = (p_task ->> 'id')::uuid
      and tombstone.user_id = auth.uid()
      and (tombstone.updated_at > (p_task ->> 'updated_at')::bigint
        or (tombstone.updated_at = (p_task ->> 'updated_at')::bigint
          and tombstone.revision >= coalesce(p_task ->> 'revision', '')))
  )
  on conflict (id) do update set
    title = excluded.title,
    note = excluded.note,
    strategy = excluded.strategy,
    eta_ms = excluded.eta_ms,
    initial_eta_ms = excluded.initial_eta_ms,
    state = excluded.state,
    attempts = excluded.attempts,
    next_fire_at = excluded.next_fire_at,
    priority = excluded.priority,
    created_at = excluded.created_at,
    updated_at = excluded.updated_at,
    revision = excluded.revision,
    completed_at = excluded.completed_at,
    enc = excluded.enc,
    webhook_title = excluded.webhook_title,
    webhook_note = excluded.webhook_note
  where public.tasks.user_id = auth.uid()
    and (excluded.updated_at > public.tasks.updated_at
      or (excluded.updated_at = public.tasks.updated_at
        and excluded.revision > public.tasks.revision));
end;
$$;

grant execute on function public.upsert_task_if_newer(jsonb) to authenticated;

-- Preserve a deletion's version so delayed writes cannot resurrect a task.
create table if not exists public.task_tombstones (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  updated_at bigint not null,
  revision text not null default ''
);
alter table public.task_tombstones enable row level security;
grant select, insert, update, delete on public.task_tombstones to authenticated, service_role;
drop policy if exists "task tombstones are private" on public.task_tombstones;
create policy "task tombstones are private" on public.task_tombstones
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.delete_task_if_newer(
  p_id uuid,
  p_updated_at bigint,
  p_revision text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into public.task_tombstones (id, user_id, updated_at, revision)
  values (p_id, auth.uid(), p_updated_at, p_revision)
  on conflict (id) do update set
    updated_at = excluded.updated_at,
    revision = excluded.revision
  where public.task_tombstones.user_id = auth.uid()
    and (excluded.updated_at > public.task_tombstones.updated_at
      or (excluded.updated_at = public.task_tombstones.updated_at
        and excluded.revision > public.task_tombstones.revision));

  delete from public.tasks
  where id = p_id
    and user_id = auth.uid()
    and (updated_at < p_updated_at
      or (updated_at = p_updated_at and revision <= p_revision));
end;
$$;

grant execute on function public.delete_task_if_newer(uuid, bigint, text) to authenticated;
