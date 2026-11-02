create table if not exists public.email_settings (
 id integer primary key default 1 check (id=1),
 enabled boolean not null default false,
 provider text not null default 'gmail' check (provider in ('gmail','sendpulse')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id)
);
insert into public.email_settings(id,enabled,provider) values(1,false,'gmail') on conflict(id) do nothing;
create table if not exists public.email_delivery_logs (
 id uuid primary key default gen_random_uuid(),
 recipient text not null,
 subject text not null,
 provider text not null check(provider in ('gmail','sendpulse')),
 status text not null check(status in ('sent','failed','skipped')),
 category text not null,
 error_message text,
 provider_message_id text,
 created_at timestamptz not null default now()
);
create index if not exists email_delivery_logs_created_at_idx on public.email_delivery_logs(created_at desc);
alter table public.email_settings enable row level security;
alter table public.email_delivery_logs enable row level security;
drop policy if exists "Admins manage email settings" on public.email_settings;
create policy "Admins manage email settings" on public.email_settings for all
using(exists(select 1 from public.staff_profiles p where p.user_id=auth.uid() and p.is_active and p.role in ('super_admin','admin')))
with check(exists(select 1 from public.staff_profiles p where p.user_id=auth.uid() and p.is_active and p.role in ('super_admin','admin')));
drop policy if exists "Admins read email delivery logs" on public.email_delivery_logs;
create policy "Admins read email delivery logs" on public.email_delivery_logs for select
using(exists(select 1 from public.staff_profiles p where p.user_id=auth.uid() and p.is_active and p.role in ('super_admin','admin')));
