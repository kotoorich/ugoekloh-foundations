-- Images stored inside the database.
--
-- Small, fixed foundation imagery (logos, seeded programme covers, default
-- illustrations) lives in this table so it survives independently of any
-- storage bucket. Larger imagery uploaded by administrators continues to go to
-- the public `foundation-media` bucket; see docs/DEPLOYMENT.md for the split.
--
-- The browser never reads this table directly. Public images are served by the
-- backend at /api/images/<id>, which checks `is_public` before returning bytes.
-- That keeps the anon key from being able to bulk-download the image table.
create table if not exists public.images (
  id uuid primary key default gen_random_uuid(),
  mime_type text not null check (mime_type in (
    'image/jpeg','image/png','image/webp','image/avif','image/svg+xml'
  )),
  byte_size integer not null check (byte_size > 0 and byte_size <= 2097152),
  data bytea not null,
  is_public boolean not null default false,
  alt_text text,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists images_public_idx on public.images(is_public, created_at desc);

alter table public.images enable row level security;

-- Staff may manage images. There is deliberately no policy for `anon`: public
-- delivery happens through the backend endpoint, never through the anon key.
drop policy if exists "Staff read images" on public.images;
create policy "Staff read images" on public.images
for select to authenticated using (public.is_staff());

drop policy if exists "Staff upload images" on public.images;
create policy "Staff upload images" on public.images
for insert to authenticated with check (public.is_staff() and uploaded_by = auth.uid());

drop policy if exists "Staff update images" on public.images;
create policy "Staff update images" on public.images
for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "Staff delete images" on public.images;
create policy "Staff delete images" on public.images
for delete to authenticated using (public.is_staff());
