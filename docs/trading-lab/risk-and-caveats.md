# Trading Lab — Risk & Caveats

## Core Disclaimers

1. **Paper trading only.** No real money is at risk. No live trading is implemented or planned.
2. **No broker connection.** No exchange API keys, no order placement, no execution infrastructure.
3. **Backtests are not predictions.** Historical performance does not guarantee future results.
4. **Technical analysis is experimental.** No technical strategy has a proven, persistent edge for retail use.
5. **Social signals are weak evidence.** A single social post should never be the sole basis for any financial decision.

## Known Biases in Backtesting

| Bias | Description | Mitigation |
|------|-------------|-----------|
| Survivorship bias | Only assets that survived to today are tested | Document assumption, use broad indices |
| Lookahead bias | Using future information in past decisions | Enforce strict data ordering in backtest engine |
| Data snooping | Testing many hypotheses until one "works" | Track tested hypothesis count, enforce OOS testing |
| Overfitting | Strategy tuned to historical noise, not signal | Walk-forward validation, parameter stability checks |
| Transaction costs | Underestimating fees, slippage, spread | Built-in cost modeling with configurable BPS |
| Regime shift | Past market conditions may not repeat | Document regime assumptions per backtest |

## Cost Modeling

Every backtest includes:
- **Fees** (configurable, default 10 BPS)
- **Slippage** (configurable, default 5 BPS)
- **Spread** (configurable, default 2 BPS)

Real-world costs may be higher, especially for illiquid assets.

## Kelly Criterion Warning

The Kelly criterion is implemented as a research reference only. In practice:
- It requires knowing the true edge and odds, which are unknown
- Full Kelly sizing is extremely aggressive
- Real-world practitioners typically use fractional Kelly (1/4 to 1/2)
- Estimation errors can lead to ruin

## ICT/CRT Warning

ICT (Inner Circle Trader) and CRT (Candle Range Theory) concepts are tagged as **experimental**:
- No peer-reviewed academic validation
- Primarily social media-driven
- High survivorship bias in the community
- Unfalsifiable claims are common
- Not recommended as a systematic strategy basis

## Deterministic Finance Engine Priority

The deterministic `packages/finance-engine` remains the source of truth for personal financial advice.
Trading Lab insights are research context that may enrich but never replace engine recommendations.

## Graph Memory Boundary

Strategy concepts, backtest summaries, and scenarios are stored in the knowledge graph as **derived memory**.
The graph enriches understanding but does not make trading decisions.
PostgreSQL remains the canonical store for all Trading Lab data.

## Real OHLCV vs Synthetic Fixture

Real provider data is preferred when configured (`EODHD_API_KEY`, `TWELVEDATA_API_KEY`). When neither is configured, or when the resolution chain fails, the adapter falls back to a deterministic synthetic series. **Every backtest run records the resolved data source and a `fallbackUsed` flag.** The UI displays this prominently; do not interpret synthetic backtest metrics as evidence of real market behaviour.

## Walk-Forward Validation

Walk-forward = rolling out-of-sample validation with `train_bars` / `test_bars` / `step_bars` windows. Outputs:
- `stabilityScore`: lower is more variable across windows
- `degradationRatio`: ratio of mean OOS return to mean IS return; <0 means OOS loses money where IS makes money
- `overfitWarning`: emitted when the relationship is suspicious

Walk-forward reduces overfitting risk **but is not a proof of future performance** — it just stresses the strategy across multiple regimes. A "stable" walk-forward is necessary, not sufficient.

## Signals are Weak Evidence

A single social or news signal is *weak evidence*. The `Créer un scénario papier` action prefills:
- thesis derived from the signal
- explicit invalidation criteria (must be defined before tracking)
- risk notes reminding the operator that signals require corroboration with deterministic data and a challenger model.

Never act on signal-driven scenarios without independent corroboration.
