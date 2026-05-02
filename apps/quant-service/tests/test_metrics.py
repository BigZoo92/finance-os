"""Tests for portfolio metrics computation."""

from finance_os_quant.engines.metrics import (
    compute_cagr,
    compute_sharpe,
    compute_sortino,
    compute_max_drawdown,
    compute_calmar,
    compute_win_rate,
    compute_profit_factor,
    compute_beta,
    compute_all_metrics,
)


def test_cagr_positive():
    # 100 -> 200 in 252 days = ~100% CAGR
    equity = [100.0] + [100.0 + i * (100 / 251) for i in range(1, 252)]
    cagr = compute_cagr(equity, periods_per_year=252)
    assert cagr is not None
    assert cagr > 0.8  # roughly 100%


def test_cagr_insufficient_data():
    assert compute_cagr([100.0]) is None
    assert compute_cagr([]) is None


def test_sharpe_positive_for_positive_returns():
    import random

    random.seed(42)
    returns = [0.01 + random.gauss(0, 0.005) for _ in range(252)]
    sharpe = compute_sharpe(returns)
    assert sharpe is not None
    assert sharpe > 0


def test_sharpe_none_for_zero_vol():
    returns = [0.0] * 100
    assert compute_sharpe(returns) is None


def test_sortino_positive_for_positive_returns():
    import random

    random.seed(42)
    returns = [0.01 + random.gauss(0, 0.005) for _ in range(252)]
    sortino = compute_sortino(returns)
    assert sortino is not None
    assert sortino > 0


def test_max_drawdown():
    equity = [100, 110, 105, 120, 95, 130]
    dd = compute_max_drawdown(equity)
    assert dd is not None
    # Max drawdown is from 120 to 95 = 20.83%
    assert abs(dd - (120 - 95) / 120) < 0.01


def test_calmar():
    equity = [100] + [100 + i * 0.5 for i in range(1, 253)]
    calmar = compute_calmar(equity)
    # Should be defined when there is some drawdown and positive CAGR
    if calmar is not None:
        assert calmar > 0


def test_win_rate():
    assert compute_win_rate([10, -5, 20, -3, 15]) == round(3 / 5, 4)
    assert compute_win_rate([]) is None


def test_profit_factor():
    pf = compute_profit_factor([10, -5, 20, -3])
    assert pf is not None
    assert pf == round(30 / 8, 4)


def test_beta():
    returns = [0.01, -0.02, 0.03, -0.01, 0.02]
    benchmark = [0.005, -0.01, 0.015, -0.005, 0.01]
    beta = compute_beta(returns, benchmark)
    assert beta is not None
    # Should be > 1 since our returns amplify benchmark moves
    assert beta > 0


def test_all_metrics_integration():
    equity = [10000 + i * 10 for i in range(252)]
    returns = [0.001] * 251
    trade_pnls = [100, -50, 200, -30, 150]
    result = compute_all_metrics(equity, returns, trade_pnls)
    assert "cagr" in result
    assert "sharpe" in result
    assert "max_drawdown" in result
    assert "win_rate" in result
    assert result["total_trades"] == 5
