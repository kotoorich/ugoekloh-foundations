-- Seed the foundation's two documented, child-focused burn prevention programmes.
-- These are published programme records, not frontend placeholders.
insert into public.programmes (title,slug,category,description,body,status)
values
(
  'Fire Safety in the Home',
  'fire-safety-in-the-home',
  'Burn prevention and family education',
  'Practical fire-safety education for families and caregivers to help prevent home fires and reduce the risk of burn injuries to children.',
  'This programme focuses on extending education to families and communities on burn prevention and safety measures. It promotes safer home environments, awareness of everyday fire hazards, and practical steps caregivers can take to protect children from burns.',
  'published'
),
(
  'Children and Fire Management at Home',
  'children-and-fire-management-at-home',
  'Fire management education',
  'Education for parents, caregivers and communities on managing fire risks around children and responding safely when fire-related incidents occur at home.',
  'This programme supports fire management education for families and communities, with a focus on children’s safety at home. It encourages practical prevention, safer household practices and awareness of appropriate actions when a fire emergency occurs.',
  'published'
)
on conflict (slug) do update set
  title=excluded.title,
  category=excluded.category,
  description=excluded.description,
  body=excluded.body,
  status='published',
  updated_at=now();
