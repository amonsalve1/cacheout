create function invite_table_name(code text) returns text
language sql stable security definer set search_path = public as $$
  select name from tables_ where join_code = upper(trim(code)) limit 1;
$$;
revoke all on function invite_table_name(text) from public;
grant execute on function invite_table_name(text) to anon, authenticated;
