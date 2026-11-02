# Local development (Windows 11, macOS or Linux)

This guide uses the same environment-variable names as `README.md`, `docs/DEPLOYMENT.md`, `frontend/.env.example` and `backend/.env.example`.

## Prerequisites
- Git
- Node.js 20 LTS or newer and npm
- Python 3.11 or newer
- A Supabase project

## 1. Clone the repository

```bash
git clone https://github.com/kotoorich/ugoekloh-foundations.git
cd ugoekloh-foundations
```

## 2. Configure Supabase

1. Create a project at https://supabase.com/dashboard.
2. Open **SQL Editor** and run the six files in `supabase/migrations/` one at a time, in this exact order:
   1. `001_initial_schema.sql`
   2. `002_operations_and_safeguarding.sql`
   3. `003_public_content_and_case_access.sql`
   4. `004_case_documents_and_audit.sql`
   5. `005_partnership_applications.sql`
   6. `006_campaign_totals.sql`
3. Wait for each query to succeed before running the next.
4. In **Project Settings → API** (or **API Keys**), copy the Project URL, publishable/legacy anon key, and secret/legacy service-role key.
5. In **Authentication → Providers**, enable Email.
6. In **Authentication → URL Configuration**, add `http://localhost:5173` as the local Site URL and allowed redirect URL.
7. Confirm the `foundation-media` public bucket and `beneficiary-private` private bucket exist.

**Key safety:** The frontend uses the publishable/anon key. The backend uses the secret/service-role key. Never put the backend key in the frontend or commit either local `.env` file to GitHub.

**No DATABASE_URL is required:** the current FastAPI backend uses the Supabase Python client through `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

## 3. Configure and run the React frontend

Open a terminal from the repository root:

```powershell
cd frontend
Copy-Item .env.example .env
```

Open `frontend/.env` and replace the sample values:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_LEGACY_ANON_KEY
VITE_API_URL=http://localhost:8000
```

Then run:

```powershell
npm install
npm run dev
```

Open http://localhost:5173.

## 4. Configure and run the Python API

Open a second terminal from the repository root:

```powershell
cd backend
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Open `backend/.env` and replace the sample values:

```env
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SECRET_OR_SERVICE_ROLE_KEY
PAYSTACK_SECRET_KEY=
PAYSTACK_CALLBACK_URL=http://localhost:5173/donation/return
FRONTEND_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173
```

Leave `PAYSTACK_SECRET_KEY` empty until you are ready to test Paystack. The backend can still record manual donation pledges as pending.

Start the API:

```powershell
uvicorn main:app --reload --port 8000
```

Check:
- Website: http://localhost:5173
- API health: http://localhost:8000/api/health
- API documentation: http://localhost:8000/docs

Keep both terminal windows open while developing.

## 5. Create the first administrator

1. Supabase Dashboard → **Authentication → Users** → create the foundation's first administrator manually.
2. Copy that user's actual UUID.
3. In SQL Editor, run the following after replacing the UUID and display name:

```sql
insert into public.staff_profiles (user_id, full_name, role, is_active)
values (
  'PASTE_THE_REAL_AUTH_USER_UUID_HERE',
  'Foundation Super Administrator',
  'super_admin',
  true
);
```

Do not use a sample UUID and do not create a public administrator sign-up flow.

## Notes

- Use fictional data during development. Never use real children's personal, medical or guardian information.
- Local environment files are ignored by Git; do not commit them.
- For production deployment, follow `docs/DEPLOYMENT.md` and use the same key names in Render and Vercel.
