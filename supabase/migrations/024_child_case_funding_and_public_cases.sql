-- Child case fields: funding, safeguarding, and opt-in public storytelling.
--
-- Every column is nullable with a safe default, so existing case rows are
-- unaffected. A case is only visible publicly when BOTH consent_to_publish and
-- is_public are true; both default to false.
alter table public.beneficiaries
  add column if not exists image_path text,
  add column if not exists date_of_birth date,
  add column if not exists age_band text,
  add column if not exists gender text,
  add column if not exists location text,
  add column if not exists medical_needs text,
  add column if not exists rehabilitation_needs text,
  add column if not exists support_need text,
  add column if not exists target_amount numeric(14,2),
  add column if not exists funding_source text,
  add column if not exists public_display_name text,
  add column if not exists public_story text,
  add column if not exists consent_reference text,
  add column if not exists is_critical boolean not null default false,
  add column if not exists is_public boolean not null default false,
  add column if not exists archived_at timestamptz;

alter table public.beneficiaries drop constraint if exists beneficiaries_target_amount_check;
alter table public.beneficiaries add constraint beneficiaries_target_amount_check
  check (target_amount is null or target_amount >= 0);

-- Money actually spent on a case, recorded by administrators. Kept separate from
-- target_amount so "needed" and "invested" never overwrite each other.
create table if not exists public.case_funding (
  id uuid primary key default gen_random_uuid(),
  beneficiary_id uuid not null references public.beneficiaries(id) on delete cascade,
  amount numeric(14,2) not null check (amount <> 0),
  entry_type text not null default 'contribution' check (entry_type in ('contribution','expense')),
  note text,
  recorded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists case_funding_case_idx on public.case_funding(beneficiary_id, created_at desc);

alter table public.case_funding enable row level security;

-- Case funding is casework data: admins, and the worker the case is assigned to.
drop policy if exists "Case staff read case funding" on public.case_funding;
create policy "Case staff read case funding" on public.case_funding
for select to authenticated using (
  public.has_role(array['super_admin','admin']) or
  (public.has_role(array['case_worker']) and exists (
    select 1 from public.beneficiaries b where b.id = beneficiary_id and b.assigned_to = auth.uid()
  ))
);

drop policy if exists "Case staff record case funding" on public.case_funding;
create policy "Case staff record case funding" on public.case_funding
for insert to authenticated with check (
  recorded_by = auth.uid() and (
    public.has_role(array['super_admin','admin']) or
    (public.has_role(array['case_worker']) and exists (
      select 1 from public.beneficiaries b where b.id = beneficiary_id and b.assigned_to = auth.uid()
    ))
  )
);

drop policy if exists "Admins correct case funding" on public.case_funding;
create policy "Admins correct case funding" on public.case_funding
for delete to authenticated using (public.has_role(array['super_admin','admin']));

-- A case may only be published when the guardian has also consented. Enforced in
-- the database so no frontend bug or direct API call can bypass it.
create or replace function public.enforce_case_publication_consent()
returns trigger language plpgsql as $$
begin
  if new.is_public and not coalesce(new.consent_to_publish, false) then
    raise exception 'A child case cannot be made public without recorded guardian consent to publish.';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_case_publication_consent on public.beneficiaries;
create trigger enforce_case_publication_consent
before insert or update on public.beneficiaries
for each row execute function public.enforce_case_publication_consent();

-- Record who archived or published a case, for the safeguarding audit trail.
create or replace function public.audit_case_visibility()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  -- Record publication state on creation as well as on later changes, so a case
  -- registered as public is audited the same way as one published afterwards.
  if tg_op = 'INSERT' then
    if coalesce(new.is_public, false) then
      insert into public.audit_logs(actor, action, entity, entity_id, details)
      values (
        auth.uid(), 'case_published', 'beneficiaries', new.id::text,
        jsonb_build_object('case_reference', new.case_reference,
                           'consent_reference', new.consent_reference,
                           'at_creation', true)
      );
    end if;
    return new;
  end if;

  if coalesce(old.is_public,false) <> coalesce(new.is_public,false) then
    insert into public.audit_logs(actor, action, entity, entity_id, details)
    values (
      auth.uid(),
      case when new.is_public then 'case_published' else 'case_unpublished' end,
      'beneficiaries',
      new.id::text,
      jsonb_build_object('case_reference', new.case_reference, 'consent_reference', new.consent_reference)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists audit_case_visibility on public.beneficiaries;
create trigger audit_case_visibility
after insert or update on public.beneficiaries
for each row execute function public.audit_case_visibility();

-- NOTE: no public RLS policy is added to public.beneficiaries on purpose.
--
-- Row-level security cannot hide individual columns, so a policy allowing anon
-- to read published rows would also expose guardian_name, guardian_contact and
-- medical_needs to anyone holding the publishable key. Public case information
-- is therefore served only by the backend (GET /api/public/cases), which uses
-- the service role and selects an explicit allow-list of safe columns.
