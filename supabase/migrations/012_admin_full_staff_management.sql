-- Administrators have full employee-management access, while only a super administrator
-- can hold the super_admin role (the staff creation API does not offer that role).
drop policy if exists "Admins manage staff profiles" on public.staff_profiles;
create policy "Admins manage staff profiles" on public.staff_profiles
for all to authenticated
using (public.has_role(array['super_admin','admin']))
with check (public.has_role(array['super_admin','admin']));
