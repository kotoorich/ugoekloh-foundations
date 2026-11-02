-- Retire the old generic campaign and duplicate seed content.
-- Keep the two programmes confirmed by the foundation's Form LF-2.
update public.campaigns
set status = 'archived', updated_at = now()
where status <> 'archived';

update public.programmes
set status = 'archived', updated_at = now()
where slug in (
  'burn-prevention-home-fire-safety-education',
  'burn-management-and-recovery-education',
  'burn-management-recovery-support'
)
and status <> 'archived';

-- Ensure the two agreed public programmes remain published.
update public.programmes
set status = 'published', updated_at = now()
where slug in (
  'fire-safety-in-the-home',
  'children-and-fire-management-at-home'
);
