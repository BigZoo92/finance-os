# Trading Lab

> **Paper-trading and backtesting research ONLY.**
> No live trading. No broker connections. No real order placement.

## What is this?

The Trading Lab is Finance-OS's personal research environment for:
- Strategy research and documentation
- Historical backtesting with realistic cost modeling
- Paper scenario tracking linked to signals and news
- Risk metric analysis and portfolio analytics
- Knowledge graph integration for strategy memory

## Architecture

```
[Web UI] --proxy--> [API (Elysia)] --internal--> [Quant Service (FastAPI)]
                                    --internal--> [Knowledge Service (FastAPI)]
                                    --internal--> [PostgreSQL]
```

- **Web UI**: Trading Lab page at `/ia/trading-lab`
- **API**: Routes under `/dashboard/trading-lab/*`
- **Quant Service**: Internal Python service at port 8012
- **Knowledge Service**: Stores strategy/backtest/scenario memory as graph nodes

## Safety Guardrails

1. `TRADING_LAB_PAPER_ONLY=true` enforced at env level
2. No broker/exchange credential env vars exist
3. No execution API endpoints exist
4. All strategies tagged with experimental/trust levels
5. Every backtest result includes caveats
6. Walk-forward validation and overfitting warnings built-in
7. UI displays "Paper Only" warning prominently

## Key Concepts

- **Strategy**: A documented trading hypothesis with entry/exit/risk rules
- **Backtest Run**: A historical simulation of a strategy with full cost modeling
- **Paper Scenario**: A thesis linked to signals, with invalidation criteria
- **Attention Item**: A signal or event that requires human attention

## Technical Strategies

| Strategy | Type | Status |
|----------|------|--------|
| Buy & Hold | Benchmark | Established |
| EMA Crossover | Technical | Experimental |
| RSI Mean Reversion | Technical | Experimental |
| Parabolic SAR Trend | Technical | Experimental |
| ORB Breakout | Technical | Experimental |

All technical strategies are marked **experimental**. They are research tools, not trading recommendations.

## Metrics

| Metric | Description |
|--------|-------------|
| CAGR | Compound Annual Growth Rate |
| Sharpe | Risk-adjusted return (excess return / volatility) |
| Sortino | Downside risk-adjusted return |
| Max Drawdown | Largest peak-to-trough loss |
| Calmar | CAGR / Max Drawdown |
| Win Rate | Percentage of profitable trades |
| Profit Factor | Gross profit / Gross loss |
| Alpha/Beta | Performance vs benchmark |

## What This Is NOT

- Not a trading bot
- Not a broker connection
- Not an order management system
- Not financial advice
- Not a guaranteed profitable strategy generator
- Not a replacement for professional financial analysis

## Running a backtest from the UI

The Trading Lab page (`/ia/trading-lab`) ships a built-in runner panel:

- choose a strategy, symbol, interval and date range
- pick a data source (`Auto` / `Cache` / `Provider` / `Données manuelles` / `Fixture démo`)
- pick a preferred provider (`Auto` / `EODHD` / `TwelveData`)
- adjust capital, fees, slippage and spread (bps)
- click **Prévisualiser les données** to inspect the resolved OHLCV (count, first/last bar, fallback flag)
- click **Lancer le backtest** to execute and persist the run
- click **Walk-forward** to run a rolling out-of-sample validation

The runner is admin-only. In demo mode the UI is rendered read-only.

## Running a backtest from the API

`POST /dashboard/trading-lab/backtests/run` (admin only). Body:

```json
{
  "strategyId": 1,
  "symbol": "SPY.US",
  "timeframe": "1d",
  "startDate": "2024-01-02",
  "endDate": "2024-06-01",
  "initialCash": 10000,
  "feesBps": 10,
  "slippageBps": 5,
  "spreadBps": 2,
  "dataSourcePreference": "auto",
  "preferredProvider": "auto",
  "data": [{"date": "2024-01-02", "open": 100, "high": 101, "low": 99, "close": 100.5, "volume": 1000}]
}
```

Resolution chain (`dataSourcePreference`):

| value | behavior |
|---|---|
| `caller_provided` | only use bars from the `data` payload |
| `cached` | only return persisted bars from `market_ohlcv_bar` |
| `provider` | force a fresh fetch from EODHD / TwelveData |
| `deterministic_fixture` | force the synthetic generator |
| `auto` (default) | caller → cache → provider → fixture, in order |

Legacy `useDemoData` is still accepted (mapped to `auto` / `provider`).

