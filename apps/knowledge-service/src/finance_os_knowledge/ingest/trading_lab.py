"""Trading Lab ingestion — strategy, backtest, scenario nodes.

Compact summaries only — no full equity curves or trade lists in graph.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from ..models import (
    KnowledgeEntity,
    KnowledgeIngestRequest,
    KnowledgeObservation,
    KnowledgeRelation,
    KnowledgeScope,
    utc_now,
)
from ._common import base_provenance, clamp_text, stable_node_id, stable_relation_id


class StrategyInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: int
    name: str
    slug: str
    strategy_type: str = Field(alias="strategyType")
    status: str
    description: str | None = None
    tags: list[str] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)
    caveats: list[str] = Field(default_factory=list)
    indicators: list[str] = Field(default_factory=list)


class BacktestSummaryInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: int
    strategy_id: int = Field(alias="strategyId")
    strategy_name: str = Field(alias="strategyName")
    symbol: str
    start_date: str = Field(alias="startDate")
    end_date: str = Field(alias="endDate")
    initial_cash: float = Field(alias="initialCash")
    fees_bps: float = Field(alias="feesBps")
    slippage_bps: float = Field(alias="slippageBps")
    metrics: dict[str, Any] = Field(default_factory=dict)
    params_hash: str | None = Field(default=None, alias="paramsHash")
    data_hash: str | None = Field(default=None, alias="dataHash")
    caveats: list[str] = Field(default_factory=list)
    run_status: str = Field(default="completed", alias="runStatus")


class ScenarioInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: int
    name: str
    thesis: str | None = None
    status: str = "open"
    linked_strategy_id: int | None = Field(default=None, alias="linkedStrategyId")
    linked_signal_item_id: int | None = Field(default=None, alias="linkedSignalItemId")
    invalidation_criteria: str | None = Field(default=None, alias="invalidationCriteria")
    risk_notes: str | None = Field(default=None, alias="riskNotes")


class TradingLabIngestRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    mode: KnowledgeScope = "admin"
    source: str = "finance-os-trading-lab"
    strategies: list[StrategyInput] = Field(default_factory=list)
    backtests: list[BacktestSummaryInput] = Field(default_factory=list)
    scenarios: list[ScenarioInput] = Field(default_factory=list)


def build_trading_lab_ingest(request: TradingLabIngestRequest) -> KnowledgeIngestRequest:
    entities: list[KnowledgeEntity] = []
    relations: list[KnowledgeRelation] = []
    observations: list[KnowledgeObservation] = []
    seen: set[str] = set()
    now = utc_now()

    for strat in request.strategies:
        sid = stable_node_id("trading:strategy", str(strat.id), strat.slug)
        entities.append(
            KnowledgeEntity(
                id=sid,
                type="TradingStrategy",
                label=strat.name,
                description=clamp_text(strat.description or strat.name, 300),
                source="finance-os-trading-lab",
                confidence=0.5 if strat.strategy_type == "experimental" else 0.7,
                scope=request.mode,
                tags=[*strat.tags, strat.strategy_type, strat.status, "trading-lab"],
                observedAt=now,
                provenance=[
                    base_provenance(
                        source="finance-os-trading-lab",
                        source_type="strategy",
                        source_ref=f"strategy:{strat.id}",
                        confidence=0.5 if strat.strategy_type == "experimental" else 0.7,
                    )
                ],
                metadata={
                    "strategyType": strat.strategy_type,
                    "status": strat.status,
                    "assumptions": strat.assumptions[:5],
                    "caveats": strat.caveats[:5],
                    "indicators": strat.indicators[:5],
                },
            )
        )
        seen.add(sid)

        # Link indicators
        for ind_name in strat.indicators[:5]:
            ind_id = stable_node_id("indicator", ind_name.lower())
            if ind_id not in seen:
                entities.append(
                    KnowledgeEntity(
                        id=ind_id,
                        type="Indicator",
                        label=ind_name,
                        description=f"Technical indicator: {ind_name}",
                        source="finance-os-trading-lab",
                        confidence=0.6,
                        scope=request.mode,
                        tags=["indicator", "trading-lab"],
                        observedAt=now,
                        provenance=[
                            base_provenance(
                                source="finance-os-trading-lab",
                                source_type="indicator",
                                source_ref=f"indicator:{ind_name}",
                                confidence=0.6,
                            )
                        ],
                    )
                )
                seen.add(ind_id)
            rel_id = stable_relation_id("USES_FORMULA", sid, ind_id)
            relations.append(
                KnowledgeRelation(
                    id=rel_id,
                    type="USES_FORMULA",
                    fromId=sid,
                    toId=ind_id,
                    label=f"{strat.name} uses {ind_name}",
                    description="",
                    source="finance-os-trading-lab",
                    confidence=0.7,
                    weight=0.75,
                    scope=request.mode,
                    tags=["trading-lab"],
                    observedAt=now,
                    provenance=[
                        base_provenance(
                            source="finance-os-trading-lab",
                            source_type="strategy-indicator",
                            source_ref=f"strategy:{strat.id}->indicator:{ind_name}",
                            confidence=0.7,
                        )
                    ],
                )
            )

    for bt in request.backtests:
        bt_id = stable_node_id("trading:backtest", str(bt.id), bt.symbol)
        label = f"Backtest: {bt.strategy_name} on {bt.symbol} ({bt.start_date[:10]} to {bt.end_date[:10]})"
        entities.append(
            KnowledgeEntity(
                id=bt_id,
                type="BacktestRun",
                label=clamp_text(label, 160),
                description=clamp_text(
                    f"Backtest run #{bt.id}. Cash: ${bt.initial_cash:.0f}, Fees: {bt.fees_bps}bps. "
                    f"Status: {bt.run_status}. "
                    + ", ".join(f"{k}: {v}" for k, v in list(bt.metrics.items())[:6]),
                    400,
                ),
                source="finance-os-trading-lab",
                confidence=0.55,
                scope=request.mode,
                tags=["backtest", "trading-lab", bt.symbol],
                observedAt=now,
                provenance=[
                    base_provenance(
                        source="finance-os-trading-lab",
                        source_type="backtest",
                        source_ref=f"backtest:{bt.id}",
                        confidence=0.55,
                    )
                ],
                metadata={
                    "symbol": bt.symbol,
                    "startDate": bt.start_date,
                    "endDate": bt.end_date,
                    "initialCash": bt.initial_cash,
                    "feesBps": bt.fees_bps,
                    "slippageBps": bt.slippage_bps,
                    "paramsHash": bt.params_hash,
                    "dataHash": bt.data_hash,
                    "runStatus": bt.run_status,
                    "metricsCompact": {k: v for k, v in list(bt.metrics.items())[:10]},
                    "caveats": bt.caveats[:3],
                },
            )
        )
        seen.add(bt_id)

        # Link to strategy
        strat_id = stable_node_id("trading:strategy", str(bt.strategy_id), "")
        rel_id = stable_relation_id("BACKTESTED_WITH", strat_id, bt_id)
        relations.append(
            KnowledgeRelation(
                id=rel_id,
                type="BACKTESTED_WITH",
                fromId=strat_id,
                toId=bt_id,
                label=f"{bt.strategy_name} backtested on {bt.symbol}",
                description="",
                source="finance-os-trading-lab",
                confidence=0.6,
                weight=0.72,
                scope=request.mode,
                tags=["trading-lab", "backtest"],
                observedAt=now,
                provenance=[
                    base_provenance(
                        source="finance-os-trading-lab",
                        source_type="backtest-link",
                        source_ref=f"strategy:{bt.strategy_id}->backtest:{bt.id}",
                        confidence=0.6,
                    )
                ],
            )
        )

    for sc in request.scenarios:
        sc_id = stable_node_id("trading:scenario", str(sc.id), sc.name[:40])
        entities.append(
            KnowledgeEntity(
                id=sc_id,
                type="PaperScenario",
                label=clamp_text(sc.name, 120),
                description=clamp_text(sc.thesis or sc.name, 300),
                source="finance-os-trading-lab",
                confidence=0.4,
                scope=request.mode,
                tags=["scenario", "trading-lab", sc.status],
                observedAt=now,
                provenance=[
                    base_provenance(
                        source="finance-os-trading-lab",
                        source_type="scenario",
                        source_ref=f"scenario:{sc.id}",
                        confidence=0.4,
                    )
                ],
                metadata={
                    "status": sc.status,
                    "invalidationCriteria": sc.invalidation_criteria,
                    "riskNotes": sc.risk_notes,
                },
            )
        )

        if sc.linked_strategy_id:
            strat_id = stable_node_id("trading:strategy", str(sc.linked_strategy_id), "")
            rel_id = stable_relation_id("GENERATED_SCENARIO", strat_id, sc_id)
            relations.append(
                KnowledgeRelation(
                    id=rel_id,
                    type="GENERATED_SCENARIO",
                    fromId=strat_id,
                    toId=sc_id,
                    label=f"Strategy generated scenario: {sc.name}",
                    description="",
                    source="finance-os-trading-lab",
                    confidence=0.45,
                    weight=0.65,
                    scope=request.mode,
                    tags=["trading-lab"],
                    observedAt=now,
                    provenance=[
                        base_provenance(
                            source="finance-os-trading-lab",
                            source_type="scenario-link",
                            source_ref=f"strategy:{sc.linked_strategy_id}->scenario:{sc.id}",
                            confidence=0.45,
                        )
                    ],
                )
            )

    return KnowledgeIngestRequest(
        mode=request.mode,
        source=request.source,
        entities=entities,
        relations=relations,
        observations=observations,
    )
