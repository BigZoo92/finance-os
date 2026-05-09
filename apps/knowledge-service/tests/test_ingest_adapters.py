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
    AdvisorDecisionPointInput,
    AdvisorEvidenceInput,
    AdvisorLearningActionInput,
    AdvisorRecommendationInput,
    decision_point_node_id,
    learning_action_node_id,
    recommendation_node_id,
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


def test_advisor_ingest_emits_decision_points_with_recommendation_link(tmp_path):
    request = AdvisorIngestRequest(
        mode="admin",
        decisionPoints=[
            AdvisorDecisionPointInput(
                decisionId=42,
                decision="accepted",
                reasonCode="rebalance_to_target_weights",
                decidedAt=datetime(2026, 4, 26, tzinfo=UTC),
                decidedBy="admin",
                expectedOutcomeAt=datetime(2026, 5, 26, tzinfo=UTC),
                recommendationKey="rec-cash-drag",
                recommendationId=7,
                runId=11,
                freeNoteExcerpt="Will reduce cash by 5pp over the month",
            )
        ],
    )

    ingest = build_advisor_ingest(request)
    types = {entity.type for entity in ingest.entities}
    rel_types = {rel.type for rel in ingest.relations}
    assert "DecisionPoint" in types
    assert "LEADS_TO" in rel_types

    decision_node = next(e for e in ingest.entities if e.type == "DecisionPoint")
    assert decision_node.id == decision_point_node_id(42)
    assert "advisory-only" in decision_node.tags
    assert decision_node.metadata["recommendationKey"] == "rec-cash-drag"

    leads_to_rel = next(r for r in ingest.relations if r.type == "LEADS_TO")
    assert leads_to_rel.from_id == recommendation_node_id("rec-cash-drag")
    assert leads_to_rel.to_id == decision_node.id

    store = _store(tmp_path)
    response = store.ingest(ingest, request_id="dp-1")
    assert response.inserted_entities >= 1

    # Idempotent re-ingest.
    response2 = store.ingest(ingest, request_id="dp-2")
    assert response2.inserted_entities == 0


def test_advisor_ingest_emits_learning_actions_with_invalidates_relation(tmp_path):
    request = AdvisorIngestRequest(
        mode="admin",
        learningActions=[
            AdvisorLearningActionInput(
                postMortemId=99,
                actionIndex=0,
                title="Tighten cash floor before rebalancing",
                description="Outcome contradicted the cash-drag thesis; raise minimum cash buffer.",
                appliesTo=["cash-drag-reduction"],
                status="invalidates_recommendation",
                confidence=0.7,
                recommendationKey="rec-cash-drag",
                decisionId=42,
                runId=11,
                evaluatedAt=datetime(2026, 5, 28, tzinfo=UTC),
            ),
            AdvisorLearningActionInput(
                postMortemId=99,
                actionIndex=1,
                title="Document inflation assumption sensitivity",
                description="Add an explicit inflation-band assumption check in the next run.",
                appliesTo=["assumption-tracking"],
                status="neutral",
                confidence=0.55,
                recommendationKey="rec-cash-drag",
                evaluatedAt=datetime(2026, 5, 28, tzinfo=UTC),
            ),
        ],
    )

    ingest = build_advisor_ingest(request)
    types = {entity.type for entity in ingest.entities}
    rel_types = {rel.type for rel in ingest.relations}
    assert "LearningAction" in types
    assert "INVALIDATED_BY" in rel_types
    assert "SUPPORTS" in rel_types
    assert "LEADS_TO" in rel_types  # decision -> learning action

    invalidating = next(e for e in ingest.entities if "invalidates_recommendation" in e.tags)
    assert invalidating.id == learning_action_node_id(99, 0)
    assert "advisory-only" in invalidating.tags

    invalidated_by_rel = next(r for r in ingest.relations if r.type == "INVALIDATED_BY")
    assert invalidated_by_rel.from_id == recommendation_node_id("rec-cash-drag")
    assert invalidated_by_rel.to_id == invalidating.id

    supports_rel = next(r for r in ingest.relations if r.type == "SUPPORTS")
    assert supports_rel.to_id == recommendation_node_id("rec-cash-drag")
    assert supports_rel.from_id == learning_action_node_id(99, 1)

    decision_to_action = next(
        r
        for r in ingest.relations
        if r.type == "LEADS_TO" and r.to_id == learning_action_node_id(99, 0)
    )
    assert decision_to_action.from_id == decision_point_node_id(42)

    store = _store(tmp_path)
    response = store.ingest(ingest, request_id="la-1")
    assert response.inserted_entities >= 2

    # Idempotent re-ingest.
    response2 = store.ingest(ingest, request_id="la-2")
    assert response2.inserted_entities == 0


