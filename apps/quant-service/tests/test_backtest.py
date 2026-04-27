"""Tests for backtest engine."""

import pytest
from finance_os_quant.engines.backtest import run_backtest, AVAILABLE_STRATEGIES

from datetime import date, timedelta
_base = date(2024, 1, 2)

# Trending up data (price rises steadily)
TREND_UP_DATA = [
    {"date": str(_base + timedelta(days=i)), "open": 100 + i * 0.5, "high": 102 + i * 0.5, "low": 99 + i * 0.5, "close": 101 + i * 0.5, "volume": 1000}
    for i in range(50)
]

# Flat data
FLAT_DATA = [
    {"date": str(_base + timedelta(days=i)), "open": 100, "high": 101, "low": 99, "close": 100, "volume": 1000}
    for i in range(50)
]


def test_available_strategies():
    assert "buy_and_hold" in AVAILABLE_STRATEGIES
    assert "ema_crossover" in AVAILABLE_STRATEGIES


def test_buy_and_hold_trending_up():
    result = run_backtest("buy_and_hold", TREND_UP_DATA, initial_cash=10000)
    assert result["ok"] is True
    assert result["strategy_type"] == "buy_and_hold"
    assert len(result["equity_curve"]) == len(TREND_UP_DATA)
    assert len(result["caveats"]) >= 3
    assert result["params_hash"] is not None
    assert result["data_hash"] is not None
    # Buy and hold on trending up data should be profitable
    final_equity = result["equity_curve"][-1]["equity"]
    assert final_equity > 10000


def test_buy_and_hold_metrics():
    result = run_backtest("buy_and_hold", TREND_UP_DATA, initial_cash=10000)
    metrics = result["metrics"]
    assert "sharpe" in metrics
    assert "max_drawdown" in metrics
    assert "total_trades" in metrics
    assert "total_fees" in metrics
    assert metrics["total_fees"] >= 0


def test_fees_applied():
    result_no_fees = run_backtest("buy_and_hold", TREND_UP_DATA, fees_bps=0, slippage_bps=0, spread_bps=0)
    result_with_fees = run_backtest("buy_and_hold", TREND_UP_DATA, fees_bps=50, slippage_bps=20, spread_bps=10)
    # With fees, final equity should be lower
    eq_no = result_no_fees["equity_curve"][-1]["equity"]
    eq_with = result_with_fees["equity_curve"][-1]["equity"]
    assert eq_no > eq_with


def test_ema_crossover():
    result = run_backtest("ema_crossover", TREND_UP_DATA, params={"fast_period": 5, "slow_period": 15})
    assert result["ok"] is True
    assert len(result["equity_curve"]) > 0


def test_unknown_strategy_raises():
    with pytest.raises(ValueError, match="Unknown strategy"):
        run_backtest("nonexistent", TREND_UP_DATA)


def test_insufficient_data_raises():
    with pytest.raises(ValueError, match="Insufficient data"):
        run_backtest("buy_and_hold", FLAT_DATA[:3])


def test_drawdowns_computed():
    result = run_backtest("buy_and_hold", TREND_UP_DATA)
    assert "drawdowns" in result
    assert len(result["drawdowns"]) > 0


def test_orb_breakout():
    result = run_backtest("orb_breakout", TREND_UP_DATA, params={"lookback": 3})
    assert result["ok"] is True


def test_parabolic_sar_trend():
    result = run_backtest("parabolic_sar_trend", TREND_UP_DATA)
    assert result["ok"] is True
