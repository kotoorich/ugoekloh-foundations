# Production deployment guide (Vercel + Render + Supabase)

This is the detailed deployment checklist. The root `README.md` is the overview; the environment-variable names below are the same ones used by the application and the checked-in `.env.example` files.

## 1. What you are deploying

| Service | What it runs | What you configure there |
|---|---|---|
| Supabase | PostgreSQL database, authentication and file storage | Project URL, API keys, SQL migrations, storage and auth URLs |
| Render | Private Python FastAPI backend | Supabase service-role secret, API URLs, optional Paystack secret |
| Vercel | Public React/Vite frontend | Supabase public/anon key and Render API URL |

The frontend and API use the Supabase client. The backend additionally uses the private `SUPABASE_DB_URL` Session Pooler connection at startup so it can apply database migrations automatically. You do not need to run SQL manually. The backend runtime is pinned to **Python 3.11.11** in `backend/.python-version` and `render.yaml`; keep this pin so Render does not select Python 3.14 and attempt a source build of `pydantic-core`.

## 2. Automatic Supabase setup

You do not need to paste SQL into the Supabase SQL Editor. The backend runs the versioned migrations in `supabase/migrations/` during startup and records each successful migration in `public.foundation_schema_migrations`. Later redeployments apply only new migration files and preserve existing data. Migrations `007_directed_programme_donations.sql` and `008_burn_prevention_programmes.sql` add programme-directed donations, recalculate programme totals from verified payments, and seed the two published burn-prevention programmes: **Fire Safety in the Home** and **Children and Fire Management at Home**.

Copy the **Session pooler** URI from Supabase **Connect → Session pooler** and add it to Render as `SUPABASE_DB_URL`. Replace the password placeholder in the URI with the project's database password. Keep this secret in Render only.

The Supabase project must be active and the database credentials must have permission to create/alter the application's schema and storage policies. The normal project database owner credentials provide this access. The service-role API key by itself cannot execute arbitrary DDL.

### Which Supabase key is which?

- Frontend: publishable key / legacy `anon` key. This is intended for browser use and relies on RLS.
- Backend: secret key / legacy `service_role` key. This has elevated access and bypasses RLS. Keep it in Render only.
- These keys are not interchangeable. Never put the secret/service-role key in Vercel, browser code, GitHub or a public document.

## 3. Deploy the backend to Render first

1. Open Render and choose **New → Web Service**.
2. Connect the repository `kotoorich/ugoekloh-foundations`.
3. Use these exact settings:

| Render setting | Value |
|---|---|
| Runtime | Python 3.11.11 (pinned by `backend/.python-version`) |
| Root Directory | `backend` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| Health Check Path | `/api/health` |

4. In **Environment**, add the variables below. Use the same names and spelling.

### Render environment variables (copy the keys exactly)

| Key | Value to enter |
|---|---|
| `SUPABASE_URL` | `https://YOUR_PROJECT_REF.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | `YOUR_SUPABASE_SERVICE_ROLE_KEY` |
| `SUPABASE_DB_URL` | Supabase Session Pooler URI, including your database password |
| `INITIAL_ADMIN_EMAIL` | Foundation's initial administrator email |
| `INITIAL_ADMIN_PASSWORD` | Long random password, at least 12 characters |
| `INITIAL_ADMIN_NAME` | Administrator's display name |
| `FRONTEND_URL` | `https://YOUR_VERCEL_DOMAIN.vercel.app` |
| `ALLOWED_ORIGINS` | `https://YOUR_VERCEL_DOMAIN.vercel.app` |
| `PAYSTACK_SECRET_KEY` | Leave empty until Paystack test mode is ready |
| `PAYSTACK_CALLBACK_URL` | `https://YOUR_VERCEL_DOMAIN.vercel.app/donation/return` |

Set the first-admin values before the first deployment. After the backend successfully creates the administrator, remove `INITIAL_ADMIN_PASSWORD` from Render. The bootstrap will not overwrite the password of an existing Auth user or repeatedly promote accounts after an active super-admin already exists.

At this point, if you have not deployed Vercel yet, you can temporarily use the Render-provided service URL for the first deployment and then update the three frontend URL values after Vercel is deployed. The health endpoint itself does not depend on these URLs.

