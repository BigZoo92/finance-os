"""Tests for indicator computations."""

import pytest
from finance_os_quant.engines.indicators import compute_indicator, AVAILABLE_INDICATORS

# Simple OHLCV fixture — 50 trading days across Jan-Mar 2024
from datetime import date, timedelta
_base = date(2024, 1, 2)
SAMPLE_DATA = [
    {"date": str(_base + timedelta(days=i)), "open": 100 + i, "high": 102 + i, "low": 99 + i, "close": 101 + i, "volume": 1000}
    for i in range(50)
]


def test_available_indicators():
    assert len(AVAILABLE_INDICATORS) >= 7
    assert "ema" in AVAILABLE_INDICATORS
    assert "sma" in AVAILABLE_INDICATORS
    assert "rsi" in AVAILABLE_INDICATORS
    assert "macd" in AVAILABLE_INDICATORS


def test_ema_returns_values():
    result = compute_indicator("ema", SAMPLE_DATA, {"period": 10})
    assert len(result) > 0
    assert "ema" in result[0]
    assert "date" in result[0]


def test_sma_returns_values():
    result = compute_indicator("sma", SAMPLE_DATA, {"period": 10})
    assert len(result) > 0
    assert "sma" in result[0]


def test_rsi_returns_values():
    result = compute_indicator("rsi", SAMPLE_DATA, {"period": 14})
    assert len(result) > 0
    assert "rsi" in result[0]
    assert 0 <= result[0]["rsi"] <= 100


def test_macd_returns_values():
    result = compute_indicator("macd", SAMPLE_DATA, {})
    assert len(result) > 0
    assert "macd" in result[0]
    assert "signal" in result[0]
    assert "histogram" in result[0]


def test_parabolic_sar_returns_values():
    result = compute_indicator("parabolic_sar", SAMPLE_DATA, {})
    assert len(result) > 0
    assert "sar" in result[0]
    assert "trend" in result[0]


def test_bollinger_bands_returns_values():
    result = compute_indicator("bollinger_bands", SAMPLE_DATA, {"period": 10})
    assert len(result) > 0
    assert "upper" in result[0]
    assert "lower" in result[0]
    assert "middle" in result[0]
    assert result[0]["upper"] > result[0]["lower"]


def test_unknown_indicator_raises():
    with pytest.raises(ValueError, match="Unknown indicator"):
        compute_indicator("nonexistent", SAMPLE_DATA, {})
