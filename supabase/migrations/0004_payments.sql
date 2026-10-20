create table payments (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references tables_(id) on delete cascade,
  from_profile uuid not null references profiles(id),
  to_profile uuid not null references profiles(id),
  cents integer not null check (cents > 0),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  check (from_profile <> to_profile)
);
alter table payments enable row level security;
create policy "read table payments" on payments for select to authenticated using (is_member(table_id));
create policy "record your payment" on payments for insert to authenticated with check (
  is_member(table_id) and from_profile = auth.uid() and confirmed_at is null
  and exists (select 1 from memberships m where m.table_id = payments.table_id and m.profile_id = to_profile)
);
create policy "recipient confirms payment" on payments for update to authenticated
  using (is_member(table_id) and to_profile = auth.uid() and confirmed_at is null)
  with check (is_member(table_id) and to_profile = auth.uid() and confirmed_at is not null);
revoke update on payments from authenticated;
grant update (confirmed_at) on payments to authenticated;
create unique index one_pending_payment on payments(table_id, from_profile, to_profile) where confirmed_at is null;
alter publication supabase_realtime add table payments;
