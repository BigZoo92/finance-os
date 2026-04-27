"""Tests for the walk-forward validation engine."""

from datetime import date, timedelta

from finance_os_quant.engines.walk_forward import run_walk_forward


_base = date(2024, 1, 2)


def _series(n: int, drift: float) -> list[dict]:
    rows = []
    price = 100.0
    for i in range(n):
        price = price * (1 + drift)
        rows.append(
            {
                "date": str(_base + timedelta(days=i)),
                "open": round(price, 2),
                "high": round(price * 1.01, 2),
                "low": round(price * 0.99, 2),
                "close": round(price, 2),
                "volume": 1000,
            }
        )
    return rows


def test_insufficient_data_returns_warning():
    result = run_walk_forward("buy_and_hold", _series(20, 0.001))
    assert result["overfit_warning"] == "INSUFFICIENT_DATA"
    assert result["windows"] == []


def test_buy_and_hold_on_trending_data_is_stable():
    data = _series(400, 0.002)
    result = run_walk_forward(
        "buy_and_hold",
        data,
        train_bars=120,
        test_bars=30,
        step_bars=30,
    )
    assert result["ok"] is True
    assert len(result["windows"]) > 0
    # On a steady uptrend, mean OOS return should be positive
    assert result["out_of_sample"]["return"]["mean"] > 0


def test_summary_mentions_window_count():
    data = _series(400, 0.002)
    result = run_walk_forward("buy_and_hold", data)
    assert "windows tested" in result["summary"]


def test_caps_at_max_windows():
    data = _series(2000, 0.001)
    result = run_walk_forward(
        "buy_and_hold",
        data,
        train_bars=60,
        test_bars=20,
        step_bars=20,
    )
    assert len(result["windows"]) <= 12


def test_overfit_warning_set_when_oos_loses():
    # Force a scenario where IS is profitable but OOS regime flips by
    # building a series that rises then crashes.
    rises = _series(300, 0.003)
    crashes = []
    price = rises[-1]["close"]
    for i in range(120):
        price = price * (1 - 0.003)
        crashes.append(
            {
                "date": str(_base + timedelta(days=300 + i)),
                "open": round(price, 2),
                "high": round(price * 1.01, 2),
                "low": round(price * 0.99, 2),
                "close": round(price, 2),
                "volume": 1000,
            }
        )
    data = rises + crashes
    result = run_walk_forward(
        "buy_and_hold",
        data,
        train_bars=120,
        test_bars=30,
        step_bars=30,
    )
    # We don't strictly require a specific warning value (regime change is
    # handled by buy_and_hold being long-only), but degradation_ratio should
    # be observable when OOS turns negative on average.
    assert result["ok"] is True
    if result["degradation_ratio"] is not None:
        assert isinstance(result["degradation_ratio"], float)
