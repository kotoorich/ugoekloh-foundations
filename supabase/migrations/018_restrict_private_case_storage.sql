-- Case workers may only access files under cases currently assigned to them.
drop policy if exists "Authorized case staff read private files" on storage.objects;
create policy "Authorized case staff read private files" on storage.objects
for select to authenticated
using (
 bucket_id='beneficiary-private' and (
  public.has_role(array['super_admin','admin']) or
  (public.has_role(array['case_worker']) and exists(
   select 1 from public.beneficiaries b
   where b.assigned_to=auth.uid() and b.id::text=split_part(name,'/',1)
  ))
 )
);

drop policy if exists "Authorized case staff upload private files" on storage.objects;
create policy "Authorized case staff upload private files" on storage.objects
for insert to authenticated
with check (
 bucket_id='beneficiary-private' and (
  public.has_role(array['super_admin','admin']) or
  (public.has_role(array['case_worker']) and exists(
   select 1 from public.beneficiaries b
   where b.assigned_to=auth.uid() and b.id::text=split_part(name,'/',1)
  ))
 )
);

drop policy if exists "Authorized case staff delete private files" on storage.objects;
create policy "Authorized case staff delete private files" on storage.objects
for delete to authenticated
using (
 bucket_id='beneficiary-private' and (
  public.has_role(array['super_admin','admin']) or
  (public.has_role(array['case_worker']) and exists(
   select 1 from public.beneficiaries b
   where b.assigned_to=auth.uid() and b.id::text=split_part(name,'/',1)
  ))
 )
);
