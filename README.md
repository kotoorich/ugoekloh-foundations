# Ugo E Kloh Foundation — Website & Administration Platform

A full-stack foundation website for publishing approved updates, receiving donations, managing volunteers and partners, and coordinating child-support cases.

> **How to use this guide:** Values such as YOUR_PROJECT_REF, YOUR_RENDER_SERVICE and YOUR_SECRET_KEY are examples only. Replace them with the real values from your accounts. Never copy a placeholder into a live setting.

## 1. What's included

- Public website: Home, About, Programmes, Stories, News, Events, Gallery, Impact Reports, FAQs, Policies and Contact.
- Get involved: Volunteer applications, partnership enquiries and newsletter subscriptions.
- Donations: Paystack checkout, server-side verification, one destination per gift (general foundation support or one programme), Paystack online checkout, verified payment tracking and downloadable receipts.
- Admin workspace: Guided content editing, direct image uploads with previews, donation ledger with destination labels, enquiries, staff accounts and foundation settings.
- Child case management: Guardian consent records, case-worker assignment and private case-document uploads.
- Supabase database, authentication, row-level security and separate public/private storage buckets.

## 2. Services and tools

| Service | Purpose | Website |
|---|---|---|
| GitHub | Source code | https://github.com |
| Supabase | Database, login and storage | https://supabase.com |
| Render | Python API hosting | https://render.com |
| Vercel | React website hosting | https://vercel.com |
| Paystack | Online donations, when enabled | https://paystack.com |

For local development, install Git, Node.js LTS and Python 3.11. The Render backend is pinned to Python 3.11.11 in `backend/.python-version` to prevent an incompatible default runtime from triggering a Rust source build.

Repository: https://github.com/kotoorich/ugoekloh-foundations

**Deployment instructions:** This README and [the detailed deployment guide](docs/DEPLOYMENT.md) use the same environment-variable names and setup sequence. If deployment steps change, update both together.

## Exact environment variables — use this as your checklist

The frontend uses the Supabase project URL and public key. The backend also uses a private `SUPABASE_DB_URL` connection for automatic, versioned migrations; you do not need to run SQL manually.

### Vercel — frontend (3 variables)

