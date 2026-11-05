"""Tests for startup readiness reporting and public-form rate limiting.

Both behaviours were added because their absence was invisible in production:
a schema that never applied still reported `status: ok`, and the public forms
accepted unlimited automated submissions.
"""
import json
import os
import sys

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault("SUPABASE_URL", "")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "")

import main  # noqa: E402


class _FakeRequest:
    """Just enough of a Starlette Request for rate_limit()."""

    def __init__(self, address="203.0.113.7", forwarded=None):
        self.headers = {"x-forwarded-for": forwarded} if forwarded else {}
        self.client = type("Client", (), {"host": address})()


@pytest.fixture(autouse=True)
def clear_windows():
    main._RATE_WINDOWS.clear()
    yield
    main._RATE_WINDOWS.clear()


def _payload(response):
    """JSONResponse stores the rendered body as bytes; decode it for assertions."""
    return json.loads(response.body)


class TestHealthReadiness:
    def test_starting_is_not_reported_as_ready(self):
        main.STARTUP_STATE.update(state="starting", database_ready=False, database_error=None)
        response = main.health()
        assert response.status_code == 200, "a starting service must not fail its health check"
        body = _payload(response)
        assert body["status"] == "starting"
        assert body["database_ready"] is False

    def test_ready_reports_ok(self):
        main.STARTUP_STATE.update(state="ready", database_ready=True, database_error=None)
        response = main.health()
        assert response.status_code == 200
        assert _payload(response)["status"] == "ok"

    def test_failed_setup_reports_503(self):
        main.STARTUP_STATE.update(state="failed", database_ready=False, database_error="boom")
        response = main.health()
        assert response.status_code == 503, "a settled failure must be visible to uptime monitoring"
        body = _payload(response)
        assert body["status"] == "degraded"
        assert body["database_error"] == "boom"


class TestRateLimit:
    def test_allows_up_to_the_limit_then_rejects(self):
        request = _FakeRequest()
        for _ in range(3):
            main.rate_limit(request, "contact", 3)
        with pytest.raises(HTTPException) as excinfo:
            main.rate_limit(request, "contact", 3)
        assert excinfo.value.status_code == 429

    def test_separate_buckets_do_not_share_a_counter(self):
        request = _FakeRequest()
        for _ in range(3):
            main.rate_limit(request, "contact", 3)
        # A burst on the contact form must not lock the newsletter form.
        main.rate_limit(request, "newsletter", 3)

    def test_separate_addresses_do_not_share_a_counter(self):
        for _ in range(3):
            main.rate_limit(_FakeRequest("198.51.100.1"), "contact", 3)
        main.rate_limit(_FakeRequest("198.51.100.2"), "contact", 3)

    def test_forwarded_header_identifies_the_client(self):
        for _ in range(2):
            main.rate_limit(_FakeRequest("10.0.0.1", forwarded="203.0.113.9, 10.0.0.1"), "contact", 2)
        with pytest.raises(HTTPException):
            main.rate_limit(_FakeRequest("10.0.0.1", forwarded="203.0.113.9, 10.0.0.1"), "contact", 2)

    def test_window_expiry_restores_capacity(self):
        request = _FakeRequest()
        for _ in range(2):
            main.rate_limit(request, "contact", 2)
        with pytest.raises(HTTPException):
            main.rate_limit(request, "contact", 2)
        # Age the recorded hits beyond the window rather than sleeping a minute.
        key = ("203.0.113.7", "contact")
        main._RATE_WINDOWS[key] = [t - main.RATE_LIMIT_WINDOW_SECONDS - 1 for t in main._RATE_WINDOWS[key]]
        main.rate_limit(request, "contact", 2)
