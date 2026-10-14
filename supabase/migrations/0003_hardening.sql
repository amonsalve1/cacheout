create unique index markers_idempotent
  on markers (table_id, debtor_id, creditor_id, day_date, reason);

drop policy if exists "edit your own ante" on antes;

drop policy if exists "react as yourself"   on reactions;
drop policy if exists "comment as yourself" on comments;

create policy "react at your table" on reactions for insert with check (
  profile_id = auth.uid()
  and exists (select 1 from antes a where a.id = ante_id and is_member(a.table_id))
);

create policy "comment at your table" on comments for insert with check (
  profile_id = auth.uid()
  and exists (select 1 from antes a where a.id = ante_id and is_member(a.table_id))
);

create policy "delete your own comment" on comments for delete using (profile_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proofs', 'proofs', false, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "read proofs at your table" on storage.objects;
create policy "read proofs at your table" on storage.objects for select using (
  bucket_id = 'proofs'
  and public.is_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "upload your own proof" on storage.objects;
create policy "upload your own proof" on storage.objects for insert with check (
  bucket_id = 'proofs'
  and public.is_member(((storage.foldername(name))[1])::uuid)
  and ((storage.foldername(name))[2])::uuid = auth.uid()
);

drop policy if exists "replace your own proof" on storage.objects;
create policy "replace your own proof" on storage.objects for update using (
  bucket_id = 'proofs'
  and ((storage.foldername(name))[2])::uuid = auth.uid()
);

drop policy if exists "delete your own proof" on storage.objects;
create policy "delete your own proof" on storage.objects for delete using (
  bucket_id = 'proofs'
  and ((storage.foldername(name))[2])::uuid = auth.uid()
);

alter table profiles add column if not exists venmo_handle text
  check (venmo_handle is null or venmo_handle ~ '^[A-Za-z0-9_-]{3,30}$');

comment on column profiles.venmo_handle is
  'Venmo username without the @. Optional — the Cage shows the debt either way.';
