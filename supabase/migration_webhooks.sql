-- Migration: Feishu / WeCom / DingTalk webhook channels.
-- Run once in Supabase SQL Editor (after push migration is already applied).

create table if not exists public.notification_webhooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null
    check (provider in ('feishu', 'wecom', 'dingtalk')),
  url text not null,
  secret text,
  enabled boolean not null default true,
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
