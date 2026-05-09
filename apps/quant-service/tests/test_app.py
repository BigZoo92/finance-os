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


@pytest.mark.anyio
async def test_patterns_detect_endpoint_returns_data_quality_and_caveats(client):
    candles = [
        {
            "timestamp": f"2025-01-{i:02d}T00:00:00+00:00",
            "open": 100.0 + (i % 5) * 0.1,
            "high": 100.4 + (i % 5) * 0.1,
            "low": 99.6 + (i % 5) * 0.1,
            "close": 100.0 + (i % 5) * 0.1,
            "volume": 1000,
        }
        for i in range(1, 31)
    ]
    resp = await client.post(
        "/quant/patterns/detect",
        json={
            "symbol": "TEST",
            "timeframe": "1d",
            "candles": candles,
            "patterns": ["ema20_horizontal_level"],
            "options": {"minCandles": 25},
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["timeframe"] == "1d"
    assert data["symbol"] == "TEST"
    assert "dataQuality" in data
    assert data["dataQuality"]["candleCount"] == 30
    assert isinstance(data["detections"], list)
    assert "caveats" in data
    assert any("Not financial advice" in c for c in data["caveats"])
    assert any("Research-only" in c for c in data["caveats"])


@pytest.mark.anyio
async def test_patterns_detect_endpoint_handles_volume_missing(client):
    candles = [
        {
            "timestamp": f"2025-02-{i:02d}T00:00:00+00:00",
            "open": 100.0,
            "high": 100.5,
            "low": 99.5,
            "close": 100.0,
        }
        for i in range(1, 31)
    ]
    resp = await client.post(
        "/quant/patterns/detect",
        json={
            "timeframe": "1d",
            "candles": candles,
            "patterns": ["volume_profile_zones"],
            "options": {"minCandles": 25},
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["dataQuality"]["hasVolume"] is False
    # No volume-profile detection should fire without volume.
    vp = [d for d in data["detections"] if d["patternType"] == "volume_profile_zones"]
    assert vp == []
    assert any("Volume Profile" in w for w in data["dataQuality"]["warnings"])