Add these under **Vercel → Project → Settings → Environment Variables**:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY
VITE_API_URL=https://YOUR_RENDER_SERVICE.onrender.com
```

All three are required. Replace the example URLs and key with the values from your own Supabase and Render projects.

### Render — backend (10 variables, including first-admin setup)

Add these under **Render → Your Web Service → Environment**:

```env
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
SUPABASE_DB_URL=YOUR_SUPABASE_SESSION_POOLER_URI
INITIAL_ADMIN_EMAIL=admin@your-foundation-domain.org
INITIAL_ADMIN_PASSWORD=YOUR_LONG_RANDOM_PASSWORD
INITIAL_ADMIN_NAME=Foundation Administrator
FRONTEND_URL=https://YOUR_VERCEL_DOMAIN.vercel.app
ALLOWED_ORIGINS=https://YOUR_VERCEL_DOMAIN.vercel.app
PAYSTACK_SECRET_KEY=
PAYSTACK_CALLBACK_URL=https://YOUR_VERCEL_DOMAIN.vercel.app/donation/return
```

| Variable | Required? | Purpose |
|---|---|---|
| `SUPABASE_URL` | Yes | Connects the backend to your Supabase project |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Private backend access to Supabase |
| `SUPABASE_DB_URL` | Yes | Private Session Pooler connection for automatic schema migrations |
| `INITIAL_ADMIN_EMAIL` | First setup | Initial super-admin email |
| `INITIAL_ADMIN_PASSWORD` | First setup | Initial super-admin password; remove after bootstrap |
| `INITIAL_ADMIN_NAME` | First setup | Initial super-admin display name |
| `FRONTEND_URL` | Yes for production | Your deployed website address |
| `ALLOWED_ORIGINS` | Yes for production | Allows your website to call the API |
| `PAYSTACK_SECRET_KEY` | Only when enabling Paystack | Private Paystack test/live secret |
| `PAYSTACK_CALLBACK_URL` | Only when enabling Paystack | Where donors return after checkout |

Online donations use Paystack only. Keep the secret key in Render; until Paystack is configured, the donation form will explain that online payments are temporarily unavailable. No manual pledges or offline payment instructions are accepted.

### Where to get the values

- `SUPABASE_URL`: Supabase Dashboard → Project Settings → API.
- `VITE_SUPABASE_ANON_KEY`: Supabase Dashboard → Project Settings → API Keys. Use the publishable key, or the legacy anon key if that is what your project provides.
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase Dashboard → Project Settings → API Keys. Use the secret key, or the legacy service_role key if that is what your project provides.
- `SUPABASE_DB_URL`: Supabase Dashboard → Connect → Session pooler. Copy the URI and replace its password placeholder with your database password.
- `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD`, `INITIAL_ADMIN_NAME`: choose these yourself for the foundation's first administrator.
- `VITE_API_URL`: the Render service URL, without an extra path such as `/api`.
- `FRONTEND_URL` and `ALLOWED_ORIGINS`: your Vercel website URL.
- Paystack values: your Paystack dashboard.

**Important security rules**
- Put `VITE_SUPABASE_ANON_KEY` in Vercel only. It is the browser-safe publishable/anon key and must be protected by Supabase Row Level Security.
- Put `SUPABASE_SERVICE_ROLE_KEY` and `PAYSTACK_SECRET_KEY` in Render only. Never put them in Vercel, frontend code, GitHub, or a public document.
- Keep `SUPABASE_DB_URL` and all administrator credentials in Render only. Never put them in Vercel or GitHub.
- After changing environment variables on Vercel, redeploy the frontend. After changing them on Render, save and restart/redeploy the service if prompted.

For local development, copy `frontend/.env.example` to `frontend/.env` and `backend/.env.example` to `backend/.env`. The exact local values and commands are in [Local Development](docs/LOCAL_DEVELOPMENT.md).

---


# PART A — SUPABASE DATABASE

## 3. Create your Supabase project

1. Sign in to Supabase.
2. Click **New project**.
3. Choose your organization.
4. Set the project name to an identifiable name, for example: ugoekloh-foundation-prod.
5. Create a strong database password and save it securely.
6. Select a region suitable for your users.
7. Click **Create new project** and wait for provisioning.

### Example: what the Supabase details look like

These are sample formats, not real credentials.

| Setting | Example value | Where to find it |
|---|---|---|
| Project URL | https://YOUR_PROJECT_REF.supabase.co | Project Settings → API |
| Anon/public key | YOUR_SUPABASE_ANON_KEY | Project Settings → API |
| Service-role/secret key | YOUR_SUPABASE_SERVICE_ROLE_KEY | Project Settings → API |

**Security:** The anon/public key is used by the frontend and relies on Row Level Security. The service-role key bypasses RLS. It must go in Render only. Never put the service-role key in Vercel, React code, GitHub or a public document.

**The backend uses `SUPABASE_DB_URL` privately for automatic schema migrations.** It is separate from the Supabase API keys and must never be exposed to the browser.

## 4. Automatic database setup — no manual SQL steps

The backend applies the numbered SQL files in `supabase/migrations/` automatically during startup, using the private `SUPABASE_DB_URL` connection. The deployment guide documents the same process:

- On the first deployment, it creates the schema, security policies, indexes, triggers and storage buckets.
- It records completed migrations in `public.foundation_schema_migrations`.
- On later redeployments, it applies only migration files that have not run before. Existing records are not deleted.
- New database changes are delivered as a new numbered SQL migration file; do not edit an already-applied migration. Migration `007_directed_programme_donations.sql` adds programme-directed giving and recalculates programme totals from verified paid donations. Migration `008_burn_prevention_programmes.sql` seeds the two approved burn-prevention programmes.

**One-time connection setting:** add `SUPABASE_DB_URL` to Render. In Supabase, open **Connect → Session pooler**, copy the URI, and replace its password placeholder with the database password. This is a private backend secret; never put it in Vercel or GitHub. Follow the same instructions in [the deployment guide](docs/DEPLOYMENT.md).

The migration runner uses this private connection to apply schema changes. The Supabase service-role key alone cannot create PostgreSQL tables or policies through the normal REST API, which is why this separate database connection is necessary.

The migrations also seed the two published programmes **Fire Safety in the Home** and **Children and Fire Management at Home**. Their cover images can be uploaded from the programme editor; no image URL needs to be pasted.

The two storage buckets are created by the migrations:
- `foundation-media`: public approved media.
- `beneficiary-private`: private case documents.

## 5. Configure Supabase authentication

1. Open **Authentication → URL Configuration**.
2. You will return here after Vercel gives you your website domain.
3. Set the Site URL to your actual website domain, for example https://YOUR_VERCEL_DOMAIN.vercel.app.
4. Add that same domain to the allowed redirect URLs.
5. Configure a reliable authentication email sender before inviting staff.

### First administrator — automatic setup

Set `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD` (minimum 12 characters), and `INITIAL_ADMIN_NAME` in Render. On backend startup, the system creates the Auth user if needed and grants the initial `super_admin` role. Existing users are not given a new password. Remove the initial password variable after the first successful setup. No SQL or manual user creation is needed.


---

# PART B — RENDER BACKEND API

## 6. Create the Render web service

Deploy the backend first. This gives you an API address that you will later enter in Vercel.

1. Sign in to Render.
2. Click **New → Web Service**.
3. Connect GitHub if prompted.
4. Select repository: kotoorich/ugoekloh-foundations.
5. Name the service, for example: ugoekloh-foundation-api.
6. Enter these settings:

| Render field | Enter this |
|---|---|
| Runtime | Python 3.11.11 (pinned automatically) |
| Root Directory | backend |
| Build Command | pip install -r requirements.txt |
| Start Command | uvicorn main:app --host 0.0.0.0 --port $PORT |
| Health Check Path | /api/health |

7. Open the service's **Environment** tab.
8. Add the variables in the following table.

### Render environment variables — same list as the deployment guide

Add these to **Render → Your Web Service → Environment**. The names and purposes below match [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

| Key | Value to enter |
|---|---|
| `SUPABASE_URL` | `https://YOUR_PROJECT_REF.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Your private Supabase service-role/secret key |
| `SUPABASE_DB_URL` | Supabase Session Pooler URI, including the database password |
| `INITIAL_ADMIN_EMAIL` | Email address for the first foundation super-admin |
| `INITIAL_ADMIN_PASSWORD` | Long random password (minimum 12 characters) |
| `INITIAL_ADMIN_NAME` | Display name for the first super-admin |
| `FRONTEND_URL` | Your exact Vercel website URL |
| `ALLOWED_ORIGINS` | Your exact Vercel website URL |
| `PAYSTACK_SECRET_KEY` | Leave empty until Paystack test mode is ready |
| `PAYSTACK_CALLBACK_URL` | Your Vercel URL followed by `/donation/return` |

