# Deployment guide: Vercel + Render + Supabase

## A. Supabase
1. Create a production Supabase project.
2. Run `supabase/migrations/001_initial_schema.sql` in SQL Editor.
3. Copy Project URL, anon key and service_role key from Project Settings → API.
4. Configure Authentication → URL Configuration with your Vercel production domain and any preview domains you actually use.
5. Keep the service_role key only in Render environment variables. It bypasses RLS and must never be exposed in the browser.
6. Confirm both storage buckets exist: `foundation-media` (public approved assets) and `beneficiary-private` (private sensitive documents).

## B. Deploy Python API to Render
1. Push the repository to GitHub.
2. In Render, choose **New → Web Service**, connect this repository.
3. Set Root Directory to `backend`.
4. Build Command: `pip install -r requirements.txt`.
5. Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`.
6. Add environment variables:
   - `SUPABASE_URL`: production project URL
   - `SUPABASE_SERVICE_ROLE_KEY`: service role key (secret)
   - `PAYSTACK_SECRET_KEY`: secret key, only when payment is enabled
   - `PAYSTACK_CALLBACK_URL`: your frontend donation-return URL
   - `FRONTEND_URL`: Vercel production URL
   - `ALLOWED_ORIGINS`: Vercel production URL, comma-separated with any approved preview origins
7. Deploy and test `https://YOUR-API.onrender.com/api/health`.
8. Configure the Paystack webhook URL as `https://YOUR-API.onrender.com/api/payments/paystack/webhook`.

## C. Deploy React frontend to Vercel
1. In Vercel, import `kotoorich/ugoekloh-foundations`.
2. Set Root Directory to `frontend`.
3. Framework preset: Vite.
4. Build Command: `npm run build`; Output Directory: `dist`; Install Command: `npm install`.
5. Add environment variables:
   - `VITE_SUPABASE_URL`: Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY`: Supabase anon/public key
   - `VITE_API_URL`: Render API URL, e.g. `https://YOUR-API.onrender.com`
6. Deploy. Redeploy after changing environment variables.

## D. Paystack setup
1. Create/verify your Paystack merchant account and enable the channels available to your business.
2. Copy the **secret key** into Render only. Do not put it in Vercel variables or frontend source.
3. Set callback URL to the frontend donation-return page you configure.
4. Set the webhook to the Render endpoint above.
5. Test with Paystack test keys and test transactions before switching to live keys.
6. The backend verifies the transaction with Paystack and checks the expected amount and currency before marking a donation paid.

## E. If Paystack is not active
The site offers a manual donation pledge route. It records the pledge as **pending**, tells the donor that no payment has been received, and allows the foundation team to contact them with verified bank/mobile-money instructions. Staff must confirm receipt before recording it as paid. Do not display invented account numbers or claim a pending pledge is a completed donation.

## F. Go-live checklist
- [ ] Replace placeholder contact details with verified foundation details.
- [ ] Add the approved logo, photos and guardian-consented stories.
- [ ] Create staff accounts and assign least-privilege roles.
- [ ] Review all RLS policies with a test non-admin account.
- [ ] Test public contact and volunteer forms.
- [ ] Test Paystack test-mode initialize, callback, webhook and amount verification.
- [ ] Confirm private beneficiary files cannot be read publicly.
- [ ] Add privacy, child safeguarding, donation/refund and terms policies.
- [ ] Configure custom domain, HTTPS, email sender and monitoring.
- [ ] Do not publish fabricated impact numbers, beneficiary profiles or partner logos.
