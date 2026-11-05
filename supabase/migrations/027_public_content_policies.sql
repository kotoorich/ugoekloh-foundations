-- Row-level security for the public content tables.
--
-- 001_initial_schema.sql enabled RLS on programmes, news, events, partners,
-- campaigns and projects, but no migration ever created a policy for them. With
-- RLS on and no policy, PostgreSQL denies every row to every role, so:
--
--   * the admin dashboard could not read or write programmes, news, events or
--     partners -- every create, edit, delete and status change failed, and the
--     sections appeared permanently empty;
--   * /api/public/programmes returns nothing, so the public programme listing
--     and the donation destination picker were empty even with content saved.
--
-- These policies mirror the pattern already used for faqs, gallery_items,
-- impact_reports and site_pages in 003_public_content_and_case_access.sql:
-- everyone may read published rows, and editors, admins and the super
-- administrator may manage everything.

-- Programmes ---------------------------------------------------------------

drop policy if exists "Public read published programmes" on public.programmes;
create policy "Public read published programmes" on public.programmes
  for select using (status = 'published');

drop policy if exists "Staff manage programmes" on public.programmes;
create policy "Staff manage programmes" on public.programmes
  for all to authenticated
  using (public.has_role(array['super_admin', 'admin', 'editor']))
  with check (public.has_role(array['super_admin', 'admin', 'editor']));

-- News and stories ---------------------------------------------------------

drop policy if exists "Public read published news" on public.news;
create policy "Public read published news" on public.news
  for select using (status = 'published');

drop policy if exists "Staff manage news" on public.news;
create policy "Staff manage news" on public.news
  for all to authenticated
  using (public.has_role(array['super_admin', 'admin', 'editor']))
  with check (public.has_role(array['super_admin', 'admin', 'editor']));

-- Events -------------------------------------------------------------------

drop policy if exists "Public read published events" on public.events;
create policy "Public read published events" on public.events
  for select using (status = 'published');

drop policy if exists "Staff manage events" on public.events;
create policy "Staff manage events" on public.events
  for all to authenticated
  using (public.has_role(array['super_admin', 'admin', 'editor']))
  with check (public.has_role(array['super_admin', 'admin', 'editor']));

-- Partners -----------------------------------------------------------------

drop policy if exists "Public read published partners" on public.partners;
create policy "Public read published partners" on public.partners
  for select using (status = 'published');

drop policy if exists "Staff manage partners" on public.partners;
create policy "Staff manage partners" on public.partners
  for all to authenticated
  using (public.has_role(array['super_admin', 'admin', 'editor']))
  with check (public.has_role(array['super_admin', 'admin', 'editor']));

-- Campaigns ----------------------------------------------------------------
-- Not edited by the current dashboard, but the table is public content and
-- carries the same status convention, so it is secured the same way rather
-- than left closed to everyone.

drop policy if exists "Public read active campaigns" on public.campaigns;
create policy "Public read active campaigns" on public.campaigns
  for select using (status in ('published', 'completed'));

drop policy if exists "Staff manage campaigns" on public.campaigns;
create policy "Staff manage campaigns" on public.campaigns
  for all to authenticated
  using (public.has_role(array['super_admin', 'admin', 'editor']))
  with check (public.has_role(array['super_admin', 'admin', 'editor']));

-- Projects -----------------------------------------------------------------
-- Retired from the public navigation, but retained so historical rows stay
-- readable to staff instead of being denied outright.

drop policy if exists "Public read published projects" on public.projects;
create policy "Public read published projects" on public.projects
  for select using (status = 'published');

drop policy if exists "Staff manage projects" on public.projects;
create policy "Staff manage projects" on public.projects
  for all to authenticated
  using (public.has_role(array['super_admin', 'admin', 'editor']))
  with check (public.has_role(array['super_admin', 'admin', 'editor']));
