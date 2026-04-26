"""Source-specific ingestion adapters for the Finance-OS knowledge graph.

Each adapter takes a typed request shaped like the existing Finance-OS
context bundles (markets, news, advisor recommendations, AI cost ledger)
and produces a `KnowledgeIngestRequest` ready for the store. Adapters
keep Postgres canonical and treat the graph as derived memory.

Common rules across adapters:
* Idempotent: stable ids derived from semantic dedupe keys.
* Provenance: every node/relation carries a `Provenance` entry pointing
  back to the originating Finance-OS surface.
* Temporal: `observedAt` and `sourceTimestamp` are populated when known.
* Confidence: derived from the source signal strength or capped to a
  conservative default.
* Redaction: free-form text fields are bounded; raw_payload is never
  populated by these adapters to avoid PII leakage.
"""
from .advisor import AdvisorIngestRequest, build_advisor_ingest
from .cost_ledger import CostLedgerIngestRequest, build_cost_ledger_ingest
from .markets import MarketsIngestRequest, build_markets_ingest
from .news import NewsIngestRequest, build_news_ingest

__all__ = [
    "AdvisorIngestRequest",
    "CostLedgerIngestRequest",
    "MarketsIngestRequest",
    "NewsIngestRequest",
    "build_advisor_ingest",
    "build_cost_ledger_ingest",
    "build_markets_ingest",
    "build_news_ingest",
]
