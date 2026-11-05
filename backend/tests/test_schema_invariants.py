"""Schema invariants that the migrations must always satisfy.

These read the migration files rather than a live database, so they run
anywhere. They exist because the admin dashboard writes content tables
straight from the browser: with row-level security enabled and no policy,
PostgreSQL denies every row to every role, and a section of the dashboard
silently stops working with no error the operator can act on.
"""
import re
from pathlib import Path

import pytest

MIGRATIONS = Path(__file__).resolve().parents[2] / "supabase" / "migrations"


def read_migrations() -> str:
    files = sorted(MIGRATIONS.glob("*.sql"))
    assert files, "no migration files found"
    return "\n".join(path.read_text(encoding="utf-8") for path in files)


def split_top_level(text: str):
    """Split a CREATE TABLE body on commas that are not inside parentheses."""
    parts, depth, current = [], 0, ""
    for char in text:
        if char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
        if char == "," and depth == 0:
            parts.append(current)
            current = ""
        else:
            current += char
    if current.strip():
        parts.append(current)
    return parts


def tables() -> set:
    sql = read_migrations()
    return set(re.findall(r"create table if not exists\s+public\.(\w+)", sql, re.I))


def tables_with_rls() -> set:
    sql = read_migrations()
    return set(re.findall(
        r"alter table\s+public\.(\w+)\s+enable row level security", sql, re.I))


def tables_with_policies() -> set:
    sql = read_migrations()
    return set(re.findall(r"create policy\s+\"[^\"]+\"\s+on\s+public\.(\w+)", sql, re.I))


class TestRowLevelSecurityCoverage:
    def test_every_table_enables_row_level_security(self):
        unprotected = tables() - tables_with_rls()
        assert not unprotected, (
            "these tables are reachable with the public anon key because RLS is "
            f"not enabled: {sorted(unprotected)}"
        )

    def test_every_table_with_rls_has_at_least_one_policy(self):
        # RLS on + no policy = deny everything. This is the exact condition that
        # made the admin dashboard's content sections appear empty.
        closed = tables_with_rls() - tables_with_policies()
        assert not closed, (
            "row-level security is enabled but no policy grants access, so every "
            f"read and write is denied: {sorted(closed)}"
        )

    @pytest.mark.parametrize("table", [
        "programmes", "news", "events", "partners", "campaigns", "projects",
    ])
    def test_public_content_tables_are_readable_and_manageable(self, table):
        sql = read_migrations()
        lowered = sql.lower()
        assert re.search(
            rf"create policy\s+\"[^\"]*public read[^\"]*\"\s+on\s+public\.{table}\b", lowered
        ), f"{table} has no public read policy"
        assert re.search(
            rf"create policy\s+\"[^\"]*staff manage[^\"]*\"\s+on\s+public\.{table}\b", lowered
        ), f"{table} has no staff manage policy"

    @pytest.mark.parametrize("table", [
        "programmes", "news", "events", "partners", "campaigns", "projects",
    ])
    def test_editor_roles_can_manage_public_content(self, table):
        sql = read_migrations()
        block = re.search(
            rf"create policy\s+\"[^\"]*staff manage[^\"]*\"\s+on\s+public\.{table}\b([\s\S]{{0,400}}?);",
            sql, re.I)
        assert block, f"{table} has no staff manage policy"
        body = block.group(1)
        assert "has_role" in body, f"{table} manage policy does not check staff roles"
        assert "editor" in body, f"{table} manage policy does not allow editors"


class TestPoliciesAreIdempotent:
    def test_every_create_policy_is_preceded_by_a_drop(self):
        sql = read_migrations()
        creates = re.findall(r"create policy\s+\"([^\"]+)\"\s+on\s+public\.(\w+)", sql, re.I)
        drops = {(name, table) for name, table in
                 re.findall(r"drop policy if exists\s+\"([^\"]+)\"\s+on\s+public\.(\w+)", sql, re.I)}
        missing = [pair for pair in creates if pair not in drops]
        assert not missing, (
            "these policies are created without a preceding "
            f"'drop policy if exists', so re-applying the schema fails: {missing}"
        )
