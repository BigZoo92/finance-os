"""Pydantic models for quant service endpoints."""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Health / Version
# ---------------------------------------------------------------------------


class HealthResponse(BaseModel):
    ok: bool = True
    service: str = "quant-service"
    paper_only: bool = True


class VersionResponse(BaseModel):
    service: str = "quant-service"
    version: str
    paper_only: bool = True


class CapabilitiesResponse(BaseModel):
    indicators: List[str]
    backtesting: bool
    metrics: List[str]
    paper_only: bool = True
    vectorbt_available: bool
    quantstats_available: bool
    walk_forward: bool = True
    strategies: List[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Indicators
# ---------------------------------------------------------------------------

IndicatorType = Literal[
    "ema",
    "sma",
    "rsi",
    "macd",
    "parabolic_sar",
    "atr",
    "bollinger_bands",
    "volume_profile",
    "support_resistance",
]


class IndicatorRequest(BaseModel):
    indicator: IndicatorType
    data: List[Dict[str, Any]] = Field(
        ..., description="OHLCV rows: [{date, open, high, low, close, volume}]"
    )
    params: Dict[str, Any] = Field(default_factory=dict)


class IndicatorResult(BaseModel):
    indicator: str
    values: List[Dict[str, Any]]
    params_used: Dict[str, Any]


# ---------------------------------------------------------------------------
# Backtest
# ---------------------------------------------------------------------------


class BacktestRequest(BaseModel):
    strategy_type: str
    data: List[Dict[str, Any]] = Field(
        ..., description="OHLCV rows: [{date, open, high, low, close, volume}]"
    )
    initial_cash: float = 10_000.0
    fees_bps: float = 10.0
    slippage_bps: float = 5.0
    spread_bps: float = 2.0
    params: Dict[str, Any] = Field(default_factory=dict)
    benchmark_data: Optional[List[Dict[str, Any]]] = None


class TradeRecord(BaseModel):
    entry_date: str
    exit_date: str
    side: Literal["long", "short"] = "long"
    entry_price: float
    exit_price: float
    size: float
    pnl: float
    pnl_pct: float
    fees: float


class BacktestMetrics(BaseModel):
    cagr: Optional[float] = None
    volatility: Optional[float] = None
    sharpe: Optional[float] = None
    sortino: Optional[float] = None
    max_drawdown: Optional[float] = None
    calmar: Optional[float] = None
    win_rate: Optional[float] = None
    profit_factor: Optional[float] = None
    exposure_time: Optional[float] = None
    total_trades: int = 0
    total_fees: float = 0.0
    total_slippage: float = 0.0
    benchmark_return: Optional[float] = None
    alpha: Optional[float] = None
    beta: Optional[float] = None
    drawdown_recovery_days: Optional[float] = None


class BacktestResult(BaseModel):
    ok: bool = True
    strategy_type: str
    symbol: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    metrics: BacktestMetrics
    equity_curve: List[Dict[str, Any]]
    trades: List[TradeRecord]
    drawdowns: List[Dict[str, Any]]
    caveats: List[str] = Field(
        default_factory=lambda: [
            "This is a simulation. Past performance does not predict future results.",
            "Backtest results include survivorship bias and do not account for market impact.",
            "Transaction costs are approximated. Real costs may differ.",
            "Paper-trading only. No real capital at risk.",
        ]
    )
    params_hash: Optional[str] = None
    data_hash: Optional[str] = None


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------


class MetricsRequest(BaseModel):
    returns: List[float] = Field(..., description="Daily returns series")
    benchmark_returns: Optional[List[float]] = None
    risk_free_rate: float = 0.0


class MetricsResult(BaseModel):
    metrics: BacktestMetrics
    caveats: List[str] = Field(
        default_factory=lambda: [
            "Metrics assume daily returns. Adjust interpretation for other frequencies.",
        ]
    )


# ---------------------------------------------------------------------------
# Scenario
# ---------------------------------------------------------------------------


class WalkForwardRequest(BaseModel):
    strategy_type: str
    data: List[Dict[str, Any]] = Field(
        ..., description="OHLCV rows: [{date, open, high, low, close, volume}]"
    )
    initial_cash: float = 10_000.0
    fees_bps: float = 10.0
    slippage_bps: float = 5.0
    spread_bps: float = 2.0
    params: Dict[str, Any] = Field(default_factory=dict)
    train_bars: int = 120
    test_bars: int = 30
    step_bars: int = 30


class ScenarioEvaluateRequest(BaseModel):
    thesis: str
    expected_outcome: Optional[str] = None
    invalidation_criteria: Optional[str] = None
    supporting_signals: List[Dict[str, Any]] = Field(default_factory=list)
    contradicting_signals: List[Dict[str, Any]] = Field(default_factory=list)


class ScenarioEvaluateResult(BaseModel):
    ok: bool = True
    confidence: float
    risk_level: Literal["low", "medium", "high", "critical"]
    supporting_evidence_count: int
    contradicting_evidence_count: int
    assessment: str
    caveats: List[str] = Field(
        default_factory=lambda: [
            "Scenario evaluation is heuristic-based. Not financial advice.",
        ]
    )
