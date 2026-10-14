create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'cache-out-sweep',
  '7 * * * *',  -- 7 past the hour, off the busy top-of-hour
  $$
  select net.http_post(
    url     := current_setting('app.settings.sweep_url', true),
    headers := jsonb_build_object(
      'Content-Type',    'application/json',
      'x-sweep-secret',  current_setting('app.settings.sweep_secret', true)
    ),
    body    := '{}'::jsonb
  );
  $$
);
