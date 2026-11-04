"""Automatic, versioned Supabase schema setup for Render deployments."""
from __future__ import annotations

import os
from pathlib import Path

import psycopg
from supabase import create_client

ROOT = Path(__file__).resolve().parent.parent
MIGRATIONS = ROOT / "supabase" / "migrations"

# One stable key so concurrent Render instances (or a redeploy racing the old
# instance) cannot apply the same migration at the same time.
MIGRATION_ADVISORY_LOCK_KEY = 907_145_331


def apply_migrations() -> None:
    database_url = os.getenv("SUPABASE_DB_URL", "").strip()
    if not database_url:
        raise RuntimeError(
            "SUPABASE_DB_URL is missing. Add the Supabase Session Pooler URI "
            "to the backend environment; automatic database setup cannot run."
        )

    with psycopg.connect(database_url, connect_timeout=20) as connection:
        # Serialise schema setup across instances. The lock is released when the
        # session ends, so a crash can never leave the database locked.
        with connection.cursor() as cursor:
            cursor.execute("select pg_advisory_lock(%s)", (MIGRATION_ADVISORY_LOCK_KEY,))
        with connection.cursor() as cursor:
            cursor.execute("""
                create table if not exists public.foundation_schema_migrations (
                    version text primary key,
                    applied_at timestamptz not null default now()
                )
            """)
        connection.commit()

        for migration in sorted(MIGRATIONS.glob("*.sql")):
            with connection.transaction():
                with connection.cursor() as cursor:
                    cursor.execute(
                        "select 1 from public.foundation_schema_migrations where version = %s",
                        (migration.name,),
                    )
                    if cursor.fetchone():
                        continue
                    cursor.execute(migration.read_text(encoding="utf-8"))
                    cursor.execute(
                        "insert into public.foundation_schema_migrations(version) values (%s)",
                        (migration.name,),
                    )
            print(f"[database] Applied {migration.name}")

    print("[database] Schema is up to date.")


def ensure_initial_admin() -> None:
    email = os.getenv("INITIAL_ADMIN_EMAIL", "").strip().lower()
    password = os.getenv("INITIAL_ADMIN_PASSWORD", "")
    full_name = os.getenv("INITIAL_ADMIN_NAME", "Foundation Administrator").strip()

    if not password:
        print("[admin] Initial admin password is not set; bootstrap skipped.")
        return
    if not email or len(password) < 12:
        raise RuntimeError(
            "Set INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD (minimum 12 characters)."
        )

    url = os.getenv("SUPABASE_URL", "").strip()
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not url or not service_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for admin setup.")

    client = create_client(url, service_key)
    active_admins = client.table("staff_profiles").select("user_id").eq(
        "role", "super_admin"
    ).eq("is_active", True).limit(1).execute().data
    if active_admins:
        print("[admin] An active super administrator already exists; bootstrap skipped.")
        return

    existing_user = None
    page = 1
    while True:
        result = client.auth.admin.list_users(page=page, per_page=100)
        users = getattr(result, "users", result)
        for candidate in users:
            if (getattr(candidate, "email", "") or "").lower() == email:
                existing_user = candidate
                break
        if existing_user or len(users) < 100:
            break
        page += 1

    if existing_user:
        user = existing_user
        print(f"[admin] Existing auth user found for {email}; password left unchanged.")
    else:
        created = client.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {"full_name": full_name},
        })
        user = created.user
        if not user:
            raise RuntimeError("Supabase did not return the newly created administrator.")

    client.table("staff_profiles").upsert({
        "user_id": user.id,
        "full_name": full_name,
        "role": "super_admin",
        "is_active": True,
    }, on_conflict="user_id").execute()
    print(f"[admin] Initial super administrator is ready: {email}")


def setup_database() -> None:
    """Apply migrations and bootstrap the first administrator.

    Raises on failure so the caller can decide how to react. The API server
    treats schema setup as best-effort (see ``main.py``) so a transient database
    problem can never stop the public website and the donation API from booting.
    """
    apply_migrations()
    ensure_initial_admin()