5. Deploy the service.
6. Copy the exact service URL shown by Render. Example only: `https://ugoekloh-foundation-api.onrender.com`.
7. Test `https://YOUR_RENDER_SERVICE.onrender.com/api/health`. Expected JSON:

```json
{
  "status": "ok",
  "service": "ugoekloh-foundations-api"
}
```

8. If it fails, check Render **Logs** before continuing. If Render still reports Python 3.14, confirm the service Root Directory is `backend`, then trigger a **Clear build cache & deploy** so it reads the committed Python version pin.

## 4. Deploy the frontend to Vercel

1. Open Vercel and choose **Add New → Project**.
2. Import `kotoorich/ugoekloh-foundations`.
3. Set:

| Vercel setting | Value |
|---|---|
| Framework Preset | Vite |
| Root Directory | `frontend` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |

4. Add these three environment variables before deploying:

| Key | Value to enter |
|---|---|
| `VITE_SUPABASE_URL` | `https://YOUR_PROJECT_REF.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `YOUR_SUPABASE_ANON_KEY` |
| `VITE_API_URL` | `https://YOUR_RENDER_SERVICE.onrender.com` |

5. Deploy and copy the exact Vercel domain assigned to the project.
6. Never add `SUPABASE_SERVICE_ROLE_KEY` or `PAYSTACK_SECRET_KEY` to Vercel. Vite variables beginning with `VITE_` are exposed to the browser.

## 5. Connect the deployed URLs

After Vercel has given you the real website domain:

1. Supabase → **Authentication → URL Configuration**:
   - Site URL: your exact Vercel website URL.
   - Add the same URL to the allowed redirect URLs.
2. Render → **Environment**:
   - `FRONTEND_URL`: exact Vercel website URL.
   - `ALLOWED_ORIGINS`: exact Vercel website URL. If you intentionally use additional preview domains, list them separated by commas.
   - `PAYSTACK_CALLBACK_URL`: exact Vercel website URL followed by `/donation/return`.
3. Vercel → **Environment Variables**:
   - Confirm `VITE_API_URL` is the exact Render service URL, with no extra path.
4. Save changes and redeploy/restart the relevant service if the host requests it.

Example only (replace all domains with your own):

```env
# Render
FRONTEND_URL=https://ugoekloh-foundation.vercel.app
ALLOWED_ORIGINS=https://ugoekloh-foundation.vercel.app
PAYSTACK_CALLBACK_URL=https://ugoekloh-foundation.vercel.app/donation/return

# Vercel
VITE_API_URL=https://ugoekloh-foundation-api.onrender.com
```

## 6. Paystack online donations

1. Complete Paystack merchant onboarding.
2. Start with a Paystack test secret key.
3. Put it in Render as `PAYSTACK_SECRET_KEY` only.
4. In Paystack webhook settings, use:

`https://YOUR_RENDER_SERVICE.onrender.com/api/payments/paystack/webhook`

5. Test a payment end-to-end. Confirm the backend verifies the transaction and expected GHS amount before it is marked paid.
6. Do not switch to live credentials until test transactions succeed and Paystack has approved the merchant account.

The public donation flow accepts online Paystack payments only. If Paystack is not configured, online checkout is temporarily unavailable; the website must not accept manual pledges or display offline bank/mobile-money instructions.

## 7. First deployment checklist

- [ ] Render startup log confirms all pending database migrations were applied (or schema is already up to date).
- [ ] Both storage buckets exist with the correct visibility.
- [ ] Render health endpoint returns the expected JSON.
- [ ] Vercel website loads.
- [ ] Supabase authentication URL configuration uses the deployed website domain.
- [ ] Vercel has only the three frontend variables listed above.
- [ ] Render has the backend variables listed above, including the private database connection.
- [ ] No secret/service-role or Paystack key is exposed in Vercel or GitHub.
- [ ] Initial super-admin was created from the private Render environment variables.
- [ ] Contact, volunteer and partnership submissions reach the database.
- [ ] Test one general foundation donation and one programme donation; confirm that only the selected programme receives its verified amount.
- [ ] Confirm the admin programme editor can upload a cover image from a phone/computer, preview it and save it without manually copying a storage path.
- [ ] Paystack test transaction is verified before enabling live payments.
- [ ] Private beneficiary documents cannot be accessed by the public.
- [ ] Test on desktop and mobile.

