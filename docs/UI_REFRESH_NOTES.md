# UI refresh notes — 3 November 2026

## Visual updates
- Refreshed the public homepage hero with a healthcare-focused, non-graphic image and stronger responsive typography.
- Added a two-image care and recovery feature section to the homepage.
- Added responsive programme-card image fallbacks so programme cards remain visual even when no cover image has been uploaded.
- Added a photo-led page-intro treatment for public inner pages, plus refined gallery, card, button, spacing and footer styling.
- Updated imagery is illustrative. Replace remote Unsplash image URLs with foundation-owned, consent-approved photographs before using identifiable beneficiaries.

## Admin workspace
- Reworked the staff portal into a deep-green navigation rail with a light command-centre content area.
- Improved dashboard statistic cards, module shortcuts, headings, content lists, editor panels and interaction states.
- Added a mobile section selector treatment and responsive two-column dashboard cards; the existing slide-in navigation is retained for phones.
- Kept existing authentication, role permissions, Supabase queries, CRUD operations and safeguarding rules intact.

## Validation
- A production build could not be run in this environment because Vite dependencies were not available; `npm install` did not complete before timeout.
- After extracting, run `cd frontend && npm install && npm run build` to validate in your environment.

## Follow-up refinements — 3 November 2026
- Rebuilt the admin portal visual system around a full-width desktop command centre, a dedicated green navigation rail, clearer content hierarchy, and responsive mobile drawer navigation.
- Removed the public-site header and footer from every `/admin` route so staff see only the administration interface.
- Removed the homepage impact/statistics display while retaining the narrative commitment section.
- Kept child imagery restricted to foundation gallery records that are marked published and have `consent_verified=true`. Do not copy identifiable children’s burn-injury photographs from third-party websites without written image-reuse permission and documented guardian consent. Online patient stories are not automatically licensed for reuse.
- The homepage gallery continues to use consent-verified foundation uploads; use distinct approved images and descriptive alt text when publishing new gallery items.
- Build validation remains pending because dependency installation timed out in this environment. Run `cd frontend && npm install && npm run build` locally before deployment.
