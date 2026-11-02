# Project scope and implementation checklist

This file is the source-of-truth checklist for the Ugo E Kloh Foundation rebuild. Preserve the approved visual direction: premium humanitarian/nonprofit presentation, forest green, warm gold and cream, editorial serif headings, generous spacing, authentic photography, strong mobile layouts and a clear donation journey. Use the World Villages for Children reference as broad design inspiration; create original layouts and do not copy proprietary assets.

## Agreed product mission
Support children recovering from burn injuries and other vulnerable children through medical/recovery assistance, rehabilitation, education, child welfare and community support. Protect children's dignity and privacy in every feature.

## Public website scope
- [x] Homepage, hero, mission statement, programme cards, campaign cards, impact area and calls to action
- [x] About, programmes, campaigns, stories, donation, volunteer, partner and contact routes
- [ ] News article listing and article detail
- [ ] Events listing and detail
- [ ] Gallery backed by approved Supabase media
- [ ] FAQs
- [ ] Published impact reports
- [ ] Privacy, terms, donation/refund and child safeguarding policy pages
- [ ] Newsletter subscription and email notifications
- [ ] Search, SEO metadata, sitemap and social sharing metadata

## Donations and payments
- [x] Server-side Paystack transaction initialization
- [x] Server-side transaction verification with amount/currency matching
- [x] Paystack webhook signature validation
- [x] Clear pending manual pledge fallback when Paystack is not configured
- [ ] Campaign selection in donation checkout
- [ ] Donor confirmation email and downloadable receipt
- [ ] Admin donation ledger, filters, reconciliation, refund recording and export
- [ ] End-to-end test-mode and live-mode verification

## Administration
- [x] Supabase email/password admin sign-in
- [x] Basic authenticated CRUD for programmes, campaigns, projects, news, events and partners
- [x] Public media bucket upload from admin
- [ ] Proper edit/create forms with validation and image previews
- [ ] Staff account creation, deactivation and role assignment by super-admin (no staff approval gate)
- [ ] Role-specific admin navigation and permission enforcement
- [ ] Beneficiary case-management interface with guardian consent records and restricted documents
- [ ] Donation, volunteer, contact-message and partnership management
- [ ] Audit-log viewer
- [ ] Financial, campaign and impact reporting with CSV/PDF export
- [ ] Admin settings for foundation profile, contact details, branding, payment instructions and email settings
- [ ] Dashboard charts and date-range filters

## Supabase and safeguarding
- [x] PostgreSQL schema and row-level security migration
- [x] `foundation-media` public bucket for approved public images
- [x] `beneficiary-private` private bucket for restricted case files
- [x] Beneficiary and staff profile data tables
- [ ] Review policies with separate anonymous, staff, finance, case-worker and super-admin test accounts
- [ ] Add file ownership/path controls for private case files
- [ ] Add documented retention, consent withdrawal and access logging workflows

## Infrastructure
- [x] React JSX + Vite frontend
- [x] Python FastAPI backend
- [x] Vercel SPA configuration
- [x] Render service configuration
- [x] Local development and deployment guides
- [x] GitHub Actions frontend build and backend compile validation
- [ ] Add automated unit/integration tests
- [ ] Add error monitoring, backups, uptime monitoring and production security review

## Go-live blockers
Do not call the platform production-ready until the unchecked safeguarding, access-control, payment, content-management, testing and legal-policy items have been implemented and verified. Do not invent beneficiaries, impact numbers, partner endorsements, bank details or foundation registration details. Use only verified organization information and guardian-consented content.
