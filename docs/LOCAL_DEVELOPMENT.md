# Run locally (Windows 11, macOS or Linux)

## Prerequisites
- Git
- Node.js 20 LTS or newer and npm
- Python 3.11 or newer
- A Supabase project (free tier is enough for development)

## 1. Clone the repository
```bash
git clone https://github.com/kotoorich/ugoekloh-foundations.git
cd ugoekloh-foundations
```

## 2. Configure Supabase
1. Create a project at https://supabase.com/dashboard.
2. Open **SQL Editor** and run migrations `001_initial_schema.sql`, `002_operations_and_safeguarding.sql` `003_public_content_and_case_access.sql` and `004_case_documents_and_audit.sql` `005_partnership_applications.sql` and `006_campaign_totals.sql` in that order.
3. In **Project Settings → API**, copy the Project URL and anon/public key.
4. In Authentication → Providers, enable Email. Turn off public sign-ups if the admin-only site is intended.
5. In Authentication → URL Configuration, add `http://localhost:5173` as a site URL.
6. The migration creates the `foundation-media` public bucket for approved website images and a separate private `beneficiary-private` bucket for restricted documents.

## 3. Start the React frontend
Open a terminal:
```bash
cd frontend
copy .env.example .env
```
On PowerShell, edit `frontend/.env` and set:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_URL=http://localhost:8000`

Then:
```bash
npm install
npm run dev
```
Open http://localhost:5173.

## 4. Start the Python API
Open a second terminal at the repository root:
```powershell
cd backend
py -3.11 -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```
Edit `backend/.env` with the Supabase Project URL and **service_role** key. Keep this key private and never put it in frontend/.env or commit it.
Set `ALLOWED_ORIGINS=http://localhost:5173` and leave Paystack unset until you are ready to test payments.

Start the API:
```bash
uvicorn main:app --reload --port 8000
```
Check http://localhost:8000/api/health and interactive API docs at http://localhost:8000/docs.

## 5. Create the first administrator
1. In Supabase Dashboard → Authentication → Users, create an admin user manually.
2. Copy that user's UUID.
3. In SQL Editor, run the following, replacing the UUID and role:
```sql
insert into public.staff_profiles(user_id, full_name, role)
values ('PASTE-AUTH-USER-UUID', 'Foundation Administrator', 'super_admin');
```
Do not make this an unauthenticated public signup flow. Admin accounts are created by an authorized owner.

## 6. Run both services
- Frontend: http://localhost:5173
- API: http://localhost:8000
- API docs: http://localhost:8000/docs

## Notes
The public site can render its designed fallback content before Supabase records are published. Contact and volunteer submissions require the API and database. Donation pledges stay pending until verified. Never use real children's personal or medical information in development.