Set the initial-admin values before the first deployment. After the backend successfully creates the administrator, remove `INITIAL_ADMIN_PASSWORD` from Render. The bootstrap does not overwrite the password of an existing Auth user and skips creating/promoting another account when an active super-admin already exists.


At first, you may not yet know your Vercel domain. You can deploy Render with the Supabase values first, then return to Render and fill in FRONTEND_URL, PAYSTACK_CALLBACK_URL and ALLOWED_ORIGINS after Vercel gives you the real domain.

9. Click **Save Changes**.
10. Click **Create Web Service** or **Deploy**.
11. Wait for the service to finish deploying.
12. Copy the Render service domain from the dashboard.

### Example Render domain

    https://ugoekloh-foundation-api.onrender.com

Your actual service name/domain may be different. Use the exact domain shown in your Render dashboard.

### Test the API

Open this URL, replacing the example domain with yours:

    https://YOUR_RENDER_SERVICE.onrender.com/api/health

Expected response:

    {
      "status": "ok",
      "service": "ugo-ekloh-foundation-api"
    }

API documentation:

    https://YOUR_RENDER_SERVICE.onrender.com/docs

If the health check does not return the expected response, open Render **Logs** and fix the error before proceeding. If Render still selects Python 3.14, confirm Root Directory is `backend`, then use **Clear build cache & deploy**.

---

# PART C — VERCEL FRONTEND WEBSITE

## 7. Import the repository into Vercel

1. Sign in to Vercel.
2. Click **Add New → Project**.
3. Import the GitHub repository kotoorich/ugoekloh-foundations.
4. Configure the project as follows:

