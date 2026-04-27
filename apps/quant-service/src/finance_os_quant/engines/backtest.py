"""Backtesting engine.

Deterministic internal engine using NumPy/pandas.
vectorbt integration available as optional accelerator.
"""
from __future__ import annotations

import hashlib
import json
from typing import Any

import numpy as np
import pandas as pd

from .indicators import compute_ema, compute_rsi, compute_macd, compute_parabolic_sar
from .metrics import compute_all_metrics, compute_drawdowns


def _hash_params(params: dict[str, Any]) -> str:
    return hashlib.sha256(json.dumps(params, sort_keys=True).encode()).hexdigest()[:16]


def _hash_data(data: list[dict[str, Any]]) -> str:
    key = f"{len(data)}:{data[0].get('date','?') if data else '?'}:{data[-1].get('date','?') if data else '?'}"
    return hashlib.sha256(key.encode()).hexdigest()[:16]


def _to_df(data: list[dict[str, Any]]) -> pd.DataFrame:
    df = pd.DataFrame(data)
    df["date"] = pd.to_datetime(df["date"])
    df = df.set_index("date").sort_index()
    for c in ("open", "high", "low", "close", "volume"):
        if c in df.columns:
            df[c] = df[c].astype(float)
    return df


# ---------------------------------------------------------------------------
# Strategy implementations (deterministic, long-only, paper-only)
# ---------------------------------------------------------------------------


def _buy_and_hold(df: pd.DataFrame, params: dict[str, Any]) -> pd.Series:
    """Buy and hold benchmark: signal is always 1 (in market)."""
    return pd.Series(1, index=df.index, dtype=int)


def _ema_crossover(df: pd.DataFrame, params: dict[str, Any]) -> pd.Series:
    """EMA crossover: long when fast EMA > slow EMA."""
    fast = int(params.get("fast_period", 10))
    slow = int(params.get("slow_period", 20))
    ema_fast = df["close"].ewm(span=fast, adjust=False).mean()
    ema_slow = df["close"].ewm(span=slow, adjust=False).mean()
    signal = (ema_fast > ema_slow).astype(int)
    return signal


def _rsi_mean_reversion(df: pd.DataFrame, params: dict[str, Any]) -> pd.Series:
    """RSI mean reversion: buy when RSI < oversold, sell when RSI > overbought."""
    period = int(params.get("rsi_period", 14))
    oversold = float(params.get("oversold", 30))
    overbought = float(params.get("overbought", 70))

    delta = df["close"].diff()
    gain = delta.where(delta > 0, 0.0)
    loss = (-delta).where(delta < 0, 0.0)
    avg_gain = gain.ewm(alpha=1 / period, min_periods=period).mean()
    avg_loss = loss.ewm(alpha=1 / period, min_periods=period).mean()
    rs = avg_gain / avg_loss.replace(0, np.inf)
    rsi = 100 - (100 / (1 + rs))

    signal = pd.Series(0, index=df.index, dtype=int)
    position = 0
    for i in range(len(df)):
        if np.isnan(rsi.iloc[i]):
            signal.iloc[i] = position
            continue
        if rsi.iloc[i] < oversold:
            position = 1
        elif rsi.iloc[i] > overbought:
            position = 0
        signal.iloc[i] = position
    return signal


def _parabolic_sar_trend(df: pd.DataFrame, params: dict[str, Any]) -> pd.Series:
    """Parabolic SAR trend following: long when price > SAR."""
    sar_data = compute_parabolic_sar(
        [{"date": str(d.date()), "open": r["open"], "high": r["high"], "low": r["low"], "close": r["close"], "volume": r.get("volume", 0)}
         for d, r in df.iterrows()],
        params,
    )
    sar_series = pd.Series(
        [s["trend"] for s in sar_data],
        index=df.index[: len(sar_data)],
    )
    signal = (sar_series > 0).astype(int).reindex(df.index, fill_value=0)
    return signal


def _orb_breakout(df: pd.DataFrame, params: dict[str, Any]) -> pd.Series:
    """Opening Range Breakout: simplified daily version.
    Long when close breaks above N-day high, exit when breaks below N-day low."""
    lookback = int(params.get("lookback", 5))
    signal = pd.Series(0, index=df.index, dtype=int)
    position = 0
    for i in range(lookback, len(df)):
        window = df.iloc[i - lookback : i]
        range_high = window["high"].max()
        range_low = window["low"].min()
        if df["close"].iloc[i] > range_high:
            position = 1
        elif df["close"].iloc[i] < range_low:
            position = 0
        signal.iloc[i] = position
    return signal


STRATEGY_MAP: dict[str, Any] = {
    "buy_and_hold": _buy_and_hold,
    "ema_crossover": _ema_crossover,
    "rsi_mean_reversion": _rsi_mean_reversion,
    "parabolic_sar_trend": _parabolic_sar_trend,
    "orb_breakout": _orb_breakout,
}

AVAILABLE_STRATEGIES = sorted(STRATEGY_MAP.keys())


# ---------------------------------------------------------------------------
# Backtest runner
# ---------------------------------------------------------------------------


