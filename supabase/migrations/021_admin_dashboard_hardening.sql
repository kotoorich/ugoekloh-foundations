-- Admin dashboard hardening: settings schema, staff password state and case isolation.
create table if not exists public.foundation_settings (
  id integer primary key default 1 check (id = 1),
  foundation_name text not null default 'Ugo E Kloh Foundation',
  contact_email text,
  contact_phone text,
  call_line text,
  address text,
  default_currency text not null default 'GHS',
  updated_at timestamptz not null default now()
);
alter table public.foundation_settings add column if not exists call_line text;
alter table public.foundation_settings add column if not exists updated_at timestamptz not null default now();
alter table public.staff_profiles add column if not exists must_change_password boolean not null default false;

alter table public.foundation_settings enable row level security;
drop policy if exists "Public read foundation settings" on public.foundation_settings;
create policy "Public read foundation settings" on public.foundation_settings
  for select using (true);
drop policy if exists "Admins manage foundation settings" on public.foundation_settings;
create policy "Admins manage foundation settings" on public.foundation_settings
  for all to authenticated
  using (public.has_role(array['super_admin','admin']))
  with check (public.has_role(array['super_admin','admin']));
grant select on public.foundation_settings to anon, authenticated;
grant insert, update, delete on public.foundation_settings to authenticated;

-- Case workers can access only cases assigned to their own authenticated identity.
drop policy if exists "Case workers read beneficiaries" on public.beneficiaries;
drop policy if exists "Case workers manage beneficiaries" on public.beneficiaries;
drop policy if exists "Assigned case workers read own cases" on public.beneficiaries;
create policy "Assigned case workers read own cases" on public.beneficiaries
  for select to authenticated
  using (
    public.has_role(array['super_admin','admin'])
    or (public.has_role(array['case_worker']) and assigned_to = auth.uid())
  );
drop policy if exists "Admins manage beneficiary cases" on public.beneficiaries;
create policy "Admins manage beneficiary cases" on public.beneficiaries
  for all to authenticated
  using (public.has_role(array['super_admin','admin']))
  with check (public.has_role(array['super_admin','admin']));
drop policy if exists "Assigned case workers update own cases" on public.beneficiaries;
create policy "Assigned case workers update own cases" on public.beneficiaries
  for update to authenticated
  using (public.has_role(array['case_worker']) and assigned_to = auth.uid())
  with check (public.has_role(array['case_worker']) and assigned_to = auth.uid());

-- Admin and finance roles can read donations; only the backend payment workflow
-- should change payment/refund state.
drop policy if exists "Staff manage donations" on public.donations;
drop policy if exists "Finance and admins read donations" on public.donations;
create policy "Finance and admins read donations" on public.donations
  for select to authenticated
  using (public.has_role(array['super_admin','admin','finance']));
drop policy if exists "Admins update donations" on public.donations;
create policy "Admins update donations" on public.donations
  for update to authenticated
  using (public.has_role(array['super_admin','admin']))
  with check (public.has_role(array['super_admin','admin']));

-- Staff records are managed only by the super administrator.
drop policy if exists "Admins manage staff profiles" on public.staff_profiles;
create policy "Super admins manage staff profiles" on public.staff_profiles
  for all to authenticated
  using (public.has_role(array['super_admin']))
  with check (public.has_role(array['super_admin']));
