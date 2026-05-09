"""PR10 — Deterministic technical pattern detection.

Research / paper-only. NEVER an execution layer.

Hard guarantees:
* No LLM call, no provider call, no graph ingest, no DB write.
* Pure NumPy/pandas math; same input ⇒ same output (IDs are SHA-1 over the
  request shape so re-runs are stable).
* Conservative confidence — `high` only when multiple agreeing signals are
  present AND the data window is long enough.
* Every detection carries `limitations` and `invalidationHints` so the caller
  cannot mistake a pattern observation for a directive. The output banlist
  rejects any wording that hints at execution before returning.
* Volume Profile is skipped silently (with a warning) when volume is missing
  or zero — never reconstructed from price-only data.
"""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, field
from typing import Any, Iterable, Literal

import numpy as np
import pandas as pd

# --- Pattern keys & banlist ------------------------------------------------

PatternKey = Literal[
    "ema20_horizontal_level",
    "ema200_one_touch",
    "parabolic_sar_rci",
    "volume_profile_zones",
    # PR15B — SMC/ICT deterministic detector pack. Research/paper-only. Inspired by
    # smart-money-concepts (MIT) but RE-IMPLEMENTED here under our license; no source
    # vendored, no dependency added.
    "fair_value_gap",
    "liquidity_sweep",
    "break_of_structure",
    "change_of_character",
    "order_block_candidate",
]

ALL_PATTERN_KEYS: tuple[PatternKey, ...] = (
    "ema20_horizontal_level",
    "ema200_one_touch",
    "parabolic_sar_rci",
    "volume_profile_zones",
    "fair_value_gap",
    "liquidity_sweep",
    "break_of_structure",
    "change_of_character",
    "order_block_candidate",
)

# Wording the detector is FORBIDDEN to emit. PR4's post-mortem scanner uses a
# similar list; we re-implement locally so quant-service has zero advisor-side
# coupling.
EXECUTION_BANLIST: tuple[str, ...] = (
    "buy",
    "sell",
    "long",
    "short",
    "open position",
    "close position",
    "place order",
    "execute",
    "execution",
    "trade now",
    "enter trade",
    "exit trade",
    "stop loss",
    "take profit",
    "leverage",
    "margin",
    "futures",
    "swap",
)

DEFAULT_HORIZONTAL_TOL_PCT = 0.5  # ±0.5% around the candidate level
DEFAULT_EMA_TOUCH_TOL_PCT = 0.6  # ±0.6% around the EMA value for "touch"
DEFAULT_MIN_CANDLES = 60
DEFAULT_VOLUME_PROFILE_BINS = 24


# --- Data quality / model ---------------------------------------------------


@dataclass
class DataQuality:
    candle_count: int
    has_volume: bool
    sufficient: bool
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "candleCount": self.candle_count,
            "hasVolume": self.has_volume,
            "sufficient": self.sufficient,
            "warnings": self.warnings,
        }


@dataclass
class Detection:
    pattern_type: PatternKey
    direction: Literal["bullish", "bearish", "neutral", "unknown"]
    confidence: Literal["low", "medium", "high"]
    observed_at: str
    evidence: list[str]
    invalidation_hints: list[str]
    metrics: dict[str, Any]
    limitations: list[str]

    def to_dict(self, request_fingerprint: str) -> dict[str, Any]:
        # Stable id derived from request fingerprint + the data observed; same
        # candles + same pattern + same observed timestamp ⇒ same id.
        seed = f"{request_fingerprint}|{self.pattern_type}|{self.observed_at}"
        det_id = "det_" + hashlib.sha1(seed.encode("utf-8")).hexdigest()[:12]
        return {
            "id": det_id,
            "patternType": self.pattern_type,
            "direction": self.direction,
            "confidence": self.confidence,
            "observedAt": self.observed_at,
            "evidence": self.evidence,
            "invalidationHints": self.invalidation_hints,
            "metrics": self.metrics,
            "limitations": self.limitations,
        }


# --- Helpers ---------------------------------------------------------------


def _to_dataframe(candles: list[dict[str, Any]]) -> pd.DataFrame:
    df = pd.DataFrame(candles)
    if "timestamp" in df.columns:
        df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True, errors="coerce")
        df = df.dropna(subset=["timestamp"]).set_index("timestamp").sort_index()
    for col in ("open", "high", "low", "close"):
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    if "volume" in df.columns:
        df["volume"] = pd.to_numeric(df["volume"], errors="coerce")
    df = df.dropna(subset=["open", "high", "low", "close"])
    return df


def _has_meaningful_volume(df: pd.DataFrame) -> bool:
    if "volume" not in df.columns:
        return False
    series = df["volume"].dropna()
    if len(series) == 0:
        return False
    return bool((series > 0).any())


def _ema(series: pd.Series, period: int) -> pd.Series:
    return series.ewm(span=period, adjust=False).mean()


def _rci(close: pd.Series, period: int = 14) -> pd.Series:
    """Rank Correlation Index. Spearman rank correlation between time index
    and price ranks over a rolling window; returned in [-100, +100]."""

    def _window(values: np.ndarray) -> float:
        if len(values) < 2 or np.std(values) == 0:
            return 0.0
        time_ranks = np.arange(1, len(values) + 1, dtype=float)
        price_ranks = pd.Series(values).rank().to_numpy()
        d = time_ranks - price_ranks
        n = len(values)
        denom = n * (n * n - 1)
        if denom == 0:
            return 0.0
        return float((1 - 6 * np.sum(d * d) / denom) * 100)

    return close.rolling(window=period, min_periods=period).apply(_window, raw=True)


