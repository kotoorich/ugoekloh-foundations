-- Case management workflow, assigned-worker privacy and optional programme targets.
alter table public.programmes add column if not exists goal_amount numeric(14,2) null;
alter table public.programmes drop constraint if exists programmes_goal_amount_check;
alter table public.programmes add constraint programmes_goal_amount_check check (goal_amount is null or goal_amount >= 0);

-- A case activity is an append-only operational record, not a replacement for the case itself.
create table if not exists public.beneficiary_case_activities (
 id uuid primary key default gen_random_uuid(),
 beneficiary_id uuid not null references public.beneficiaries(id) on delete cascade,
 activity_type text not null check (activity_type in ('assessment','appointment','home_visit','medical_coordination','support_provided','follow_up','case_note','status_change')),
 summary text not null check (length(trim(summary)) between 3 and 4000),
 next_follow_up_at timestamptz,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create index if not exists beneficiary_case_activities_case_idx on public.beneficiary_case_activities(beneficiary_id, created_at desc);
create index if not exists beneficiaries_follow_up_idx on public.beneficiaries(assigned_to, case_status);

alter table public.beneficiary_case_activities enable row level security;
drop policy if exists "Assigned case staff read case activities" on public.beneficiary_case_activities;
create policy "Assigned case staff read case activities" on public.beneficiary_case_activities for select to authenticated
using (
 public.has_role(array['super_admin','admin']) or
 exists(select 1 from public.beneficiaries b where b.id=beneficiary_id and b.assigned_to=auth.uid() and public.has_role(array['case_worker']))
);
drop policy if exists "Assigned case staff add case activities" on public.beneficiary_case_activities;
create policy "Assigned case staff add case activities" on public.beneficiary_case_activities for insert to authenticated
with check (
 created_by=auth.uid() and (
  public.has_role(array['super_admin','admin']) or
  exists(select 1 from public.beneficiaries b where b.id=beneficiary_id and b.assigned_to=auth.uid() and public.has_role(array['case_worker']))
 )
);
-- Activity history is intentionally immutable through the client; corrections are made with a new note.

-- Case workers must only see and update cases explicitly assigned to their own account.
drop policy if exists "Case workers read beneficiaries" on public.beneficiaries;
create policy "Case workers read beneficiaries" on public.beneficiaries for select to authenticated
using (public.has_role(array['super_admin','admin']) or (public.has_role(array['case_worker']) and assigned_to=auth.uid()));
drop policy if exists "Case workers manage beneficiaries" on public.beneficiaries;
create policy "Case staff update assigned beneficiaries" on public.beneficiaries for update to authenticated
using (public.has_role(array['super_admin','admin']) or (public.has_role(array['case_worker']) and assigned_to=auth.uid()))
with check (public.has_role(array['super_admin','admin']) or (public.has_role(array['case_worker']) and assigned_to=auth.uid()));
drop policy if exists "Case staff create beneficiary cases" on public.beneficiaries;
create policy "Case staff create beneficiary cases" on public.beneficiaries for insert to authenticated
with check (public.has_role(array['super_admin','admin']));

-- Admins need to choose active case workers in the assignment control.
drop policy if exists "Admins read staff directory" on public.staff_profiles;
create policy "Admins read staff directory" on public.staff_profiles for select to authenticated
using (user_id=auth.uid() or public.has_role(array['super_admin','admin']));

-- Keep case documents restricted to administrators and the worker assigned to that case.
drop policy if exists "Case staff manage beneficiary documents" on public.beneficiary_documents;
create policy "Case staff manage beneficiary documents" on public.beneficiary_documents for all to authenticated
using (
 public.has_role(array['super_admin','admin']) or
 (public.has_role(array['case_worker']) and exists(select 1 from public.beneficiaries b where b.id=beneficiary_id and b.assigned_to=auth.uid()))
)
with check (
 public.has_role(array['super_admin','admin']) or
 (public.has_role(array['case_worker']) and exists(select 1 from public.beneficiaries b where b.id=beneficiary_id and b.assigned_to=auth.uid()))
);
