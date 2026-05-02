"""Tests for quant service FastAPI endpoints."""

import pytest
from httpx import ASGITransport, AsyncClient

from finance_os_quant.app import create_app

SAMPLE_DATA = [
    {
        "date": f"2024-01-{i:02d}",
        "open": 100 + i,
        "high": 102 + i,
        "low": 99 + i,
        "close": 101 + i,
        "volume": 1000,
    }
    for i in range(1, 31)
]


@pytest.fixture
def app():
    return create_app()


@pytest.fixture
async def client(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.mark.anyio
async def test_health(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert data["paper_only"] is True


@pytest.mark.anyio
async def test_version(client):
    resp = await client.get("/version")
    assert resp.status_code == 200
    data = resp.json()
    assert data["service"] == "quant-service"
    assert data["paper_only"] is True


@pytest.mark.anyio
async def test_capabilities(client):
    resp = await client.get("/quant/capabilities")
    assert resp.status_code == 200
    data = resp.json()
    assert data["paper_only"] is True
    assert len(data["indicators"]) >= 7
    assert data["backtesting"] is True


@pytest.mark.anyio
async def test_indicators_endpoint(client):
    resp = await client.post(
        "/quant/indicators",
        json={
            "indicator": "ema",
            "data": SAMPLE_DATA,
            "params": {"period": 10},
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert data["indicator"] == "ema"
    assert len(data["values"]) > 0


@pytest.mark.anyio
async def test_backtest_endpoint(client):
    resp = await client.post(
        "/quant/backtest",
        json={
            "strategy_type": "buy_and_hold",
            "data": SAMPLE_DATA,
            "initial_cash": 10000,
            "fees_bps": 10,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert len(data["equity_curve"]) > 0
    assert len(data["caveats"]) >= 3
    assert "requestId" in data


@pytest.mark.anyio
async def test_metrics_endpoint(client):
    resp = await client.post(
        "/quant/metrics",
        json={
            "returns": [0.01, -0.005, 0.02, -0.01, 0.015] * 50,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert "sharpe" in data["metrics"]


@pytest.mark.anyio
async def test_scenario_evaluate_endpoint(client):
    resp = await client.post(
        "/quant/scenario/evaluate",
        json={
            "thesis": "Tech sector will outperform in Q2",
            "supporting_signals": [{"id": "1"}],
            "contradicting_signals": [{"id": "2"}, {"id": "3"}],
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert "confidence" in data
    assert "risk_level" in data


@pytest.mark.anyio
async def test_no_live_trading_endpoints(client):
    """Verify no live trading endpoints exist."""
    for path in ["/trade", "/execute", "/order", "/broker", "/exchange"]:
        resp = await client.get(path)
        assert resp.status_code in (404, 405), f"Unexpected endpoint found: {path}"
        resp = await client.post(path, json={})
        assert resp.status_code in (404, 422), f"Unexpected endpoint found: {path}"
