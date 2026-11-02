create table if not exists public.partnership_applications (
 id uuid primary key default gen_random_uuid(), organization_name text not null,
 contact_name text not null, email text not null, phone text,
 partnership_type text, message text not null,
 status text not null default 'new' check(status in ('new','in_progress','approved','declined','closed')),
 assigned_to uuid references auth.users(id), created_at timestamptz not null default now()
);
alter table public.partnership_applications enable row level security;
drop policy if exists "Staff read partnership applications" on public.partnership_applications;
create policy "Staff read partnership applications" on public.partnership_applications for select to authenticated using(public.is_staff());
drop policy if exists "Staff update partnership applications" on public.partnership_applications;
create policy "Staff update partnership applications" on public.partnership_applications for update to authenticated using(public.is_staff()) with check(public.is_staff());
create index if not exists partnership_applications_created_idx on public.partnership_applications(created_at desc);
