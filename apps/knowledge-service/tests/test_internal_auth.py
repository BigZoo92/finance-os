import pytest
from fastapi.testclient import TestClient

from finance_os_knowledge.app import create_app
from finance_os_knowledge.config import get_settings

TOKEN = "test-internal-service-token-0123456789"
HEADER = "x-internal-service-token"


@pytest.fixture(autouse=True)
def reset_settings_cache(tmp_path, monkeypatch):
    monkeypatch.setenv("KNOWLEDGE_GRAPH_STORAGE_PATH", str(tmp_path))
    monkeypatch.setenv("KNOWLEDGE_GRAPH_REBUILD_ON_START", "false")
    monkeypatch.delenv("INTERNAL_SERVICE_TOKEN", raising=False)
    monkeypatch.delenv("INTERNAL_SERVICE_AUTH_REQUIRED", raising=False)
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_functional_routes_reject_missing_or_wrong_token_when_configured(monkeypatch):
    monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", TOKEN)

    with TestClient(create_app()) as client:
        missing = client.get("/knowledge/stats", headers={"x-request-id": "req-auth-1"})
        assert missing.status_code == 401
        assert missing.json() == {
            "ok": False,
            "code": "INTERNAL_AUTH_REQUIRED",
            "message": "Internal service token required.",
            "requestId": "req-auth-1",
        }
        assert missing.headers["cache-control"] == "no-store"
        assert missing.headers["x-request-id"] == "req-auth-1"

        wrong = client.post(
            "/knowledge/query",
            json={"mode": "demo", "query": "cash drag", "maxResults": 5},
            headers={HEADER: "not-the-token"},
        )
        assert wrong.status_code == 401
        assert wrong.json()["code"] == "INTERNAL_AUTH_INVALID"
        assert wrong.headers["cache-control"] == "no-store"

        # The rejection envelope never echoes the configured secret.
        assert TOKEN not in missing.text
        assert TOKEN not in wrong.text


def test_functional_routes_accept_correct_token(monkeypatch):
    monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", TOKEN)

    with TestClient(create_app()) as client:
        stats = client.get("/knowledge/stats", headers={HEADER: TOKEN})
        assert stats.status_code == 200
        assert "entityCount" in stats.json()

        schema = client.get("/knowledge/schema", headers={HEADER: TOKEN})
        assert schema.status_code == 200
        assert schema.json()["ok"] is True


def test_health_and_version_stay_open_when_token_configured(monkeypatch):
    monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", TOKEN)

    with TestClient(create_app()) as client:
        assert client.get("/health").status_code == 200
        assert client.get("/version").status_code == 200


def test_blank_token_means_auth_disabled(monkeypatch):
    # Compose dev passes `${INTERNAL_SERVICE_TOKEN:-}`; blank must behave as unset.
    monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", "   ")

    with TestClient(create_app()) as client:
        assert client.get("/knowledge/stats").status_code == 200


def test_auth_required_without_token_fails_startup(monkeypatch):
    monkeypatch.setenv("INTERNAL_SERVICE_AUTH_REQUIRED", "true")

    with pytest.raises(RuntimeError, match="INTERNAL_SERVICE_TOKEN is not configured"):
        create_app()

    get_settings.cache_clear()
    monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", "")
    with pytest.raises(RuntimeError, match="INTERNAL_SERVICE_TOKEN is not configured"):
        create_app()
