"""Finance-OS Quant Service — FastAPI application.

Paper-trading and backtesting research ONLY.
No live trading, no broker connections, no real execution.
"""

from __future__ import annotations

import json
import logging
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import ORJSONResponse

from . import __version__
from .config import get_settings
from .engines.backtest import AVAILABLE_STRATEGIES, run_backtest
from .engines.indicators import AVAILABLE_INDICATORS, compute_indicator
from .engines.metrics import compute_all_metrics
from .engines.walk_forward import run_walk_forward
from .models import (
    BacktestRequest,
    CapabilitiesResponse,
    HealthResponse,
    IndicatorRequest,
    MetricsRequest,
    ScenarioEvaluateRequest,
    ScenarioEvaluateResult,
    VersionResponse,
    WalkForwardRequest,
)

logger = logging.getLogger("finance_os_quant")
logging.basicConfig(level=logging.INFO, format="%(message)s")

METRIC_NAMES = [
    "cagr", "volatility", "sharpe", "sortino", "max_drawdown",
    "calmar", "win_rate", "profit_factor", "exposure_time",
    "total_trades", "total_fees", "total_slippage", "benchmark_return",
    "alpha", "beta", "drawdown_recovery_days",
]


def _request_id(request: Request) -> str:
    candidate = request.headers.get("x-request-id", "").strip()
    return candidate or str(uuid4())


def _log(level: str, message: str, **fields: object) -> None:
    payload = {
        "level": level,
        "service": "quant-service",
        "msg": message,
        **fields,
    }
    logger.log(
        logging.ERROR if level == "error"
        else logging.WARNING if level == "warn"
        else logging.INFO,
        json.dumps(payload, default=str),
    )


def _safe_error(request_id: str, status_code: int, code: str, message: str) -> ORJSONResponse:
    return ORJSONResponse(
        {"ok": False, "code": code, "message": message, "requestId": request_id},
        status_code=status_code,
        headers={"x-request-id": request_id, "cache-control": "no-store"},
    )


def _check_vectorbt() -> bool:
    try:
        import vectorbt  # noqa: F401
        return True
    except ImportError:
        return False


