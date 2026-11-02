-- Seed real, source-aligned foundation content. Slugs make this safe to run once
-- through the migration runner without overwriting future administrator edits.
insert into public.campaigns (title, slug, description, goal_amount, status)
values (
  'Care and Recovery Support for Children with Burns',
  'care-and-recovery-support-for-children-with-burns',
  'Support the foundation’s work with health facilities to help vulnerable children with burn injuries access medical support, recovery care and the assistance they need to heal.',
  0,
  'published'
)
on conflict (slug) do nothing;

insert into public.programmes (title, slug, category, description, body, status)
values
(
  'Burn Prevention and Home Fire Safety Education',
  'burn-prevention-home-fire-safety-education',
  'Prevention and safety education',
  'Extend education to families and communities on burn prevention and practical safety measures at home.',
  'The foundation’s prevention education focuses on helping families and communities understand burn risks, fire safety and practical measures that can make homes safer for children.',
  'published'
),
(
  'Burn Management and Recovery Education',
  'burn-management-and-recovery-education',
  'Burn management education',
  'Provide education about burn management and recovery, while supporting the foundation’s work to connect vulnerable children with health facilities.',
  'The foundation’s burn management education helps families and communities better understand burn care and recovery. The foundation’s mission includes working with health facilities to support vulnerable children with burn injuries.',
  'published'
)
on conflict (slug) do nothing;