def _parabolic_sar(df: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
    """Reuses the existing indicator's algorithm but returns numpy arrays
    aligned to df's index. Kept self-contained so the patterns module has no
    runtime coupling to indicators.compute_indicator."""

    high = df["high"].to_numpy(dtype=float)
    low = df["low"].to_numpy(dtype=float)
    n = len(high)
    if n < 2:
        return np.array([]), np.array([])
    af_start, af_step, af_max = 0.02, 0.02, 0.2
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
    return sar, trend


_BANLIST_PATTERNS: tuple[tuple[str, "re.Pattern[str]"], ...] = tuple(
    # Single-word terms use word-boundary matching so innocent words like
    # "shortcut", "longitude", "buyer" don't trigger; multi-word phrases
    # match as plain substrings (case-insensitive).
    (
        term,
        re.compile(rf"\b{re.escape(term)}\b", re.IGNORECASE)
        if " " not in term
        else re.compile(re.escape(term), re.IGNORECASE),
    )
    for term in EXECUTION_BANLIST
)


def _scan_text_banlist(texts: Iterable[str]) -> list[str]:
    found: list[str] = []
    for text in texts:
        for term, pattern in _BANLIST_PATTERNS:
            if pattern.search(text):
                found.append(term)
    return found


def _stable_request_fingerprint(payload: dict[str, Any]) -> str:
    blob = json.dumps(payload, sort_keys=True, default=str).encode("utf-8")
    return hashlib.sha1(blob).hexdigest()[:16]


# --- Pattern detectors ------------------------------------------------------


def _detect_ema20_horizontal_level(
    df: pd.DataFrame, *, horizontal_tol_pct: float, ema_touch_tol_pct: float
) -> list[Detection]:
    if len(df) < 30:
        return []
    close = df["close"]
    ema20 = _ema(close, 20)
    last_idx = df.index[-1]
    last_close = float(close.iloc[-1])
    last_ema = float(ema20.iloc[-1]) if not np.isnan(ema20.iloc[-1]) else float("nan")

    if np.isnan(last_ema):
        return []

    # Horizontal level candidates: rolling 20-bar pivot highs / lows that have
    # been retested at least twice. We pick the most-retested level closest to
    # the current price.
    lookback = 20
    pivots: list[float] = []
    for i in range(lookback, len(df) - lookback):
        window_high = df["high"].iloc[i - lookback : i + lookback + 1]
        window_low = df["low"].iloc[i - lookback : i + lookback + 1]
        if df["high"].iloc[i] == window_high.max():
            pivots.append(float(df["high"].iloc[i]))
        if df["low"].iloc[i] == window_low.min():
            pivots.append(float(df["low"].iloc[i]))
    if not pivots:
        return []

    # Group pivots within ±tolerance% of each other; pick the cluster with the
    # most retests, breaking ties by proximity to current price.
    tol = horizontal_tol_pct / 100.0
    clusters: list[tuple[float, int]] = []  # (level, retest_count)
    for px in sorted(pivots):
        if clusters and abs(px - clusters[-1][0]) / max(clusters[-1][0], 1e-9) <= tol:
            level, count = clusters[-1]
            clusters[-1] = ((level * count + px) / (count + 1), count + 1)
        else:
            clusters.append((px, 1))
    clusters.sort(
        key=lambda c: (c[1], -abs(c[0] - last_close)),
        reverse=True,
    )
    best_level, retest_count = clusters[0]
    if retest_count < 2:
        return []

    # Confluence test: is the EMA20 currently within tolerance of the level
    # AND is price within tolerance of the EMA20?
    ema_to_level_pct = abs(last_ema - best_level) / max(best_level, 1e-9)
    price_to_ema_pct = abs(last_close - last_ema) / max(last_ema, 1e-9)
    if ema_to_level_pct > tol * 4:
        return []
    if price_to_ema_pct > ema_touch_tol_pct / 100.0:
        return []

    direction: Literal["bullish", "bearish", "neutral", "unknown"]
    if last_close > last_ema and last_close > best_level:
        direction = "bullish"
    elif last_close < last_ema and last_close < best_level:
        direction = "bearish"
    else:
        direction = "neutral"

    confidence: Literal["low", "medium", "high"] = "low"
    if retest_count >= 4 and direction != "neutral" and len(df) >= 120:
        confidence = "medium"
    if retest_count >= 6 and direction != "neutral" and len(df) >= 200:
        confidence = "high"

    evidence = [
        f"EMA20 confluence with retested horizontal level at {best_level:.4f} (≥{retest_count} retests).",
        f"EMA20 currently {last_ema:.4f}; deviation from level {ema_to_level_pct * 100:.2f}%.",
        f"Latest close {last_close:.4f} sits {price_to_ema_pct * 100:.2f}% from EMA20.",
    ]
    invalidation = [
        "Sustained close beyond the level by more than the tolerance band invalidates the confluence.",
        "EMA20 separating from the level (drift > 4× tolerance) invalidates the pattern.",
        "Retest count drops if older pivots roll out of the lookback window.",
    ]
    limitations = [
        "Horizontal level is heuristic, derived from rolling 20-bar pivots only.",
        "Pattern is observational; it does NOT predict price direction.",
        "Confidence assumes sufficient pivot history; limited candles skew detection.",
    ]
    metrics = {
        "level": round(best_level, 4),
        "ema20": round(last_ema, 4),
        "retestCount": retest_count,
        "emaToLevelPct": round(ema_to_level_pct * 100, 4),
        "priceToEmaPct": round(price_to_ema_pct * 100, 4),
        "candlesUsed": len(df),
    }
    return [
        Detection(
            pattern_type="ema20_horizontal_level",
            direction=direction,
            confidence=confidence,
            observed_at=last_idx.isoformat(),
            evidence=evidence,
            invalidation_hints=invalidation,
            metrics=metrics,
            limitations=limitations,
        )
    ]


def _detect_ema200_one_touch(
    df: pd.DataFrame, *, ema_touch_tol_pct: float
) -> list[Detection]:
    if len(df) < 220:
        return []
    close = df["close"]
    ema200 = _ema(close, 200)
    valid = ema200.dropna()
    if valid.empty:
        return []
    tol = ema_touch_tol_pct / 100.0

    # Walk forward; flag the FIRST candle whose low..high range crosses the
    # EMA200 within tolerance after the price was extended (≥2*tolerance away)
    # for at least the previous 30 candles.
    lows = df["low"].to_numpy(dtype=float)
    highs = df["high"].to_numpy(dtype=float)
    ema_arr = ema200.to_numpy(dtype=float)
    extension_threshold = tol * 2

    last_touch_index = -1
    extended_streak = 0
    for i in range(len(df)):
        if np.isnan(ema_arr[i]):
            continue
        # Tracks consecutive candles where price stayed extended from EMA200.
        prev_close = float(close.iloc[i - 1]) if i > 0 else float("nan")
        prev_ema = float(ema_arr[i - 1]) if i > 0 else float("nan")
        if not np.isnan(prev_close) and not np.isnan(prev_ema):
            distance = abs(prev_close - prev_ema) / max(prev_ema, 1e-9)
            if distance >= extension_threshold:
                extended_streak += 1
            else:
                extended_streak = 0
        if extended_streak < 30:
            continue
        # A "touch" is when the candle range crosses EMA200 within tolerance.
        within = (lows[i] <= ema_arr[i] * (1 + tol)) and (highs[i] >= ema_arr[i] * (1 - tol))
        if within:
            last_touch_index = i
            break
    if last_touch_index < 0:
        return []

    last_close = float(close.iloc[last_touch_index])
    last_ema = float(ema_arr[last_touch_index])
    direction: Literal["bullish", "bearish", "neutral", "unknown"]
    if last_close > last_ema:
        direction = "bullish"
    elif last_close < last_ema:
        direction = "bearish"
    else:
        direction = "neutral"

    # One-touch is rare ⇒ medium confidence at best. Long extension streaks
    # nudge toward medium; otherwise stay low. We never go to high.
    confidence: Literal["low", "medium", "high"] = "low"
    if extended_streak >= 60 and len(df) >= 400:
        confidence = "medium"

    evidence = [
        f"EMA200 first-touch detected after {extended_streak}-bar extension streak.",
        f"Touch candle close {last_close:.4f} vs EMA200 {last_ema:.4f}.",
    ]
    invalidation = [
        "A second touch within the next 5 candles invalidates the 'one-touch' framing.",
        "Continued extension (close moves further from EMA200) invalidates the mean-reversion read.",
        "Regime shifts (e.g. trend change) override the historical one-touch interpretation.",
    ]
    limitations = [
        "Pattern is observational; it does NOT imply reversal or trend continuation.",
        "Market regime (trend / range / breakout) materially changes the prior probability of mean-reversion at EMA200.",
        "Historical one-touch frequency is symbol-specific — sample is too small to generalise.",
    ]
    metrics = {
        "ema200": round(last_ema, 4),
        "closeAtTouch": round(last_close, 4),
        "extensionBars": extended_streak,
        "candlesUsed": len(df),
    }
    return [
        Detection(
            pattern_type="ema200_one_touch",
            direction=direction,
            confidence=confidence,
            observed_at=df.index[last_touch_index].isoformat(),
            evidence=evidence,
            invalidation_hints=invalidation,
            metrics=metrics,
            limitations=limitations,
        )
    ]


def _detect_parabolic_sar_rci(df: pd.DataFrame) -> list[Detection]:
    if len(df) < 40:
        return []
    sar, trend = _parabolic_sar(df)
    if len(sar) == 0:
        return []
    rci = _rci(df["close"], period=14)
    last_idx = df.index[-1]
    last_trend = int(trend[-1])
    last_rci = float(rci.iloc[-1]) if not np.isnan(rci.iloc[-1]) else float("nan")
    if np.isnan(last_rci):
        return []

    # Alignment: SAR up-trend AND RCI > +50 (or both inverted).
    # Divergence: SAR up-trend but RCI < -50 (or inverse).
    direction: Literal["bullish", "bearish", "neutral", "unknown"]
    aligned = False
    diverged = False
    if last_trend == 1 and last_rci > 50:
        direction = "bullish"
        aligned = True
    elif last_trend == -1 and last_rci < -50:
        direction = "bearish"
        aligned = True
    elif last_trend == 1 and last_rci < -50:
        direction = "neutral"
        diverged = True
    elif last_trend == -1 and last_rci > 50:
        direction = "neutral"
        diverged = True
    else:
        direction = "neutral"

    confidence: Literal["low", "medium", "high"] = "low"
    if aligned and len(df) >= 120:
        confidence = "medium"
    # We never assign 'high' to SAR+RCI on its own — both inputs are momentum
    # readings and can flip together on noise.

    evidence = []
    if aligned:
        evidence.append(
            f"Parabolic SAR trend aligned with RCI(14): SAR trend {last_trend}, RCI {last_rci:.1f}."
        )
    elif diverged:
        evidence.append(
            f"Parabolic SAR / RCI divergence: SAR trend {last_trend}, RCI {last_rci:.1f}."
        )
    else:
        evidence.append(
            f"Parabolic SAR trend {last_trend} with mid-range RCI {last_rci:.1f} (no clear regime signal)."
        )

    invalidation = [
        "A SAR flip on the next candle invalidates the alignment read.",
        "RCI crossing back through 0 within 3 candles invalidates the momentum read.",
        "Sudden volatility expansion (range > 2× rolling ATR) invalidates the regime assumption.",
    ]
    limitations = [
        "SAR is reactive — it does NOT lead price.",
        "RCI is rank-based — it can saturate at ±100 for low-noise series.",
        "Pattern reads regime, not trade outcome. No directional certainty implied.",
    ]
    metrics = {
        "sarTrend": last_trend,
        "rci14": round(last_rci, 2),
        "aligned": aligned,
        "diverged": diverged,
        "candlesUsed": len(df),
    }
    return [
        Detection(
            pattern_type="parabolic_sar_rci",
            direction=direction,
            confidence=confidence,
            observed_at=last_idx.isoformat(),
            evidence=evidence,
            invalidation_hints=invalidation,
            metrics=metrics,
            limitations=limitations,
        )
    ]


def _detect_volume_profile_zones(
    df: pd.DataFrame, *, bins: int
) -> list[Detection]:
    if "volume" not in df.columns or len(df) < 30:
        return []
    if not _has_meaningful_volume(df):
        return []

    typical = (df["high"] + df["low"] + df["close"]) / 3.0
    volume = df["volume"].fillna(0.0)
    if volume.sum() <= 0:
        return []

    px_min = float(typical.min())
    px_max = float(typical.max())
    if px_max <= px_min:
        return []

    edges = np.linspace(px_min, px_max, bins + 1)
    bin_volumes = np.zeros(bins)
    bin_index = np.clip(
        np.searchsorted(edges, typical.to_numpy(), side="right") - 1, 0, bins - 1
    )
    for idx, vol in zip(bin_index, volume.to_numpy()):
        bin_volumes[idx] += vol
    if bin_volumes.sum() <= 0:
        return []

    poc_bin = int(np.argmax(bin_volumes))
    poc_price = float((edges[poc_bin] + edges[poc_bin + 1]) / 2.0)

    # Value area: the contiguous band around POC that contains 70% of total
    # volume. We expand symmetrically by adding the largest neighbour.
    target = bin_volumes.sum() * 0.7
    accumulated = bin_volumes[poc_bin]
    lower, upper = poc_bin, poc_bin
    while accumulated < target and (lower > 0 or upper < bins - 1):
        left_val = bin_volumes[lower - 1] if lower > 0 else -1
        right_val = bin_volumes[upper + 1] if upper < bins - 1 else -1
        if right_val >= left_val and upper < bins - 1:
            upper += 1
            accumulated += bin_volumes[upper]
        elif lower > 0:
            lower -= 1
            accumulated += bin_volumes[lower]
        else:
            break
    val_price = float(edges[lower])
    vah_price = float(edges[upper + 1])

    last_close = float(df["close"].iloc[-1])
    if last_close > vah_price:
        direction: Literal["bullish", "bearish", "neutral", "unknown"] = "bullish"
    elif last_close < val_price:
        direction = "bearish"
    else:
        direction = "neutral"

    confidence: Literal["low", "medium", "high"] = "low"
    if len(df) >= 200 and direction != "neutral":
        confidence = "medium"

    evidence = [
        f"Volume Profile over {len(df)} candles ({bins} bins).",
        f"POC {poc_price:.4f}, VAL {val_price:.4f}, VAH {vah_price:.4f}.",
        f"Latest close {last_close:.4f} sits {'above VAH' if direction == 'bullish' else 'below VAL' if direction == 'bearish' else 'inside the value area'}.",
    ]
    invalidation = [
        "Close re-entering the value area (between VAL and VAH) invalidates a breakout / breakdown read.",
        "POC migration (recomputed POC moves > 1% in either direction) invalidates the structural read.",
        "Insufficient volume in newer candles (e.g. holiday session) skews the profile.",
    ]
    limitations = [
        "Volume Profile is approximate — typical price + linear binning, not tick-level.",
        "Pattern is observational; it does NOT predict price direction.",
        "Quality depends on volume integrity; reported / aggregated volume can distort POC location.",
    ]
    metrics = {
        "poc": round(poc_price, 4),
        "valueAreaLow": round(val_price, 4),
        "valueAreaHigh": round(vah_price, 4),
        "binCount": bins,
        "candlesUsed": len(df),
        "lastClose": round(last_close, 4),
    }
    return [
        Detection(
            pattern_type="volume_profile_zones",
            direction=direction,
            confidence=confidence,
            observed_at=df.index[-1].isoformat(),
            evidence=evidence,
            invalidation_hints=invalidation,
            metrics=metrics,
            limitations=limitations,
        )
    ]


# --- PR15B — SMC/ICT deterministic detector pack ---------------------------
# Research/paper-only. Conservative confidence caps. Heuristic by nature — every detection
# carries explicit limitations + invalidation hints. Inspired by smart-money-concepts (MIT)
# but RE-IMPLEMENTED here under our license; no source vendored, no dependency added.

SMC_MIN_CANDLES = 60
SMC_PIVOT_K = 3  # window radius for swing-pivot detection
SMC_DISPLACEMENT_ATR_MULT = 1.0  # body must exceed 1× rolling ATR(14) to count as displacement
SMC_FVG_MAX_DETECTIONS = 3  # bound payload size
SMC_OB_MAX_DETECTIONS = 2

SMC_LIMITATIONS_COMMON: tuple[str, ...] = (
    "Detection is heuristic; SMC/ICT concepts are interpretive and subjective.",
    "False positives are expected on noisy or low-volume series.",
    "Pattern is a research observation; backtest + scorecard required before any conclusion.",
    "Pattern is observational; it does NOT predict price direction.",
)


def _atr14(df: pd.DataFrame) -> pd.Series:
    high = df["high"]
    low = df["low"]
    close = df["close"]
    prev_close = close.shift(1)
    tr = pd.concat(
        [high - low, (high - prev_close).abs(), (low - prev_close).abs()], axis=1
    ).max(axis=1)
    return tr.ewm(alpha=1 / 14, min_periods=14).mean()


def _find_swing_indices(df: pd.DataFrame, k: int = SMC_PIVOT_K) -> tuple[list[int], list[int]]:
    """Return (swing_high_indices, swing_low_indices). A pivot at index i requires
    high[i] to be the strict max (or low[i] the strict min) of high[i-k..i+k]."""

    highs = df["high"].to_numpy(dtype=float)
    lows = df["low"].to_numpy(dtype=float)
    n = len(highs)
    swing_highs: list[int] = []
    swing_lows: list[int] = []
    for i in range(k, n - k):
        window_high = highs[i - k : i + k + 1]
        window_low = lows[i - k : i + k + 1]
        if highs[i] == window_high.max() and (window_high == highs[i]).sum() == 1:
            swing_highs.append(i)
        if lows[i] == window_low.min() and (window_low == lows[i]).sum() == 1:
            swing_lows.append(i)
    return swing_highs, swing_lows


def _is_displacement(row: pd.Series, atr_at_idx: float) -> tuple[bool, str]:
    """Return (is_displacement, direction) where direction ∈ {bullish, bearish, neutral}."""
    if not np.isfinite(atr_at_idx) or atr_at_idx <= 0:
        return False, "neutral"
    body = float(row["close"]) - float(row["open"])
    if abs(body) < SMC_DISPLACEMENT_ATR_MULT * atr_at_idx:
        return False, "neutral"
    return (True, "bullish") if body > 0 else (True, "bearish")


def _detect_fair_value_gap(df: pd.DataFrame) -> list[Detection]:
    if len(df) < SMC_MIN_CANDLES:
        return []
    atr = _atr14(df)
    n = len(df)
    detections: list[Detection] = []

    for i in range(2, n - 1):
        # 3-candle window (i-1, i, i+1). Bullish FVG: low[i+1] > high[i-1].
        # Bearish FVG: high[i+1] < low[i-1]. The middle candle (i) must be a displacement.
        prev_high = float(df["high"].iloc[i - 1])
        prev_low = float(df["low"].iloc[i - 1])
        next_high = float(df["high"].iloc[i + 1])
        next_low = float(df["low"].iloc[i + 1])
        atr_i = float(atr.iloc[i]) if not np.isnan(atr.iloc[i]) else 0.0
        is_disp, direction = _is_displacement(df.iloc[i], atr_i)
        if not is_disp:
            continue

        if direction == "bullish" and next_low > prev_high:
            gap_low, gap_high = prev_high, next_low
        elif direction == "bearish" and next_high < prev_low:
            gap_low, gap_high = next_high, prev_low
        else:
            continue

        # Mitigation: any later candle whose [low, high] intersects [gap_low, gap_high].
        mitigated = False
        mitigation_index: int | None = None
        for j in range(i + 2, n):
            jh = float(df["high"].iloc[j])
            jl = float(df["low"].iloc[j])
            if jh >= gap_low and jl <= gap_high:
                mitigated = True
                mitigation_index = j
                break

        confidence: Literal["low", "medium", "high"] = "low"
        if not mitigated and atr_i > 0:
            confidence = "medium"

        observed_at = df.index[i].isoformat()
        detections.append(
            Detection(
                pattern_type="fair_value_gap",
                direction=direction,  # type: ignore[arg-type]
                confidence=confidence,
                observed_at=observed_at,
                evidence=[
                    f"3-candle FVG ({direction}) detected on a displacement candle.",
                    f"Gap range: [{gap_low:.4f}, {gap_high:.4f}].",
                    f"Mitigation: {'yes' if mitigated else 'no'}"
                    + (f" (later candle index {mitigation_index})." if mitigated else "."),
                ],
                invalidation_hints=[
                    "Gap mitigation by a subsequent candle invalidates the unmitigated FVG read.",
                    "A reversal in the displacement direction within a few candles weakens the FVG inference.",
                ],
                metrics={
                    "gapLow": round(gap_low, 4),
                    "gapHigh": round(gap_high, 4),
                    "displacementAtr": round(atr_i, 4),
                    "mitigated": mitigated,
                    "mitigationIndex": mitigation_index if mitigation_index is not None else -1,
                    "candlesUsed": n,
                },
                limitations=list(SMC_LIMITATIONS_COMMON),
            )
        )

    # Cap output to most recent N to bound payload.
    return detections[-SMC_FVG_MAX_DETECTIONS:]


def _detect_liquidity_sweep(df: pd.DataFrame) -> list[Detection]:
    if len(df) < SMC_MIN_CANDLES:
        return []
    swing_highs, swing_lows = _find_swing_indices(df)
    if not swing_highs and not swing_lows:
        return []
    n = len(df)
    detections: list[Detection] = []

    # Sweep low (bullish-side / sell-side sweep): wick below recent swing low, close back above.
    for swing_idx in swing_lows[-3:]:
        swing_low_value = float(df["low"].iloc[swing_idx])
        for i in range(swing_idx + 1, min(swing_idx + 30, n)):
            low_i = float(df["low"].iloc[i])
            close_i = float(df["close"].iloc[i])
            if low_i < swing_low_value and close_i >= swing_low_value:
                detections.append(
                    Detection(
                        pattern_type="liquidity_sweep",
                        direction="bullish",
                        confidence="low",
                        observed_at=df.index[i].isoformat(),
                        evidence=[
                            f"Wick swept below swing low {swing_low_value:.4f} and candle closed back above.",
                            f"Sweep candle close {close_i:.4f}, low {low_i:.4f}.",
                        ],
                        invalidation_hints=[
                            "Sustained close below the swept swing low invalidates the sweep read.",
                            "Repeated sweeps in the same direction reduce the inference value.",
                        ],
                        metrics={
                            "sweptSwingLow": round(swing_low_value, 4),
                            "sweepCandleLow": round(low_i, 4),
                            "sweepCandleClose": round(close_i, 4),
                            "side": "below_swing_low",
                            "candlesUsed": n,
                        },
                        limitations=list(SMC_LIMITATIONS_COMMON),
                    )
                )
                break  # one sweep per swing

    # Sweep high (bearish-side / buy-side): wick above recent swing high, close back below.
    for swing_idx in swing_highs[-3:]:
        swing_high_value = float(df["high"].iloc[swing_idx])
        for i in range(swing_idx + 1, min(swing_idx + 30, n)):
            high_i = float(df["high"].iloc[i])
            close_i = float(df["close"].iloc[i])
            if high_i > swing_high_value and close_i <= swing_high_value:
                detections.append(
                    Detection(
                        pattern_type="liquidity_sweep",
                        direction="bearish",
                        confidence="low",
                        observed_at=df.index[i].isoformat(),
                        evidence=[
                            f"Wick swept above swing high {swing_high_value:.4f} and candle closed back below.",
                            f"Sweep candle close {close_i:.4f}, high {high_i:.4f}.",
                        ],
                        invalidation_hints=[
                            "Sustained close above the swept swing high invalidates the sweep read.",
                            "Repeated sweeps in the same direction reduce the inference value.",
                        ],
                        metrics={
                            "sweptSwingHigh": round(swing_high_value, 4),
                            "sweepCandleHigh": round(high_i, 4),
                            "sweepCandleClose": round(close_i, 4),
                            "side": "above_swing_high",
                            "candlesUsed": n,
                        },
                        limitations=list(SMC_LIMITATIONS_COMMON),
                    )
                )
                break

    return detections[-3:]


def _structure_breaks(
    df: pd.DataFrame,
) -> list[tuple[int, Literal["bullish", "bearish"], int, float]]:
    """Returns a list of (candle_index, direction, swing_index, swing_value) for confirmed
    structure breaks. A bullish break = first close strictly above the most recent swing high
    after that swing was confirmed; bearish = first close strictly below most recent swing low.
    Each break is recorded once."""

    swing_highs, swing_lows = _find_swing_indices(df)
    closes = df["close"].to_numpy(dtype=float)
    n = len(closes)
    breaks: list[tuple[int, Literal["bullish", "bearish"], int, float]] = []
    sh_iter = iter(swing_highs)
    sl_iter = iter(swing_lows)
    sh_next = next(sh_iter, None)
    sl_next = next(sl_iter, None)
    pending_high: tuple[int, float] | None = None
    pending_low: tuple[int, float] | None = None
    consumed_high_indices: set[int] = set()
    consumed_low_indices: set[int] = set()

    for i in range(n):
        # Promote any pivots that have been confirmed (i > pivot_idx + SMC_PIVOT_K).
        while sh_next is not None and sh_next + SMC_PIVOT_K <= i:
            pending_high = (sh_next, float(df["high"].iloc[sh_next]))
            sh_next = next(sh_iter, None)
        while sl_next is not None and sl_next + SMC_PIVOT_K <= i:
            pending_low = (sl_next, float(df["low"].iloc[sl_next]))
            sl_next = next(sl_iter, None)

        if (
            pending_high is not None
            and pending_high[0] not in consumed_high_indices
            and closes[i] > pending_high[1]
        ):
            breaks.append((i, "bullish", pending_high[0], pending_high[1]))
            consumed_high_indices.add(pending_high[0])
        if (
            pending_low is not None
            and pending_low[0] not in consumed_low_indices
            and closes[i] < pending_low[1]
        ):
            breaks.append((i, "bearish", pending_low[0], pending_low[1]))
            consumed_low_indices.add(pending_low[0])

    return breaks


def _detect_break_of_structure(df: pd.DataFrame) -> list[Detection]:
    if len(df) < SMC_MIN_CANDLES:
        return []
    breaks = _structure_breaks(df)
    if not breaks:
        return []
    detections: list[Detection] = []
    for break_idx, direction, swing_idx, swing_value in breaks[-2:]:
        confidence: Literal["low", "medium", "high"] = (
            "medium" if (break_idx - swing_idx) >= 5 else "low"
        )
        observed_at = df.index[break_idx].isoformat()
        close_v = float(df["close"].iloc[break_idx])
        detections.append(
            Detection(
                pattern_type="break_of_structure",
                direction=direction,  # type: ignore[arg-type]
                confidence=confidence,
                observed_at=observed_at,
                evidence=[
                    f"Close {close_v:.4f} crossed prior {('swing high' if direction == 'bullish' else 'swing low')} {swing_value:.4f}.",
                    f"Bars between swing pivot and break: {break_idx - swing_idx}.",
                ],
                invalidation_hints=[
                    "Immediate retracement back through the broken level invalidates the structure read.",
                    "Lack of follow-through within a few candles weakens the inference.",
                ],
                metrics={
                    "swingValue": round(swing_value, 4),
                    "breakClose": round(close_v, 4),
                    "barsBetween": break_idx - swing_idx,
                    "candlesUsed": len(df),
                },
                limitations=list(SMC_LIMITATIONS_COMMON),
            )
        )
    return detections


def _detect_change_of_character(df: pd.DataFrame) -> list[Detection]:
    if len(df) < SMC_MIN_CANDLES:
        return []
    breaks = _structure_breaks(df)
    if len(breaks) < 2:
        return []
    detections: list[Detection] = []
    prior_dir: Literal["bullish", "bearish"] | None = None
    for break_idx, direction, swing_idx, swing_value in breaks:
        if prior_dir is not None and direction != prior_dir:
            observed_at = df.index[break_idx].isoformat()
            close_v = float(df["close"].iloc[break_idx])
            detections.append(
                Detection(
                    pattern_type="change_of_character",
                    direction=direction,  # type: ignore[arg-type]
                    confidence="low",
                    observed_at=observed_at,
                    evidence=[
                        f"First opposing structure break after {prior_dir} structure.",
                        f"Close {close_v:.4f} crossed prior {('swing high' if direction == 'bullish' else 'swing low')} {swing_value:.4f}.",
                    ],
                    invalidation_hints=[
                        "Quick reversion to the prior structure direction invalidates the CHOCH read.",
                        "Without a follow-through structure break, the regime change is not confirmed.",
                    ],
                    metrics={
                        "priorStructureDirection": prior_dir,
                        "swingValue": round(swing_value, 4),
                        "breakClose": round(close_v, 4),
                        "candlesUsed": len(df),
                    },
                    limitations=list(SMC_LIMITATIONS_COMMON),
                )
            )
        prior_dir = direction
    return detections[-2:]


def _detect_order_block_candidate(df: pd.DataFrame) -> list[Detection]:
    if len(df) < SMC_MIN_CANDLES:
        return []
    breaks = _structure_breaks(df)
    if not breaks:
        return []
    detections: list[Detection] = []
    for break_idx, direction, _swing_idx, _swing_value in breaks[-2:]:
        # Order block candidate = the last opposite-coloured candle right before the
        # displacement leg that triggered the break. We look back up to 10 candles.
        candidate_idx: int | None = None
        for j in range(break_idx - 1, max(break_idx - 10, -1), -1):
            o = float(df["open"].iloc[j])
            c = float(df["close"].iloc[j])
            if direction == "bullish" and c < o:
                candidate_idx = j
                break
            if direction == "bearish" and c > o:
                candidate_idx = j
                break
        if candidate_idx is None:
            continue
        ob_open = float(df["open"].iloc[candidate_idx])
        ob_close = float(df["close"].iloc[candidate_idx])
        ob_high = float(df["high"].iloc[candidate_idx])
        ob_low = float(df["low"].iloc[candidate_idx])
        detections.append(
            Detection(
                pattern_type="order_block_candidate",
                direction=direction,  # type: ignore[arg-type]
                confidence="low",
                observed_at=df.index[candidate_idx].isoformat(),
                evidence=[
                    f"Last opposite-coloured candle ({'down' if direction == 'bullish' else 'up'}) "
                    f"immediately preceding a {direction} structure break.",
                    f"Candidate range [{ob_low:.4f}, {ob_high:.4f}].",
                ],
                invalidation_hints=[
                    "An immediate revisit closing through the candidate range invalidates the candidate.",
                    "Order-block candidates require subsequent confirmation; otherwise treat as noise.",
                    "Without follow-through structure breaks, the candidate has limited value.",
                ],
                metrics={
                    "candidateOpen": round(ob_open, 4),
                    "candidateClose": round(ob_close, 4),
                    "candidateLow": round(ob_low, 4),
                    "candidateHigh": round(ob_high, 4),
                    "barsBeforeBreak": break_idx - candidate_idx,
                    "candlesUsed": len(df),
                },
                limitations=[
                    *SMC_LIMITATIONS_COMMON,
                    "Order block is a CANDIDATE only — requires confirmation and can be invalidated.",
                ],
            )
        )
    return detections[-SMC_OB_MAX_DETECTIONS:]


# --- Public entry point -----------------------------------------------------


def detect_patterns(
    *,
    candles: list[dict[str, Any]],
    timeframe: str,
    symbol: str | None,
    requested: list[PatternKey] | None,
    options: dict[str, Any] | None,
    generated_at: str,
) -> dict[str, Any]:
    """Orchestrates per-pattern detectors and packages the response.

    The return shape matches the PR10 spec exactly. The function never raises
    on insufficient data — it returns `dataQuality.sufficient = false` with a
    structured warning instead.
    """

    opts = options or {}
    horizontal_tol_pct = float(opts.get("horizontalLevelTolerancePct", DEFAULT_HORIZONTAL_TOL_PCT))
    ema_touch_tol_pct = float(opts.get("emaTouchTolerancePct", DEFAULT_EMA_TOUCH_TOL_PCT))
    min_candles = int(opts.get("minCandles", DEFAULT_MIN_CANDLES))
    bins = int(opts.get("volumeProfileBins", DEFAULT_VOLUME_PROFILE_BINS))

    df = _to_dataframe(candles)
    has_volume = _has_meaningful_volume(df)
    sufficient = len(df) >= min_candles
    warnings: list[str] = []
    if len(df) < min_candles:
        warnings.append(
            f"Only {len(df)} usable candles — at least {min_candles} are recommended for stable detection."
        )
    if not has_volume:
        warnings.append(
            "No usable volume column — Volume Profile will be skipped if requested."
        )

    requested_keys = list(requested) if requested else list(ALL_PATTERN_KEYS)

    detections_models: list[Detection] = []
    if sufficient:
        if "ema20_horizontal_level" in requested_keys:
            detections_models.extend(
                _detect_ema20_horizontal_level(
                    df,
                    horizontal_tol_pct=horizontal_tol_pct,
                    ema_touch_tol_pct=ema_touch_tol_pct,
                )
            )
        if "ema200_one_touch" in requested_keys:
            detections_models.extend(
                _detect_ema200_one_touch(df, ema_touch_tol_pct=ema_touch_tol_pct)
            )
        if "parabolic_sar_rci" in requested_keys:
            detections_models.extend(_detect_parabolic_sar_rci(df))
        # PR15B — SMC/ICT detector pack. All gated by `sufficient` so the no-detection-on-low-data
        # rule from PR10 still holds.
        if "fair_value_gap" in requested_keys:
            detections_models.extend(_detect_fair_value_gap(df))
        if "liquidity_sweep" in requested_keys:
            detections_models.extend(_detect_liquidity_sweep(df))
        if "break_of_structure" in requested_keys:
            detections_models.extend(_detect_break_of_structure(df))
        if "change_of_character" in requested_keys:
            detections_models.extend(_detect_change_of_character(df))
        if "order_block_candidate" in requested_keys:
            detections_models.extend(_detect_order_block_candidate(df))
    if has_volume and "volume_profile_zones" in requested_keys and len(df) >= 30:
        detections_models.extend(_detect_volume_profile_zones(df, bins=bins))
    elif "volume_profile_zones" in requested_keys and not has_volume:
        warnings.append(
            "Volume Profile requested but skipped: no usable volume data."
        )

    fingerprint_payload = {
        "timeframe": timeframe,
        "symbol": symbol,
        "candleCount": len(df),
        "first": df.index[0].isoformat() if len(df) else None,
        "last": df.index[-1].isoformat() if len(df) else None,
    }
    fingerprint = _stable_request_fingerprint(fingerprint_payload)

    serialised: list[dict[str, Any]] = []
    for det in detections_models:
        # Defensive: never let any text leak execution wording.
        forbidden = _scan_text_banlist(
            det.evidence + det.invalidation_hints + det.limitations
        )
        if forbidden:
            # Replace problematic strings with a structured neutral fallback.
            # The fallback text MUST itself be clean — both the engine self-scan
            # and downstream consumers re-scan the response, so any wording
            # here that re-triggers the banlist would create a feedback loop.
            det.evidence = ["Detection text suppressed by safety filter."]
            det.invalidation_hints = ["Re-run detection after addressing source text."]
            det.limitations = [
                "Detector hit its safety filter; this is a defensive failure mode, not a directive.",
            ]
        serialised.append(det.to_dict(fingerprint))

    response: dict[str, Any] = {
        "generatedAt": generated_at,
        "timeframe": timeframe,
        "dataQuality": DataQuality(
            candle_count=len(df),
            has_volume=has_volume,
            sufficient=sufficient,
            warnings=warnings,
        ).to_dict(),
        "detections": serialised,
    }
    if symbol is not None:
        response["symbol"] = symbol
    return response
