alter table public.donations add column if not exists refund_status text;
alter table public.donations add column if not exists provider_refund_id text;
