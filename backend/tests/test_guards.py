"""Tests for the backend logic that guards money and child data.

These exercise real functions in main.py rather than stubs: the image decoder
that stands between an upload and stored bytes, and the projection that decides
which child case fields may be published.
"""
import base64
import os
import sys

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# main.py builds a Supabase client at import time only when credentials exist.
# Importing with an empty environment keeps the module importable without a
# database, which is what these unit-level checks need.
os.environ.setdefault("SUPABASE_URL", "")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "")

import main  # noqa: E402


def data_url(mime: str, payload: bytes) -> str:
    return f"data:{mime};base64,{base64.b64encode(payload).decode()}"


class TestDecodeImageDataUrl:
    def test_accepts_png_and_returns_mime_and_bytes(self):
        raw = b"\x89PNG\r\n\x1a\n" + b"x" * 40
        mime, decoded = main.decode_image_data_url(data_url("image/png", raw))
        assert mime == "image/png"
        assert decoded == raw

    def test_accepts_jpeg_webp_and_avif(self):
        for mime in ("image/jpeg", "image/webp", "image/avif"):
            _, decoded = main.decode_image_data_url(data_url(mime, b"abc"))
            assert decoded == b"abc"

    def test_rejects_a_non_data_url(self):
        with pytest.raises(HTTPException) as err:
            main.decode_image_data_url("https://example.com/photo.png")
        assert err.value.status_code == 422

    def test_rejects_an_unsupported_format(self):
        with pytest.raises(HTTPException) as err:
            main.decode_image_data_url(data_url("image/gif", b"GIF89a"))
        assert err.value.status_code == 422

    def test_rejects_undecodable_base64(self):
        with pytest.raises(HTTPException) as err:
            main.decode_image_data_url("data:image/png;base64,!!!!not-base64!!!!")
        assert err.value.status_code == 422

    def test_rejects_empty_payload(self):
        with pytest.raises(HTTPException) as err:
            main.decode_image_data_url("data:image/png;base64,")
        assert err.value.status_code == 422

    def test_rejects_an_image_over_two_megabytes(self):
        oversized = b"x" * (main.MAX_IMAGE_BYTES + 1)
        with pytest.raises(HTTPException) as err:
            main.decode_image_data_url(data_url("image/png", oversized))
        assert err.value.status_code == 413

    def test_accepts_an_image_exactly_at_the_limit(self):
        at_limit = b"x" * main.MAX_IMAGE_BYTES
        _, decoded = main.decode_image_data_url(data_url("image/png", at_limit))
        assert len(decoded) == main.MAX_IMAGE_BYTES

    def test_accepts_a_plain_svg(self):
        svg = b'<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>'
        mime, decoded = main.decode_image_data_url(data_url("image/svg+xml", svg))
        assert mime == "image/svg+xml"
        assert decoded == svg

    @pytest.mark.parametrize("payload", [
        b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
        b'<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>',
        b'<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)">x</a></svg>',
        b'<svg xmlns="http://www.w3.org/2000/svg"><iframe src="evil"></iframe></svg>',
        b'<svg xmlns="http://www.w3.org/2000/svg"><image onerror="alert(1)"/></svg>',
    ])
    def test_rejects_svg_carrying_active_content(self, payload):
        # A stored SVG is served from our own origin, so script inside it would
        # run as us. These must never reach the database.
        with pytest.raises(HTTPException) as err:
            main.decode_image_data_url(data_url("image/svg+xml", payload))
        assert err.value.status_code == 422


class TestBuildPublicCase:
    FULL_ROW = {
        "id": "case-1",
        "case_reference": "UEKF-0001",
        "public_display_name": "Ama",
        "public_story": "Ama needs surgery after a burn injury.",
        "support_need": "Reconstructive surgery",
        "image_path": "db:abc",
        "is_critical": True,
        "target_amount": 4000,
        "amount_raised": 1000,
        "created_at": "2026-01-01T00:00:00Z",
        # Sensitive fields that must never reach the public payload.
        "guardian_name": "Mrs Mensah",
        "guardian_contact": "+233200000000",
        "medical_needs": "Second degree burns, ongoing dressing",
        "rehabilitation_needs": "Physiotherapy",
        "assigned_to": "staff-uuid",
        "consent_reference": "FORM-77",
        "internal_notes": "Do not publish the surname",
    }

    def test_projects_only_public_fields(self):
        result = main.build_public_case(self.FULL_ROW)
        assert result["display_name"] == "Ama"
        assert result["support_need"] == "Reconstructive surgery"
        assert result["target_amount"] == 4000.0
        assert result["amount_raised"] == 1000.0

    def test_never_exposes_guardian_or_medical_information(self):
        result = main.build_public_case(self.FULL_ROW)
        for leaked in ("guardian_name", "guardian_contact", "medical_needs",
                       "rehabilitation_needs", "assigned_to", "consent_reference",
                       "internal_notes", "case_reference"):
            assert leaked not in result
        # And the values themselves must not appear anywhere in the payload.
        assert "Mrs Mensah" not in str(result)
        assert "233200000000" not in str(result)
        assert "Second degree burns" not in str(result)

    def test_computes_progress_as_a_percentage(self):
        assert main.build_public_case(self.FULL_ROW)["progress"] == 25.0

    def test_caps_progress_at_one_hundred_when_overfunded(self):
        row = dict(self.FULL_ROW, amount_raised=9000)
        assert main.build_public_case(row)["progress"] == 100.0

    def test_reports_zero_progress_when_no_target_is_set(self):
        row = dict(self.FULL_ROW, target_amount=0)
        assert main.build_public_case(row)["progress"] == 0

    def test_handles_missing_optional_values(self):
        result = main.build_public_case({"id": "case-2"})
        assert result["display_name"] == "A child in our care"
        assert result["target_amount"] == 0.0
        assert result["progress"] == 0

    def test_treats_null_amounts_as_zero(self):
        row = dict(self.FULL_ROW, target_amount=None, amount_raised=None)
        result = main.build_public_case(row)
        assert result["target_amount"] == 0.0
        assert result["amount_raised"] == 0.0


class TestRouteRegistration:
    def test_new_routes_are_registered_once(self):
        paths = [(r.path, tuple(sorted(r.methods))) for r in main.app.routes
                 if getattr(r, "methods", None)]
        assert len(paths) == len(set(paths)), "a route is registered more than once"

    @pytest.mark.parametrize("path,method", [
        ("/api/admin/images", "POST"),
        ("/api/images/{image_id}", "GET"),
        ("/api/public/cases", "GET"),
        ("/api/admin/funds/summary", "GET"),
        ("/api/admin/allocations", "GET"),
        ("/api/admin/allocations", "POST"),
        ("/api/admin/allocations/{allocation_id}", "DELETE"),
        ("/api/admin/reports/summary", "GET"),
    ])
    def test_expected_route_exists(self, path, method):
        found = any(
            getattr(r, "path", None) == path and method in getattr(r, "methods", set())
            for r in main.app.routes
        )
        assert found, f"{method} {path} is missing"