## 8. Automatic first administrator

Set these private Render environment variables before the first deployment:

- `INITIAL_ADMIN_EMAIL`
- `INITIAL_ADMIN_PASSWORD` (at least 12 characters)
- `INITIAL_ADMIN_NAME`

On startup, the backend creates the Supabase Auth user if it does not already exist and assigns the `super_admin` profile. If the user already exists, its password is left unchanged and the profile is ensured. No public administrator registration is enabled. Remove the initial password variable from Render after the first successful bootstrap; normal sign-in continues to use Supabase Auth.

## 9. Environment variable source of truth

The repository includes ready-to-copy templates:

- Frontend local template: `frontend/.env.example`
- Backend local template: `backend/.env.example`

The variable names in those files are the same names to enter in Vercel and Render. Copy the template into a local `.env` file for local development; in hosted dashboards, enter each key/value in the service's Environment Variables screen.

The backend also uses `SUPABASE_DB_URL` privately at startup to apply versioned schema migrations; it is never exposed to the frontend.


---


## Email delivery setup (Gmail API primary, SendPulse alternative)

The Admin Dashboard now has **Email settings**. Email mode is OFF by default. Turn it ON and select exactly one provider: **Gmail API (Primary)** or **SendPulse (Alternative)**. The application does not silently switch providers. Provider credentials are private Render environment variables; never enter them in the browser or commit them to GitHub.

When email mode is OFF, public forms still save the submission and show a normal receipt message such as **“Your submission has been received successfully.”** They do not mention email being disabled. When email mode is ON, the public confirmation mentions an email only if the provider accepted the message. A provider failure never prevents the underlying form or donation record from being saved.

### A. Create and configure the primary Gmail API sender

