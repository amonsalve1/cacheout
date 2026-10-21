create function enforce_powerup_target() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.table_id::text || new.target_id::text, 0));
  if new.target_id = new.from_id or not exists (
    select 1 from memberships where table_id = new.table_id and profile_id = new.target_id
  ) then raise exception 'Choose another member of this table'; end if;
  if exists (
    select 1 from powerups p where p.table_id = new.table_id and p.target_id = new.target_id
    and p.cleared_on is null and p.played_on + case when p.kind = 'daily' then 1 else 2 end >= new.played_on
  ) then raise exception 'This player already has a live powerup'; end if;
  return new;
end;
$$;
create trigger check_powerup_target before insert on powerups for each row execute function enforce_powerup_target();
