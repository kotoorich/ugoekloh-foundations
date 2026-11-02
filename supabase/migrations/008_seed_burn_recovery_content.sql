-- Seed the foundation's real burn-prevention and recovery focus.
-- Insert only once by stable slug; later edits are managed through the admin workspace.
insert into public.campaigns (title, slug, description, goal_amount, status)
values (
  'Help Children Recover from Burn Injuries',
  'help-children-recover-from-burn-injuries',
  'Support access to medical care, recovery support and rehabilitation for vulnerable children living with burn injuries, in collaboration with health facilities and caring communities.',
  0,
  'published'
)
on conflict (slug) do nothing;

insert into public.programmes (title, slug, category, description, body, status)
values
(
  'Burn Prevention & Home Fire Safety Education',
  'burn-prevention-home-fire-safety-education',
  'PREVENTION & FAMILY EDUCATION',
  'Educating families and communities about burn prevention, home fire safety and practical steps that can help protect children from burn injuries.',
  'This programme extends education to families and communities on burn prevention and safety measures. It includes fire safety in the home and practical education for caregivers and children about managing fire risks at home.',
  'published'
),
(
  'Burn Management & Recovery Support',
  'burn-management-recovery-support',
  'MEDICAL SUPPORT & RECOVERY',
  'Working with health facilities and community partners to help vulnerable children access medical support, burn management, recovery care and rehabilitation.',
  'This programme focuses on burn management education and support for children recovering from burn injuries. The foundation seeks to collaborate with health facilities and build long-term partnerships with local and global communities to create a network of care and support.',
  'published'
)
on conflict (slug) do nothing;

insert into public.projects (title, description, status)
values
(
  'Fire Safety in the Home',
  'Community education on identifying household fire risks and taking practical steps to prevent burns and protect children.',
  'published'
),
(
  'Children and Fire Safety at Home',
  'Child- and caregiver-focused education about fire hazards, safe behaviour around heat and fire, and preventing burn injuries in the home.',
  'published'
)
on conflict do nothing;
