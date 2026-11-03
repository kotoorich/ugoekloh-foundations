# Administration UI and action audit

## Changes in this refresh

- Replaced the fixed left sidebar and mobile drawer with a compact workspace selector and a horizontally scrollable section bar. There is no left navigation column at desktop or mobile widths.
- Removed the duplicated welcome banner so the active workspace has one clear page heading.
- Applied one warm neutral / brown / forest-green visual system to the admin top bar, navigation, cards, forms, lists, dialogs and mobile layouts.
- Kept the administration portal independent of the public site chrome. `App.jsx` renders neither the public `Header` nor public `Footer` for any `/admin` route.
- Made database loading failures visible. Missing relations or columns now produce a specific instruction to apply the SQL migrations instead of leaving the user with an unexplained empty page.
- Prevented the Foundation Settings module from querying `created_at`; that table uses `updated_at` and is loaded by its dedicated settings form.
- Limited overview counts to modules visible to the active workspace role, avoiding false zeroes caused by role-based row-level security.
- Staff account creation now uses the same configured `apiUrl` as the rest of the admin API calls.
- Removed duplicate FastAPI method/path registrations for public news, events, settings, newsletter, staff creation and partnership submission. The stale duplicate handlers could shadow the current versions and omit email/password-change behavior. The duplicate `require_super_admin` definition was removed too.
- Case status changes now report if the status saved but its case-history audit entry failed, rather than silently claiming the entire action succeeded.

## Admin module to database mapping

| Admin module | Supabase table / service | Schema migration |
|---|---|---|
| Programmes | `programmes` | `001`, `007`, `008`, `010` |
| Projects | `projects` | `001` |
| News | `news` | `001` |
| Events | `events` | `001`, `013` |
| Partners | `partners` | `001` |
| Donations | `donations` + `programmes` relation + `donation_receipts` | `001`, `002`, `007`, `016` |
| Volunteers | `volunteer_applications` | `001`, `002` |
| Messages | `contact_messages` | `001`, `002` |
| Child cases | `beneficiaries`, `staff_profiles`, `beneficiary_case_activities`, `beneficiary_documents`, private storage bucket | `001`, `002`, `010`, `011`, `018` |
| Staff | `staff_profiles` + Supabase Auth admin API | `001`, `012`, `017`, `019` |
| Audit trail | `audit_logs` | `001` |
| Foundation settings | `foundation_settings` | `002`, `013` |
| FAQs | `faqs` | `003` |
| Gallery | `gallery_items` + `foundation-media` storage bucket | `003` |
| Impact reports | `impact_reports` | `003`, `013` |
| Policy pages | `site_pages` | `003` |
| Newsletter | `newsletter_subscribers` | `002` |
| Partnerships | `partnership_applications` | `005` |
| Email settings | backend endpoints + `email_settings` / `email_delivery_logs` | `014`, `015` |

All 20 admin module keys have a corresponding table or explicitly documented service-backed module in the checked-in migration set. The two special singleton settings modules are not queried as generic timestamped record lists.

## Important deployment requirement

A source-code change cannot create tables inside a separately hosted Supabase project by itself. The Render backend must have the correct private `SUPABASE_DB_URL` Session Pooler URI, and `SUPABASE_URL` / Vercel `VITE_SUPABASE_URL` must refer to the same Supabase project. The backend applies the 21 checked-in migration files at startup and records them in `foundation_schema_migrations`. If the frontend points to another project, the admin portal will report missing tables even when the backend migrated a different project.

Never put `SUPABASE_DB_URL` or the service-role key in Vercel, browser code, or GitHub.

## Verification performed for this package

- Python syntax compilation passed for `backend/main.py`, `backend/migration_runner.py`, and `backend/email_service.py`.
- Static migration audit found all 20 admin module keys represented by the migration set or explicitly treated as a special settings/service module.
- Confirmed the public `Header` and `Footer` are both conditionally excluded for `/admin` routes.
- Confirmed the old sidebar JSX is no longer rendered.
- Python AST route audit found no duplicate HTTP method/path registrations (21 unique route registrations).
- Frontend production build was not run: `npm install` timed out in this environment. Run `npm install` and `npm run build` before deployment, then test each admin action against the actual Supabase project with the intended staff roles.

## Manual production acceptance checks still required

- Sign in as super-admin, admin, editor, finance, case-worker and staff accounts.
- Create, edit, publish/unpublish and delete one safe test content record in each content module.
- Upload and replace an approved public image; verify the storage object and public URL.
- Verify donation payment, receipt download and refund workflow in Paystack test mode.
- Test volunteer, contact and partnership status changes.
- Test staff creation, role change, deactivation and reactivation.
- Test case registration, assignment, status change, activity note and private document upload with separate admin and case-worker accounts.
- Test foundation settings, newsletter status, email settings and audit log access.
- Confirm the public header and footer never appear on `/admin`, at desktop and mobile widths.
