-- Ensure a case worker cannot replace or move files belonging to another worker's case.
drop policy if exists "Authorized case staff update private files" on storage.objects;
create policy "Authorized case staff update private files" on storage.objects for update to authenticated
using (
 bucket_id='beneficiary-private' and (
  public.has_role(array['super_admin','admin']) or
  (public.has_role(array['case_worker']) and exists(
   select 1 from public.beneficiaries b
   where b.assigned_to=auth.uid() and b.id::text=split_part(name,'/',1)
  ))
 )
)
with check (
 bucket_id='beneficiary-private' and (
  public.has_role(array['super_admin','admin']) or
  (public.has_role(array['case_worker']) and exists(
   select 1 from public.beneficiaries b
   where b.assigned_to=auth.uid() and b.id::text=split_part(name,'/',1)
  ))
 )
);
