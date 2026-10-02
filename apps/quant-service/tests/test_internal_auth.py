"""Tests for the quant service internal shared-secret guard."""

import pytest
from httpx import ASGITransport, AsyncClient

from finance_os_quant.app import create_app
from finance_os_quant.config import get_settings

TOKEN = "test-internal-service-token-0123456789"
HEADER = "x-internal-service-token"


@pytest.fixture(autouse=True)
def reset_settings_cache(monkeypatch):
    monkeypatch.delenv("INTERNAL_SERVICE_TOKEN", raising=False)
    monkeypatch.delenv("INTERNAL_SERVICE_AUTH_REQUIRED", raising=False)
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def make_client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=create_app()), base_url="http://test")


@pytest.mark.anyio
async def test_functional_routes_reject_missing_or_wrong_token_when_configured(monkeypatch):
    monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", TOKEN)

    async with make_client() as client:
        missing = await client.get("/quant/capabilities", headers={"x-request-id": "req-auth-1"})
        assert missing.status_code == 401
        assert missing.json() == {
            "ok": False,
            "code": "INTERNAL_AUTH_REQUIRED",
            "message": "Internal service token required.",
            "requestId": "req-auth-1",
        }
        assert missing.headers["cache-control"] == "no-store"
        assert missing.headers["x-request-id"] == "req-auth-1"

        wrong = await client.post(
            "/quant/metrics",
            json={"returns": [0.01, -0.005, 0.02]},
            headers={HEADER: "not-the-token"},
        )
        assert wrong.status_code == 401
        assert wrong.json()["code"] == "INTERNAL_AUTH_INVALID"
        assert wrong.headers["cache-control"] == "no-store"

        # The rejection envelope never echoes the configured secret.
        assert TOKEN not in missing.text
        assert TOKEN not in wrong.text


@pytest.mark.anyio
async def test_functional_routes_accept_correct_token(monkeypatch):
    monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", TOKEN)

    async with make_client() as client:
        capabilities = await client.get("/quant/capabilities", headers={HEADER: TOKEN})
        assert capabilities.status_code == 200
        assert capabilities.json()["paper_only"] is True

        metrics = await client.post(
            "/quant/metrics",
            json={"returns": [0.01, -0.005, 0.02, -0.01, 0.015] * 10},
            headers={HEADER: TOKEN},
        )
        assert metrics.status_code == 200
        assert metrics.json()["ok"] is True


@pytest.mark.anyio
async def test_health_and_version_stay_open_when_token_configured(monkeypatch):
    monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", TOKEN)

    async with make_client() as client:
        assert (await client.get("/health")).status_code == 200
        assert (await client.get("/version")).status_code == 200


@pytest.mark.anyio
async def test_blank_token_means_auth_disabled(monkeypatch):
    # Compose dev passes `${INTERNAL_SERVICE_TOKEN:-}`; blank must behave as unset.
    monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", "   ")

    async with make_client() as client:
        assert (await client.get("/quant/capabilities")).status_code == 200


def test_auth_required_without_token_fails_startup(monkeypatch):
    monkeypatch.setenv("INTERNAL_SERVICE_AUTH_REQUIRED", "true")

    with pytest.raises(RuntimeError, match="INTERNAL_SERVICE_TOKEN is not configured"):
        create_app()

    get_settings.cache_clear()
    monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", "")
    with pytest.raises(RuntimeError, match="INTERNAL_SERVICE_TOKEN is not configured"):
        create_app()