| Vercel field | Enter this |
|---|---|
| Framework Preset | Vite |
| Root Directory | frontend |
| Build Command | npm run build |
| Output Directory | dist |
| Install Command | npm install |

5. Open **Environment Variables** before deploying.
6. Add the three variables below.

### Vercel environment variables — sample template

| Key | Example value |
|---|---|
| VITE_SUPABASE_URL | https://YOUR_PROJECT_REF.supabase.co |
| VITE_SUPABASE_ANON_KEY | YOUR_SUPABASE_ANON_KEY |
| VITE_API_URL | https://YOUR_RENDER_SERVICE.onrender.com |

Example only:

- Website: https://ugoekloh-foundation.vercel.app
- API: https://ugoekloh-foundation-api.onrender.com
- Supabase: https://YOUR_PROJECT_REF.supabase.co

7. Click **Deploy**.
8. Wait for the build to finish.
9. Open the Vercel domain and check that the homepage loads.
10. Copy the exact website domain from Vercel.

**Never add SUPABASE_SERVICE_ROLE_KEY or PAYSTACK_SECRET_KEY to Vercel.** Those are private backend secrets and must remain in Render.

## 8. Connect the final website domain to Supabase and Render

Now that you have the real Vercel domain:

1. In Supabase, open **Authentication → URL Configuration**. Set the Site URL and allowed redirect URL to the Vercel domain.
2. In Render, update FRONTEND_URL to the Vercel domain.
3. In Render, update ALLOWED_ORIGINS to the Vercel domain.
4. In Render, update PAYSTACK_CALLBACK_URL to the Vercel domain plus /donation/return.
5. Save the Render environment changes and redeploy/restart the service if prompted.
6. Confirm VITE_API_URL in Vercel points to the exact Render service domain.

Example values:

    FRONTEND_URL=https://ugoekloh-foundation.vercel.app
    ALLOWED_ORIGINS=https://ugoekloh-foundation.vercel.app
    PAYSTACK_CALLBACK_URL=https://ugoekloh-foundation.vercel.app/donation/return
    VITE_API_URL=https://ugoekloh-foundation-api.onrender.com

Replace those example domains with the actual domains assigned to your accounts.

---

# PART D — PAYSTACK DONATIONS

## 9. Configure Paystack after the website and API work

1. Sign in to Paystack.
2. Complete the merchant onboarding and verification required for the foundation.
3. Open the API keys/settings section.
4. Start with a test secret key. A test key commonly begins with sk_test_.
5. Add the test secret key to Render as PAYSTACK_SECRET_KEY.
6. Confirm PAYSTACK_CALLBACK_URL is your deployed website's donation return page.
7. In Paystack webhook settings, enter:

    https://YOUR_RENDER_SERVICE.onrender.com/api/payments/paystack/webhook

8. Save the webhook settings.
9. Restart/redeploy Render if required.
10. Run test transactions using Paystack's approved test credentials and payment methods.
11. Confirm a successful transaction is verified by the backend and appears as paid in the admin donation ledger.
12. Confirm failed, abandoned and mismatched-amount transactions are not recorded as paid.
13. Only switch to live credentials after successful end-to-end tests and merchant approval.

**Never place the Paystack secret key in React code, GitHub or Vercel.** It belongs only in Render's private environment settings.

## 10. If Paystack is not ready

Online donations are Paystack-only. If the Paystack secret key is not configured, checkout is temporarily unavailable and the form will not accept offline pledges. Configure Paystack in Render before accepting donations.

---

# PART E — TEST YOUR DEPLOYMENT

## 11. First launch test checklist

| Test | Expected result |
|---|---|
| Open Vercel website | Homepage loads |
| Open Render /api/health | JSON response with status ok |
| Open About and Programmes | Pages load |
| Open admin sign-in | Sign-in page appears; no public admin registration |
| Sign in as super-admin | Admin workspace opens |
| Create a draft programme | Visible in admin, not public |
| Publish a programme | Appears on the public website |
| Upload approved public image | Saved to foundation-media |
| Submit contact/volunteer/partnership form | Submission appears in admin |
| Subscribe to newsletter | Subscriber appears in admin |
| Submit manual donation pledge | Donation remains pending |
| Run Paystack test payment | Verified successful payment appears as paid |
| Test private case file permissions | Unauthorized users cannot access the file |

