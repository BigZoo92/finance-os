"""News context ingestion.

Maps a news context bundle (curated headlines + market-event tags) into
NewsSignal/MarketEvent/SourceDocument/Evidence nodes with the appropriate
SUPPORTED_BY/CONTRADICTED_BY/IMPACTS edges.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from ..models import (
    KnowledgeEntity,
    KnowledgeIngestRequest,
    KnowledgeRelation,
    KnowledgeScope,
    utc_now,
)
from ._common import base_provenance, clamp_text, stable_node_id, stable_relation_id


class NewsItemInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str
    title: str
    summary: str = ""
    source: str = "unknown"
    source_url: str | None = Field(default=None, alias="sourceUrl")
    published_at: datetime | None = Field(default=None, alias="publishedAt")
    sentiment: float | None = None
    confidence: float = 0.6
    impact: float | None = None
    severity: float | None = None
    tags: list[str] = Field(default_factory=list)
    related_assets: list[str] = Field(default_factory=list, alias="relatedAssets")
    related_sectors: list[str] = Field(default_factory=list, alias="relatedSectors")
    market_event: str | None = Field(default=None, alias="marketEvent")
    stance: Literal["supporting", "contradicting", "neutral"] = "neutral"


class NewsIngestRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    mode: KnowledgeScope = "admin"
    source: str = "finance-os-news"
    items: list[NewsItemInput] = Field(default_factory=list)


def build_news_ingest(request: NewsIngestRequest) -> KnowledgeIngestRequest:
    entities: list[KnowledgeEntity] = []
    relations: list[KnowledgeRelation] = []
    seen_ids: set[str] = set()

    for item in request.items:
        signal_id = stable_node_id("news:signal", item.id, item.title)
        signal = KnowledgeEntity(
            id=signal_id,
            type="NewsSignal",
            label=clamp_text(item.title, max_length=160),
            description=clamp_text(item.summary, max_length=480),
            source=item.source,
            sourceUrl=item.source_url,
            confidence=item.confidence,
            severity=item.severity,
            impact=item.impact,
            scope=request.mode,
            tags=[*item.tags, "news", item.stance],
            observedAt=item.published_at or utc_now(),
            sourceTimestamp=item.published_at,
            provenance=[
                base_provenance(
                    source=item.source,
                    source_type="news",
                    source_ref=f"news:{item.id}",
                    source_url=item.source_url,
                    confidence=item.confidence,
                    source_timestamp=item.published_at,
                )
            ],
            metadata={"sentiment": item.sentiment, "originalId": item.id},
        )
        if signal.id not in seen_ids:
            entities.append(signal)
            seen_ids.add(signal.id)

        # Source document node so we can SUPPORT or CONTRADICT it later.
        if item.source_url:
            doc_id = stable_node_id("news:doc", item.source_url)
            doc = KnowledgeEntity(
                id=doc_id,
                type="SourceDocument",
                label=clamp_text(item.title, max_length=160),
                description=item.source,
                source=item.source,
                sourceUrl=item.source_url,
                confidence=0.7,
                scope=request.mode,
                tags=["news", "document"],
                observedAt=item.published_at or utc_now(),
                sourceTimestamp=item.published_at,
                provenance=[
                    base_provenance(
                        source=item.source,
                        source_type="document",
                        source_ref=f"doc:{item.id}",
                        source_url=item.source_url,
                        confidence=0.7,
                        source_timestamp=item.published_at,
                    )
                ],
            )
            if doc.id not in seen_ids:
                entities.append(doc)
                seen_ids.add(doc.id)
            rel_id = stable_relation_id(
                "DERIVED_FROM" if item.stance == "supporting" else "DERIVED_FROM",
                signal.id,
                doc.id,
            )
            relations.append(
                KnowledgeRelation(
                    id=rel_id,
                    type="DERIVED_FROM",
                    fromId=signal.id,
                    toId=doc.id,
                    label="news signal derived from document",
                    description="",
                    source=item.source,
                    confidence=0.75,
                    weight=0.78,
                    scope=request.mode,
                    tags=["news"],
                    observedAt=item.published_at or utc_now(),
                    provenance=[
                        base_provenance(
                            source=item.source,
                            source_type="document",
                            source_ref=f"news_doc:{item.id}",
                            confidence=0.75,
                        )
                    ],
                )
            )

        if item.market_event:
            event_id = stable_node_id("news:event", item.market_event)
            event = KnowledgeEntity(
                id=event_id,
                type="MarketEvent",
                label=clamp_text(item.market_event, max_length=120),
                description="",
                source="finance-os-news",
                confidence=0.7,
                severity=item.severity,
                impact=item.impact,
                scope=request.mode,
                tags=["market-event", "news"],
                observedAt=item.published_at or utc_now(),
                provenance=[
                    base_provenance(
                        source="finance-os-news",
                        source_type="event",
                        source_ref=f"event:{item.market_event}",
                        confidence=0.7,
                    )
                ],
            )
            if event.id not in seen_ids:
                entities.append(event)
                seen_ids.add(event.id)
            rel_id = stable_relation_id("OBSERVED_IN", signal.id, event.id)
            relations.append(
                KnowledgeRelation(
                    id=rel_id,
                    type="OBSERVED_IN",
                    fromId=signal.id,
                    toId=event.id,
                    label=f"{signal.label} observed in {event.label}",
                    description="",
                    source="finance-os-news",
                    confidence=item.confidence,
                    weight=0.7,
                    scope=request.mode,
                    tags=["news"],
                    observedAt=item.published_at or utc_now(),
                    provenance=[
                        base_provenance(
                            source="finance-os-news",
                            source_type="event",
                            source_ref=f"signal_event:{item.id}->{item.market_event}",
                            confidence=item.confidence,
                        )
                    ],
                )
            )

        for asset in item.related_assets:
            asset_id = stable_node_id("markets:ticker", asset.upper())
            if asset_id not in seen_ids:
                entities.append(
                    KnowledgeEntity(
                        id=asset_id,
                        type="Ticker",
                        label=asset.upper(),
                        description=f"Referenced by news signal {signal.label}",
                        source="finance-os-news",
                        confidence=0.55,
                        scope=request.mode,
                        tags=["ticker", "news-link"],
                        observedAt=item.published_at or utc_now(),
                        provenance=[
                            base_provenance(
                                source="finance-os-news",
                                source_type="news",
                                source_ref=f"news_asset:{item.id}->{asset.upper()}",
                                confidence=0.55,
                            )
                        ],
                    )
                )
                seen_ids.add(asset_id)
            rel_id = stable_relation_id("AFFECTS_ASSET", signal.id, asset_id)
            relations.append(
                KnowledgeRelation(
                    id=rel_id,
                    type="AFFECTS_ASSET",
                    fromId=signal.id,
                    toId=asset_id,
                    label=f"{signal.label} mentions {asset.upper()}",
                    description="",
                    source="finance-os-news",
                    confidence=item.confidence,
                    weight=0.74,
                    scope=request.mode,
                    tags=["news"],
                    observedAt=item.published_at or utc_now(),
                    provenance=[
                        base_provenance(
                            source="finance-os-news",
                            source_type="news",
                            source_ref=f"signal_asset:{item.id}->{asset.upper()}",
                            confidence=item.confidence,
                        )
                    ],
                )
            )

    return KnowledgeIngestRequest(
        mode=request.mode,
        source=request.source,
        entities=entities,
        relations=relations,
        observations=[],
    )
