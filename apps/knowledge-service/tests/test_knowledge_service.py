from datetime import UTC, datetime

from fastapi.testclient import TestClient

from finance_os_knowledge.app import create_app
from finance_os_knowledge.config import KnowledgeSettings
from finance_os_knowledge.models import (
    ContextBundleRequest,
    KnowledgeEntity,
    KnowledgeIngestRequest,
    KnowledgeRelation,
)
from finance_os_knowledge.seed import build_seed_ingest
from finance_os_knowledge.store import KnowledgeGraphStore


def test_seed_contains_required_temporal_finance_memory_types():
    seed = build_seed_ingest("demo")
    node_types = {entity.type for entity in seed.entities}
    labels = {entity.label for entity in seed.entities}
    relation_types = {relation.type for relation in seed.relations}

    assert "FinancialConcept" in node_types
    assert "Formula" in node_types
    assert "TradingStrategy" in node_types
    assert "CostObservation" in node_types
    assert "Compound interest" in labels
    assert "DCA vs lump sum" in labels
    assert "ICT and CRT" in labels
    assert "CONTRADICTED_BY" in relation_types


def test_ingest_is_idempotent_and_supersedes_changed_facts(tmp_path):
    store = KnowledgeGraphStore(
        settings=KnowledgeSettings(KNOWLEDGE_GRAPH_STORAGE_PATH=tmp_path, KNOWLEDGE_GRAPH_REBUILD_ON_START=False)
    )
    first = KnowledgeEntity(
        id="financialconcept:test_fact",
        type="FinancialConcept",
        label="Test fact",
        description="Original",
        confidence=0.7,
        observedAt=datetime(2026, 4, 1, tzinfo=UTC),
        validFrom=datetime(2026, 4, 1, tzinfo=UTC),
        scope="admin",
    )
    changed = first.model_copy(update={"description": "Changed", "confidence": 0.8})

    response1 = store.ingest(KnowledgeIngestRequest(mode="admin", entities=[first]), request_id="r1")
    response2 = store.ingest(KnowledgeIngestRequest(mode="admin", entities=[first]), request_id="r2")
    response3 = store.ingest(KnowledgeIngestRequest(mode="admin", entities=[changed]), request_id="r3")

    assert response1.inserted_entities == 1
    assert response2.dedupe_count == 1
    assert response3.updated_entities == 1
    assert response3.superseded_count == 1
    assert len(store.historical_entities) == 1
    assert store.entities["financialconcept:test_fact"].description == "Changed"


def test_contradictions_coexist_and_are_retrieved(tmp_path):
    store = KnowledgeGraphStore(
        settings=KnowledgeSettings(KNOWLEDGE_GRAPH_STORAGE_PATH=tmp_path, KNOWLEDGE_GRAPH_REBUILD_ON_START=False)
    )
    risky = KnowledgeEntity(
        id="tradingstrategy:demo_edge",
        type="TradingStrategy",
        label="Demo edge",
        description="Experimental trading edge",
        tags=["technical-analysis"],
        confidence=0.55,
        scope="admin",
    )
    bias = KnowledgeEntity(
        id="riskmetric:lookahead_bias",
        type="RiskMetric",
        label="Lookahead bias",
        description="Invalidates optimistic backtests",
        tags=["backtesting", "risk"],
        confidence=0.9,
        scope="admin",
    )
    relation = KnowledgeRelation(
        id="rel:contradiction:test",
        type="CONTRADICTED_BY",
        fromId=risky.id,
        toId=bias.id,
        confidence=0.86,
        scope="admin",
    )
    store.ingest(
        KnowledgeIngestRequest(mode="admin", entities=[risky, bias], relations=[relation]),
        request_id="r1",
    )

    response = store.query(
        request=store_query("demo edge backtest bias"),
        request_id="r2",
    )

    hit = next(item for item in response.hits if item.entity.id == risky.id)
    assert hit.contradictory_evidence[0].id == bias.id
    assert store.metrics.contradiction_count == 1


def store_query(query: str):
    from finance_os_knowledge.models import KnowledgeQueryRequest

    return KnowledgeQueryRequest(query=query, mode="admin", maxResults=8)


def test_context_bundle_shape_and_redaction(tmp_path):
    store = KnowledgeGraphStore(
        settings=KnowledgeSettings(KNOWLEDGE_GRAPH_STORAGE_PATH=tmp_path, KNOWLEDGE_GRAPH_REBUILD_ON_START=False)
    )
    entity = KnowledgeEntity(
        id="provider:redacted",
        type="Provider",
        label="Redacted provider",
        description="Provider with sensitive raw payload",
        rawPayload={"access_token": "secret-token", "safe": "ok"},
        scope="admin",
    )
    store.ingest(KnowledgeIngestRequest(mode="admin", entities=[entity]), request_id="r1")

    bundle = store.context_bundle(
        ContextBundleRequest(query="redacted provider", mode="admin", maxResults=8),
        request_id="r2",
    )

    assert bundle.request_id == "r2"
    assert bundle.token_estimate > 0
    assert store.entities[entity.id].raw_payload == {"access_token": "[redacted]", "safe": "ok"}


def test_http_endpoints_rebuild_query_stats(tmp_path, monkeypatch):
    monkeypatch.setenv("KNOWLEDGE_GRAPH_STORAGE_PATH", str(tmp_path))
    monkeypatch.setenv("KNOWLEDGE_GRAPH_REBUILD_ON_START", "false")
    app = create_app()

    with TestClient(app) as client:
        rebuild = client.post("/knowledge/rebuild", json={"mode": "demo", "includeSeed": True})
        assert rebuild.status_code == 200
        assert rebuild.json()["entityCount"] >= 50

        query = client.post("/knowledge/query", json={"mode": "demo", "query": "cash drag inflation", "maxResults": 5})
        assert query.status_code == 200
        assert query.json()["hits"]

        stats = client.get("/knowledge/stats")
        assert stats.status_code == 200
        assert stats.json()["entityCount"] >= 50
