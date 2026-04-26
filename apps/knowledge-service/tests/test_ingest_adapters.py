from datetime import UTC, datetime

from finance_os_knowledge.config import KnowledgeSettings
from finance_os_knowledge.ingest import (
    AdvisorIngestRequest,
    CostLedgerIngestRequest,
    MarketsIngestRequest,
    NewsIngestRequest,
    build_advisor_ingest,
    build_cost_ledger_ingest,
    build_markets_ingest,
    build_news_ingest,
)
from finance_os_knowledge.ingest.advisor import (
    AdvisorAssumptionInput,
    AdvisorEvidenceInput,
    AdvisorRecommendationInput,
)
from finance_os_knowledge.ingest.cost_ledger import CostLedgerEntryInput
from finance_os_knowledge.ingest.markets import (
    MarketsMacroSignalInput,
    MarketsTickerInput,
)
from finance_os_knowledge.ingest.news import NewsItemInput
from finance_os_knowledge.store import KnowledgeGraphStore


def _store(tmp_path):
    return KnowledgeGraphStore(
        settings=KnowledgeSettings(
            KNOWLEDGE_GRAPH_STORAGE_PATH=tmp_path,
            KNOWLEDGE_GRAPH_REBUILD_ON_START=False,
        )
    )


def test_markets_ingest_creates_macro_sector_ticker_relations(tmp_path):
    request = MarketsIngestRequest(
        mode="admin",
        macroSignals=[
            MarketsMacroSignalInput(
                id="macro_rate_hike",
                label="Central bank surprise rate hike",
                description="Unexpected 50bps move",
                confidence=0.78,
                impact=72,
                severity=60,
                observedAt=datetime(2026, 4, 1, tzinfo=UTC),
                affectedSectors=["Technology", "Real Estate"],
                affectedAssets=["AAPL"],
                tags=["rates"],
            )
        ],
        tickers=[
            MarketsTickerInput(
                symbol="AAPL",
                name="Apple Inc.",
                sector="Technology",
                region="US",
                assetClass="equity",
                exposure=0.12,
            )
        ],
    )

    ingest = build_markets_ingest(request)
    types = {entity.type for entity in ingest.entities}
    rel_types = {relation.type for relation in ingest.relations}
    assert "Ticker" in types
    assert "Sector" in types
    assert "MacroSignal" in types
    assert "PART_OF" in rel_types
    assert "AFFECTS_SECTOR" in rel_types
    assert "AFFECTS_ASSET" in rel_types

    store = _store(tmp_path)
    response = store.ingest(ingest, request_id="markets-1")
    assert response.inserted_entities >= 4

    # Idempotent re-ingest
    response2 = store.ingest(ingest, request_id="markets-2")
    assert response2.inserted_entities == 0
    assert response2.dedupe_count >= response.inserted_entities


def test_news_ingest_links_signals_to_assets_and_documents(tmp_path):
    request = NewsIngestRequest(
        mode="admin",
        items=[
            NewsItemInput(
                id="news-1",
                title="Fed minutes signal cooling tone",
                summary="Members discuss pacing rate cuts amid sticky inflation.",
                source="reuters",
                sourceUrl="https://example.com/fed-minutes",
                publishedAt=datetime(2026, 4, 20, tzinfo=UTC),
                confidence=0.72,
                relatedAssets=["SPY"],
                marketEvent="FOMC minutes",
                stance="supporting",
            )
        ],
    )
    ingest = build_news_ingest(request)
    types = {entity.type for entity in ingest.entities}
    assert "NewsSignal" in types
    assert "SourceDocument" in types
    assert "MarketEvent" in types
    assert "Ticker" in types

    store = _store(tmp_path)
    response = store.ingest(ingest, request_id="news-1")
    assert response.inserted_entities >= 4
    rel_types = {rel.type for rel in store.relations.values()}
    assert "DERIVED_FROM" in rel_types
    assert "OBSERVED_IN" in rel_types
    assert "AFFECTS_ASSET" in rel_types


