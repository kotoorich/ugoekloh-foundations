-- Behavioural tests for migrations 023-026. Run via:
--   tools/db.sh --fresh tools/test_new_migrations.sql
-- Any failed assertion raises and aborts the run.
\set ON_ERROR_STOP on

-- Remove any data left by a previous run so the suite is repeatable.
delete from public.audit_logs where entity in ('beneficiaries','allocations') and entity_id is not null;
delete from public.case_funding where beneficiary_id in (select id from public.beneficiaries where case_reference like 'TEST-%');
delete from public.allocations;
delete from public.donations where reference like 'TEST-%';
delete from public.beneficiaries where case_reference like 'TEST-%';
delete from public.programmes where title = 'Test Programme';
delete from public.images where uploaded_by in (select id from auth.users where email like '%@test.local');
delete from public.staff_profiles where user_id in (select id from auth.users where email like '%@test.local');
delete from auth.users where email like '%@test.local';

do $$
declare
  admin_id uuid := gen_random_uuid();
  worker_id uuid := gen_random_uuid();
  case_id uuid;
  prog_id uuid;
  img_id uuid;
  summary jsonb;
  ok boolean;
begin
  insert into auth.users(id, email) values (admin_id, 'admin@test.local'), (worker_id, 'worker@test.local');
  insert into public.staff_profiles(user_id, full_name, role, is_active)
    values (admin_id, 'Test Admin', 'super_admin', true),
           (worker_id, 'Test Worker', 'case_worker', true);

  -- 1. images: byte cap and mime allow-list are enforced.
  begin
    insert into public.images(mime_type, byte_size, data) values ('image/gif', 100, 'AAAA');
    raise exception 'FAIL: unsupported mime type was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.images(mime_type, byte_size, data) values ('image/png', 3000000, 'AAAA');
    raise exception 'FAIL: image above 2MB was accepted';
  exception when check_violation then null;
  end;
  -- data length must be consistent with byte_size, so a truncated payload is caught.
  begin
    insert into public.images(mime_type, byte_size, data) values ('image/png', 2000, 'AAAA');
    raise exception 'FAIL: base64 payload inconsistent with byte_size was accepted';
  exception when check_violation then null;
  end;
  insert into public.images(mime_type, byte_size, data, is_public, uploaded_by)
    values ('image/png', 8, 'iVBORw0KGgo=', true, admin_id) returning id into img_id;
  raise notice 'PASS: images table enforces mime, size and payload length';

  -- 2. A case cannot be published without guardian consent.
  begin
    insert into public.beneficiaries(case_reference, guardian_name, guardian_contact,
      consent_to_collect, consent_to_publish, is_public)
      values ('TEST-NOCONSENT', 'Guardian', '000', true, false, true);
    raise exception 'FAIL: published a case without consent_to_publish';
  exception when raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  raise notice 'PASS: publishing without consent is blocked';

  -- 3. Consent + is_public is accepted, and both consent flags are required.
  insert into public.beneficiaries(case_reference, guardian_name, guardian_contact,
    consent_to_collect, consent_to_publish, is_public, public_display_name,
    support_need, target_amount, is_critical, image_path)
    values ('TEST-OK', 'Guardian', '000', true, true, true, 'Ama',
      'Burn surgery', 5000, true, 'db:' || img_id)
    returning id into case_id;
  raise notice 'PASS: consented case can be published';

  -- 4. Publishing/unpublishing is written to the audit trail.
  select count(*) = 1 into ok from public.audit_logs
    where entity='beneficiaries' and entity_id=case_id::text and action='case_published';
  if not ok then raise exception 'FAIL: case_published was not audited'; end if;
  raise notice 'PASS: case publication is audited';

  -- 5. Over-allocation is refused when there is no income.
  begin
    insert into public.allocations(destination_type, destination_id, amount, allocated_by)
      values ('beneficiary', case_id, 100, admin_id);
    raise exception 'FAIL: allocated money that was never received';
  exception when check_violation then null;
  end;
  raise notice 'PASS: allocation beyond the balance is blocked';

  -- 6. After real income, allocation within balance succeeds.
  insert into public.programmes(title, status) values ('Test Programme','published') returning id into prog_id;
  insert into public.donations(reference, amount, donor_name, donor_email, status, programme_id)
    values ('TEST-DON-1', 1000, 'Donor', 'd@test.local', 'paid', prog_id);

  insert into public.allocations(destination_type, destination_id, amount, allocated_by)
    values ('programme', prog_id, 400, admin_id);

  summary := public.foundation_funds_summary();
  if (summary->>'total_received')::numeric <> 1000 then raise exception 'FAIL: received %', summary->>'total_received'; end if;
  if (summary->>'total_allocated')::numeric <> 400 then raise exception 'FAIL: allocated %', summary->>'total_allocated'; end if;
  if (summary->>'unallocated')::numeric <> 600 then raise exception 'FAIL: unallocated %', summary->>'unallocated'; end if;
  raise notice 'PASS: funds summary reports received/allocated/unallocated correctly';

  -- 7. Allocating the remainder is fine; one more unit is not.
  insert into public.allocations(destination_type, destination_id, amount, allocated_by)
    values ('general', null, 600, admin_id);
  begin
    insert into public.allocations(destination_type, destination_id, amount, allocated_by)
      values ('programme', prog_id, 1, admin_id);
    raise exception 'FAIL: allocated past a zero balance';
  exception when check_violation then null;
  end;
  raise notice 'PASS: balance cannot go negative';

  -- 8. amount_raised on a programme is derived from paid donations only.
  if (select amount_raised from public.programmes where id=prog_id) <> 1000 then
    raise exception 'FAIL: programme amount_raised not derived from paid donations';
  end if;
  insert into public.donations(reference, amount, donor_name, donor_email, status, programme_id)
    values ('TEST-DON-2', 250, 'Donor2', 'd2@test.local', 'pending', prog_id);
  if (select amount_raised from public.programmes where id=prog_id) <> 1000 then
    raise exception 'FAIL: a pending donation counted toward amount_raised';
  end if;
  raise notice 'PASS: only paid donations count toward programme totals';

  -- 9. Donation for a child case updates the case total and one-destination rule holds.
  insert into public.donations(reference, amount, donor_name, donor_email, status, beneficiary_id)
    values ('TEST-DON-3', 300, 'Donor3', 'd3@test.local', 'paid', case_id);
  if (select amount_raised from public.beneficiaries where id=case_id) <> 300 then
    raise exception 'FAIL: case amount_raised not updated';
  end if;
  begin
    insert into public.donations(reference, amount, donor_name, donor_email, status, beneficiary_id, programme_id)
      values ('TEST-DON-4', 10, 'Donor4', 'd4@test.local', 'pending', case_id, prog_id);
    raise exception 'FAIL: a donation was allowed two destinations';
  exception when check_violation then null;
  end;
  raise notice 'PASS: case donations update totals and destinations stay exclusive';

  -- 10. Foundation name is normalised to the official spelling.
  if (select foundation_name from public.foundation_settings where id=1) <> 'Ugoekloh Foundations' then
    raise exception 'FAIL: foundation name not normalised';
  end if;
  raise notice 'PASS: foundation name is Ugoekloh Foundations';

  -- 11. Case funding entries are recorded and summed correctly.
  insert into public.case_funding(beneficiary_id, amount, entry_type, recorded_by)
    values (case_id, 500, 'contribution', admin_id), (case_id, 120, 'expense', admin_id);
  if (select sum(amount) from public.case_funding where beneficiary_id=case_id) <> 620 then
    raise exception 'FAIL: case funding total wrong';
  end if;
  raise notice 'PASS: case funding ledger records contributions and expenses';

  raise notice 'ALL NEW-MIGRATION TESTS PASSED';
end $$;