Test the website on a phone as well as a desktop computer.

## 12. Add a custom domain later

1. In Vercel, open **Settings → Domains**.
2. Add the foundation's domain.
3. Follow the exact DNS records Vercel provides at your domain registrar.
4. Wait for domain verification and HTTPS activation.
5. Update Supabase Site URL and allowed redirect URLs.
6. Update Render FRONTEND_URL, ALLOWED_ORIGINS and PAYSTACK_CALLBACK_URL.
7. Redeploy/restart services if required.
8. Test sign-in, donation return and public forms again.

---

# PART F — RUN THE PROJECT ON YOUR WINDOWS COMPUTER

## 13. Clone the repository

Open PowerShell:

    git clone https://github.com/kotoorich/ugoekloh-foundations.git
    cd ugoekloh-foundations

## 14. Run the frontend

In a PowerShell terminal:

    cd frontend
    Copy-Item .env.example .env
    npm install
    npm run dev

Open frontend/.env and replace the sample values:

    VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
    VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
    VITE_API_URL=http://localhost:8000

The Vite development website normally runs at:

    http://localhost:5173

## 15. Run the backend

Open a **second PowerShell window** from the repository folder:

    cd backend
    py -3.11 -m venv .venv
    .\.venv\Scripts\Activate.ps1
    pip install -r requirements.txt
    Copy-Item .env.example .env

Open backend/.env and enter your own values:

    SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
    SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
    SUPABASE_DB_URL=YOUR_SUPABASE_SESSION_POOLER_URI
    INITIAL_ADMIN_EMAIL=admin@your-foundation-domain.org
    INITIAL_ADMIN_PASSWORD=YOUR_LONG_RANDOM_PASSWORD
    INITIAL_ADMIN_NAME=Foundation Administrator
    PAYSTACK_SECRET_KEY=
    PAYSTACK_CALLBACK_URL=http://localhost:5173/donation/return
    FRONTEND_URL=http://localhost:5173
    ALLOWED_ORIGINS=http://localhost:5173

Start the API:

    uvicorn main:app --reload --port 8000

Local addresses:

- Website: http://localhost:5173
- API health: http://localhost:8000/api/health
- API documentation: http://localhost:8000/docs

Keep both terminal windows open while developing.

---

# PART G — SECURITY AND GO-LIVE REQUIREMENTS

## 16. Protect children and foundation data

- Never publish a child's identity, photograph, medical details, location or recovery story without documented guardian consent and publication approval.
- Consent to collect case information is separate from consent to publish a story or photograph.
- Store sensitive case documents only in beneficiary-private.
- Give staff access according to their role and responsibilities.
- Use individual staff accounts; never share administrator credentials.
- Remove access promptly when a staff member leaves.
- Never commit .env files or secret keys to GitHub.
- Test permissions using separate super-admin, finance, editor, case-worker and unauthenticated accounts.
- Prepare the foundation's approved privacy, safeguarding, donation/refund and terms policies.
- Configure backups, monitoring and an incident-response process before launch.

## 17. Important production note

A successful GitHub build confirms that the frontend compiles and the backend passes the configured Python compile check. It does **not** prove that live Supabase permissions, Paystack, email delivery, private-file access or deployment environment settings are correct.

Complete the end-to-end tests and have the foundation's responsible people review safeguarding, privacy, financial and legal processes before publicly announcing the platform. Do not publish fabricated impact figures, beneficiary profiles, partner endorsements or registration details.

## 18. Other project guides

- Local development: docs/LOCAL_DEVELOPMENT.md
- Deployment guide: docs/DEPLOYMENT.md
- Implementation checklist: docs/PROJECT_STATUS.md
- Database migrations: supabase/migrations/

## 19. Quick reference — where each value goes

| Value | Supabase | Render | Vercel |
|---|---|---|---|
| Project URL | Source | SUPABASE_URL | VITE_SUPABASE_URL |
| Anon/public key | Source | Not needed | VITE_SUPABASE_ANON_KEY |
| Service-role key | Source | SUPABASE_SERVICE_ROLE_KEY | **Never** |
| Paystack secret key | From Paystack | PAYSTACK_SECRET_KEY | **Never** |
| Website URL | Auth URL settings | FRONTEND_URL, ALLOWED_ORIGINS | Assigned by Vercel |
| API URL | — | Assigned by Render | VITE_API_URL |

