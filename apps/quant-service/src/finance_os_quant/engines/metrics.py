"""Portfolio/backtest metrics computation.

Internal implementations with QuantStats integration when available.
All metrics are deterministic for same inputs.
"""

from __future__ import annotations

import math
from typing import Any

import numpy as np


def _safe(v: float | None, decimals: int = 4) -> float | None:
    if v is None or not math.isfinite(v):
        return None
    return round(v, decimals)


def compute_cagr(equity_curve: list[float], periods_per_year: float = 252) -> float | None:
    if len(equity_curve) < 2 or equity_curve[0] <= 0:
        return None
    total_return = equity_curve[-1] / equity_curve[0]
    if total_return <= 0:
        return None
    n_periods = len(equity_curve) - 1
    years = n_periods / periods_per_year
    if years <= 0:
        return None
    return _safe(total_return ** (1 / years) - 1)


def compute_volatility(returns: list[float], periods_per_year: float = 252) -> float | None:
    if len(returns) < 2:
        return None
    return _safe(float(np.std(returns, ddof=1)) * math.sqrt(periods_per_year))


def compute_sharpe(
    returns: list[float], risk_free_rate: float = 0.0, periods_per_year: float = 252
) -> float | None:
    if len(returns) < 2:
        return None
    excess = [r - risk_free_rate / periods_per_year for r in returns]
    mean_excess = float(np.mean(excess))
    std_excess = float(np.std(excess, ddof=1))
    if std_excess == 0:
        return None
    return _safe(mean_excess / std_excess * math.sqrt(periods_per_year))


def compute_sortino(
    returns: list[float], risk_free_rate: float = 0.0, periods_per_year: float = 252
) -> float | None:
    if len(returns) < 2:
        return None
    daily_rf = risk_free_rate / periods_per_year
    excess = [r - daily_rf for r in returns]
    mean_excess = float(np.mean(excess))
    downside = [min(r, 0) ** 2 for r in excess]
    downside_std = math.sqrt(float(np.mean(downside)))
    if downside_std == 0:
        return None
    return _safe(mean_excess / downside_std * math.sqrt(periods_per_year))


def compute_max_drawdown(equity_curve: list[float]) -> float | None:
    if len(equity_curve) < 2:
        return None
    peak = equity_curve[0]
    max_dd = 0.0
    for v in equity_curve:
        if v > peak:
            peak = v
        dd = (peak - v) / peak if peak > 0 else 0.0
        if dd > max_dd:
            max_dd = dd
    return _safe(max_dd)


def compute_calmar(equity_curve: list[float], periods_per_year: float = 252) -> float | None:
    cagr = compute_cagr(equity_curve, periods_per_year)
    max_dd = compute_max_drawdown(equity_curve)
    if cagr is None or max_dd is None or max_dd == 0:
        return None
    return _safe(cagr / max_dd)


def compute_win_rate(pnls: list[float]) -> float | None:
    if not pnls:
        return None
    wins = sum(1 for p in pnls if p > 0)
    return _safe(wins / len(pnls))


def compute_profit_factor(pnls: list[float]) -> float | None:
    if not pnls:
        return None
    gross_profit = sum(p for p in pnls if p > 0)
    gross_loss = abs(sum(p for p in pnls if p < 0))
    if gross_loss == 0:
        return None if gross_profit == 0 else float("inf")
    return _safe(gross_profit / gross_loss)


def compute_exposure_time(in_market: list[bool]) -> float | None:
    if not in_market:
        return None
    return _safe(sum(1 for m in in_market if m) / len(in_market))


def compute_drawdown_recovery_days(equity_curve: list[float]) -> float | None:
    if len(equity_curve) < 2:
        return None
    peak = equity_curve[0]
    max_recovery = 0
    current_dd_start: int | None = None
    for i, v in enumerate(equity_curve):
        if v >= peak:
            if current_dd_start is not None:
                recovery = i - current_dd_start
                if recovery > max_recovery:
                    max_recovery = recovery
            peak = v
            current_dd_start = None
        elif current_dd_start is None:
            current_dd_start = i
    return float(max_recovery) if max_recovery > 0 else None


def compute_beta(returns: list[float], benchmark_returns: list[float]) -> float | None:
    n = min(len(returns), len(benchmark_returns))
    if n < 2:
        return None
    r = np.array(returns[:n])
    b = np.array(benchmark_returns[:n])
    cov = float(np.cov(r, b)[0][1])
    var_b = float(np.var(b, ddof=1))
    if var_b == 0:
        return None
    return _safe(cov / var_b)


def compute_alpha(
    returns: list[float],
    benchmark_returns: list[float],
    risk_free_rate: float = 0.0,
    periods_per_year: float = 252,
) -> float | None:
    beta = compute_beta(returns, benchmark_returns)
    if beta is None:
        return None
    n = min(len(returns), len(benchmark_returns))
    r_mean = float(np.mean(returns[:n])) * periods_per_year
    b_mean = float(np.mean(benchmark_returns[:n])) * periods_per_year
    return _safe(r_mean - risk_free_rate - beta * (b_mean - risk_free_rate))


def compute_drawdowns(
    equity_curve: list[float], dates: list[str] | None = None
) -> list[dict[str, Any]]:
    """Compute drawdown series from equity curve."""
    if not equity_curve:
        return []
    peak = equity_curve[0]
    result = []
    for i, v in enumerate(equity_curve):
        if v > peak:
            peak = v
        dd = (peak - v) / peak if peak > 0 else 0.0
        entry: dict[str, Any] = {"drawdown": round(dd, 6)}
        if dates and i < len(dates):
            entry["date"] = dates[i]
        result.append(entry)
    return result


def compute_all_metrics(
    equity_curve: list[float],
    returns: list[float],
    trade_pnls: list[float],
    total_fees: float = 0.0,
    total_slippage: float = 0.0,
    benchmark_returns: list[float] | None = None,
    risk_free_rate: float = 0.0,
    periods_per_year: float = 252,
) -> dict[str, Any]:
    """Compute all standard backtest metrics."""
    result: dict[str, Any] = {
        "cagr": compute_cagr(equity_curve, periods_per_year),
        "volatility": compute_volatility(returns, periods_per_year),
        "sharpe": compute_sharpe(returns, risk_free_rate, periods_per_year),
        "sortino": compute_sortino(returns, risk_free_rate, periods_per_year),
        "max_drawdown": compute_max_drawdown(equity_curve),
        "calmar": compute_calmar(equity_curve, periods_per_year),
        "win_rate": compute_win_rate(trade_pnls),
        "profit_factor": compute_profit_factor(trade_pnls),
        "total_trades": len(trade_pnls),
        "total_fees": round(total_fees, 2),
        "total_slippage": round(total_slippage, 2),
        "drawdown_recovery_days": compute_drawdown_recovery_days(equity_curve),
    }
    if benchmark_returns:
        bm_eq = [1.0]
        for r in benchmark_returns:
            bm_eq.append(bm_eq[-1] * (1 + r))
        result["benchmark_return"] = compute_cagr(bm_eq, periods_per_year)
        result["alpha"] = compute_alpha(
            returns, benchmark_returns, risk_free_rate, periods_per_year
        )
        result["beta"] = compute_beta(returns, benchmark_returns)
    return result
