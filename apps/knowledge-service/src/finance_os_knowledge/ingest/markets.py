"""Markets context ingestion.

Takes a markets context bundle (regimes, macro signals, asset/sector
exposures) and produces MacroSignal/Asset/Ticker/Sector/Evidence nodes
with the appropriate IMPACTS/AFFECTS_SECTOR/AFFECTS_ASSET relations.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from ..models import (
    KnowledgeEntity,
    KnowledgeIngestRequest,
    KnowledgeRelation,
    KnowledgeScope,
    utc_now,
)
from ._common import base_provenance, clamp_text, stable_node_id, stable_relation_id


class MarketsTickerInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    symbol: str
    name: str | None = None
    sector: str | None = None
    region: str | None = None
    asset_class: str | None = Field(default=None, alias="assetClass")
    exposure: float | None = None


class MarketsMacroSignalInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str
    label: str
    description: str = ""
    severity: float | None = None
    impact: float | None = None
    confidence: float = 0.65
    observed_at: datetime | None = Field(default=None, alias="observedAt")
    affected_sectors: list[str] = Field(default_factory=list, alias="affectedSectors")
    affected_assets: list[str] = Field(default_factory=list, alias="affectedAssets")
    tags: list[str] = Field(default_factory=list)


class MarketsIngestRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    mode: KnowledgeScope = "admin"
    source: str = "finance-os-markets"
    generated_at: datetime | None = Field(default=None, alias="generatedAt")
    macro_signals: list[MarketsMacroSignalInput] = Field(
        default_factory=list, alias="macroSignals"
    )
    tickers: list[MarketsTickerInput] = Field(default_factory=list)


def _ticker_node(ticker: MarketsTickerInput, mode: KnowledgeScope) -> KnowledgeEntity:
    node_id = stable_node_id("markets:ticker", ticker.symbol.upper())
    return KnowledgeEntity(
        id=node_id,
        type="Ticker",
        label=ticker.symbol.upper(),
        description=clamp_text(ticker.name) or ticker.symbol.upper(),
        source="finance-os-markets",
        confidence=0.7,
        scope=mode,
        tags=[
            tag
            for tag in [
                "ticker",
                ticker.asset_class or None,
                ticker.region or None,
                ticker.sector or None,
            ]
            if tag
        ],
        observedAt=utc_now(),
        provenance=[
            base_provenance(
                source="finance-os-markets",
                source_type="metric",
                source_ref=f"ticker:{ticker.symbol.upper()}",
                confidence=0.7,
            )
        ],
        metadata={
            "exposure": ticker.exposure,
            "assetClass": ticker.asset_class,
            "region": ticker.region,
        },
    )


def _sector_node(sector: str, mode: KnowledgeScope) -> KnowledgeEntity:
    node_id = stable_node_id("markets:sector", sector.lower())
    return KnowledgeEntity(
        id=node_id,
        type="Sector",
        label=sector,
        description=f"Market sector: {sector}",
        source="finance-os-markets",
        confidence=0.78,
        scope=mode,
        tags=["sector", sector.lower()],
        observedAt=utc_now(),
        provenance=[
            base_provenance(
                source="finance-os-markets",
                source_type="metric",
                source_ref=f"sector:{sector.lower()}",
                confidence=0.78,
            )
        ],
    )


def _macro_signal_node(
    signal: MarketsMacroSignalInput, mode: KnowledgeScope
) -> KnowledgeEntity:
    node_id = stable_node_id("markets:macro", signal.id, signal.label)
    return KnowledgeEntity(
        id=node_id,
        type="MacroSignal",
        label=clamp_text(signal.label, max_length=160),
        description=clamp_text(signal.description),
        source="finance-os-markets",
        confidence=max(0.0, min(1.0, signal.confidence)),
        severity=signal.severity,
        impact=signal.impact,
        scope=mode,
        tags=[*signal.tags, "macro", "markets"],
        observedAt=signal.observed_at or utc_now(),
        sourceTimestamp=signal.observed_at,
        provenance=[
            base_provenance(
                source="finance-os-markets",
                source_type="signal",
                source_ref=f"macro:{signal.id}",
                confidence=signal.confidence,
                source_timestamp=signal.observed_at,
            )
        ],
    )


def build_markets_ingest(request: MarketsIngestRequest) -> KnowledgeIngestRequest:
    entities: list[KnowledgeEntity] = []
    relations: list[KnowledgeRelation] = []
    seen_ids: set[str] = set()

    sector_nodes: dict[str, KnowledgeEntity] = {}
    for ticker in request.tickers:
        node = _ticker_node(ticker, request.mode)
        if node.id not in seen_ids:
            entities.append(node)
            seen_ids.add(node.id)
        if ticker.sector:
            sector = sector_nodes.get(ticker.sector.lower())
            if sector is None:
                sector = _sector_node(ticker.sector, request.mode)
                sector_nodes[ticker.sector.lower()] = sector
                if sector.id not in seen_ids:
                    entities.append(sector)
                    seen_ids.add(sector.id)
            rel_id = stable_relation_id("PART_OF", node.id, sector.id)
            relations.append(
                KnowledgeRelation(
                    id=rel_id,
                    type="PART_OF",
                    fromId=node.id,
                    toId=sector.id,
                    label=f"{node.label} part of {sector.label}",
                    description="",
                    source="finance-os-markets",
                    confidence=0.78,
                    weight=0.66,
                    scope=request.mode,
                    tags=["markets", "sector"],
                    observedAt=utc_now(),
                    provenance=[
                        base_provenance(
                            source="finance-os-markets",
                            source_type="metric",
                            source_ref=f"ticker_sector:{node.label}->{sector.label}",
                            confidence=0.78,
                        )
                    ],
                )
            )

    for signal in request.macro_signals:
        signal_node = _macro_signal_node(signal, request.mode)
        if signal_node.id not in seen_ids:
            entities.append(signal_node)
            seen_ids.add(signal_node.id)
        for sector_label in signal.affected_sectors:
            sector = sector_nodes.get(sector_label.lower())
            if sector is None:
                sector = _sector_node(sector_label, request.mode)
                sector_nodes[sector_label.lower()] = sector
                if sector.id not in seen_ids:
                    entities.append(sector)
                    seen_ids.add(sector.id)
            rel_id = stable_relation_id("AFFECTS_SECTOR", signal_node.id, sector.id)
            relations.append(
                KnowledgeRelation(
                    id=rel_id,
                    type="AFFECTS_SECTOR",
                    fromId=signal_node.id,
                    toId=sector.id,
                    label=f"{signal_node.label} affects {sector.label}",
                    description="",
                    source="finance-os-markets",
                    confidence=signal.confidence,
                    weight=0.82,
                    severity=signal.severity,
                    impact=signal.impact,
                    scope=request.mode,
                    tags=["markets", "macro"],
                    observedAt=signal.observed_at or utc_now(),
                    sourceTimestamp=signal.observed_at,
                    provenance=[
                        base_provenance(
                            source="finance-os-markets",
                            source_type="signal",
                            source_ref=f"macro->sector:{signal.id}->{sector.label}",
                            confidence=signal.confidence,
                            source_timestamp=signal.observed_at,
                        )
                    ],
                )
            )
        for asset_symbol in signal.affected_assets:
            asset_id = stable_node_id("markets:ticker", asset_symbol.upper())
            if asset_id not in seen_ids:
                # Materialize a placeholder ticker if not already present.
                placeholder = KnowledgeEntity(
                    id=asset_id,
                    type="Ticker",
                    label=asset_symbol.upper(),
                    description=f"Asset referenced by {signal.label}",
                    source="finance-os-markets",
                    confidence=0.6,
                    scope=request.mode,
                    tags=["ticker", "macro-effect"],
                    observedAt=signal.observed_at or utc_now(),
                    provenance=[
                        base_provenance(
                            source="finance-os-markets",
                            source_type="signal",
                            source_ref=f"macro->ticker:{signal.id}->{asset_symbol.upper()}",
                            confidence=0.6,
                        )
                    ],
                )
                entities.append(placeholder)
                seen_ids.add(asset_id)
            rel_id = stable_relation_id("AFFECTS_ASSET", signal_node.id, asset_id)
            relations.append(
                KnowledgeRelation(
                    id=rel_id,
                    type="AFFECTS_ASSET",
                    fromId=signal_node.id,
                    toId=asset_id,
                    label=f"{signal_node.label} affects {asset_symbol.upper()}",
                    description="",
                    source="finance-os-markets",
                    confidence=signal.confidence,
                    weight=0.84,
                    scope=request.mode,
                    tags=["markets", "macro"],
                    observedAt=signal.observed_at or utc_now(),
                    provenance=[
                        base_provenance(
                            source="finance-os-markets",
                            source_type="signal",
                            source_ref=f"macro->asset:{signal.id}->{asset_symbol.upper()}",
                            confidence=signal.confidence,
                            source_timestamp=signal.observed_at,
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


_metadata_used: dict[str, Any] = {}
