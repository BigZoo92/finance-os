"""Walk-forward / out-of-sample validation engine.

Splits the OHLCV series into rolling (train, test) windows.
For each window, we run the strategy on the test slice and capture
the test-only metrics. We then compare the average test metrics to
the average in-sample metrics over the same parameter set to estimate
overfitting / regime degradation.

Notes:
- Deterministic, light-weight. No parameter optimization yet — that
  is reserved for a future iteration. The current implementation
  reports stability across windows for the *given* parameters, so it
  is not a true walk-forward optimization but an out-of-sample
  rolling validation.
- Caps the number of windows to keep CPU bounded.
"""
from __future__ import annotations

import statistics
from typing import Any

from .backtest import run_backtest


MAX_WINDOWS = 12
MIN_BARS_PER_WINDOW = 30


def _safe_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _summarize_metric(values: list[float | None]) -> dict[str, float | None]:
    cleaned = [v for v in values if v is not None]
    if not cleaned:
        return {"mean": None, "median": None, "min": None, "max": None, "stdev": None}
    return {
        "mean": round(statistics.fmean(cleaned), 6),
        "median": round(statistics.median(cleaned), 6),
        "min": round(min(cleaned), 6),
        "max": round(max(cleaned), 6),
        "stdev": round(statistics.pstdev(cleaned), 6) if len(cleaned) > 1 else 0.0,
    }