1. Sign in to the Google account that will send foundation emails.
2. Open [Google Cloud Console](https://console.cloud.google.com/) and create a project, for example **Ugoekloh Foundations Mail**.
3. Select that project and open **APIs & Services → Library**. Search for **Gmail API** and click **Enable**.
4. Open **Google Auth Platform**. Configure the app name, support email and developer contact email. Choose **External** if the sender account is not restricted to a Google Workspace organisation.
5. Under **Audience**, add the Gmail account that will authorize the sender as a test user while the app is in testing.
6. Under **Data Access**, add the scope `https://www.googleapis.com/auth/gmail.send`.
7. Under **Clients**, create an OAuth client. Choose **Web application** and add this authorised redirect URI:
   `https://developers.google.com/oauthplayground`
8. Copy the OAuth **Client ID** and **Client Secret**. Store them securely.
9. Open [Google OAuth 2.0 Playground](https://developers.google.com/oauthplayground). Open its settings (gear icon), enable **Use your own OAuth credentials**, and enter the Client ID and Client Secret.
10. In Step 1, enter/select the Gmail send scope `https://www.googleapis.com/auth/gmail.send`, authorize with the foundation sender account and grant access.
11. In Step 2, exchange the authorization code for tokens. Copy the **refresh_token**. Treat it as a password.
12. In Render → your API service → **Environment**, add:
   - `GOOGLE_CLIENT_ID` = OAuth Client ID
   - `GOOGLE_CLIENT_SECRET` = OAuth Client Secret
   - `GOOGLE_REFRESH_TOKEN` = OAuth refresh token
   - `GMAIL_SENDER_EMAIL` = the exact Gmail address that granted permission
13. Save and redeploy/restart the Render service. Do not add these values to Vercel, frontend variables, source code or GitHub.
14. In Admin → Email settings, select **Gmail API — Primary**, turn email mode ON, save, then send a test email to an address you control.

**Google OAuth testing warning:** External OAuth apps left in Testing can issue refresh tokens that expire after seven days for Gmail scopes. Before relying on ongoing production sending, review Google's publishing/verification requirements and move the OAuth app to the appropriate production status. Gmail API sending is subject to Google's account and API limits. A successful API response means Google accepted the message for sending; it is not proof that the recipient read it.

Official references: [Gmail API enablement and OAuth quickstart](https://developers.google.com/workspace/gmail/api/quickstart/python), [Gmail messages.send](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/send), [Google server-side OAuth](https://developers.google.com/identity/protocols/oauth2/web-server).

### B. Create and configure SendPulse (alternative sender)

1. Create an account at [SendPulse](https://sendpulse.com/).
2. Confirm the account email and complete the profile information requested in the SMTP section.
3. Open **SMTP** in the SendPulse dashboard and complete the sender/profile approval process. SendPulse may review the intended use and list-collection method before activating SMTP sending.
4. Add and verify a sender email address under SMTP sender settings. Use an address you control.
5. For better deliverability, add the sending domain and publish the SPF, DKIM and any CNAME/DNS records that SendPulse provides. Do not guess DNS values; copy the exact records from your SendPulse dashboard and verify them there.
6. Open **Account Settings → API** (or the API/SMTP integration section shown in your account). Create/copy the API **Client ID** and **Client Secret** used for OAuth client-credentials authentication. Do not confuse these with an SMTP mailbox password.
7. In Render → your API service → **Environment**, add:
   - `SENDPULSE_CLIENT_ID` = SendPulse API Client ID
   - `SENDPULSE_CLIENT_SECRET` = SendPulse API Client Secret
   - `SENDPULSE_SENDER_EMAIL` = the verified SendPulse sender address
8. Save and redeploy/restart Render.
9. In Admin → Email settings, select **SendPulse — Alternative**, turn email mode ON, save, and send a test email.

SendPulse SMTP API sends transactional email through its API. The application obtains a short-lived access token from SendPulse and then submits the email. Account approval and sender verification are controlled by SendPulse.

Official references: [SendPulse SMTP setup](https://sendpulse.com/knowledge-base/smtp/setup-smtp-server), [SendPulse API](https://sendpulse.com/integrations/api).

### C. Shared Render email settings

Add these backend variables in Render. The same template is in `backend/.env.example`:

```env
# Gmail API — primary
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
GMAIL_SENDER_EMAIL=

# SendPulse — alternative
SENDPULSE_CLIENT_ID=
SENDPULSE_CLIENT_SECRET=
SENDPULSE_SENDER_EMAIL=

# Shared sender identity and optional internal alerts
EMAIL_SENDER_NAME=Ugoekloh Foundations
EMAIL_ADMIN_NOTIFY_TO=
```

`EMAIL_ADMIN_NOTIFY_TO` is optional. If set, new contact, volunteer and partnership submissions also trigger an internal alert to that address. Keep all provider secrets in Render only.

### D. How the Admin email controls work

- Email mode OFF: no provider is called; submission and payment records continue to be saved. The delivery log records a skipped email. Public users see only the normal submission/payment confirmation.
- Email mode ON + Gmail selected: Gmail API is used as the primary provider.
- Email mode ON + SendPulse selected: SendPulse is used as the alternative provider.
- Provider failure: the submission remains saved; the public message does not falsely claim that an email was sent. The failure is recorded for administrators.
- Provider selection is manual. There is no automatic Gmail-to-SendPulse fallback in this version.
- Use **Send a test email** after configuring a provider. Check the recent email activity list for sent, failed or skipped records.

The email settings row and delivery log are created by migration `014_email_delivery_and_settings.sql` at backend startup. Do not manually create these tables. Provider credentials are never stored in the database. The HTML email layout and message template are maintained in `backend/email_service.py`.

### E. Email workflows currently connected

- Contact form acknowledgement and optional internal alert.
- Volunteer application acknowledgement and optional internal alert.
- Partnership enquiry acknowledgement and optional internal alert.
- Newsletter subscription welcome message.
- Donor confirmation after Paystack payment verification.

Password-reset/first-login enforcement emails, full newsletter campaign composition, unsubscribe links and consent lifecycle, scheduled campaigns, retries and automatic provider failover remain follow-up implementation work. Do not assume those workflows are active until separately implemented and tested.