Response includes:
- `runId` + `metrics` + `caveats`
- `resolvedMarketDataSource`: `caller_provided`, `cached`, `provider_eodhd`, `provider_twelvedata`, or `deterministic_fixture`
- `dataProvider`, `dataQuality` (`real` / `real-cached` / `synthetic`), `dataWarnings[]`
- `fallbackUsed` + `fallbackReason` when the chain falls back
- `barsCount`, `firstBarDate`, `lastBarDate`
- `graphIngest.{ok,reason}` from the post-run knowledge graph push.

The persisted run records `marketDataSource` and stores quality + provider context in `resultSummary`.

If no provider is configured (no `EODHD_API_KEY` or `TWELVEDATA_API_KEY`), `auto` falls back to the deterministic fixture and the response **clearly labels the fallback** with `fallbackUsed: true`.

## Real OHLCV market data

OHLCV bars from market providers are persisted in `market_ohlcv_bar` keyed by `(provider, symbol, interval, bar_date)`. The adapter:

- prefers cached bars when available (no provider call needed)
- falls back to a fresh fetch via EODHD or TwelveData when cache is short
- writes fetched bars back to the cache (idempotent upsert)
- never logs API tokens or includes them in error responses

To enable real market data, set `EODHD_API_KEY` and/or `TWELVEDATA_API_KEY` and ensure `MARKET_DATA_EODHD_ENABLED` / `MARKET_DATA_TWELVEDATA_ENABLED` are true.

Set `MARKET_DATA_FORCE_FIXTURE_FALLBACK=true` to force the synthetic generator regardless of configuration (useful in CI).

## Walk-forward validation

`POST /dashboard/trading-lab/backtests/walk-forward` (admin only) performs a rolling out-of-sample validation:

- splits the resolved OHLCV into `(train_bars, test_bars)` windows stepped by `step_bars`
- caps at 12 windows for CPU bounds
- returns per-window train/test return, sharpe, drawdown
- emits a `stabilityScore`, `degradationRatio` and an optional `overfitWarning` (`STRONG_DEGRADATION`, `OOS_LOSES_MONEY_WHEN_IS_PROFITABLE`, `HIGH_OOS_VARIANCE`, `INSUFFICIENT_DATA`)

The UI shows a `Stable` / `Fragile` / `Risque overfit` / `Données insuffisantes` badge plus a window table.

Walk-forward reduces overfitting risk **but is not a proof of future performance**.

## Verifying the quant-service

```sh
# inside docker compose
docker compose exec quant-service python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8012/health', timeout=3).read())"

# capabilities
curl -s http://127.0.0.1:8012/quant/capabilities | jq
```

`/quant/capabilities` reports the active indicators, metrics, strategies, and whether vectorbt / quantstats are installed. The base service install is light — vectorbt and quantstats are optional via the `[full]` extra.

## Attention items

`attention_item` rows are auto-generated by `POST /dashboard/trading-lab/attention/rebuild` (admin only) from:

- `signal_item.requiresAttention` rows above the relevance/confidence thresholds
- `news_provider_state` rows that are stale or in error
- failed `signal_ingestion_run` rows
- failed `trading_lab_backtest_run` rows

Items are deduped by `dedupeKey`, expire automatically, and surface in:
- the cockpit's "demande attention" card
- the `/ia/trading-lab` "ce qui demande ton attention" panel

A failed backtest also creates an attention item inline with the run failure.

### Scheduled rebuild (worker)

When `ATTENTION_SYSTEM_ENABLED=true` and `ATTENTION_REBUILD_AUTO_ENABLED=true`, the worker triggers a rebuild every `ATTENTION_REBUILD_INTERVAL_MS` (default 10 min). The trigger:

- holds a Redis lock (`attention:rebuild:lock`, 5-minute TTL) to prevent overlap
- propagates a per-tick request id for tracing
- fails soft on any error — logged, never crashes the worker loop
- is gated by `EXTERNAL_INTEGRATIONS_SAFE_MODE`

## Signal → Scenario → Backtest workflow

From `/signaux`:
- each signal card exposes a **Créer un scénario papier** action (admin only)
- the API endpoint `POST /dashboard/trading-lab/scenarios/from-signal` builds a scenario with a prefilled thesis and explicit caveats
- a follow-up backtest can be run from `/ia/trading-lab` against any strategy

The Trading Lab page renders a compact `Signal → Scenario → Strategy → Backtest → Caveats` path preview that walks recent scenarios and visualises the chain without querying Neo4j directly.

## Charts

The Trading Lab page lazy-loads `lightweight-charts` only on the Trading Lab route:

- Equity curve (area chart)
- Drawdown (negative area chart)

Charts are client-only with explicit text fallbacks for SSR / unavailable data / chart load failure (no hydration mismatch, no color-only encoding, ARIA labels included).