**Remember:** Supabase stores the data, Render runs the private Python API, and Vercel serves the public React website. The URLs and keys must match across all three services.

---

# PART H — COMPLETE ADMINISTRATOR & STAFF USER MANUAL

This section is the everyday operating guide for the foundation team. The website is a tool for the work; it does not replace safeguarding judgement, clinical decisions, financial controls or the foundation's legal obligations.

## 20. Sign in and navigate

1. Open the deployed website and add `/admin` to its address.
2. Sign in with the individual account created by the super administrator.
3. The workspace navigation is based on your staff role. On a phone, select **Open menu**.
4. Open the relevant section, complete the work and check the confirmation message.
5. Select **Sign out** when finished, particularly on a shared computer.

There is no public staff registration. Do not share accounts. Individual accounts are necessary for access control and accountability.

### Staff roles

| Role | Main responsibilities and access |
|---|---|
| Super administrator | Full workspace access, staff account creation and platform oversight |
| Administrator | Public content, foundation settings, enquiries, partnerships and child-case oversight |
| Editor | Programmes, projects, news, events, partners, FAQs, gallery, impact reports and policy pages |
| Finance | Donation ledger, payment verification, receipts and authorised exports |
| Case worker | Child cases assigned to that worker only |
| Staff | Volunteer applications and contact messages |

Use the least-privilege role that lets a person perform their work. A case worker does not need administrator access to manage assigned cases.

## 21. Overview

The Overview is a navigation starting point. It intentionally does not display an overall amount-raised statistic. Financial records belong in **Donations**; an optional fundraising target and verified progress belong on the individual public programme.

Use the shortcuts to open Child case management, Programmes, Staff and access (if authorised), or Messages and enquiries.

## 22. Programmes and optional fundraising goals

Programmes describe the foundation's continuing work. Use the term **programmes**, not campaigns, for these public sections.

### Create or edit a programme

1. Open **Programmes** and select **Add new**, or choose **Edit** beside an existing programme.
2. Enter the title, category, short description and full content.
3. Upload an approved cover image using **Choose image**. Preview, replace or remove it here; do not paste an image URL.
4. Choose a publishing status: **Draft** (not public), **Published** (eligible for public display) or **Archived** (retained but not active publicly).
5. Select **Save changes** and review the public Programmes page.

### Optional fundraising goal

The **Fundraising goal (GHS)** field may be left blank.

- Blank means no public target and no progress bar.
- A positive approved goal makes the public programme card show the target and progress bar.
- The amount raised is maintained by the database from donations directed to that programme with status **paid**.
- Pending, failed and refunded donations do not count.
- General foundation donations and donations directed to another programme are kept separate.
- Never type a raised amount manually. The amount is calculated from verified donation records.

Only publish a target that the foundation has approved and can explain to donors.

## 23. Child cases — registration, assignment and follow-up

Child cases contain confidential guardian and child information. They are for authorised case staff, not a public directory.

### A. Before registration

Confirm that the foundation is authorised to collect the information. Explain the purpose and handling of the data to the guardian. Record consent to collect information separately from consent to publish a story or photograph. Use a non-identifying case reference and collect only information needed to assess and coordinate support.

### B. Register a case (administrator)

1. Open **Child cases**.
2. Enter the case reference, guardian name and contact, child display name, support category and support summary.
3. Confirm **Guardian consent to collect case information**. Registration is blocked unless this is checked.
4. Leave separate public-story consent unchecked unless informed permission has been documented and approved.
5. Select an active Case worker if one is ready. Otherwise leave the case unassigned.
6. Select **Register child case** and confirm the new case appears.

Use the case reference in routine internal discussions wherever possible. Do not expose child names or details in screenshots, emails or public reports.

### C. Assign or reassign a case

1. Find the case card.
2. Under **Responsible case worker**, choose an active staff account with the Case worker role.
3. The assignment is saved against that person's authenticated user ID.
4. To transfer responsibility, select another active worker. To remove assignment, choose **Not assigned**.
5. Confirm the save message and refresh the case list if needed.
6. Tell the receiving worker using the foundation's approved internal channel.

