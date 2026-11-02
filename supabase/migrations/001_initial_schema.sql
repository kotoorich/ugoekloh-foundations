-- Ugo E Kloh Foundation: initial database schema
create extension if not exists pgcrypto;

create table if not exists public.programmes (
 id uuid primary key default gen_random_uuid(), title text not null, slug text unique,
 category text, description text, body text, image_path text, status text not null default 'draft' check(status in ('draft','published','archived')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.campaigns (
 id uuid primary key default gen_random_uuid(), title text not null, slug text unique,
 description text, goal_amount numeric(14,2) not null default 0 check(goal_amount>=0),
 amount_raised numeric(14,2) not null default 0 check(amount_raised>=0),
 image_path text, status text not null default 'draft' check(status in ('draft','published','completed','archived')),
 start_date date, end_date date, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.projects (
 id uuid primary key default gen_random_uuid(), title text not null, description text, location text,
 status text not null default 'draft', image_path text, created_at timestamptz not null default now()
);
create table if not exists public.news (
 id uuid primary key default gen_random_uuid(), title text not null, slug text unique, excerpt text, body text,
 cover_image_path text, status text not null default 'draft', published_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists public.events (
 id uuid primary key default gen_random_uuid(), title text not null, description text, venue text,
 starts_at timestamptz, ends_at timestamptz, status text not null default 'draft', created_at timestamptz not null default now()
);
create table if not exists public.partners (
 id uuid primary key default gen_random_uuid(), name text not null, website text, logo_path text, description text,
 status text not null default 'draft', created_at timestamptz not null default now()
);
create table if not exists public.donations (
 id uuid primary key default gen_random_uuid(), reference text not null unique,
 amount numeric(14,2) not null check(amount>0), currency text not null default 'GHS',
 donor_name text not null, donor_email text not null, donor_phone text,
 campaign_id uuid references public.campaigns(id) on delete set null,
 payment_method text not null default 'paystack',
 status text not null default 'pending' check(status in ('pending','paid','failed','refunded')),
 provider_transaction_id text, created_at timestamptz not null default now()
);
create table if not exists public.volunteer_applications (
 id uuid primary key default gen_random_uuid(), name text not null, email text not null, phone text not null,
 skills text not null, message text, status text not null default 'new', created_at timestamptz not null default now()
);
create table if not exists public.contact_messages (
 id uuid primary key default gen_random_uuid(), name text not null, email text not null,
 subject text, message text not null, status text not null default 'unread', created_at timestamptz not null default now()
);
-- Beneficiary details are private by default. Do not expose medical details or identifiers publicly.
create table if not exists public.beneficiaries (
 id uuid primary key default gen_random_uuid(), case_reference text not null unique,
 child_display_name text, guardian_name text not null, guardian_contact text not null,
 consent_to_collect boolean not null default false, consent_to_publish boolean not null default false,
 support_category text, support_summary text, medical_notes text,
 case_status text not null default 'under_review', assigned_to uuid references auth.users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.staff_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null, role text not null default 'staff' check(role in ('super_admin','admin','editor','finance','case_worker','staff')),
 is_active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.audit_logs (
 id uuid primary key default gen_random_uuid(), actor uuid references auth.users(id),
 action text not null, entity text not null, entity_id text, details jsonb default '{}'::jsonb,
 created_at timestamptz not null default now()
);

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.staff_profiles where user_id=auth.uid() and is_active=true); $$;
create or replace function public.has_role(allowed text[])
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.staff_profiles where user_id=auth.uid() and is_active=true and role=any(allowed)); $$;

alter table public.programmes enable row level security;
alter table public.campaigns enable row level security;
alter table public.projects enable row level security;
alter table public.news enable row level security;
alter table public.events enable row level security;
alter table public.partners enable row level security;
alter table public.donations enable row level security;
alter table public.volunteer_applications enable row level security;
alter table public.contact_messages enable row level security;
alter table public.beneficiaries enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.audit_logs enable row level security;

-- Public visitors may only read published public-facing content.
do $$ declare t text; begin
 foreach t in array array['programmes','campaigns','projects','news','events','partners'] loop
  execute format('drop policy if exists "Public read published %1$s" on public.%1$I',t);
  execute format('create policy "Public read published %1$s" on public.%1$I for select using (status = ''published'')',t);
  execute format('drop policy if exists "Staff manage %1$s" on public.%1$I',t);
  execute format('create policy "Staff manage %1$s" on public.%1$I for all to authenticated using (public.is_staff()) with check (public.is_staff())',t);
 end loop;
end $$;
drop policy if exists "Finance and admins read donations" on public.donations;
create policy "Finance and admins read donations" on public.donations for select to authenticated using(public.has_role(array['super_admin','admin','finance']));
drop policy if exists "Staff manage donations" on public.donations;
create policy "Staff manage donations" on public.donations for update to authenticated using(public.has_role(array['super_admin','admin','finance'])) with check(public.has_role(array['super_admin','admin','finance']));
drop policy if exists "Staff read volunteer applications" on public.volunteer_applications;
create policy "Staff read volunteer applications" on public.volunteer_applications for select to authenticated using(public.is_staff());
drop policy if exists "Staff update volunteer applications" on public.volunteer_applications;
create policy "Staff update volunteer applications" on public.volunteer_applications for update to authenticated using(public.is_staff()) with check(public.is_staff());
drop policy if exists "Staff read contact messages" on public.contact_messages;
create policy "Staff read contact messages" on public.contact_messages for select to authenticated using(public.is_staff());
drop policy if exists "Staff update contact messages" on public.contact_messages;
create policy "Staff update contact messages" on public.contact_messages for update to authenticated using(public.is_staff()) with check(public.is_staff());
drop policy if exists "Case workers read beneficiaries" on public.beneficiaries;
create policy "Case workers read beneficiaries" on public.beneficiaries for select to authenticated using(public.has_role(array['super_admin','admin','case_worker']));
drop policy if exists "Case workers manage beneficiaries" on public.beneficiaries;
create policy "Case workers manage beneficiaries" on public.beneficiaries for all to authenticated using(public.has_role(array['super_admin','admin','case_worker'])) with check(public.has_role(array['super_admin','admin','case_worker']));
drop policy if exists "Users read own staff profile" on public.staff_profiles;
create policy "Users read own staff profile" on public.staff_profiles for select to authenticated using(user_id=auth.uid() or public.has_role(array['super_admin','admin']));
drop policy if exists "Admins manage staff profiles" on public.staff_profiles;
create policy "Admins manage staff profiles" on public.staff_profiles for all to authenticated using(public.has_role(array['super_admin'])) with check(public.has_role(array['super_admin']));
drop policy if exists "Admins read audit logs" on public.audit_logs;
create policy "Admins read audit logs" on public.audit_logs for select to authenticated using(public.has_role(array['super_admin','admin']));
drop policy if exists "Staff create audit logs" on public.audit_logs;
create policy "Staff create audit logs" on public.audit_logs for insert to authenticated with check(actor=auth.uid() and public.is_staff());

-- Secure storage: public-approved images only. Never upload private case files here.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('foundation-media','foundation-media',true,5242880,array['image/jpeg','image/png','image/webp','image/avif'])
on conflict(id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp','image/avif'];
drop policy if exists "Public read foundation media" on storage.objects;
drop policy if exists "Public read foundation media" on storage.objects;
create policy "Public read foundation media" on storage.objects for select using(bucket_id='foundation-media');
drop policy if exists "Staff upload foundation media" on storage.objects;
drop policy if exists "Staff upload foundation media" on storage.objects;
create policy "Staff upload foundation media" on storage.objects for insert to authenticated with check(bucket_id='foundation-media' and public.is_staff());
drop policy if exists "Staff update foundation media" on storage.objects;
drop policy if exists "Staff update foundation media" on storage.objects;
create policy "Staff update foundation media" on storage.objects for update to authenticated using(bucket_id='foundation-media' and public.is_staff()) with check(bucket_id='foundation-media' and public.is_staff());
drop policy if exists "Staff delete foundation media" on storage.objects;
drop policy if exists "Staff delete foundation media" on storage.objects;
create policy "Staff delete foundation media" on storage.objects for delete to authenticated using(bucket_id='foundation-media' and public.is_staff());

-- Private bucket for consent forms and case documents (private by design).
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('beneficiary-private','beneficiary-private',false,10485760,array['application/pdf','image/jpeg','image/png'])
on conflict(id) do update set public=false,file_size_limit=10485760;
drop policy if exists "Authorized case staff read private files" on storage.objects;
drop policy if exists "Authorized case staff read private files" on storage.objects;
create policy "Authorized case staff read private files" on storage.objects for select to authenticated using(bucket_id='beneficiary-private' and public.has_role(array['super_admin','admin','case_worker']));
drop policy if exists "Authorized case staff upload private files" on storage.objects;
drop policy if exists "Authorized case staff upload private files" on storage.objects;
create policy "Authorized case staff upload private files" on storage.objects for insert to authenticated with check(bucket_id='beneficiary-private' and public.has_role(array['super_admin','admin','case_worker']));
