-- The admin "Policy pages" module lists rows ordered by created_at, but
-- site_pages only defined updated_at (migration 003), so the query failed with
-- "column site_pages.created_at does not exist". Add the missing column.
alter table public.site_pages
add column if not exists created_at timestamptz not null default now();
