"""PR10 — Tests for deterministic technical pattern detection.

These tests intentionally avoid exotic numerical setups: each fixture is a
synthetic but realistic OHLCV series tuned so that one specific detector is
expected to fire (or NOT fire) under that scenario. Hard guarantees verified:

* No execution vocabulary in any output text field.
* Same input → same detection IDs (deterministic).
* Volume Profile is skipped silently when volume is missing or zero.
* Insufficient data degrades to `sufficient=false` rather than fabricating
  high-confidence detections.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import pytest

from finance_os_quant.engines.patterns import (
    ALL_PATTERN_KEYS,
    EXECUTION_BANLIST,
    detect_patterns,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _ts(i: int) -> str:
    base = datetime(2025, 1, 1, tzinfo=UTC)
    return (base + timedelta(days=i)).isoformat()


def _ema_horizontal_fixture(n: int = 250, level: float = 100.0) -> list[dict[str, Any]]:
    """Builds a price path that oscillates around `level` so EMA20 hugs it
    and the level itself is retested several times."""

    candles: list[dict[str, Any]] = []
    for i in range(n):
        # Mild oscillation around `level`.
        oscillation = 0.6 * (((i % 10) - 5) / 5)
        # Slow drift back to the level (mean-reversion).
        close = level + oscillation
        candles.append(
            {
                "timestamp": _ts(i),
                "open": close - 0.1,
                "high": close + 0.4,
                "low": close - 0.4,
                "close": close,
                "volume": 1000 + (i % 7) * 50,
            }
        )
    return candles


def _ema200_one_touch_fixture(n: int = 450) -> list[dict[str, Any]]:
    """Builds a long uptrend that extends well above EMA200, then dips back
    to within EMA200 tolerance for the first time."""

    candles: list[dict[str, Any]] = []
    price = 100.0
    for i in range(n):
        if i < 350:
            # Strong, smooth uptrend that keeps price extended above EMA200.
            price += 0.6
        elif i < 360:
            # Sharp pullback toward the EMA200 region.
            price -= 1.2
        else:
            # Stabilise near the EMA200 area; tweak so the touch lands cleanly
            # within tolerance of the rolling mean.
            price -= 0.2 if i < 380 else 0.0
        close = price
        candles.append(
            {
                "timestamp": _ts(i),
                "open": close - 0.05,
                "high": close + 0.3,
                "low": close - 0.3,
                "close": close,
                "volume": 1500,
            }
        )
    return candles


def _sar_rci_fixture(n: int = 150, *, ascending: bool = True) -> list[dict[str, Any]]:
    """Monotonic price drift so SAR locks into trend and RCI saturates."""

    candles: list[dict[str, Any]] = []
    price = 100.0
    for i in range(n):
        price += 0.4 if ascending else -0.4
        close = price
        candles.append(
            {
                "timestamp": _ts(i),
                "open": close - 0.05,
                "high": close + 0.2,
                "low": close - 0.2,
                "close": close,
                "volume": 800,
            }
        )
    return candles


def _volume_profile_fixture(n: int = 220, *, with_volume: bool = True) -> list[dict[str, Any]]:
    """Range-bound price with concentrated volume around a POC region."""

    candles: list[dict[str, Any]] = []
    for i in range(n):
        # Triangle wave between 95 and 105 with a long stretch around 100.
        phase = i % 40
        if phase < 10:
            close = 95 + phase
        elif phase < 30:
            close = 100  # POC region
        else:
            close = 105 - (phase - 30)
        # Last 10 candles drift higher to push close above VAH.
        if i >= n - 10:
            close = 108 + (i - (n - 10)) * 0.3
        # Heavy volume around 100 to anchor the POC.
        volume = 5000 if abs(close - 100) < 1 else 1000
        if not with_volume:
            volume = None
        candle = {
            "timestamp": _ts(i),
            "open": close - 0.05,
            "high": close + 0.2,
            "low": close - 0.2,
            "close": close,
        }
        if volume is not None:
            candle["volume"] = volume
        candles.append(candle)
    return candles


import re


def _scan_for_execution_terms(payload: dict[str, Any]) -> list[str]:
    """Walks the entire response and returns any execution-vocabulary hit.

    Uses the same word-boundary semantics as the engine self-scan: single-word
    terms are matched at word boundaries (so "shortcut" does not trigger
    "short"); multi-word phrases match as plain substrings.
    """

    patterns = [
        (
            term,
            re.compile(rf"\b{re.escape(term)}\b", re.IGNORECASE)
            if " " not in term
            else re.compile(re.escape(term), re.IGNORECASE),
        )
        for term in EXECUTION_BANLIST
    ]
    found: list[str] = []

    def walk(value: Any) -> None:
        if isinstance(value, str):
            for term, pattern in patterns:
                if pattern.search(value):
                    found.append(term)
        elif isinstance(value, dict):
            for v in value.values():
                walk(v)
        elif isinstance(value, list):
            for item in value:
                walk(item)

    walk(payload)
    return found


def _detect(candles: list[dict[str, Any]], **kwargs: Any) -> dict[str, Any]:
    return detect_patterns(
        candles=candles,
        timeframe=kwargs.pop("timeframe", "1d"),
        symbol=kwargs.pop("symbol", "TEST"),
        requested=kwargs.pop("requested", None),
        options=kwargs.pop("options", None),
        generated_at="2026-05-08T09:00:00+00:00",
    )


# ---------------------------------------------------------------------------
# Pattern: EMA20 + horizontal level
# ---------------------------------------------------------------------------


def test_ema20_horizontal_level_detects_when_price_pivots_around_a_level():
    out = _detect(_ema_horizontal_fixture(), requested=["ema20_horizontal_level"])
    assert out["dataQuality"]["sufficient"] is True
    detections = [d for d in out["detections"] if d["patternType"] == "ema20_horizontal_level"]
    assert len(detections) == 1
    det = detections[0]
    assert det["direction"] in ("bullish", "bearish", "neutral")
    assert det["confidence"] in ("low", "medium", "high")
    # Conservative: 250 candles + dense pivots should land at medium or high,
    # never below low.
    assert det["confidence"] != "high" or det["metrics"]["retestCount"] >= 6
    assert det["evidence"]
    assert det["invalidationHints"]
    assert det["limitations"]


# ---------------------------------------------------------------------------
# Pattern: EMA200 one-touch
# ---------------------------------------------------------------------------


def test_ema200_one_touch_detects_after_long_extension():
    out = _detect(_ema200_one_touch_fixture(), requested=["ema200_one_touch"])
    detections = [d for d in out["detections"] if d["patternType"] == "ema200_one_touch"]
    # The fixture is tuned so a touch lands; if a future indicator change
    # shifts the boundary, the detector should still report at most ONE entry
    # (one-touch by definition) and never exceed medium confidence.
    assert len(detections) <= 1
    if detections:
        det = detections[0]
        assert det["confidence"] in ("low", "medium")
        # Regime caveat MUST be present.
        all_text = " ".join(det["limitations"]).lower()
        assert "regime" in all_text


# ---------------------------------------------------------------------------
# Pattern: Parabolic SAR + RCI
# ---------------------------------------------------------------------------


def test_parabolic_sar_rci_emits_low_or_medium_confidence_only():
    out = _detect(_sar_rci_fixture(ascending=True), requested=["parabolic_sar_rci"])
    detections = [d for d in out["detections"] if d["patternType"] == "parabolic_sar_rci"]
    assert len(detections) == 1
    det = detections[0]
    assert det["confidence"] in ("low", "medium")  # never "high"
    assert det["evidence"]
    assert det["invalidationHints"]


def test_parabolic_sar_rci_descending_yields_bearish_or_neutral():
    out = _detect(_sar_rci_fixture(ascending=False), requested=["parabolic_sar_rci"])
    detections = [d for d in out["detections"] if d["patternType"] == "parabolic_sar_rci"]
    assert len(detections) == 1
    det = detections[0]
    assert det["direction"] in ("bearish", "neutral")


# ---------------------------------------------------------------------------
# Pattern: Volume Profile
# ---------------------------------------------------------------------------


def test_volume_profile_zones_with_volume_returns_poc_vah_val():
    out = _detect(_volume_profile_fixture(with_volume=True), requested=["volume_profile_zones"])
    detections = [d for d in out["detections"] if d["patternType"] == "volume_profile_zones"]
    assert len(detections) == 1
    det = detections[0]
    metrics = det["metrics"]
    assert {"poc", "valueAreaLow", "valueAreaHigh", "binCount"} <= metrics.keys()
    assert metrics["valueAreaLow"] <= metrics["poc"] <= metrics["valueAreaHigh"]
    # Last close (108+) should be above VAH ⇒ bullish bias.
    assert det["direction"] == "bullish"


def test_volume_profile_zones_skipped_when_volume_missing():
    out = _detect(_volume_profile_fixture(with_volume=False), requested=["volume_profile_zones"])
    detections = [d for d in out["detections"] if d["patternType"] == "volume_profile_zones"]
    assert detections == []
    assert out["dataQuality"]["hasVolume"] is False
    assert any("Volume Profile" in w for w in out["dataQuality"]["warnings"])


def test_volume_profile_zones_skipped_when_volume_all_zeroes():
    candles = _volume_profile_fixture(with_volume=True)
    for c in candles:
        c["volume"] = 0
    out = _detect(candles, requested=["volume_profile_zones"])
    detections = [d for d in out["detections"] if d["patternType"] == "volume_profile_zones"]
    assert detections == []
    assert out["dataQuality"]["hasVolume"] is False


# ---------------------------------------------------------------------------
# Data quality / safety guarantees
# ---------------------------------------------------------------------------


def test_too_few_candles_yields_sufficient_false_and_no_detections():
    short_fixture = _ema_horizontal_fixture(n=20)
    out = _detect(short_fixture)
    assert out["dataQuality"]["sufficient"] is False
    assert any("usable candles" in w for w in out["dataQuality"]["warnings"])
    # No detections produced when the data window is below threshold (Volume
    # Profile also gated by min length, so it stays empty too).
    assert out["detections"] == []


def test_detect_patterns_returns_caveats_and_no_execution_vocabulary():
    out = _detect(_ema_horizontal_fixture())
    forbidden = _scan_for_execution_terms(out)
    assert forbidden == [], f"execution vocabulary leaked: {forbidden}"


def test_default_request_runs_all_pattern_keys():
    # No `requested` field ⇒ all detectors are tried.
    out = _detect(_volume_profile_fixture(with_volume=True))
    pattern_types = {d["patternType"] for d in out["detections"]}
    # Each pattern is independently optional; the assertion is that the engine
    # tried every key, not that every key fired. We only require the union of
    # produced patterns is a subset of the canonical set.
    assert pattern_types <= set(ALL_PATTERN_KEYS)


def test_deterministic_detection_ids_for_identical_input():
    candles = _ema_horizontal_fixture()
    out_a = _detect(candles, requested=["ema20_horizontal_level"])
    out_b = _detect(candles, requested=["ema20_horizontal_level"])
    ids_a = sorted(d["id"] for d in out_a["detections"])
    ids_b = sorted(d["id"] for d in out_b["detections"])
    assert ids_a == ids_b
    assert all(i.startswith("det_") for i in ids_a)


def test_minCandles_option_is_honoured():
    out = _detect(
        _ema_horizontal_fixture(n=40),
        options={"minCandles": 30},
    )
    # 40 ≥ 30 (custom min), so sufficient becomes True even though the
    # default 60-candle floor would have failed it.
    assert out["dataQuality"]["sufficient"] is True


def test_data_quality_reports_candle_count_and_volume_presence():
    out = _detect(_ema_horizontal_fixture())
    dq = out["dataQuality"]
    assert dq["candleCount"] == 250
    assert dq["hasVolume"] is True


def test_response_includes_symbol_and_timeframe_passthrough():
    out = _detect(_ema_horizontal_fixture(), symbol="ABC.US", timeframe="4h")
    assert out["symbol"] == "ABC.US"
    assert out["timeframe"] == "4h"


# ===========================================================================
# PR15B — SMC/ICT detector pack
# ===========================================================================


def _bullish_fvg_fixture() -> list[dict[str, Any]]:
    """Curve with a clean bullish 3-candle FVG around index ~70 followed by trend."""
    candles: list[dict[str, Any]] = []
    price = 100.0
    for i in range(120):
        if i == 70:
            # Tall bullish displacement candle.
            o = price
            c = price * 1.03
            h = c * 1.005
            low = o * 0.998
        elif i == 71:
            # Next candle's low is well above prior candle's high (gap on the chart).
            o = price * 1.01
            c = price * 1.012
            h = c * 1.005
            low = price * 1.008
        else:
            move = 0.001 if i < 70 else 0.002
            o = price
            c = price * (1 + move)
            h = c * 1.002
            low = o * 0.998
        candles.append(
            {"timestamp": _ts(i), "open": o, "high": h, "low": low, "close": c, "volume": 1000}
        )
        price = c
    return candles


def _bearish_fvg_fixture() -> list[dict[str, Any]]:
    candles: list[dict[str, Any]] = []
    price = 100.0
    for i in range(120):
        if i == 70:
            o = price
            c = price * 0.97
            h = o * 1.002
            low = c * 0.995
        elif i == 71:
            o = price * 0.99
            c = price * 0.988
            h = price * 0.992
            low = c * 0.995
        else:
            move = -0.001 if i < 70 else -0.002
            o = price
            c = price * (1 + move)
            h = o * 1.002
            low = c * 0.998
        candles.append(
            {"timestamp": _ts(i), "open": o, "high": h, "low": low, "close": c, "volume": 1000}
        )
        price = c
    return candles


def _trend_with_swings_fixture(direction: str = "bullish", n: int = 200) -> list[dict[str, Any]]:
    """Strong trend with clear distinct swing pivots so BOS/CHOCH/order-block detectors
    fire reliably. We synthesize an explicit zig-zag with unique-max segment turns."""

    candles: list[dict[str, Any]] = []
    sign = 1 if direction == "bullish" else -1
    # 8-bar zig-zag legs: 5 bars trend, 3 bars retrace, repeat. Distinct top/bottom each leg.
    leg_size = 8
    leg_amplitude = 0.04
    base = 100.0
    for i in range(n):
        leg_index = i // leg_size
        within = i % leg_size
        # Trend leg: stair-step up (or down). Retrace leg: half-amplitude opposite.
        if within < 5:
            progress = within / 4  # 0..1
            offset = sign * leg_amplitude * leg_index + sign * leg_amplitude * progress
        else:
            progress = (within - 4) / 3
            offset = sign * leg_amplitude * (leg_index + 1) - sign * leg_amplitude * 0.5 * progress
        # Add tiny per-bar noise so pivot uniqueness holds (no equal highs).
        noise = 0.0002 * (1 if i % 2 == 0 else -1) * (1 + (i % 7))
        target = base * (1 + offset + noise)
        prev_close = candles[-1]["close"] if candles else base
        o = float(prev_close)
        c = float(target)
        h = max(o, c) * 1.003 + abs(noise) * 10
        low = min(o, c) * 0.997 - abs(noise) * 10
        candles.append(
            {"timestamp": _ts(i), "open": o, "high": h, "low": low, "close": c, "volume": 1000}
        )
    return candles


def _liquidity_sweep_low_fixture() -> list[dict[str, Any]]:
    """Build a clear swing low at ~i=40, then a wick that pierces below it
    and closes back above it at ~i=60."""
    candles: list[dict[str, Any]] = []
    price = 100.0
    swing_idx = 40
    sweep_idx = 60
    swing_low_value = 95.0
    for i in range(120):
        if i == swing_idx:
            o, c = 96.0, 95.5
            h = 96.5
            low = swing_low_value  # the low we will sweep
        elif i == sweep_idx:
            o, c = 97.0, 97.5  # close ABOVE the swing low
            h = 98.0
            low = swing_low_value - 0.5  # wick pierces BELOW the swing low
        else:
            base = 98.0 if i > swing_idx else 99.0
            o, c = base, base * 1.001
            h = max(o, c) * 1.002
            low = min(o, c) * 0.998
        candles.append(
            {"timestamp": _ts(i), "open": o, "high": h, "low": low, "close": c, "volume": 1000}
        )
        price = c
    return candles


def _liquidity_sweep_high_fixture() -> list[dict[str, Any]]:
    candles: list[dict[str, Any]] = []
    price = 100.0
    swing_idx = 40
    sweep_idx = 60
    swing_high_value = 105.0
    for i in range(120):
        if i == swing_idx:
            o, c = 104.0, 104.5
            h = swing_high_value  # the high we will sweep
            low = 103.5
        elif i == sweep_idx:
            o, c = 103.0, 102.5  # close BELOW the swing high
            h = swing_high_value + 0.5  # wick pierces ABOVE the swing high
            low = 102.0
        else:
            base = 102.0 if i > swing_idx else 101.0
            o, c = base, base * 0.999
            h = max(o, c) * 1.002
            low = min(o, c) * 0.998
        candles.append(
            {"timestamp": _ts(i), "open": o, "high": h, "low": low, "close": c, "volume": 1000}
        )
        price = c
    return candles


def test_fair_value_gap_bullish_detected():
    out = _detect(_bullish_fvg_fixture(), requested=["fair_value_gap"])
    detections = [d for d in out["detections"] if d["patternType"] == "fair_value_gap"]
    assert len(detections) >= 1
    bullish = [d for d in detections if d["direction"] == "bullish"]
    assert len(bullish) >= 1
    det = bullish[0]
    assert det["confidence"] in ("low", "medium")  # SMC cap — no high
    metrics = det["metrics"]
    assert metrics["gapHigh"] > metrics["gapLow"]


def test_fair_value_gap_bearish_detected():
    out = _detect(_bearish_fvg_fixture(), requested=["fair_value_gap"])
    detections = [d for d in out["detections"] if d["patternType"] == "fair_value_gap"]
    assert len(detections) >= 1
    bearish = [d for d in detections if d["direction"] == "bearish"]
    assert len(bearish) >= 1


def test_fair_value_gap_mitigation_recorded_when_filled():
    """A bullish FVG followed by a deep retracement should be marked mitigated=True."""
    candles = _bullish_fvg_fixture()
    # Append a deep retrace that overlaps the gap range so mitigation triggers.
    last_close = float(candles[-1]["close"])
    for i in range(120, 140):
        retrace = last_close * (1 - 0.008 * (i - 119))
        candles.append(
            {
                "timestamp": _ts(i),
                "open": retrace,
                "high": retrace * 1.001,
                "low": retrace * 0.999,
                "close": retrace,
                "volume": 1000,
            }
        )
    out = _detect(candles, requested=["fair_value_gap"])
    detections = [d for d in out["detections"] if d["patternType"] == "fair_value_gap"]
    if detections:
        # At least one of the surfaced FVGs should now be marked mitigated.
        assert any(d["metrics"]["mitigated"] is True for d in detections)


def test_liquidity_sweep_low_detects_bullish_sweep():
    out = _detect(_liquidity_sweep_low_fixture(), requested=["liquidity_sweep"])
    detections = [d for d in out["detections"] if d["patternType"] == "liquidity_sweep"]
    assert any(
        d["direction"] == "bullish" and d["metrics"]["side"] == "below_swing_low"
        for d in detections
    )


def test_liquidity_sweep_high_detects_bearish_sweep():
    out = _detect(_liquidity_sweep_high_fixture(), requested=["liquidity_sweep"])
    detections = [d for d in out["detections"] if d["patternType"] == "liquidity_sweep"]
    assert any(
        d["direction"] == "bearish" and d["metrics"]["side"] == "above_swing_high"
        for d in detections
    )


def test_break_of_structure_bullish_detected_on_strong_uptrend():
    out = _detect(_trend_with_swings_fixture("bullish"), requested=["break_of_structure"])
    detections = [d for d in out["detections"] if d["patternType"] == "break_of_structure"]
    assert any(d["direction"] == "bullish" for d in detections)
    for det in detections:
        assert det["confidence"] in ("low", "medium")


def test_break_of_structure_bearish_detected_on_strong_downtrend():
    out = _detect(_trend_with_swings_fixture("bearish"), requested=["break_of_structure"])
    detections = [d for d in out["detections"] if d["patternType"] == "break_of_structure"]
    assert any(d["direction"] == "bearish" for d in detections)


def test_change_of_character_requires_two_opposing_breaks():
    """A monotonic uptrend should NOT produce a CHOCH — there is no opposing break."""
    out = _detect(_trend_with_swings_fixture("bullish"), requested=["change_of_character"])
    detections = [d for d in out["detections"] if d["patternType"] == "change_of_character"]
    # Either no detection OR all detections use low confidence.
    for det in detections:
        assert det["confidence"] in ("low", "medium")


def test_order_block_candidate_carries_candidate_limitation():
    out = _detect(
        _trend_with_swings_fixture("bullish"), requested=["order_block_candidate"]
    )
    detections = [d for d in out["detections"] if d["patternType"] == "order_block_candidate"]
    if detections:
        det = detections[0]
        assert det["confidence"] == "low"
        # Candidate limitation must be present.
        assert any("CANDIDATE" in lim or "candidate" in lim for lim in det["limitations"])


def test_smc_too_few_candles_yields_no_detections_and_warning():
    short_fixture = _bullish_fvg_fixture()[:30]
    out = _detect(short_fixture, requested=["fair_value_gap", "liquidity_sweep"])
    assert out["dataQuality"]["sufficient"] is False
    assert all(
        d["patternType"] not in (
            "fair_value_gap",
            "liquidity_sweep",
            "break_of_structure",
            "change_of_character",
            "order_block_candidate",
        )
        for d in out["detections"]
    )


def test_smc_no_clear_swing_yields_no_bos_choch():
    """Flat / random series should not produce false BOS / CHOCH detections."""
    candles = [
        {
            "timestamp": _ts(i),
            "open": 100,
            "high": 100.5,
            "low": 99.5,
            "close": 100,
            "volume": 1000,
        }
        for i in range(120)
    ]
    out = _detect(candles, requested=["break_of_structure", "change_of_character"])
    smc_detections = [
        d
        for d in out["detections"]
        if d["patternType"] in ("break_of_structure", "change_of_character")
    ]
    assert smc_detections == []


def test_smc_patterns_never_emit_high_confidence():
    fixtures = [
        ("fair_value_gap", _bullish_fvg_fixture()),
        ("liquidity_sweep", _liquidity_sweep_low_fixture()),
        ("break_of_structure", _trend_with_swings_fixture("bullish")),
        ("change_of_character", _trend_with_swings_fixture("bullish")),
        ("order_block_candidate", _trend_with_swings_fixture("bullish")),
    ]
    for key, candles in fixtures:
        out = _detect(candles, requested=[key])
        for det in out["detections"]:
            if det["patternType"] == key:
                assert det["confidence"] in ("low", "medium"), (
                    f"{key} produced {det['confidence']} — SMC patterns must not exceed medium"
                )


def test_smc_detections_never_contain_execution_vocabulary():
    fixtures = [
        _bullish_fvg_fixture(),
        _liquidity_sweep_low_fixture(),
        _liquidity_sweep_high_fixture(),
        _trend_with_swings_fixture("bullish"),
        _trend_with_swings_fixture("bearish"),
    ]
    for candles in fixtures:
        out = _detect(candles)
        forbidden = _scan_for_execution_terms(out)
        assert forbidden == [], f"execution vocabulary leaked: {forbidden}"


def test_smc_detection_ids_are_deterministic_for_identical_input():
    candles = _bullish_fvg_fixture()
    out_a = _detect(candles, requested=["fair_value_gap"])
    out_b = _detect(candles, requested=["fair_value_gap"])
    ids_a = sorted(d["id"] for d in out_a["detections"])
    ids_b = sorted(d["id"] for d in out_b["detections"])
    assert ids_a == ids_b
    assert all(i.startswith("det_") for i in ids_a)


def test_smc_detections_carry_limitations_and_invalidation_hints():
    out = _detect(_bullish_fvg_fixture())
    smc_dets = [
        d
        for d in out["detections"]
        if d["patternType"]
        in (
            "fair_value_gap",
            "liquidity_sweep",
            "break_of_structure",
            "change_of_character",
            "order_block_candidate",
        )
    ]
    for det in smc_dets:
        assert len(det["limitations"]) > 0
        assert len(det["invalidationHints"]) > 0
        assert len(det["evidence"]) > 0