The current release does not send automatic email, SMS or push notifications for assignment changes. An administrator or super administrator can oversee the case register. A worker should see only cases assigned to their own account.

### D. Case worker daily workflow

1. Sign in using your own account and open **Child cases**.
2. Review your assigned cases, support summary and current status.
3. Record an assessment, appointment, home visit, medical coordination, support provided, follow-up or case note.
4. Write factual, respectful notes: what happened, what action was taken, who is responsible for the next step and the relevant date.
5. Add a next follow-up date and time when needed.
6. Upload relevant private documents using **Upload document**. Accepted formats are PDF, JPG and PNG under 10 MB.
7. Add a new activity after each meaningful development.

The history is a dated record and is append-only through the current user interface. Do not put passwords, payment-card details or unrelated personal information in case notes.

### E. Case statuses

Use these exact values in the status control:

- `under_review` — awaiting assessment or decision.
- `active` — support coordination is in progress.
- `on_hold` — work is temporarily paused; record why in a case activity.
- `completed` — planned support activity has been completed, subject to review.
- `closed` — an authorised supervisor has reviewed the record and approved closure.

Before closure, review the history, outstanding follow-ups, documents and support commitments. Keep a case active or on hold if further work remains. The current application provides status updates and supervisor visibility, but not a formal multi-step closure approval workflow.

### F. Private documents and safeguarding

- Store case files only in the private `beneficiary-private` bucket.
- Never upload case files to public `foundation-media`.
- Never create public links to private case documents.
- Case workers may access files only for cases assigned to them; administrators retain oversight.
- Deactivate staff accounts promptly when access is no longer needed.
- If consent is withdrawn, follow the foundation's approved safeguarding and retention procedure. The database has a withdrawal timestamp field, but a complete withdrawal workflow and legal retention process are not yet provided by the application.

The platform does not replace clinical judgement, statutory safeguarding duties, emergency response, guardian communication or a formal case-supervision policy.

## 24. Staff accounts and access

An active **administrator or super administrator** can create, view, deactivate and reactivate staff accounts and can assign the available employee roles. The super administrator remains the highest-level account and is not assignable through the ordinary staff form.

1. Enter the staff member's full name and unique email.
2. Set a temporary password of at least 12 characters.
3. Choose the correct role and select **Create account**.
4. Share the temporary credentials privately.
5. Ask the staff member to use the account's available password-management process to change the temporary password.
6. Use **Deactivate** immediately when a staff member leaves or no longer needs access. Reactivate only after approval.

Administrators have the same workspace module access as super administrators for day-to-day foundation operations. Access to confidential child information and financial records remains protected by database policies, and administrator actions are recorded where audit triggers are configured. The current release does not enforce a first-login password-change screen. Treat temporary credentials as sensitive and plan a dedicated password lifecycle improvement.

## 25. Donations and finance

Open **Donations** only if your role permits it. The ledger shows donor and transaction details, reference, destination and status.

- **Verify online payment** asks the backend to verify the transaction with Paystack.
- Treat a donation as received only when the backend confirms status **paid**.
- Record a refund only after the refund has actually been processed and authorised.
- **Download receipt** is available for paid donations.
- **Export CSV** is for authorised reconciliation and reporting only.
- Keep donor details and exports confidential.

A donor chooses general foundation support or one published programme. Programme donations remain associated with that programme; general donations do not count toward any programme goal. Never mark a payment as paid just because a donor sends a screenshot. The application does not replace accounting records, bank reconciliation or independent refund approval.

## 26. Enquiries, volunteers, partnerships and newsletter

Depending on your role, the workspace may include:
- **Messages** — questions submitted through the public contact form.
- **Volunteers** — volunteer applications.
- **Partnerships** — organisation partnership enquiries.
- **Newsletter** — subscribers and unsubscribe requests.

Read submissions before acting. Update statuses to reflect the actual review state. Do not promise acceptance, funding, employment, medical assistance or partnership approval before the authorised foundation representative has decided.

## 27. Public content

Editors and administrators maintain:
- **Projects** — specific pieces of work.
- **News** — approved updates and stories.
- **Events** — descriptions, venue and dates.
- **Partners** — approved names, descriptions, websites and logos.
- **FAQs** — answers to common questions.
- **Gallery** — approved images, accessibility descriptions and consent references.
- **Impact reports** — approved reporting-period summaries and report files.
- **Policy pages** — privacy, safeguarding and terms content.

