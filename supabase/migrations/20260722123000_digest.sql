-- Generic daily digest preferences and idempotent delivery records.
create table if not exists public.digest_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  enabled boolean not null default false,
  timezone text not null default 'Asia/Shanghai',
  local_time time not null default '09:00',
  channel text not null default 'webhook',
  updated_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);
create table if not exists public.digest_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  digest_date date not null,
  channel text not null,
  status text not null default 'claimed',
  attempts int not null default 0,
  last_error text,
  sent_at bigint,
  unique (user_id, digest_date, channel)
);
alter table public.digest_preferences enable row level security;
alter table public.digest_deliveries enable row level security;
grant select, insert, update, delete on public.digest_preferences to authenticated, service_role;
grant select on public.digest_deliveries to authenticated, service_role;
drop policy if exists "digest preferences are private" on public.digest_preferences;
create policy "digest preferences are private" on public.digest_preferences for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "digest deliveries are private" on public.digest_deliveries;
create policy "digest deliveries are private" on public.digest_deliveries for select to authenticated using (auth.uid() = user_id);


-- Atomically claim a delivery. A failed delivery may be retried, while a
-- claimed/sent delivery can never be duplicated by overlapping cron jobs.
create or replace function public.claim_daily_digest(
  p_user_id uuid,
  p_digest_date date,
  p_channel text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed boolean := false;
begin
  insert into public.digest_deliveries (user_id, digest_date, channel, status, attempts)
  values (p_user_id, p_digest_date, p_channel, 'claimed', 1)
  on conflict (user_id, digest_date, channel) do update
    set status = 'claimed', attempts = public.digest_deliveries.attempts + 1, last_error = null
    where public.digest_deliveries.status = 'failed'
  returning true into claimed;
  return coalesce(claimed, false);
end;
$$;

grant execute on function public.claim_daily_digest(uuid, date, text) to service_role;
