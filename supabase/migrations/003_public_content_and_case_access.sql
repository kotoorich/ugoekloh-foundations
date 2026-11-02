create table if not exists public.faqs (
 id uuid primary key default gen_random_uuid(), question text not null, answer text not null,
 sort_order integer not null default 0, status text not null default 'draft' check(status in ('draft','published','archived')),
 created_at timestamptz not null default now()
);
create table if not exists public.gallery_items (
 id uuid primary key default gen_random_uuid(), title text not null, description text,
 image_path text not null, alt_text text not null, consent_reference text,
 consent_verified boolean not null default false,
 status text not null default 'draft' check(status in ('draft','published','archived')),
 created_at timestamptz not null default now()
);
create table if not exists public.impact_reports (
 id uuid primary key default gen_random_uuid(), title text not null, reporting_period text,
 summary text, report_path text, status text not null default 'draft' check(status in ('draft','published','archived')),
 published_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.site_pages (
 id uuid primary key default gen_random_uuid(), slug text not null unique, title text not null,
 body text not null, status text not null default 'draft' check(status in ('draft','published','archived')),
 updated_at timestamptz not null default now()
);
alter table public.faqs enable row level security;
alter table public.gallery_items enable row level security;
alter table public.impact_reports enable row level security;
alter table public.site_pages enable row level security;
create policy "Public read published FAQs" on public.faqs for select using(status='published');
create policy "Staff manage FAQs" on public.faqs for all to authenticated using(public.has_role(array['super_admin','admin','editor'])) with check(public.has_role(array['super_admin','admin','editor']));
create policy "Public read approved gallery" on public.gallery_items for select using(status='published' and consent_verified=true);
create policy "Staff manage gallery" on public.gallery_items for all to authenticated using(public.has_role(array['super_admin','admin','editor'])) with check(public.has_role(array['super_admin','admin','editor']));
create policy "Public read published reports" on public.impact_reports for select using(status='published');
create policy "Staff manage reports" on public.impact_reports for all to authenticated using(public.has_role(array['super_admin','admin','editor'])) with check(public.has_role(array['super_admin','admin','editor']));
create policy "Public read published pages" on public.site_pages for select using(status='published');
create policy "Staff manage pages" on public.site_pages for all to authenticated using(public.has_role(array['super_admin','admin','editor'])) with check(public.has_role(array['super_admin','admin','editor']));
create index if not exists faqs_sort_idx on public.faqs(sort_order);
create index if not exists impact_published_idx on public.impact_reports(published_at desc);
drop policy if exists "Case workers read beneficiaries" on public.beneficiaries;
create policy "Case workers read beneficiaries" on public.beneficiaries for select to authenticated using(public.has_role(array['super_admin','admin']) or (public.has_role(array['case_worker']) and assigned_to=auth.uid()));
drop policy if exists "Case workers manage beneficiaries" on public.beneficiaries;
create policy "Case workers manage beneficiaries" on public.beneficiaries for all to authenticated using(public.has_role(array['super_admin','admin']) or (public.has_role(array['case_worker']) and assigned_to=auth.uid())) with check(public.has_role(array['super_admin','admin']) or (public.has_role(array['case_worker']) and assigned_to=auth.uid()));
drop policy if exists "Authorized case staff update private files" on storage.objects;
create policy "Authorized case staff update private files" on storage.objects for update to authenticated using(bucket_id='beneficiary-private' and (public.has_role(array['super_admin','admin']) or (public.has_role(array['case_worker']) and exists(select 1 from public.beneficiaries b where b.assigned_to=auth.uid() and b.id::text=split_part(name,'/',1))))) with check(bucket_id='beneficiary-private' and (public.has_role(array['super_admin','admin']) or (public.has_role(array['case_worker']) and exists(select 1 from public.beneficiaries b where b.assigned_to=auth.uid() and b.id::text=split_part(name,'/',1)))));
