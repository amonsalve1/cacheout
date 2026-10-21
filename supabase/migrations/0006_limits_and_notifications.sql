create table verification_limits (
  profile_id uuid primary key references auth.users(id) on delete cascade,
  day date not null,
  requests integer not null,
  last_at timestamptz not null
);
alter table verification_limits enable row level security;
create function consume_verification(who uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare accepted uuid;
begin
  insert into verification_limits as v values (who, (now() at time zone 'UTC')::date, 1, now())
  on conflict (profile_id) do update set
    day = excluded.day,
    requests = case when v.day = excluded.day then v.requests + 1 else 1 end,
    last_at = now()
  where v.last_at <= now() - interval '30 seconds' and (v.day <> excluded.day or v.requests < 60)
  returning profile_id into accepted;
  return accepted is not null;
end;
$$;
revoke all on function consume_verification(uuid) from public, authenticated, anon;
grant execute on function consume_verification(uuid) to service_role;
create function lock_leetcode_handle() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.leetcode_username is distinct from old.leetcode_username then
    if old.username_locked_until > current_date then raise exception 'Handle locked until %', old.username_locked_until; end if;
    new.username_locked_until := current_date + 7;
  else
    new.username_locked_until := old.username_locked_until;
  end if;
  return new;
end;
$$;
create trigger lock_handle before update on profiles for each row execute function lock_leetcode_handle();
alter table tables_ add column discord_webhook_url text check (
  discord_webhook_url is null or discord_webhook_url ~ '^https://discord\.com/api/webhooks/[0-9]+/[A-Za-z0-9_-]+$'
);
drop policy "owner edits table" on tables_;
create policy "members edit settings" on tables_ for update to authenticated using (is_member(id)) with check (is_member(id));
revoke update on tables_ from authenticated;
grant update (name, tz, discord_webhook_url) on tables_ to authenticated;
create table notifications (
  table_id uuid references tables_(id) on delete cascade,
  day date not null,
  kind text not null check (kind in ('reminder', 'closed')),
  created_at timestamptz not null default now(),
  primary key (table_id, day, kind)
);
alter table notifications enable row level security;
