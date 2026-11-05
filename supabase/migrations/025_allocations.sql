-- Allocation ledger: records where received money is directed and spent.
--
-- This is internal bookkeeping only. No payment provider is involved: money has
-- already been received, and an allocation simply states which programme,
-- project or child case it was assigned to.
--
-- `programmes.amount_raised` is maintained automatically from paid donations by
-- the trigger in migration 007. Allocations are a SEPARATE figure and never
-- write to amount_raised, so the public "raised" total cannot double-count.
create table if not exists public.allocations (
  id uuid primary key default gen_random_uuid(),
  destination_type text not null check (destination_type in ('programme','project','beneficiary','general')),
  destination_id uuid,
  amount numeric(14,2) not null check (amount > 0),
  note text,
  allocated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  -- A specific destination requires an id; general support must not carry one.
  constraint allocations_destination_check check (
    (destination_type = 'general' and destination_id is null) or
    (destination_type <> 'general' and destination_id is not null)
  )
);

create index if not exists allocations_created_idx on public.allocations(created_at desc);
create index if not exists allocations_destination_idx on public.allocations(destination_type, destination_id);

alter table public.allocations enable row level security;

-- Only finance-capable roles may see or create allocations.
drop policy if exists "Finance and admins read allocations" on public.allocations;
create policy "Finance and admins read allocations" on public.allocations
for select to authenticated using (public.has_role(array['super_admin','admin','finance']));

drop policy if exists "Finance and admins create allocations" on public.allocations;
create policy "Finance and admins create allocations" on public.allocations
for insert to authenticated with check (
  allocated_by = auth.uid() and public.has_role(array['super_admin','admin','finance'])
);

drop policy if exists "Admins delete allocations" on public.allocations;
create policy "Admins delete allocations" on public.allocations
for delete to authenticated using (public.has_role(array['super_admin','admin']));

-- Total verified income and total allocated, so the UI can show a live balance
-- and the database can refuse an over-allocation even if the UI is bypassed.
create or replace function public.foundation_funds_summary()
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'total_received', coalesce((select sum(amount) from public.donations where status = 'paid'), 0),
    'total_allocated', coalesce((select sum(amount) from public.allocations), 0),
    'unallocated', coalesce((select sum(amount) from public.donations where status = 'paid'), 0)
                   - coalesce((select sum(amount) from public.allocations), 0)
  );
$$;

-- Refuse an allocation that exceeds the unallocated balance. Enforced in the
-- database so a stale browser tab cannot overspend the ledger.
create or replace function public.enforce_allocation_within_balance()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  received numeric(14,2);
  allocated numeric(14,2);
begin
  select coalesce(sum(amount), 0) into received from public.donations where status = 'paid';
  select coalesce(sum(amount), 0) into allocated from public.allocations;

  if new.amount > (received - allocated) then
    raise exception
      'Allocation of % exceeds the unallocated balance of % (received %, already allocated %).',
      new.amount, (received - allocated), received, allocated
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_allocation_within_balance on public.allocations;
create trigger enforce_allocation_within_balance
before insert on public.allocations
for each row execute function public.enforce_allocation_within_balance();

-- Allocations are part of the financial audit trail.
create or replace function public.audit_allocation_changes()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs(actor, action, entity, entity_id, details)
    values (new.allocated_by, 'allocation_created', 'allocations', new.id::text,
            jsonb_build_object('destination_type', new.destination_type,
                               'destination_id', new.destination_id,
                               'amount', new.amount));
    return new;
  end if;
  insert into public.audit_logs(actor, action, entity, entity_id, details)
  values (auth.uid(), 'allocation_deleted', 'allocations', old.id::text,
          jsonb_build_object('destination_type', old.destination_type,
                             'destination_id', old.destination_id,
                             'amount', old.amount));
  return old;
end;
$$;

drop trigger if exists audit_allocation_changes on public.allocations;
create trigger audit_allocation_changes
after insert or delete on public.allocations
for each row execute function public.audit_allocation_changes();
