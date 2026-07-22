-- Run after migration_digest.sql, deploying daily-digest, and saving the secret:
-- select vault.create_secret('YOUR_RANDOM_SECRET', 'cadence_cron_secret');
-- This reads the secret at execution time; it never stores a service role key in cron SQL.
select cron.schedule(
  'cadence-daily-digest',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/daily-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cadence-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cadence_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
