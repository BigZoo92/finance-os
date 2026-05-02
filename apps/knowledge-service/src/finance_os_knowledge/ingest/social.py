"""Social signal ingestion.

Maps social posts (X/Twitter, Bluesky, manual imports) into
SocialSignal nodes with AFFECTS_ASSET/OBSERVED_IN edges.
Reuses the news ingest infrastructure but creates SocialSignal node types
to distinguish provenance.
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


class SocialSignalInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str
    text: str
    author: str = "unknown"
    author_handle: str | None = Field(default=None, alias="authorHandle")
    provider: str = "manual_import"
    source_url: str | None = Field(default=None, alias="sourceUrl")
    published_at: datetime | None = Field(default=None, alias="publishedAt")
    group: Literal["finance", "ai_tech"] = "finance"
    signal_domain: str | None = Field(default=None, alias="signalDomain")
    confidence: float = 0.5
    impact: float | None = None
    severity: float | None = None
    relevance_score: float | None = Field(default=None, alias="relevanceScore")
    requires_attention: bool = Field(default=False, alias="requiresAttention")
    attention_reason: str | None = Field(default=None, alias="attentionReason")
    tags: list[str] = Field(default_factory=list)
    related_assets: list[str] = Field(default_factory=list, alias="relatedAssets")
    related_sectors: list[str] = Field(default_factory=list, alias="relatedSectors")


class SocialIngestRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    mode: KnowledgeScope = "admin"
    source: str = "finance-os-social"
    items: list[SocialSignalInput] = Field(default_factory=list)


def build_social_ingest(request: SocialIngestRequest) -> KnowledgeIngestRequest:
    entities: list[KnowledgeEntity] = []
    relations: list[KnowledgeRelation] = []
    seen_ids: set[str] = set()

    for item in request.items:
        signal_id = stable_node_id("social:signal", item.id, item.text[:80])
        label = clamp_text(item.text, max_length=160)
        signal = KnowledgeEntity(
            id=signal_id,
            type="SocialSignal",
            label=label,
            description=clamp_text(item.text, max_length=480),
            source=f"{item.provider}:{item.author}",
            sourceUrl=item.source_url,
            confidence=item.confidence,
            severity=item.severity,
            impact=item.impact,
            scope=request.mode,
            tags=[
                *item.tags,
                "social",
                item.group,
                item.provider,
                *(["attention"] if item.requires_attention else []),
            ],
            observedAt=item.published_at or utc_now(),
            sourceTimestamp=item.published_at,
            provenance=[
                base_provenance(
                    source=f"{item.provider}:{item.author}",
                    source_type="social",
                    source_ref=f"social:{item.id}",
                    source_url=item.source_url,
                    confidence=item.confidence,
                    source_timestamp=item.published_at,
                )
            ],
            metadata={
                "authorHandle": item.author_handle,
                "group": item.group,
                "signalDomain": item.signal_domain,
                "requiresAttention": item.requires_attention,
                "attentionReason": item.attention_reason,
                "relevanceScore": item.relevance_score,
            },
        )
        if signal.id not in seen_ids:
            entities.append(signal)
            seen_ids.add(signal.id)

        for asset in item.related_assets:
            asset_id = stable_node_id("markets:ticker", asset.upper())
            if asset_id not in seen_ids:
                entities.append(
                    KnowledgeEntity(
                        id=asset_id,
                        type="Ticker",
                        label=asset.upper(),
                        description=f"Referenced by social signal from {item.author}",
                        source="finance-os-social",
                        confidence=0.45,
                        scope=request.mode,
                        tags=["ticker", "social-link"],
                        observedAt=item.published_at or utc_now(),
                        provenance=[
                            base_provenance(
                                source="finance-os-social",
                                source_type="social",
                                source_ref=f"social_asset:{item.id}->{asset.upper()}",
                                confidence=0.45,
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
                    label=f"social signal from {item.author} mentions {asset.upper()}",
                    description="",
                    source="finance-os-social",
                    confidence=item.confidence * 0.8,
                    weight=0.55,
                    scope=request.mode,
                    tags=["social"],
                    observedAt=item.published_at or utc_now(),
                    provenance=[
                        base_provenance(
                            source="finance-os-social",
                            source_type="social",
                            source_ref=f"signal_asset:{item.id}->{asset.upper()}",
                            confidence=item.confidence * 0.8,
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