Check spelling, dates, links, image quality, permissions and factual accuracy before publishing. Use drafts for unfinished work. Never invent impact figures, testimonials, partner endorsements, registrations, medical outcomes or financial totals.

## 28. Foundation settings

Authorised administrators can update the foundation name, public contact email, telephone number and address in **Settings**. Enter only verified details and check the public footer after saving.

## 29. Audit trail

The **Audit trail** is available to authorised administrators and records selected sensitive changes, including donation, child-case and document changes. Use it for oversight and investigation. It is not a replacement for a complete case file, finance ledger, incident register or formal approval workflow.

## 30. Troubleshooting

| Problem | What to check |
|---|---|
| Cannot sign in | Check email, password, connection and account active status. Contact the super administrator. |
| Access unavailable | The account may be inactive or have no valid role. |
| A menu item is missing | Your role may not include that module. Never use another person's login. |
| Worker cannot see a case | Check assignment to the exact user account currently signed in. |
| No workers appear in assignment list | Confirm active staff accounts exist with the Case worker role. |
| Case update does not save | Check the summary, internet connection and current case assignment. |
| Private upload fails | Use PDF, JPG or PNG under 10 MB and confirm case access. |
| Programme is not public | Confirm Published status and successful deployment of the latest database migrations/API. |
| Programme progress is hidden | A positive goal must be set. Only verified paid programme donations count. |
| Donation remains pending | Use payment verification. Do not treat it as received until confirmed. |
| Website content looks old | Refresh. If it persists, ask the technical administrator to check Vercel and the API health endpoint. |

## 31. Routine administrator checklist

**Each working day**
- Review new messages, volunteer and partnership enquiries.
- Check unassigned cases and allocate a responsible worker.
- Review upcoming and overdue follow-ups.
- Confirm case notes are factual and necessary.
- Check pending donations and verify transactions through Paystack.

**Each week**
- Review active and on-hold cases with workers.
- Confirm each active case has a clear next action.
- Review staff access and deactivate accounts no longer needed.
- Check public programme details and contact information.
- Review the audit trail for unusual changes.

**Each month**
- Reconcile paid donations and refunds against Paystack and bank records.
- Review programme goals and explain changes to donors.
- Review case closures and outstanding commitments.
- Check backups, permissions, privacy and safeguarding procedures.
- Confirm impact claims are supported by evidence.

## 32. Technical notes and deployment verification

Migration `010_case_management_and_programme_goals.sql` adds nullable programme goals, case activity history, assigned-worker row-level security, activity permissions, administrator access to the active case-worker directory and restricted case-document metadata access. Migration `011_case_file_update_policy.sql` also ensures a case worker can update private files only inside a case folder assigned to that worker.

The backend migration runner applies the migration on startup when `SUPABASE_DB_URL` is configured. After deploying, verify the following:

1. Confirm GitHub main contains migrations 010 and 011 and the latest frontend/backend commits.
2. Deploy the latest commit to Render.
3. Confirm Render startup logs show migrations 010 and 011 completed successfully.
4. Deploy the latest frontend build to Vercel.
5. Test with separate super administrator, administrator, case worker, editor and finance accounts.
6. Create a synthetic test case and assign it to a test worker.
7. Confirm the worker can see that case but cannot see another worker's case.
8. Add a test activity and follow-up date; confirm it appears in the history.
9. Upload a test private document and verify an unrelated account cannot access it.
10. Set a programme goal and confirm the public progress bar appears. Clear the goal and confirm the bar disappears.
11. Use Paystack test mode to confirm only paid programme-directed donations affect the programme total.

Never use real children's personal information or live payment details for testing.

### Not included in this release

The current application provides case assignment/reassignment, assigned-case access, activity logging, follow-up dates, private document upload, status updates and administrator oversight. These additional capabilities require separate implementation and testing:
- Automatic email, SMS or push notifications on assignment or upcoming/overdue follow-up.
- A background overdue-follow-up alert service.
- Formal multi-step supervisor approval for case closure.
- A complete consent-withdrawal and records-retention workflow.
- A forced first-login password-change screen.
- Automated scheduled backups and disaster-recovery testing.

Plan and test these before relying on them operationally.

---