def run_walk_forward(
    strategy_type: str,
    data: list[dict[str, Any]],
    initial_cash: float = 10_000.0,
    fees_bps: float = 10.0,
    slippage_bps: float = 5.0,
    spread_bps: float = 2.0,
    params: dict[str, Any] | None = None,
    train_bars: int = 120,
    test_bars: int = 30,
    step_bars: int = 30,
) -> dict[str, Any]:
    """Run a rolling walk-forward validation.

    For each window i:
    - in-sample slice = data[i*step : i*step + train_bars]
    - out-of-sample slice = data[i*step + train_bars : i*step + train_bars + test_bars]

    Parameters are NOT optimized inside in-sample (yet) — we just measure
    test-period stability for the same params, which is still informative.
    """
    params = params or {}
    train_bars = max(MIN_BARS_PER_WINDOW, int(train_bars))
    test_bars = max(int(MIN_BARS_PER_WINDOW / 2), int(test_bars))
    step_bars = max(test_bars, int(step_bars))
    total = len(data)

    if total < train_bars + test_bars + 5:
        return {
            "ok": True,
            "windows": [],
            "in_sample": {},
            "out_of_sample": {},
            "stability_score": None,
            "degradation_ratio": None,
            "overfit_warning": "INSUFFICIENT_DATA",
            "summary": (
                f"Need at least {train_bars + test_bars} bars for walk-forward; "
                f"got {total}."
            ),
        }

    windows: list[dict[str, Any]] = []
    in_sample_returns: list[float | None] = []
    in_sample_sharpe: list[float | None] = []
    in_sample_dd: list[float | None] = []
    out_of_sample_returns: list[float | None] = []
    out_of_sample_sharpe: list[float | None] = []
    out_of_sample_dd: list[float | None] = []

    cursor = 0
    while (
        cursor + train_bars + test_bars <= total
        and len(windows) < MAX_WINDOWS
    ):
        train_slice = data[cursor : cursor + train_bars]
        test_slice = data[cursor + train_bars : cursor + train_bars + test_bars]

        try:
            train_result = run_backtest(
                strategy_type=strategy_type,
                data=train_slice,
                initial_cash=initial_cash,
                fees_bps=fees_bps,
                slippage_bps=slippage_bps,
                spread_bps=spread_bps,
                params=params,
            )
        except Exception as exc:  # noqa: BLE001
            train_result = {"metrics": {}, "_error": str(exc)}
        try:
            test_result = run_backtest(
                strategy_type=strategy_type,
                data=test_slice,
                initial_cash=initial_cash,
                fees_bps=fees_bps,
                slippage_bps=slippage_bps,
                spread_bps=spread_bps,
                params=params,
            )
        except Exception as exc:  # noqa: BLE001
            test_result = {"metrics": {}, "_error": str(exc)}

        train_metrics = train_result.get("metrics") or {}
        test_metrics = test_result.get("metrics") or {}

        train_curve = train_result.get("equity_curve") or []
        test_curve = test_result.get("equity_curve") or []

        def _curve_return(curve: list[Any]) -> float | None:
            if len(curve) < 2:
                return None
            first_eq = _safe_float(curve[0].get("equity"))
            last_eq = _safe_float(curve[-1].get("equity"))
            if not first_eq or not last_eq or first_eq == 0:
                return None
            return round((last_eq - first_eq) / first_eq, 6)

        train_ret = _curve_return(train_curve)
        test_ret = _curve_return(test_curve)

        in_sample_returns.append(train_ret)
        in_sample_sharpe.append(_safe_float(train_metrics.get("sharpe")))
        in_sample_dd.append(_safe_float(train_metrics.get("max_drawdown")))
        out_of_sample_returns.append(test_ret)
        out_of_sample_sharpe.append(_safe_float(test_metrics.get("sharpe")))
        out_of_sample_dd.append(_safe_float(test_metrics.get("max_drawdown")))

        windows.append(
            {
                "index": len(windows),
                "train_start": train_slice[0].get("date"),
                "train_end": train_slice[-1].get("date"),
                "test_start": test_slice[0].get("date"),
                "test_end": test_slice[-1].get("date"),
                "train_return": train_ret,
                "test_return": test_ret,
                "train_sharpe": _safe_float(train_metrics.get("sharpe")),
                "test_sharpe": _safe_float(test_metrics.get("sharpe")),
                "train_max_drawdown": _safe_float(train_metrics.get("max_drawdown")),
                "test_max_drawdown": _safe_float(test_metrics.get("max_drawdown")),
                "test_total_trades": int(test_metrics.get("total_trades", 0)),
            }
        )
        cursor += step_bars

    in_sample = {
        "return": _summarize_metric(in_sample_returns),
        "sharpe": _summarize_metric(in_sample_sharpe),
        "max_drawdown": _summarize_metric(in_sample_dd),
    }
    out_of_sample = {
        "return": _summarize_metric(out_of_sample_returns),
        "sharpe": _summarize_metric(out_of_sample_sharpe),
        "max_drawdown": _summarize_metric(out_of_sample_dd),
    }

    # Stability: ratio of OOS sharpe stdev to mean (lower is more stable)
    oos_sharpe_clean = [v for v in out_of_sample_sharpe if v is not None]
    stability_score: float | None
    if len(oos_sharpe_clean) >= 2:
        mean_abs = abs(statistics.fmean(oos_sharpe_clean))
        if mean_abs > 0.01:
            stability_score = round(
                1.0 - min(statistics.pstdev(oos_sharpe_clean) / mean_abs, 1.0),
                3,
            )
        else:
            stability_score = 0.0
    else:
        stability_score = None

    # Degradation: ratio of mean OOS return / mean IS return (negative = OOS worse)
    is_ret_mean = in_sample["return"]["mean"]
    oos_ret_mean = out_of_sample["return"]["mean"]
    degradation_ratio: float | None
    if is_ret_mean is not None and oos_ret_mean is not None and is_ret_mean != 0:
        degradation_ratio = round(oos_ret_mean / is_ret_mean, 3)
    else:
        degradation_ratio = None

    overfit_warning: str | None
    if degradation_ratio is not None and degradation_ratio < 0:
        overfit_warning = "OOS_LOSES_MONEY_WHEN_IS_PROFITABLE"
    elif degradation_ratio is not None and degradation_ratio < 0.3:
        overfit_warning = "STRONG_DEGRADATION"
    elif stability_score is not None and stability_score < 0.3:
        overfit_warning = "HIGH_OOS_VARIANCE"
    else:
        overfit_warning = None

    summary_lines = [
        f"{len(windows)} windows tested.",
        f"In-sample mean return: {is_ret_mean if is_ret_mean is not None else 'n/a'}.",
        f"Out-of-sample mean return: {oos_ret_mean if oos_ret_mean is not None else 'n/a'}.",
    ]
    if overfit_warning:
        summary_lines.append(f"WARNING: {overfit_warning}.")

    return {
        "ok": True,
        "windows": windows,
        "in_sample": in_sample,
        "out_of_sample": out_of_sample,
        "stability_score": stability_score,
        "degradation_ratio": degradation_ratio,
        "overfit_warning": overfit_warning,
        "summary": " ".join(summary_lines),
    }
