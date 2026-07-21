-- E2EE: store encrypted task payloads. Plaintext columns become placeholders when enc is set.
-- Run once in Supabase SQL Editor after schema.sql.

alter table public.tasks add column if not exists enc text;

comment on column public.tasks.enc is
  'Client-side AES-GCM ciphertext (JSON). When set, title/note etc. are placeholders only.';
