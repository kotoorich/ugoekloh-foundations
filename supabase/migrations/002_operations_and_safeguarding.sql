-- Expanded operations, privacy controls and public information modules.
create table if not exists public.foundation_settings (
 id integer primary key default 1 check(id=1),
 foundation_name text not null default 'Ugo E Kloh Foundation',
 contact_email text, contact_phone text, address text, donation_instructions text,
 default_currency text not null default 'GHS',
 updated_at timestamptz not null default now()
);
create table if not exists public.newsletter_subscribers (
 id uuid primary key default gen_random_uuid(),
 email text not null unique,
 consented_at timestamptz not null default now(),
 status text not null default 'subscribed' check(status in ('subscribed','unsubscribed')),
 created_at timestamptz not null default now()
);
create table if not exists public.beneficiary_documents (
 id uuid primary key default gen_random_uuid(),
 beneficiary_id uuid not null references public.beneficiaries(id) on delete cascade,
 storage_path text not null unique,
 document_type text not null,
 uploaded_by uuid references auth.users(id),
 created_at timestamptz not null default now()
);
create table if not exists public.donation_receipts (
 id uuid primary key default gen_random_uuid(),
 donation_id uuid not null references public.donations(id) on delete cascade,
 receipt_number text not null unique,
 issued_at timestamptz not null default now(),
 issued_by uuid references auth.users(id)
);
alter table public.foundation_settings enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.beneficiary_documents enable row level security;
alter table public.donation_receipts enable row level security;

drop policy if exists "Public read foundation settings" on public.foundation_settings;
drop policy if exists "Public read foundation settings" on public.foundation_settings;
create policy "Public read foundation settings" on public.foundation_settings for select using(true);
drop policy if exists "Admins manage foundation settings" on public.foundation_settings;
drop policy if exists "Admins manage foundation settings" on public.foundation_settings;
create policy "Admins manage foundation settings" on public.foundation_settings for all to authenticated using(public.has_role(array['super_admin','admin'])) with check(public.has_role(array['super_admin','admin']));
drop policy if exists "Public subscribe newsletter" on public.newsletter_subscribers;
drop policy if exists "Public subscribe newsletter" on public.newsletter_subscribers;
create policy "Public subscribe newsletter" on public.newsletter_subscribers for insert to anon,authenticated with check(status='subscribed');
drop policy if exists "Staff manage newsletter" on public.newsletter_subscribers;
drop policy if exists "Staff manage newsletter" on public.newsletter_subscribers;
create policy "Staff manage newsletter" on public.newsletter_subscribers for all to authenticated using(public.has_role(array['super_admin','admin','editor'])) with check(public.has_role(array['super_admin','admin','editor']));
drop policy if exists "Case staff manage beneficiary documents" on public.beneficiary_documents;
drop policy if exists "Case staff manage beneficiary documents" on public.beneficiary_documents;
create policy "Case staff manage beneficiary documents" on public.beneficiary_documents for all to authenticated using(public.has_role(array['super_admin','admin','case_worker'])) with check(public.has_role(array['super_admin','admin','case_worker']));
drop policy if exists "Finance read donation receipts" on public.donation_receipts;
drop policy if exists "Finance read donation receipts" on public.donation_receipts;
create policy "Finance read donation receipts" on public.donation_receipts for select to authenticated using(public.has_role(array['super_admin','admin','finance']));
drop policy if exists "Finance create donation receipts" on public.donation_receipts;
drop policy if exists "Finance create donation receipts" on public.donation_receipts;
create policy "Finance create donation receipts" on public.donation_receipts for insert to authenticated with check(public.has_role(array['super_admin','admin','finance']));

-- Restrict sensitive case information to designated case staff only.
drop policy if exists "Case workers read beneficiaries" on public.beneficiaries;
drop policy if exists "Case workers read beneficiaries" on public.beneficiaries;
create policy "Case workers read beneficiaries" on public.beneficiaries for select to authenticated using(public.has_role(array['super_admin','admin','case_worker']));
drop policy if exists "Case workers manage beneficiaries" on public.beneficiaries;
drop policy if exists "Case workers manage beneficiaries" on public.beneficiaries;
create policy "Case workers manage beneficiaries" on public.beneficiaries for all to authenticated using(public.has_role(array['super_admin','admin','case_worker'])) with check(public.has_role(array['super_admin','admin','case_worker']));

-- Storage objects are private and keyed by a case UUID folder. A case worker can only
-- access the folder for a case assigned to them; administrators retain oversight.
drop policy if exists "Authorized case staff read private files" on storage.objects;
drop policy if exists "Authorized case staff read private files" on storage.objects;
create policy "Authorized case staff read private files" on storage.objects for select to authenticated
using(bucket_id='beneficiary-private' and (
 public.has_role(array['super_admin','admin']) or
 (public.has_role(array['case_worker']) and exists(
   select 1 from public.beneficiaries b
   where b.assigned_to=auth.uid() and b.id::text=split_part(name,'/',1)
 ))
));
drop policy if exists "Authorized case staff upload private files" on storage.objects;
drop policy if exists "Authorized case staff upload private files" on storage.objects;
create policy "Authorized case staff upload private files" on storage.objects for insert to authenticated
with check(bucket_id='beneficiary-private' and (
 public.has_role(array['super_admin','admin']) or
 (public.has_role(array['case_worker']) and exists(
   select 1 from public.beneficiaries b
   where b.assigned_to=auth.uid() and b.id::text=split_part(name,'/',1)
 ))
));
drop policy if exists "Authorized case staff update private files" on storage.objects;
drop policy if exists "Authorized case staff update private files" on storage.objects;
create policy "Authorized case staff update private files" on storage.objects for update to authenticated
using(bucket_id='beneficiary-private' and (public.has_role(array['super_admin','admin']) or public.has_role(array['case_worker'])))
with check(bucket_id='beneficiary-private' and (public.has_role(array['super_admin','admin']) or public.has_role(array['case_worker'])));
drop policy if exists "Authorized case staff delete private files" on storage.objects;
drop policy if exists "Authorized case staff delete private files" on storage.objects;
create policy "Authorized case staff delete private files" on storage.objects for delete to authenticated
using(bucket_id='beneficiary-private' and public.has_role(array['super_admin','admin']));

-- Add the missing status and assignment fields without overwriting existing case data.
alter table public.beneficiaries add column if not exists assigned_at timestamptz;
alter table public.beneficiaries add column if not exists consent_withdrawn_at timestamptz;
alter table public.beneficiaries add column if not exists case_notes text;
alter table public.donations add column if not exists refunded_at timestamptz;
alter table public.donations add column if not exists reconciliation_note text;
alter table public.volunteer_applications add column if not exists reviewed_by uuid references auth.users(id);
alter table public.volunteer_applications add column if not exists reviewed_at timestamptz;
alter table public.contact_messages add column if not exists assigned_to uuid references auth.users(id);
alter table public.contact_messages add column if not exists resolved_at timestamptz;

create index if not exists donations_created_at_idx on public.donations(created_at desc);
create index if not exists beneficiaries_assigned_to_idx on public.beneficiaries(assigned_to);
create index if not exists news_published_at_idx on public.news(published_at desc);
create index if not exists events_starts_at_idx on public.events(starts_at);