def run_backtest(
    strategy_type: str,
    data: list[dict[str, Any]],
    initial_cash: float = 10_000.0,
    fees_bps: float = 10.0,
    slippage_bps: float = 5.0,
    spread_bps: float = 2.0,
    params: dict[str, Any] | None = None,
    benchmark_data: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Run a deterministic backtest. Paper-only, no real execution."""
    if strategy_type not in STRATEGY_MAP:
        raise ValueError(f"Unknown strategy: {strategy_type}. Available: {AVAILABLE_STRATEGIES}")

    params = params or {}
    df = _to_df(data)

    if len(df) < 5:
        raise ValueError("Insufficient data for backtest (minimum 5 rows)")

    # Generate signals
    strategy_fn = STRATEGY_MAP[strategy_type]
    signals = strategy_fn(df, params)

    # Simulate portfolio
    fee_rate = fees_bps / 10_000
    slippage_rate = slippage_bps / 10_000
    spread_rate = spread_bps / 10_000
    total_cost_rate = fee_rate + slippage_rate + spread_rate

    cash = initial_cash
    position = 0.0
    equity_curve: list[float] = []
    returns: list[float] = []
    trades: list[dict[str, Any]] = []
    total_fees = 0.0
    total_slippage = 0.0
    dates: list[str] = []

    entry_price = 0.0
    entry_date = ""

    prev_signal = 0
    prev_equity = initial_cash

    for i in range(len(df)):
        price = float(df["close"].iloc[i])
        date_str = str(df.index[i].date())
        sig = int(signals.iloc[i]) if i < len(signals) else 0

        # Entry
        if sig == 1 and prev_signal == 0 and cash > 0:
            cost = cash * total_cost_rate
            invest = cash - cost
            position = invest / price
            entry_price = price
            entry_date = date_str
            total_fees += cash * fee_rate
            total_slippage += cash * slippage_rate
            cash = 0.0

        # Exit
        elif sig == 0 and prev_signal == 1 and position > 0:
            proceeds = position * price
            cost = proceeds * total_cost_rate
            cash = proceeds - cost
            total_fees += proceeds * fee_rate
            total_slippage += proceeds * slippage_rate
            pnl = cash - (position * entry_price)
            pnl_pct = pnl / (position * entry_price) if position * entry_price > 0 else 0.0
            trades.append({
                "entry_date": entry_date,
                "exit_date": date_str,
                "side": "long",
                "entry_price": round(entry_price, 4),
                "exit_price": round(price, 4),
                "size": round(position, 6),
                "pnl": round(pnl, 2),
                "pnl_pct": round(pnl_pct, 6),
                "fees": round(cost, 2),
            })
            position = 0.0

        equity = cash + position * price
        daily_return = (equity - prev_equity) / prev_equity if prev_equity > 0 else 0.0
        returns.append(daily_return)
        equity_curve.append(round(equity, 2))
        dates.append(date_str)
        prev_equity = equity
        prev_signal = sig

    # Close any open position at end
    if position > 0:
        price = float(df["close"].iloc[-1])
        proceeds = position * price
        cost = proceeds * total_cost_rate
        cash = proceeds - cost
        total_fees += proceeds * fee_rate
        total_slippage += proceeds * slippage_rate
        pnl = cash - (position * entry_price)
        pnl_pct = pnl / (position * entry_price) if position * entry_price > 0 else 0.0
        trades.append({
            "entry_date": entry_date,
            "exit_date": dates[-1] if dates else "",
            "side": "long",
            "entry_price": round(entry_price, 4),
            "exit_price": round(price, 4),
            "size": round(position, 6),
            "pnl": round(pnl, 2),
            "pnl_pct": round(pnl_pct, 6),
            "fees": round(cost, 2),
        })
        equity_curve[-1] = round(cash, 2)

    # Benchmark
    benchmark_returns: list[float] | None = None
    if benchmark_data:
        bm_df = _to_df(benchmark_data)
        benchmark_returns = bm_df["close"].pct_change().dropna().tolist()

    # Metrics
    trade_pnls = [t["pnl"] for t in trades]
    metrics = compute_all_metrics(
        equity_curve=equity_curve,
        returns=returns[1:] if returns else [],
        trade_pnls=trade_pnls,
        total_fees=total_fees,
        total_slippage=total_slippage,
        benchmark_returns=benchmark_returns,
    )

    # Drawdowns
    drawdowns = compute_drawdowns(equity_curve, dates)

    return {
        "ok": True,
        "strategy_type": strategy_type,
        "symbol": None,
        "start_date": dates[0] if dates else None,
        "end_date": dates[-1] if dates else None,
        "metrics": metrics,
        "equity_curve": [{"date": d, "equity": e} for d, e in zip(dates, equity_curve)],
        "trades": trades,
        "drawdowns": drawdowns,
        "params_hash": _hash_params({"strategy_type": strategy_type, **params}),
        "data_hash": _hash_data(data),
        "caveats": [
            "This is a simulation. Past performance does not predict future results.",
            "Backtest results include survivorship bias and do not account for real market impact.",
            "Transaction costs are approximated. Real costs may differ.",
            "Paper-trading only. No real capital at risk.",
        ],
    }
