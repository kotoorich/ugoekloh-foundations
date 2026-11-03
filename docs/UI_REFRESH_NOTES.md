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
