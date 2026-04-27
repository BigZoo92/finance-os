# ADR: Trading Lab & Quant Service

> **Status**: Accepted
> **Date**: 2026-04-26
> **Prompt**: 5
> **Deciders**: Human + Claude (challenger/reviewer)

## Context

Finance-OS needs a research lab for paper-trading, backtesting, and strategy analysis. The goal is serious decision-support and education, not automated trading.

### Requirements
- Paper-trading and backtesting only. No live trading.
- Strategy research with reproducible backtest runs.
- Risk metrics, portfolio analytics, and performance reporting.
- Signal-to-strategy linking (social signals, news, manual hypotheses).
- Knowledge graph integration for strategy memory.
- Financial charting and dataviz.
- Deterministic demo mode fixtures.
- Fail-soft behavior when quant-service is unavailable.

### Constraints
- No broker/exchange credentials.
- No real order placement.
- No execution infrastructure.
- Internal-only services (no public exposure).
- Follow existing patterns (knowledge-service as template).
- Must preserve demo/admin split.

## Decision

### 1. Add `apps/quant-service` as internal Python service

**Yes.** Following the `apps/knowledge-service` pattern:
- FastAPI with Pydantic models
- Internal Docker network only
- No public exposure
- Structured logs with requestId propagation
- Health/version endpoints
- Dockerfile following knowledge-service pattern

**Rationale**: Python ecosystem (NumPy, pandas, vectorbt, QuantStats) is vastly superior to TypeScript for numerical computing, backtesting, and financial analytics. The knowledge-service proves this pattern works well in Finance-OS.

### 2. Python framework: FastAPI

**FastAPI** over Litestar.

**Rationale**: Proven in Finance-OS (knowledge-service uses FastAPI). Pydantic integration, auto-docs, async support, and team familiarity. No reason to introduce a second Python framework.

### 3. Backtesting engine: vectorbt + internal fallback

**Primary**: vectorbt (open, MIT license) for vectorized backtesting.
**Fallback**: Internal deterministic NumPy-based engine for tests/demo when vectorbt is unavailable.

**Rationale**: vectorbt provides high-performance vectorized backtesting with excellent indicator support. MIT license. The internal fallback ensures tests and demo mode work without the full vectorbt stack.

### 4. Analytics: QuantStats + internal metrics

**Primary**: QuantStats (Apache-2.0) for standard portfolio metrics.
**Internal**: Direct computation of core metrics (Sharpe, Sortino, max drawdown, CAGR, Calmar) as fallback.

**Rationale**: QuantStats provides comprehensive metrics with minimal code. Internal implementations ensure independence from any single library.

### 5. Charting: TradingView Lightweight Charts + D3

**Financial charts**: TradingView Lightweight Charts (Apache-2.0) for OHLCV, equity curves, indicators.
**Custom dataviz**: D3 for attention maps, risk waterfalls, knowledge path visualizations.
**Existing charts**: Keep current Recharts-style patterns for KPI tiles.

**Rationale**: TradingView Lightweight Charts is purpose-built for financial data with small bundle size (~45KB). D3 provides flexibility for custom visualizations that financial chart libraries don't cover.

### 6. Data sources: Existing Finance-OS market backbone

**No new data providers.** Use existing EODHD/FRED/Twelve Data data already in PostgreSQL.

**Rationale**: Adding OpenBB or new providers increases complexity without proportional benefit at this stage. The existing market backbone provides sufficient EOD/delayed data for research.

### 7. Storage: PostgreSQL canonical + Knowledge Graph derived

**Canonical**: New PostgreSQL tables for strategies, backtest runs, scenarios, signal links.
**Derived**: Knowledge graph stores strategy concepts, backtest summaries, assumptions, evidence as derived memory.

**Rationale**: Consistent with Finance-OS architecture where PostgreSQL is the source of truth and the knowledge graph enriches/explains.

### 8. Integration: apps/api as safe boundary

```
[apps/web] --proxy--> [apps/api] --internal--> [apps/quant-service]
                                  --internal--> [apps/knowledge-service]
```

- Frontend never calls quant-service directly.
- apps/api validates, authorizes, and proxies.
- Demo mode returns deterministic fixtures from apps/api (no quant-service call).
- Admin mode calls quant-service with fail-soft fallback.

