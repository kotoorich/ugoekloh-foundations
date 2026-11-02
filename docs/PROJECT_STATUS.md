# Project scope and implementation checklist

This file is the source-of-truth checklist for the Ugo E Kloh Foundation rebuild. Preserve the approved visual direction: premium humanitarian/nonprofit presentation, forest green, warm gold and cream, editorial serif headings, generous spacing, authentic photography, strong mobile layouts and a clear donation journey. Use the World Villages for Children reference as broad design inspiration; create original layouts and do not copy proprietary assets.

## Agreed product mission
Support children recovering from burn injuries and other vulnerable children through medical/recovery assistance, rehabilitation, education, child welfare and community support. Protect children's dignity and privacy in every feature.

## Public website scope
- [x] Homepage, hero, mission statement, programme cards, campaign cards, impact area and calls to action
- [x] About, live programmes, campaigns, stories/news, donation, volunteer, partner and contact routes
- [x] News article listing\n- [x] Public projects and partner directory connected to admin-managed content
- [x] Events listing
- [x] Gallery backed by approved Supabase media with consent flag
- [x] FAQs
- [x] Published impact reports
- [x] Policy-page publishing module (approved policy text still must be supplied)
- [x] Newsletter subscription capture and admin list; [ ] email notifications and unsubscribe automation
- [ ] Search, SEO metadata, sitemap and social sharing metadata\n- [x] Footer navigation checked against registered routes; contact email and owner-managed phone/address are actionable when configured

## Donations and payments
- [x] Server-side Paystack transaction initialization
- [x] Server-side transaction verification with amount/currency matching
- [x] Paystack webhook signature validation
- [x] Clear pending manual pledge fallback when Paystack is not configured
- [x] Single-destination donation checkout: general foundation support, one campaign, or one programme\n- [x] Campaign and programme totals are recalculated from verified paid donations only
- [x] Downloadable donor receipt (HTML, printable to PDF); [ ] automated donor confirmation email
- [x] Admin donation ledger, filters, manual reconciliation, refund recording, CSV export and receipt download
- [ ] End-to-end test-mode and live-mode verification, including one general, one campaign and one programme donation

## Administration
- [x] Supabase email/password admin sign-in
- [x] Basic authenticated CRUD for programmes, campaigns, projects, news, events and partners
- [x] Public media bucket upload from admin
- [x] Guided edit/create forms with human-readable fields, image previews and direct upload-to-field workflow\n- [x] Responsive admin navigation, mobile section picker, dashboard shortcuts and record thumbnails\n- [x] Owner-managed public contact details and manual donation instructions
- [x] Staff account creation and activation/deactivation by super-admin
- [x] Role-specific admin navigation and permission enforcement
- [x] Beneficiary case registration, guardian consent fields, case-worker assignment and restricted private document uploads
- [x] Donation ledger, volunteer and contact-message management (partnership workflow remains basic)
- [x] Audit-log viewer
- [ ] Financial, campaign and impact reporting with CSV/PDF export
- [x] Foundation profile/contact/payment-instruction settings (branding and email-provider settings pending)
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
- [ ] Add error monitoring, backups, uptime monitoring and production security review

## Go-live blockers
Do not call the platform production-ready until the unchecked safeguarding, access-control, payment, content-management, testing and legal-policy items have been implemented and verified. Do not invent beneficiaries, impact numbers, partner endorsements, bank details or foundation registration details. Use only verified organization information and guardian-consented content.
