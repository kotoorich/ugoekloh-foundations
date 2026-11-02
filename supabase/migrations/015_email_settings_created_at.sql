alter table public.email_settings
add column if not exists created_at timestamptz not null default now();
