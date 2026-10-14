create extension if not exists "pgcrypto";

create table profiles (
  id                    uuid primary key references auth.users on delete cascade,
  display_name          text not null check (length(trim(display_name)) between 1 and 14),
  leetcode_username     text not null check (length(trim(leetcode_username)) between 1 and 39),
  suit                  text not null default 'spade'
                          check (suit in ('spade','heart','club','diamond')),
  lifetime_solved       int  not null default 0,
  username_locked_until date,
  created_at            timestamptz not null default now()
);

create table tables_ (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (length(trim(name)) between 1 and 40),
  join_code       text not null unique check (join_code ~ '^[A-Z0-9]{4,8}$'),
  tz              text not null default 'America/New_York',
  owner_id        uuid not null references profiles on delete cascade,
  last_swept_day  date not null default (current_date - 1),
  created_at      timestamptz not null default now()
);

create table memberships (
  table_id   uuid not null references tables_ on delete cascade,
  profile_id uuid not null references profiles on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (table_id, profile_id)
);

create index on memberships (profile_id);

create table days (
  table_id         uuid not null references tables_ on delete cascade,
  date             date not null,
  daily_slug       text,
  daily_title      text,
  daily_difficulty text check (daily_difficulty in ('Easy','Medium','Hard')),
  primary key (table_id, date)
);

create table antes (
  id             uuid primary key default gen_random_uuid(),
  table_id       uuid not null references tables_ on delete cascade,
  profile_id     uuid not null references profiles on delete cascade,
  day_date       date not null,
  status         text not null default 'pending'
                   check (status in ('verified','insured','bust','disputed','pending')),
  lc_slug        text,
  lc_title       text,
  lc_difficulty  text check (lc_difficulty in ('Easy','Medium','Hard')),
  lc_timestamp   bigint,
  is_daily       boolean not null default false,
  photo_path     text,
  caption        text check (caption is null or length(caption) <= 80),
  verified_at    timestamptz,
  unique (table_id, profile_id, day_date, lc_slug)
);

create index on antes (table_id, day_date);

create table powerups (
  id         uuid primary key default gen_random_uuid(),
  table_id   uuid not null references tables_ on delete cascade,
  kind       text not null check (kind in ('double','hard','daily')),
  from_id    uuid not null references profiles on delete cascade,
  target_id  uuid not null references profiles on delete cascade,
  played_on  date not null,
  cleared_on date,
  check (from_id <> target_id)
);

create unique index one_live_powerup_per_pair
  on powerups (table_id, from_id, target_id)
  where cleared_on is null;

create index on powerups (table_id, target_id);

create table markers (
  id         uuid primary key default gen_random_uuid(),
  table_id   uuid not null references tables_ on delete cascade,
  debtor_id  uuid not null references profiles on delete cascade,
  creditor_id uuid not null references profiles on delete cascade,
  cents      int  not null check (cents > 0),
  reason     text not null,
  day_date   date not null,
  settled_in uuid,
  created_at timestamptz not null default now(),
  check (debtor_id <> creditor_id)
);

create index on markers (table_id, day_date);

create table reactions (
  ante_id    uuid not null references antes on delete cascade,
  profile_id uuid not null references profiles on delete cascade,
  emoji      text not null check (length(emoji) <= 8),
  primary key (ante_id, profile_id, emoji)
);

create table comments (
  id         uuid primary key default gen_random_uuid(),
  ante_id    uuid not null references antes on delete cascade,
  profile_id uuid not null references profiles on delete cascade,
  body       text not null check (length(trim(body)) between 1 and 90),
  created_at timestamptz not null default now()
);

create table lc_snapshots (
  profile_id   uuid not null references profiles on delete cascade,
  day          date not null,
  total_solved int  not null,
  primary key (profile_id, day)
);

alter table profiles     enable row level security;
alter table tables_      enable row level security;
alter table memberships  enable row level security;
alter table days         enable row level security;
alter table antes        enable row level security;
alter table powerups     enable row level security;
alter table markers      enable row level security;
alter table reactions    enable row level security;
alter table comments     enable row level security;
alter table lc_snapshots enable row level security;

create or replace function is_member(t uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from memberships m
    where m.table_id = t and m.profile_id = auth.uid()
  );
$$;

create policy "read profiles at your tables" on profiles for select using (
  id = auth.uid() or exists (
    select 1 from memberships mine
    join memberships theirs on theirs.table_id = mine.table_id
    where mine.profile_id = auth.uid() and theirs.profile_id = profiles.id
  )
);
create policy "write your own profile"  on profiles for update using (id = auth.uid());
create policy "create your own profile" on profiles for insert with check (id = auth.uid());

create policy "read your tables"   on tables_     for select using (is_member(id));
create policy "create a table"     on tables_     for insert with check (owner_id = auth.uid());
create policy "owner edits table"  on tables_     for update using (owner_id = auth.uid());

create policy "read memberships"   on memberships for select using (is_member(table_id));
create policy "join yourself"      on memberships for insert with check (profile_id = auth.uid());
create policy "leave yourself"     on memberships for delete using (profile_id = auth.uid());

create policy "read days"          on days        for select using (is_member(table_id));

create policy "read antes"         on antes       for select using (is_member(table_id));
create policy "post your own ante" on antes       for insert
  with check (profile_id = auth.uid() and is_member(table_id));
create policy "edit your own ante" on antes       for update using (profile_id = auth.uid());

create policy "read powerups"      on powerups    for select using (is_member(table_id));
create policy "play a powerup"     on powerups    for insert
  with check (from_id = auth.uid() and is_member(table_id));

create policy "read markers"       on markers     for select using (is_member(table_id));

create policy "read reactions"     on reactions   for select using (
  exists (select 1 from antes a where a.id = ante_id and is_member(a.table_id))
);
create policy "react as yourself"  on reactions   for insert with check (profile_id = auth.uid());
create policy "unreact yourself"   on reactions   for delete using (profile_id = auth.uid());

create policy "read comments"      on comments    for select using (
  exists (select 1 from antes a where a.id = ante_id and is_member(a.table_id))
);
create policy "comment as yourself" on comments   for insert with check (profile_id = auth.uid());

create policy "read own snapshots" on lc_snapshots for select using (profile_id = auth.uid());

create or replace function join_table_by_code(code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare target uuid;
begin
  select id into target from tables_ where join_code = upper(trim(code));
  if target is null then
    raise exception 'no table with that code' using errcode = 'no_data_found';
  end if;
  insert into memberships (table_id, profile_id)
  values (target, auth.uid())
  on conflict do nothing;
  return target;
end;
$$;

revoke all on function join_table_by_code(text) from public;
grant execute on function join_table_by_code(text) to authenticated;
