# Ugo E Kloh Foundation Platform

A full-stack charitable foundation platform focused on children recovering from burn injuries and other vulnerable children.

## Technology
- Frontend: React + JSX + Vite
- Backend: Python + FastAPI
- Database, authentication and object storage: Supabase
- Deployment: Vercel (frontend) + Render (API)
- Donations: Paystack (server-side verification) with a transparent offline donation fallback

## Project status
This repository is being initialized with the production-oriented application scaffold, database schema, Supabase Storage setup, API and deployment guides. Configure the environment variables described in `docs/DEPLOYMENT.md` before connecting live services.

## Local development
See [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md).

## Deployment
See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Supabase setup
Run the SQL migration in `supabase/migrations/001_initial_schema.sql` in the Supabase SQL Editor. It creates the application tables, access policies and the public `foundation-media` storage bucket for approved public assets. Sensitive beneficiary documents must use a separate private bucket.

## Safeguarding
Never publish a child's name, image, medical history, location or recovery story without documented guardian consent and explicit publication approval. Do not store medical records in the public media bucket.

## Payments
Paystack secret keys belong only in the Render backend environment. The frontend never receives the secret key. If Paystack is unavailable or not configured, the donation flow offers a clearly labelled manual bank/mobile-money pledge. Such pledges remain pending until an administrator verifies receipt; the website must never present them as paid.

## Security
- Enable Supabase email authentication and configure redirect URLs.
- Keep Supabase service-role keys and Paystack secret keys server-side only.
- Review and test RLS policies before launch.
- Create the first super-admin through the documented bootstrap process; never expose public admin registration.
