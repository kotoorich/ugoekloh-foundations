-- Restrict case-document metadata to the assigned case worker and foundation admins.
drop policy if exists "Case staff manage beneficiary documents" on public.beneficiary_documents;
drop policy if exists "Case staff manage beneficiary documents" on public.beneficiary_documents;
create policy "Case staff manage beneficiary documents" on public.beneficiary_documents for all to authenticated
using(public.has_role(array['super_admin','admin']) or (public.has_role(array['case_worker']) and exists(select 1 from public.beneficiaries b where b.id=beneficiary_id and b.assigned_to=auth.uid())))
with check(public.has_role(array['super_admin','admin']) or (public.has_role(array['case_worker']) and exists(select 1 from public.beneficiaries b where b.id=beneficiary_id and b.assigned_to=auth.uid())));

-- Keep a minimal audit trail of financial and case-record changes.
create or replace function public.log_sensitive_change()
returns trigger language plpgsql security definer set search_path=public
as $$
declare target_id text;
begin
 if tg_op='DELETE' then target_id=old.id::text; else target_id=new.id::text; end if;
 insert into public.audit_logs(actor,action,entity,entity_id,details)
 values(auth.uid(),lower(tg_op),tg_table_name,target_id,jsonb_build_object('recorded_at',now()));
 if tg_op='DELETE' then return old; else return new; end if;
end;
$$;
drop trigger if exists audit_donation_changes on public.donations;
create trigger audit_donation_changes after insert or update or delete on public.donations for each row execute function public.log_sensitive_change();
drop trigger if exists audit_beneficiary_changes on public.beneficiaries;
create trigger audit_beneficiary_changes after insert or update or delete on public.beneficiaries for each row execute function public.log_sensitive_change();
drop trigger if exists audit_document_changes on public.beneficiary_documents;
create trigger audit_document_changes after insert or update or delete on public.beneficiary_documents for each row execute function public.log_sensitive_change();