def _check_quantstats() -> bool:
    try:
        import quantstats  # noqa: F401
        return True
    except ImportError:
        return False


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="Finance-OS Quant Service",
        description="Paper-trading and backtesting research service. No live trading.",
        version=__version__,
        docs_url="/docs" if settings.quant_service_enabled else None,
    )

    # --- Validation error handler ---
    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError) -> ORJSONResponse:
        rid = _request_id(request)
        return _safe_error(rid, 422, "VALIDATION_ERROR", str(exc.errors()[:3]))

    # --- Health ---
    @app.get("/health", response_class=ORJSONResponse)
    async def health() -> dict[str, Any]:
        return HealthResponse(paper_only=settings.trading_lab_paper_only).model_dump()

    # --- Version ---
    @app.get("/version", response_class=ORJSONResponse)
    async def version() -> dict[str, Any]:
        return VersionResponse(
            version=__version__,
            paper_only=settings.trading_lab_paper_only,
        ).model_dump()

    # --- Capabilities ---
    @app.get("/quant/capabilities", response_class=ORJSONResponse)
    async def capabilities() -> dict[str, Any]:
        return CapabilitiesResponse(
            indicators=AVAILABLE_INDICATORS,
            backtesting=True,
            metrics=METRIC_NAMES,
            paper_only=settings.trading_lab_paper_only,
            vectorbt_available=_check_vectorbt(),
            quantstats_available=_check_quantstats(),
            walk_forward=True,
            strategies=AVAILABLE_STRATEGIES,
        ).model_dump()

    # --- Indicators ---
    @app.post("/quant/indicators", response_class=ORJSONResponse)
    async def indicators(request: Request, body: IndicatorRequest) -> ORJSONResponse:
        rid = _request_id(request)
        _log("info", "indicator_request", requestId=rid, indicator=body.indicator)

        if not settings.quant_service_enabled:
            return _safe_error(rid, 503, "SERVICE_DISABLED", "Quant service is disabled")

        try:
            values = compute_indicator(body.indicator, body.data, body.params)
            return ORJSONResponse(
                {
                    "ok": True,
                    "indicator": body.indicator,
                    "values": values,
                    "params_used": body.params,
                    "requestId": rid,
                },
                headers={"x-request-id": rid, "cache-control": "no-store"},
            )
        except Exception as exc:
            _log("error", "indicator_error", requestId=rid, error=str(exc))
            return _safe_error(rid, 400, "INDICATOR_ERROR", str(exc))

    # --- Backtest ---
    @app.post("/quant/backtest", response_class=ORJSONResponse)
    async def backtest(request: Request, body: BacktestRequest) -> ORJSONResponse:
        rid = _request_id(request)
        _log("info", "backtest_request", requestId=rid, strategy=body.strategy_type, rows=len(body.data))

        if not settings.quant_service_enabled:
            return _safe_error(rid, 503, "SERVICE_DISABLED", "Quant service is disabled")

        if not settings.trading_lab_paper_only:
            return _safe_error(rid, 403, "PAPER_ONLY", "Trading Lab is paper-only mode. Live trading is not supported.")

        if len(body.data) > settings.trading_lab_max_backtest_rows:
            return _safe_error(
                rid, 400, "DATA_TOO_LARGE",
                f"Data exceeds maximum rows ({len(body.data)} > {settings.trading_lab_max_backtest_rows})",
            )

        try:
            result = run_backtest(
                strategy_type=body.strategy_type,
                data=body.data,
                initial_cash=body.initial_cash,
                fees_bps=body.fees_bps,
                slippage_bps=body.slippage_bps,
                spread_bps=body.spread_bps,
                params=body.params,
                benchmark_data=body.benchmark_data,
            )
            result["requestId"] = rid
            return ORJSONResponse(
                result,
                headers={"x-request-id": rid, "cache-control": "no-store"},
            )
        except Exception as exc:
            _log("error", "backtest_error", requestId=rid, error=str(exc))
            return _safe_error(rid, 400, "BACKTEST_ERROR", str(exc))

    # --- Metrics ---
    @app.post("/quant/metrics", response_class=ORJSONResponse)
    async def metrics(request: Request, body: MetricsRequest) -> ORJSONResponse:
        rid = _request_id(request)
        _log("info", "metrics_request", requestId=rid, returns_count=len(body.returns))

        if not settings.quant_service_enabled:
            return _safe_error(rid, 503, "SERVICE_DISABLED", "Quant service is disabled")

        try:
            equity = [1.0]
            for r in body.returns:
                equity.append(equity[-1] * (1 + r))

            result_metrics = compute_all_metrics(
                equity_curve=equity,
                returns=body.returns,
                trade_pnls=[],
                benchmark_returns=body.benchmark_returns,
                risk_free_rate=body.risk_free_rate,
            )
            return ORJSONResponse(
                {
                    "ok": True,
                    "metrics": result_metrics,
                    "requestId": rid,
                    "caveats": ["Metrics assume daily returns. Adjust interpretation for other frequencies."],
                },
                headers={"x-request-id": rid, "cache-control": "no-store"},
            )
        except Exception as exc:
            _log("error", "metrics_error", requestId=rid, error=str(exc))
            return _safe_error(rid, 400, "METRICS_ERROR", str(exc))

    # --- Walk-forward validation ---
    @app.post("/quant/walk-forward", response_class=ORJSONResponse)
    async def walk_forward(request: Request, body: WalkForwardRequest) -> ORJSONResponse:
        rid = _request_id(request)
        _log("info", "walk_forward_request", requestId=rid, strategy=body.strategy_type, rows=len(body.data))

        if not settings.quant_service_enabled:
            return _safe_error(rid, 503, "SERVICE_DISABLED", "Quant service is disabled")

        if not settings.trading_lab_paper_only:
            return _safe_error(rid, 403, "PAPER_ONLY", "Trading Lab is paper-only mode.")

        if len(body.data) > settings.trading_lab_max_backtest_rows:
            return _safe_error(
                rid, 400, "DATA_TOO_LARGE",
                f"Data exceeds maximum rows ({len(body.data)} > {settings.trading_lab_max_backtest_rows})",
            )

        try:
            result = run_walk_forward(
                strategy_type=body.strategy_type,
                data=body.data,
                initial_cash=body.initial_cash,
                fees_bps=body.fees_bps,
                slippage_bps=body.slippage_bps,
                spread_bps=body.spread_bps,
                params=body.params,
                train_bars=body.train_bars,
                test_bars=body.test_bars,
                step_bars=body.step_bars,
            )
            result["requestId"] = rid
            return ORJSONResponse(
                result,
                headers={"x-request-id": rid, "cache-control": "no-store"},
            )
        except Exception as exc:  # noqa: BLE001
            _log("error", "walk_forward_error", requestId=rid, error=str(exc))
            return _safe_error(rid, 400, "WALK_FORWARD_ERROR", str(exc))

    # --- Scenario Evaluate ---
    @app.post("/quant/scenario/evaluate", response_class=ORJSONResponse)
    async def scenario_evaluate(request: Request, body: ScenarioEvaluateRequest) -> ORJSONResponse:
        rid = _request_id(request)
        _log("info", "scenario_evaluate_request", requestId=rid)

        if not settings.quant_service_enabled:
            return _safe_error(rid, 503, "SERVICE_DISABLED", "Quant service is disabled")

        supporting = len(body.supporting_signals)
        contradicting = len(body.contradicting_signals)
        total = supporting + contradicting
        confidence = supporting / total if total > 0 else 0.0
        risk = "low" if confidence > 0.7 else "medium" if confidence > 0.4 else "high" if confidence > 0.2 else "critical"

        result = ScenarioEvaluateResult(
            confidence=round(confidence, 2),
            risk_level=risk,
            supporting_evidence_count=supporting,
            contradicting_evidence_count=contradicting,
            assessment=f"Thesis has {supporting} supporting and {contradicting} contradicting signals. "
            f"Confidence: {confidence:.0%}. This is a heuristic assessment, not financial advice.",
        )
        return ORJSONResponse(
            {**result.model_dump(), "requestId": rid},
            headers={"x-request-id": rid, "cache-control": "no-store"},
        )

    _log("info", "quant_service_started", version=__version__, paper_only=settings.trading_lab_paper_only)
    return app