def test_advisor_ingest_pr8_nodes_always_carry_advisory_only_tag(tmp_path):
    """Invariant: every DecisionPoint and LearningAction node MUST carry the
    'advisory-only' tag. The adapter is the single place that injects it; this
    test verifies the contract holds across both node types and across mixed
    inputs in the same request.
    """

    request = AdvisorIngestRequest(
        mode="admin",
        decisionPoints=[
            AdvisorDecisionPointInput(
                decisionId=1,
                decision="accepted",
                reasonCode="rebalance",
                decidedAt=datetime(2026, 5, 1, tzinfo=UTC),
                recommendationKey="rec-a",
            ),
            AdvisorDecisionPointInput(
                decisionId=2,
                decision="rejected",
                reasonCode="risk_too_high",
                decidedAt=datetime(2026, 5, 2, tzinfo=UTC),
                recommendationKey="rec-b",
            ),
        ],
        learningActions=[
            AdvisorLearningActionInput(
                postMortemId=10,
                actionIndex=0,
                title="Tighten threshold",
                status="invalidates_recommendation",
                recommendationKey="rec-a",
            ),
            AdvisorLearningActionInput(
                postMortemId=10,
                actionIndex=1,
                title="Confirm assumption",
                status="validates_recommendation",
                recommendationKey="rec-b",
            ),
            AdvisorLearningActionInput(
                postMortemId=10,
                actionIndex=2,
                title="Document drift",
                status="neutral",
                recommendationKey="rec-c",
            ),
        ],
    )

    ingest = build_advisor_ingest(request)
    pr8_nodes = [e for e in ingest.entities if e.type in ("DecisionPoint", "LearningAction")]
    assert len(pr8_nodes) == 5
    for node in pr8_nodes:
        assert "advisory-only" in node.tags, (
            f"node {node.id} ({node.type}) is missing the 'advisory-only' tag"
        )
        assert node.metadata.get("scope") == "advisory-only", (
            f"node {node.id} ({node.type}) metadata.scope must be 'advisory-only'"
        )


def test_advisor_ingest_pr8_idempotent_across_repeated_ingest(tmp_path):
    """Re-confirm idempotency for a mixed PR8 batch — no new nodes/relations
    should be created on a second ingest of the exact same payload.
    """

    request = AdvisorIngestRequest(
        mode="admin",
        decisionPoints=[
            AdvisorDecisionPointInput(
                decisionId=42,
                decision="accepted",
                reasonCode="accepted",
                decidedAt=datetime(2026, 5, 1, tzinfo=UTC),
                recommendationKey="rec-cash-drag",
            )
        ],
        learningActions=[
            AdvisorLearningActionInput(
                postMortemId=99,
                actionIndex=0,
                title="Cap confidence",
                status="invalidates_recommendation",
                recommendationKey="rec-cash-drag",
                decisionId=42,
            )
        ],
    )

    ingest = build_advisor_ingest(request)
    store = _store(tmp_path)

    first = store.ingest(ingest, request_id="pr8-1")
    second = store.ingest(ingest, request_id="pr8-2")

    assert first.inserted_entities >= 2
    assert second.inserted_entities == 0
    assert second.dedupe_count >= first.inserted_entities


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
