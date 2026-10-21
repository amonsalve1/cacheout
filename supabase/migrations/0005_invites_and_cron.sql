drop policy "join yourself" on memberships;
drop policy "create a table" on tables_;
create function create_table(table_name text, timezone text, code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare created uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if not exists (select 1 from pg_timezone_names where name = timezone) then raise exception 'Invalid timezone'; end if;
  insert into tables_(name, tz, join_code, owner_id) values (table_name, timezone, code, auth.uid()) returning id into created;
  insert into memberships(table_id, profile_id) values (created, auth.uid());
  return created;
end;
$$;
revoke all on function create_table(text, text, text) from public;
grant execute on function create_table(text, text, text) to authenticated;
select cron.unschedule(jobid) from cron.job where jobname = 'cache-out-sweep';
select cron.schedule('cache-out-sweep', '7 * * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'sweep_url'),
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-sweep-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'sweep_secret')),
    body := '{}'::jsonb
  ) where exists (select 1 from vault.decrypted_secrets where name = 'sweep_url')
    and exists (select 1 from vault.decrypted_secrets where name = 'sweep_secret');
$$);