### 9. Live trading prevention

Multiple layers:
1. `TRADING_LAB_PAPER_ONLY=true` env var (no toggle to disable)
2. No broker/exchange credential env vars
3. No execution API endpoints
4. vectorbt used in simulation-only mode
5. All UI surfaces display "Paper Only" / "Simulation" warnings
6. ADR and docs explicitly prohibit execution features

### 10. Fail-soft / Demo / Admin

- **Demo**: Deterministic fixtures for strategies, backtest results, scenarios. No service calls.
- **Admin, quant-service available**: Full backtesting and analytics.
- **Admin, quant-service unavailable**: Graceful degradation. Strategies/scenarios persist. Backtest run returns "quant-service unavailable" error. Previously completed backtest results remain readable.

## Alternatives Considered

| Alternative | Rejected Because |
|-------------|-----------------|
| TypeScript-only backtesting | NumPy/pandas/vectorbt ecosystem is orders of magnitude better for numerical computing |
| Litestar instead of FastAPI | No team familiarity; knowledge-service already uses FastAPI |
| backtesting.py instead of vectorbt | AGPL license; slower; vectorbt is more powerful |
| OpenBB as data layer now | Adds complexity; existing providers are sufficient |
| freqtrade as backtesting engine | GPL license; execution-focused; overkill |
| No Python service (API-only) | Backtesting in TypeScript would be slow, fragile, and miss the Python quant ecosystem |

## Consequences

### Positive
- Serious research capability with proven Python quant libraries
- Reproducible backtests with full parameter/data hash tracking
- Risk-aware by design (walk-forward, overfitting warnings, cost modeling)
- Clean separation from existing Finance-OS services
- Knowledge graph enrichment for strategy memory

### Negative
- Additional service to maintain and deploy
- Python/TypeScript boundary requires careful contract management
- vectorbt learning curve
- Additional Docker container in compose

### Risks
- Over-engineering the Trading Lab beyond what a single user needs
- Temptation to add execution features later (ADR explicitly prohibits this)
- Backtest results being mistaken for predictions (mitigated by caveats everywhere)

## Implementation Notes

- Follow knowledge-service Dockerfile pattern
- Use the same structured logging, requestId propagation, safe error patterns
- Internal port: 8012 (knowledge-service uses 8011)
- Health endpoint required for Docker healthcheck
- Compose integration in both dev and prod configs

## Activation pass (Prompt 5B, 2026-04-27)

- TanStack route tree regenerated via `pnpm --filter @finance-os/web build`; web typecheck and build are clean.
- `lightweight-charts` (Apache-2.0) installed and consumed via lazy dynamic import in client-only chart components (equity curve + drawdown). Bundle is ~259KB lazy chunk, only on Trading Lab routes.
- Backtest pipeline accepts caller-provided OHLCV; falls back to a deterministic synthetic series when none provided (`useDemoData !== false`); rejects with `DATA_UNAVAILABLE` (422) if data is opted out and no provider data exists.
- Backtest run records `marketDataSource` ∈ `{caller_provided, deterministic_fixture, unavailable}`, `paramsHash`, `dataHash`, full metrics, equity curve, drawdowns, trades.
- After successful backtest, a compact summary (no equity curve, no trade list) is auto-sent to `/knowledge/ingest/trading-lab` when `KNOWLEDGE_SERVICE_ENABLED=true` and `TRADING_LAB_GRAPH_INGEST_ENABLED=true`. Fail-soft.
- Attention auto-generation implemented (`POST /dashboard/trading-lab/attention/rebuild`) from signal_item, news_provider_state, signal_ingestion_run failures, trading_lab_backtest_run failures. Idempotent via `dedupeKey`.
- Cockpit "demande attention" card now consumes real attention items in addition to local connection/recommendation/goal heuristics. The Liquid Ether `CockpitHero` is untouched.
- Signal-to-scenario flow added: `POST /dashboard/trading-lab/scenarios/from-signal` creates a paper scenario with prefilled thesis from a signal item.
- Tests: 29 Python (quant-service) + 105 web vitest pass; bun:test files added for OHLCV fixture determinism and graph-ingest payload shape (require bun runtime to execute, not present on this host).
