# Production deployment guide (Vercel + Render + Supabase)

This is the detailed deployment checklist. The root `README.md` is the overview; the environment-variable names below are the same ones used by the application and the checked-in `.env.example` files.

## 1. What you are deploying

| Service | What it runs | What you configure there |
|---|---|---|
| Supabase | PostgreSQL database, authentication and file storage | Project URL, API keys, SQL migrations, storage and auth URLs |
| Render | Private Python FastAPI backend | Supabase service-role secret, API URLs, optional Paystack secret |
| Vercel | Public React/Vite frontend | Supabase public/anon key and Render API URL |

**Important: this project does not currently need a `DATABASE_URL`.** The backend in `backend/main.py` connects through the Supabase Python client using `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Do not add a PostgreSQL connection string unless the backend is deliberately changed to use a direct PostgreSQL driver/SQLAlchemy.

## 2. Supabase setup

1. Create a Supabase project.
2. Open **SQL Editor**.
3. Run the six files in `supabase/migrations/` in this exact order, one at a time:
   1. `001_initial_schema.sql`
   2. `002_operations_and_safeguarding.sql`
   3. `003_public_content_and_case_access.sql`
   4. `004_case_documents_and_audit.sql`
   5. `005_partnership_applications.sql`
   6. `006_campaign_totals.sql`
4. Wait for each query to succeed before running the next. If one fails, stop and resolve it; do not skip it.
5. Open **Project Settings → API** (or **API Keys**, depending on the dashboard version) and copy:
   - Project URL
   - Publishable key, or legacy `anon` key
   - Secret key, or legacy `service_role` key
6. Confirm these two storage buckets exist:
   - `foundation-media`: public, for approved public website media only.
   - `beneficiary-private`: private, for restricted case documents.
7. Under **Authentication → URL Configuration**, you will later add the deployed Vercel website URL as the Site URL and an allowed redirect URL.

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
| Runtime | Python |
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
| `PAYSTACK_SECRET_KEY` | Leave empty until Paystack test mode is ready |
| `PAYSTACK_CALLBACK_URL` | `https://YOUR_VERCEL_DOMAIN.vercel.app/donation/return` |
| `FRONTEND_URL` | `https://YOUR_VERCEL_DOMAIN.vercel.app` |
| `ALLOWED_ORIGINS` | `https://YOUR_VERCEL_DOMAIN.vercel.app` |

At this point, if you have not deployed Vercel yet, you can temporarily use the Render-provided service URL for the first deployment and then update the three frontend URL values after Vercel is deployed. The health endpoint itself does not depend on these URLs.

5. Deploy the service.
6. Copy the exact service URL shown by Render. Example only: `https://ugoekloh-foundation-api.onrender.com`.
7. Test `https://YOUR_RENDER_SERVICE.onrender.com/api/health`. Expected JSON:

```json
{
  "status": "ok",
  "service": "ugo-ekloh-foundation-api"
}
```

8. If it fails, check Render **Logs** before continuing.

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
| `VITE_SUPABASE_ANON_KEY` | `YOUR_SUPABASE_PUBLISHABLE_OR_LEGACY_ANON_KEY` |
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

## 6. Paystack (optional until online payments are enabled)

1. Complete Paystack merchant onboarding.
2. Start with a Paystack test secret key.
3. Put it in Render as `PAYSTACK_SECRET_KEY` only.
4. In Paystack webhook settings, use:

`https://YOUR_RENDER_SERVICE.onrender.com/api/payments/paystack/webhook`

5. Test a payment end-to-end. Confirm the backend verifies the transaction and expected GHS amount before it is marked paid.
6. Do not switch to live credentials until test transactions succeed and Paystack has approved the merchant account.

If Paystack is not configured, the site can record a donation pledge as **pending**. A pending pledge is not a completed payment. Foundation staff must verify receipt before marking it paid. Do not publish unverified bank or mobile-money instructions.

## 7. First deployment checklist

- [ ] All six Supabase migrations completed successfully in order.
- [ ] Both storage buckets exist with the correct visibility.
- [ ] Render health endpoint returns the expected JSON.
- [ ] Vercel website loads.
- [ ] Supabase authentication URL configuration uses the deployed website domain.
- [ ] Vercel has only the three frontend variables listed above.
- [ ] Render has the six backend variables listed above.
- [ ] No secret/service-role or Paystack key is exposed in Vercel or GitHub.
- [ ] Initial super-admin account has been provisioned securely.
- [ ] Contact, volunteer and partnership submissions reach the database.
- [ ] Manual donation pledge remains pending until verified.
- [ ] Paystack test transaction is verified before enabling live payments.
- [ ] Private beneficiary documents cannot be accessed by the public.
- [ ] Test on desktop and mobile.

## 8. Initial super-admin account

1. Supabase → **Authentication → Users** → add the foundation's first administrator.
2. Copy that user's actual UUID.
3. In SQL Editor, run this after replacing the UUID and display name:

```sql
insert into public.staff_profiles (user_id, full_name, role, is_active)
values (
  'PASTE_THE_REAL_AUTH_USER_UUID_HERE',
  'Foundation Super Administrator',
  'super_admin',
  true
);
```

Do not use a sample UUID. Do not enable public administrator registration.

## 9. Environment variable source of truth

The repository includes ready-to-copy templates:

- Frontend local template: `frontend/.env.example`
- Backend local template: `backend/.env.example`

The variable names in those files are the same names to enter in Vercel and Render. Copy the template into a local `.env` file for local development; in hosted dashboards, enter each key/value in the service's Environment Variables screen.

There is intentionally no `DATABASE_URL` in either template: the current backend uses the Supabase client, not a direct PostgreSQL connection.
