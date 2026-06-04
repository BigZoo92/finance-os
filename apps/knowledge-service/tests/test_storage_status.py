import pytest
from fastapi.testclient import TestClient

from finance_os_knowledge.app import create_app
from finance_os_knowledge.backends.qdrant_adapter import QdrantAdapter
from finance_os_knowledge.config import KnowledgeSettings, get_settings


@pytest.fixture(autouse=True)
def reset_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_storage_status_reports_fallback_and_empty_on_local_backend():
    with TestClient(create_app()) as client:
        response = client.get("/knowledge/storage/status")
        assert response.status_code == 200
        storage = response.json()["storage"]

        # Local fallback: no production backends, nothing ingested.
        assert storage["backend"] == "local"
        assert storage["fallbackActive"] is True
        assert storage["productionActive"] is False
        assert storage["empty"] is True
        assert storage["qdrant"]["collectionExists"] is False
        assert storage["qdrant"]["points"] == 0
        assert storage["neo4j"]["nodes"] == 0
        assert storage["neo4j"]["relationships"] == 0


def test_ensure_storage_is_non_destructive_and_returns_status():
    with TestClient(create_app()) as client:
        response = client.post("/knowledge/storage/ensure")
        assert response.status_code == 200
        body = response.json()
        assert body["ok"] is True
        # On local fallback ensure is a no-op that still reports status.
        assert body["storage"]["backend"] == "local"
        assert body["storage"]["empty"] is True


class _FakeCollection:
    def __init__(self, name: str) -> None:
        self.name = name


class _FakeCollections:
    def __init__(self, names: list[str]) -> None:
        self.collections = [_FakeCollection(name) for name in names]


class _FakeQdrantClient:
    def __init__(self, existing: list[str]) -> None:
        self._names = list(existing)
        self.create_calls = 0

    def get_collections(self) -> _FakeCollections:
        return _FakeCollections(self._names)

    def create_collection(self, collection_name: str, vectors_config: object) -> None:
        self.create_calls += 1
        self._names.append(collection_name)


class _FakeModels:
    class Distance:
        COSINE = "Cosine"

    @staticmethod
    def VectorParams(size: int, distance: object) -> dict[str, object]:
        return {"size": size, "distance": distance}


def test_ensure_collection_is_idempotent():
    adapter = QdrantAdapter(settings=KnowledgeSettings())
    client = _FakeQdrantClient(existing=[])
    adapter._client = client  # type: ignore[attr-defined]
    adapter._models = _FakeModels  # type: ignore[attr-defined]

    adapter.ensure_collection()  # collection missing -> created
    adapter.ensure_collection()  # collection present -> no-op

    assert client.create_calls == 1


def test_ensure_collection_no_op_when_collection_exists():
    settings = KnowledgeSettings()
    adapter = QdrantAdapter(settings=settings)
    client = _FakeQdrantClient(existing=[settings.qdrant_collection])
    adapter._client = client  # type: ignore[attr-defined]
    adapter._models = _FakeModels  # type: ignore[attr-defined]

    adapter.ensure_collection()

    assert client.create_calls == 0