def test_advisor_ingest_creates_recommendation_with_assumptions_and_evidence(tmp_path):
    request = AdvisorIngestRequest(
        mode="admin",
        snapshotId="snap-2026-04-26",
        recommendations=[
            AdvisorRecommendationInput(
                id="rec-cash-drag",
                title="Reduce cash drag",
                summary="Cash exceeds 24 months runway",
                category="cash-drag-reduction",
                severity=60,
                confidence=0.8,
                generatedAt=datetime(2026, 4, 26, tzinfo=UTC),
                assumptions=[
                    AdvisorAssumptionInput(
                        id="ass-1",
                        summary="Inflation runs near 3% over next 12 months",
                        confidence=0.65,
                    )
                ],
                evidence=[
                    AdvisorEvidenceInput(
                        id="ev-1",
                        summary="Cash position 28 months of expenses",
                        confidence=0.85,
                    )
                ],
                contradictingEvidence=[
                    AdvisorEvidenceInput(
                        id="ev-c1",
                        summary="Pending real estate purchase planned in 6 months",
                        confidence=0.78,
                    )
                ],
                tags=["cash"],
            )
        ],
    )
    ingest = build_advisor_ingest(request)
    types = {entity.type for entity in ingest.entities}
    rel_types = {rel.type for rel in ingest.relations}
    assert "Recommendation" in types
    assert "Assumption" in types
    assert "Evidence" in types
    assert "REQUIRES_ASSUMPTION" in rel_types
    assert "SUPPORTED_BY" in rel_types
    assert "CONTRADICTED_BY" in rel_types

    store = _store(tmp_path)
    response = store.ingest(ingest, request_id="adv-1")
    assert response.inserted_entities >= 4


def test_cost_ledger_ingest_creates_model_run_token_cost_chain(tmp_path):
    request = CostLedgerIngestRequest(
        mode="admin",
        entries=[
            CostLedgerEntryInput(
                id="cost-1",
                model="claude-opus-4-7",
                skill="advisor.daily-brief",
                agentRunId="run-42",
                inputTokens=1200,
                outputTokens=800,
                costUsd=0.0125,
                observedAt=datetime(2026, 4, 25, tzinfo=UTC),
                notes="daily brief generation",
            )
        ],
    )
    ingest = build_cost_ledger_ingest(request)
    types = {entity.type for entity in ingest.entities}
    rel_types = {rel.type for rel in ingest.relations}
    assert "Model" in types
    assert "AgentSkill" in types
    assert "AgentRun" in types
    assert "TokenUsageObservation" in types
    assert "CostObservation" in types
    assert "USES_MODEL" in rel_types
    assert "USES_SKILL" in rel_types
    assert "CONSUMED_TOKENS" in rel_types
    assert "COSTS" in rel_types

    store = _store(tmp_path)
    response = store.ingest(ingest, request_id="cost-1")
    assert response.inserted_entities >= 5


def test_production_store_falls_back_when_backends_unavailable(tmp_path):
    from finance_os_knowledge.backends.factory import select_backend
    from finance_os_knowledge.backends.production_store import ProductionKnowledgeStore

    settings = KnowledgeSettings(
        KNOWLEDGE_GRAPH_STORAGE_PATH=tmp_path,
        KNOWLEDGE_GRAPH_REBUILD_ON_START=False,
        KNOWLEDGE_USE_PRODUCTION_BACKENDS=True,
        KNOWLEDGE_NEO4J_URI="bolt://127.0.0.1:1",  # unreachable
        KNOWLEDGE_NEO4J_USER="neo4j",
        KNOWLEDGE_NEO4J_PASSWORD="invalid",
        KNOWLEDGE_QDRANT_URL="http://127.0.0.1:1",  # unreachable
        KNOWLEDGE_ALLOW_LOCAL_FALLBACK_IN_ADMIN=True,
    )
    store = select_backend(settings)
    assert isinstance(store, ProductionKnowledgeStore)
    assert store.degraded
    health = store.health()
    assert health["productionActive"] is False
    assert health["neo4j"]["available"] is False
    assert health["qdrant"]["available"] is False


def test_select_backend_returns_local_when_not_configured(tmp_path):
    from finance_os_knowledge.backends.factory import select_backend
    from finance_os_knowledge.store import KnowledgeGraphStore

    settings = KnowledgeSettings(
        KNOWLEDGE_GRAPH_STORAGE_PATH=tmp_path,
        KNOWLEDGE_GRAPH_REBUILD_ON_START=False,
    )
    store = select_backend(settings)
    assert isinstance(store, KnowledgeGraphStore)
