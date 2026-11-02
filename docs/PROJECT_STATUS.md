# Project scope and implementation checklist

This file is the source-of-truth checklist for the Ugo E Kloh Foundation rebuild. Preserve the approved visual direction: premium humanitarian/nonprofit presentation, forest green, warm gold and cream, editorial serif headings, generous spacing, authentic photography, strong mobile layouts and a clear donation journey. Use the World Villages for Children reference as broad design inspiration; create original layouts and do not copy proprietary assets.

## Agreed product mission
Collaborate with health facilities to provide medical support so vulnerable and poor children with burns can recover and thrive, while building partnerships with local and global communities to create a network of care and support. Key programme areas: burn-prevention and safety education for families and communities, fire-management education and burn-management education. Protect children's dignity and privacy in every feature.

## Public website scope
- [x] Homepage, hero, mission statement, two seeded programme cards, impact area and calls to action
- [x] About, live programmes, stories/news, donation, volunteer, partner and contact routes
- [x] News article listing
- [x] Public projects and partner directory connected to admin-managed content
- [x] Events listing
- [x] Gallery backed by approved Supabase media with consent flag
- [x] FAQs
- [x] Published impact reports
- [x] Policy-page publishing module (approved policy text still must be supplied)
- [x] Newsletter subscription capture and admin list
- [x] Admin email ON/OFF control and manual Gmail API (primary) / SendPulse (alternative) provider selection
- [x] Central email sender, branded HTML template, provider test action and sent/failed/skipped delivery log
- [x] Contact, volunteer, partnership, newsletter welcome, donor payment confirmation, staff invitation and case-assignment email triggers
- [ ] Newsletter campaign composer, unsubscribe links/automation and consent lifecycle
- [x] Mandatory first-login password change for newly created staff accounts
- [ ] Password-reset email flow
- [ ] Public site search and XML sitemap (requires confirmed production domain)
- [x] Route-aware page titles, descriptions, social-sharing metadata and admin no-index controls
- [x] Footer navigation checked against registered routes; contact email and owner-managed phone/address are actionable when configured

## Donations and payments
- [x] Server-side Paystack transaction initialization
- [x] Server-side transaction verification with amount/currency matching
- [x] Paystack webhook signature validation
- [x] Online Paystack-only donation flow; no offline pledge fallback
- [x] Programme-only donation checkout: general foundation support or one selected programme
- [x] Programme totals are recalculated from verified paid donations only
- [x] Downloadable donor receipt (HTML, printable to PDF)
- [x] Donor confirmation email trigger after verified successful payment (requires configured provider)
- [x] Admin donation ledger, filters, Paystack verification, Paystack refund requests with webhook status tracking, CSV export and receipt download
- [ ] End-to-end test-mode and live-mode verification, including one general, one programme donation
- [ ] Verify payment/email idempotency under webhook and return-page race conditions

## Administration
- [x] Supabase email/password admin sign-in
- [x] Basic authenticated CRUD for programmes, projects, news, events and partners
- [x] Public media bucket upload from admin, including programme cover-image upload and preview
- [x] Guided edit/create forms with human-readable fields, image previews and direct upload-to-field workflow
- [x] Responsive admin navigation, icon-led responsive hamburger navigation, dashboard shortcuts and record thumbnails
- [x] Owner-managed public foundation contact details
- [x] Staff account creation and activation/deactivation by super-admin
- [x] Role-specific admin navigation and permission enforcement
- [x] Beneficiary case registration, guardian consent fields, case-worker assignment and restricted private document uploads
- [x] Donation ledger, volunteer and contact-message management (partnership workflow remains basic)
- [x] Audit-log viewer
- [ ] Financial and impact reporting with CSV/PDF export
- [x] Foundation profile and contact settings
- [x] Email provider controls and delivery log
- [ ] Dashboard charts and date-range filters

## Supabase and safeguarding
- [x] PostgreSQL schema and row-level security migration
- [x] `foundation-media` public bucket for approved public images
- [x] `beneficiary-private` private bucket for restricted case files
- [x] Beneficiary and staff profile data tables
- [ ] Review policies with separate anonymous, staff, finance, case-worker and super-admin test accounts
- [x] Add file ownership/path controls for private case files
- [ ] Add documented retention, consent withdrawal and access logging workflows

## Infrastructure
- [x] React JSX + Vite frontend
- [x] Python FastAPI backend
- [x] Vercel SPA configuration
- [x] Render service configuration
- [x] Local development and deployment guides
- [x] GitHub Actions frontend build and backend compile validation
- [ ] Add automated unit/integration tests beyond CI build and compile checks
- [ ] Configure and verify Gmail OAuth production publishing/verification and SendPulse SMTP approval/sender authentication
- [ ] Test each email workflow with email OFF, Gmail ON, SendPulse ON and provider failure
- [ ] Add error monitoring, backups, uptime monitoring and production security review

## Go-live blockers
Do not call the platform production-ready until the unchecked safeguarding, access-control, payment, content-management, testing and legal-policy items have been implemented and verified. Do not invent beneficiaries, impact numbers, partner endorsements, bank details or foundation registration details. Use only verified organization information and guardian-consented content.
