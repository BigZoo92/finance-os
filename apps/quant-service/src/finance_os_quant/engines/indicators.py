"""Technical indicator computations.

Pure NumPy/pandas implementations. vectorbt used when available for speed,
fallback to internal implementations otherwise.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd


def _to_series(data: list[dict[str, Any]], col: str = "close") -> pd.Series:
    df = pd.DataFrame(data)
    if "date" in df.columns:
        df["date"] = pd.to_datetime(df["date"])
        df = df.set_index("date").sort_index()
    return df[col].astype(float)


def _to_ohlcv(data: list[dict[str, Any]]) -> pd.DataFrame:
    df = pd.DataFrame(data)
    if "date" in df.columns:
        df["date"] = pd.to_datetime(df["date"])
        df = df.set_index("date").sort_index()
    for c in ("open", "high", "low", "close", "volume"):
        if c in df.columns:
            df[c] = df[c].astype(float)
    return df


# ---------------------------------------------------------------------------
# EMA
# ---------------------------------------------------------------------------

def compute_ema(data: list[dict[str, Any]], params: dict[str, Any]) -> list[dict[str, Any]]:
    period = int(params.get("period", 20))
    close = _to_series(data)
    ema = close.ewm(span=period, adjust=False).mean()
    return [{"date": str(d.date()), "ema": round(v, 4)} for d, v in ema.items() if not np.isnan(v)]


# ---------------------------------------------------------------------------
# SMA
# ---------------------------------------------------------------------------

def compute_sma(data: list[dict[str, Any]], params: dict[str, Any]) -> list[dict[str, Any]]:
    period = int(params.get("period", 20))
    close = _to_series(data)
    sma = close.rolling(window=period).mean()
    return [{"date": str(d.date()), "sma": round(v, 4)} for d, v in sma.items() if not np.isnan(v)]


# ---------------------------------------------------------------------------
# RSI
# ---------------------------------------------------------------------------

def compute_rsi(data: list[dict[str, Any]], params: dict[str, Any]) -> list[dict[str, Any]]:
    period = int(params.get("period", 14))
    close = _to_series(data)
    delta = close.diff()
    gain = delta.where(delta > 0, 0.0)
    loss = (-delta).where(delta < 0, 0.0)
    avg_gain = gain.ewm(alpha=1 / period, min_periods=period).mean()
    avg_loss = loss.ewm(alpha=1 / period, min_periods=period).mean()
    rs = avg_gain / avg_loss.replace(0, np.inf)
    rsi = 100 - (100 / (1 + rs))
    return [{"date": str(d.date()), "rsi": round(v, 2)} for d, v in rsi.items() if not np.isnan(v)]


# ---------------------------------------------------------------------------
# MACD
# ---------------------------------------------------------------------------

def compute_macd(data: list[dict[str, Any]], params: dict[str, Any]) -> list[dict[str, Any]]:
    fast = int(params.get("fast", 12))
    slow = int(params.get("slow", 26))
    signal_period = int(params.get("signal", 9))
    close = _to_series(data)
    ema_fast = close.ewm(span=fast, adjust=False).mean()
    ema_slow = close.ewm(span=slow, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal_period, adjust=False).mean()
    histogram = macd_line - signal_line
    result = []
    for d in macd_line.index:
        if np.isnan(macd_line[d]):
            continue
        result.append({
            "date": str(d.date()),
            "macd": round(float(macd_line[d]), 4),
            "signal": round(float(signal_line[d]), 4),
            "histogram": round(float(histogram[d]), 4),
        })
    return result


# ---------------------------------------------------------------------------
# Parabolic SAR
# ---------------------------------------------------------------------------

def compute_parabolic_sar(data: list[dict[str, Any]], params: dict[str, Any]) -> list[dict[str, Any]]:
    af_start = float(params.get("af_start", 0.02))
    af_step = float(params.get("af_step", 0.02))
    af_max = float(params.get("af_max", 0.2))
    df = _to_ohlcv(data)
    high = df["high"].values
    low = df["low"].values
    n = len(high)
    if n < 2:
        return []

    sar = np.zeros(n)
    trend = np.ones(n, dtype=int)
    af = af_start
    ep = high[0]
    sar[0] = low[0]

    for i in range(1, n):
        sar[i] = sar[i - 1] + af * (ep - sar[i - 1])
        if trend[i - 1] == 1:
            sar[i] = min(sar[i], low[i - 1])
            if i >= 2:
                sar[i] = min(sar[i], low[i - 2])
            if low[i] < sar[i]:
                trend[i] = -1
                sar[i] = ep
                ep = low[i]
                af = af_start
            else:
                trend[i] = 1
                if high[i] > ep:
                    ep = high[i]
                    af = min(af + af_step, af_max)
        else:
            sar[i] = max(sar[i], high[i - 1])
            if i >= 2:
                sar[i] = max(sar[i], high[i - 2])
            if high[i] > sar[i]:
                trend[i] = 1
                sar[i] = ep
                ep = high[i]
                af = af_start
            else:
                trend[i] = -1
                if low[i] < ep:
                    ep = low[i]
                    af = min(af + af_step, af_max)

    dates = df.index
    return [
        {"date": str(dates[i].date()), "sar": round(float(sar[i]), 4), "trend": int(trend[i])}
        for i in range(n)
    ]


# ---------------------------------------------------------------------------
# ATR (Average True Range)
# ---------------------------------------------------------------------------

def compute_atr(data: list[dict[str, Any]], params: dict[str, Any]) -> list[dict[str, Any]]:
    period = int(params.get("period", 14))
    df = _to_ohlcv(data)
    high, low, close = df["high"], df["low"], df["close"]
    prev_close = close.shift(1)
    tr = pd.concat([high - low, (high - prev_close).abs(), (low - prev_close).abs()], axis=1).max(axis=1)
    atr = tr.ewm(alpha=1 / period, min_periods=period).mean()
    return [{"date": str(d.date()), "atr": round(v, 4)} for d, v in atr.items() if not np.isnan(v)]


# ---------------------------------------------------------------------------
# Bollinger Bands
# ---------------------------------------------------------------------------

def compute_bollinger_bands(data: list[dict[str, Any]], params: dict[str, Any]) -> list[dict[str, Any]]:
    period = int(params.get("period", 20))
    num_std = float(params.get("num_std", 2.0))
    close = _to_series(data)
    sma = close.rolling(window=period).mean()
    std = close.rolling(window=period).std()
    upper = sma + num_std * std
    lower = sma - num_std * std
    result = []
    for d in sma.index:
        if np.isnan(sma[d]):
            continue
        result.append({
            "date": str(d.date()),
            "middle": round(float(sma[d]), 4),
            "upper": round(float(upper[d]), 4),
            "lower": round(float(lower[d]), 4),
        })
    return result


# ---------------------------------------------------------------------------
# Support / Resistance (simple pivot-based)
# ---------------------------------------------------------------------------

def compute_support_resistance(
    data: list[dict[str, Any]], params: dict[str, Any]
) -> list[dict[str, Any]]:
    lookback = int(params.get("lookback", 20))
    df = _to_ohlcv(data)
    high, low = df["high"], df["low"]
    supports: list[dict[str, Any]] = []
    resistances: list[dict[str, Any]] = []

    for i in range(lookback, len(df) - lookback):
        window_high = high.iloc[i - lookback : i + lookback + 1]
        window_low = low.iloc[i - lookback : i + lookback + 1]
        if high.iloc[i] == window_high.max():
            resistances.append({"date": str(df.index[i].date()), "level": round(float(high.iloc[i]), 4)})
        if low.iloc[i] == window_low.min():
            supports.append({"date": str(df.index[i].date()), "level": round(float(low.iloc[i]), 4)})

    return [{"supports": supports[-10:], "resistances": resistances[-10:]}]


# ---------------------------------------------------------------------------
# Dispatcher
# ---------------------------------------------------------------------------

INDICATOR_MAP = {
    "ema": compute_ema,
    "sma": compute_sma,
    "rsi": compute_rsi,
    "macd": compute_macd,
    "parabolic_sar": compute_parabolic_sar,
    "atr": compute_atr,
    "bollinger_bands": compute_bollinger_bands,
    "support_resistance": compute_support_resistance,
}

AVAILABLE_INDICATORS = sorted(INDICATOR_MAP.keys())


def compute_indicator(indicator: str, data: list[dict[str, Any]], params: dict[str, Any]) -> list[dict[str, Any]]:
    fn = INDICATOR_MAP.get(indicator)
    if fn is None:
        raise ValueError(f"Unknown indicator: {indicator}. Available: {AVAILABLE_INDICATORS}")
    return fn(data, params)
