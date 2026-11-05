"""The homepage programme feed must follow the dashboard, not the source code.

/api/public/home once filtered on two hard-coded slugs, so a programme created
in the admin dashboard never appeared on the homepage. These tests pin the
behaviour: published programmes are returned, newest first, limited to the two
the homepage renders, with no slug allow-list.
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault("SUPABASE_URL", "")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "")

import main  # noqa: E402


class _RecordingTable:
    """A Supabase table double that records the query it was asked to build."""

    def __init__(self, rows):
        self.rows = rows
        self.calls = []

    def select(self, columns):
        self.calls.append(("select", columns))
        return self

    def eq(self, column, value):
        self.calls.append(("eq", column, value))
        return self

    def in_(self, column, values):
        self.calls.append(("in_", column, tuple(values)))
        return self

    def order(self, column, desc=False):
        self.calls.append(("order", column, desc))
        return self

    def limit(self, count):
        self.calls.append(("limit", count))
        return self

    def execute(self):
        return type("R", (), {"data": list(self.rows)})()

    def find(self, name):
        return [call for call in self.calls if call[0] == name]


class _RecordingClient:
    def __init__(self, rows):
        self.table_double = _RecordingTable(rows)

    def table(self, name):
        assert name == "programmes", f"unexpected table: {name}"
        return self.table_double


@pytest.fixture
def two_programmes(monkeypatch):
    rows = [
        {"id": "p1", "title": "Fire Safety in the Home", "slug": "fire-safety-in-the-home"},
        {"id": "p2", "title": "Children and Fire Management at Home", "slug": "children-and-fire-management"},
    ]
    client = _RecordingClient(rows)
    monkeypatch.setattr(main, "db", client)
    return client, rows


class TestPublicHomeProgrammes:
    def test_returns_the_programmes_the_database_gave(self, two_programmes):
        client, rows = two_programmes
        result = main.home()
        assert result["programmes"] == rows

    def test_only_published_programmes_are_offered(self, two_programmes):
        client, _ = two_programmes
        main.home()
        assert ("eq", "status", "published") in client.table_double.calls

    def test_does_not_filter_on_a_hard_coded_slug_allow_list(self, two_programmes):
        client, _ = two_programmes
        main.home()
        assert client.table_double.find("in_") == [], (
            "homepage still filters programmes by a hard-coded slug list, so "
            "programmes created in the dashboard cannot appear"
        )

    def test_returns_the_two_newest(self, two_programmes):
        client, _ = two_programmes
        main.home()
        assert ("limit", 2) in client.table_double.calls
        assert ("order", "created_at", True) in client.table_double.calls

    def test_returns_an_empty_feed_without_a_database(self, monkeypatch):
        monkeypatch.setattr(main, "db", None)
        assert main.home()["programmes"] == []
