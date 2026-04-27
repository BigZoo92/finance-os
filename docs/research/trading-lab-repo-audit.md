# Trading Lab Repository & Tool Audit

> **Date**: 2026-04-26
> **Prompt**: 5 (Trading Lab Foundation)
> **Purpose**: Evaluate Python quant/trading repos, charting libraries, and trading concepts for Finance-OS Trading Lab.
> **Constraint**: Paper-trading and backtesting ONLY. No live trading, no broker connections, no exchange API keys.

---

## Evaluation Criteria

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Paper-trading safety | Critical | Must not enable live execution by default |
| License | High | Permissive preferred (MIT, Apache-2.0, BSD) |
| Maturity | High | Stars, maintenance, community, production use |
| Complexity | Medium | Dependency weight, learning curve |
| Finance-OS fit | High | Single-user research lab, not a trading desk |
| Overfitting risk | Medium | Does it encourage or guard against overfitting? |

---

## 1. Python Quant / Data / Backtesting

### 1.1 OpenBB-finance/OpenBB

| Field | Value |
|-------|-------|
| **What** | Open-source investment research platform. Unified API for financial data from multiple providers (Yahoo Finance, EODHD, FRED, etc.). SDK + Terminal. |
| **License** | AGPL-3.0 (Terminal), Apache-2.0 (SDK/Platform) |
| **Maturity** | ~35k+ stars, very active, VC-backed (OpenBB Inc), large community |
| **Strengths** | Massive provider coverage, unified data model, good documentation, active development, Python SDK is clean |
| **Weaknesses** | AGPL-3.0 for terminal is viral; heavy dependency tree; data aggregation focus rather than backtesting; some providers require paid keys; SDK can be complex for simple use cases |
| **Overfitting risk** | Low (data layer, not strategy layer) |
| **Live trading risk** | None (data only, no execution) |
| **Paper-trading support** | N/A (not a backtesting tool) |
| **Python service required** | Yes |
| **Recommendation** | **Later** -- useful as optional data adapter if existing EODHD/FRED/Twelve Data coverage proves insufficient. The Apache-2.0 SDK could be integrated without viral license concerns. Not needed now since Finance-OS already has its own market data backbone. |

### 1.2 ranaroussi/quantstats

| Field | Value |
|-------|-------|
| **What** | Portfolio analytics library. Generates performance/risk metrics and tear sheets from returns series. |
| **License** | Apache-2.0 |
| **Maturity** | ~5k+ stars, moderate maintenance, widely used in quant community |
| **Strengths** | Simple API (`qs.reports.full(returns)`), comprehensive metrics (Sharpe, Sortino, Calmar, max drawdown, VaR, etc.), HTML/PDF report generation, benchmark comparison, lightweight |
| **Weaknesses** | Maintenance can be slow; some metrics assume daily returns; HTML reports are heavy; limited customization of report layout |
| **Overfitting risk** | Low (analytics/reporting, not strategy optimization) |
| **Live trading risk** | None |
| **Paper-trading support** | N/A (analytics only, works on any returns series) |
| **Python service required** | Yes |
| **Recommendation** | **Integrate now** -- lightweight, permissive license, exactly what we need for backtest metrics and performance analytics. Use programmatic API for metrics, skip heavy HTML reports. |

### 1.3 vectorbt / vectorbt.pro

| Field | Value |
|-------|-------|
| **What** | High-performance vectorized backtesting and portfolio analytics library using NumPy/Numba. |
| **License** | vectorbt (open): MIT; vectorbt.pro: proprietary/commercial |
| **Maturity** | ~4.5k+ stars (open), active pro development, strong quant community adoption |
| **Strengths** | Extremely fast vectorized operations, rich indicator library, portfolio simulation, parameter optimization, excellent visualization, composable signal/entry/exit logic |
| **Weaknesses** | Steep learning curve; pro version is paid; open version maintenance slowed as focus shifted to pro; heavy NumPy/Numba dependencies; memory-hungry for large datasets |
| **Overfitting risk** | Medium (parameter optimization can encourage overfitting without discipline) |
| **Live trading risk** | None (simulation only in open version) |
| **Paper-trading support** | Yes, excellent |
| **Python service required** | Yes |
| **Recommendation** | **Integrate now (open version)** -- best vectorized backtesting for a personal research lab. MIT license. Use for core backtesting engine. Keep the pro version as future option. Guard against overfitting by enforcing walk-forward validation and out-of-sample testing. |

### 1.4 backtesting.py (kernc/backtesting.py)

| Field | Value |
|-------|-------|
| **What** | Lightweight event-driven backtesting framework with built-in optimization and interactive plots. |
| **License** | AGPL-3.0 |
| **Maturity** | ~5.5k+ stars, moderate maintenance, popular for education |
| **Strengths** | Very simple API, good for learning, built-in Bokeh plots, optimization support |
| **Weaknesses** | AGPL-3.0 is viral; single-asset only by default; slower than vectorized approaches; limited portfolio-level analysis; event-driven is slower for parameter sweeps |
| **Overfitting risk** | Medium (optimization without guardrails) |
| **Live trading risk** | None |
| **Paper-trading support** | Yes |
| **Python service required** | Yes |
| **Recommendation** | **Not now** -- AGPL license is problematic; vectorbt covers backtesting better and faster with MIT license. Could be inspiration for API design. |

### 1.5 microsoft/qlib

| Field | Value |
|-------|-------|
| **What** | AI-oriented quantitative investment platform. ML pipeline for alpha research, model training, backtesting. |
| **License** | MIT |
| **Maturity** | ~16k+ stars, Microsoft Research backed, very active |
| **Strengths** | Sophisticated ML pipeline, factor research, model management, extensive documentation, research-grade |
| **Weaknesses** | Very complex; designed for institutional/research teams; heavy dependencies; requires significant data preprocessing; overkill for personal use |
| **Overfitting risk** | High (ML-heavy approach requires extreme discipline) |
| **Live trading risk** | None (research-focused) |
| **Paper-trading support** | Yes (simulation) |
| **Python service required** | Yes |
| **Recommendation** | **Later (research inspiration)** -- too heavy for initial Trading Lab. Excellent concepts for future ML-based alpha research. Study their factor framework and walk-forward methodology. |

### 1.6 AI4Finance-Foundation/FinRL

| Field | Value |
|-------|-------|
| **What** | Deep reinforcement learning framework for automated trading. |
| **License** | MIT |
| **Maturity** | ~10k+ stars, academic community, active research |
| **Strengths** | Interesting RL approach, multiple environment support, paper-backed research |
| **Weaknesses** | RL for trading is highly experimental; massive overfitting risk; requires GPU for training; results rarely transfer to live markets; academic rather than production |
| **Overfitting risk** | Very high (RL models overfit aggressively to training data) |
| **Live trading risk** | Low (primarily simulation, but has Alpaca/other broker connectors) |
| **Paper-trading support** | Yes |
| **Python service required** | Yes |
| **Recommendation** | **Not now** -- experimental research inspiration only. RL trading is unproven at personal scale. High overfitting risk. Store as a knowledge graph concept for future investigation. |

### 1.7 AI4Finance-Foundation/FinGPT

| Field | Value |
|-------|-------|
| **What** | Open-source LLM framework for finance. Sentiment analysis, financial NLP, market prediction via LLMs. |
| **License** | MIT |
| **Maturity** | ~14k+ stars, very active, research-focused |
| **Strengths** | Financial sentiment from LLMs, news/social signal analysis, interesting research direction |
| **Weaknesses** | LLM-based predictions are unreliable for trading; high compute cost; experimental; results not reproducible |
| **Overfitting risk** | Very high (LLM outputs are stochastic) |
| **Live trading risk** | None |
| **Paper-trading support** | N/A (analysis tool) |
| **Python service required** | Yes |
| **Recommendation** | **Not now** -- Finance-OS already has its own AI Advisor with OpenAI/Anthropic. FinGPT concepts could inspire future sentiment analysis improvements, but it's not a core dependency. |

### 1.8 shiyu-coder/Kronos

| Field | Value |
|-------|-------|
| **What** | Multi-agent trading system using LLMs for market analysis and strategy generation. |
| **License** | MIT (likely) |
| **Maturity** | Low stars, early-stage research project |
| **Strengths** | Interesting multi-agent architecture concept |
| **Weaknesses** | Very early stage; unproven; LLM-based trading signals are unreliable; minimal documentation |
| **Overfitting risk** | Very high |
| **Live trading risk** | Moderate (designed for trading decisions) |
| **Paper-trading support** | Unclear |
| **Python service required** | Yes |
| **Recommendation** | **Not now** -- too experimental, low maturity. Concept is interesting for future research. |

### 1.9 TauricResearch/TradingAgents

| Field | Value |
|-------|-------|
| **What** | Multi-agent LLM trading system inspired by real trading firms (analyst, quant, risk manager, trader roles). |
| **License** | MIT |
| **Maturity** | ~2k+ stars, recent, research-stage |
| **Strengths** | Interesting role-based agent architecture; mimics institutional workflow |
| **Weaknesses** | Experimental; LLM agents making trading decisions is unproven; high cost per run; no proven edge |
| **Overfitting risk** | Very high |
| **Live trading risk** | Moderate |
| **Paper-trading support** | Simulation-focused |
| **Python service required** | Yes |
| **Recommendation** | **Not now** -- research inspiration for future multi-agent advisory patterns. The role decomposition (analyst/quant/risk/trader) is a good mental model but should not drive real decisions. |

### 1.10 hsliuping/TradingAgents-CN

| Field | Value |
|-------|-------|
| **What** | Chinese localization/fork of TradingAgents concept. |
| **License** | Unknown |
| **Maturity** | Low |
| **Strengths** | Chinese market focus |
| **Weaknesses** | Fork with unclear maintenance; language barrier |
| **Recommendation** | **Not relevant** -- same concerns as TradingAgents, with localization overhead. |

### 1.11 virattt/ai-hedge-fund

| Field | Value |
|-------|-------|
| **What** | Educational AI hedge fund simulator using multiple LLM-powered agents (Warren Buffett, Jim Simons, etc.). |
| **License** | MIT |
| **Maturity** | ~10k+ stars, viral educational project |
| **Strengths** | Great for learning agent patterns; entertaining; well-documented; clear educational intent |
| **Weaknesses** | Explicitly not for real trading; agent personas are gimmicky; no proven edge; entertainment-first |
| **Overfitting risk** | N/A (educational) |
| **Live trading risk** | None (explicitly disclaimed) |
| **Paper-trading support** | Simulation only |
| **Python service required** | Yes |
| **Recommendation** | **Not now** -- interesting educational reference. The multi-perspective analysis pattern (bullish vs bearish vs risk-aware agents) could inspire advisor challenger improvements. Not a dependency. |

### 1.12 ZhuLinsen/daily_stock_analysis

| Field | Value |
|-------|-------|
| **What** | Daily stock analysis automation using AI/LLMs. |
| **License** | Unknown |
| **Maturity** | Low-moderate |
| **Strengths** | Simple daily analysis pipeline concept |
| **Weaknesses** | Narrow scope; minimal documentation; not a library |
| **Recommendation** | **Not relevant** -- Finance-OS already has a more sophisticated daily advisor pipeline. |

### 1.13 Fincept-Corporation/FinceptTerminal

| Field | Value |
|-------|-------|
| **What** | Terminal-based financial data platform. |
| **License** | MIT |
| **Maturity** | Low-moderate |
| **Strengths** | Good TUI concept for financial data |
| **Weaknesses** | Terminal-focused, not library-friendly; limited scope |
| **Recommendation** | **Not relevant** -- Finance-OS is a web app, not a terminal. |

### 1.14 arteemg/AutoHypothesis

| Field | Value |
|-------|-------|
| **What** | Agentic quantitative finance research framework. Automated hypothesis generation and testing. |
| **License** | MIT (likely) |
| **Maturity** | Early stage, low stars |
| **Strengths** | Interesting hypothesis-driven approach; automated research pipeline concept |
| **Weaknesses** | Very early; unproven; automated hypothesis generation risks data snooping |
| **Overfitting risk** | Very high (automated hypothesis generation = data snooping risk) |
| **Live trading risk** | Low |
| **Paper-trading support** | Research-focused |
| **Python service required** | Yes |
| **Recommendation** | **Not now** -- concept is interesting but the automated hypothesis generation is a data snooping risk. Could inform future research methodology. |

### 1.15 freqtrade/freqtrade

| Field | Value |
|-------|-------|
| **What** | Crypto and general trading bot framework. Strategy development, backtesting, and live/paper trading. |
| **License** | GPL-3.0 |
| **Maturity** | ~32k+ stars, very active, large community, production-used |
| **Strengths** | Excellent strategy framework; great backtesting; built-in paper trading mode; comprehensive docs; hyperoptimization; FreqUI dashboard |
| **Weaknesses** | GPL-3.0 is viral; primarily crypto-focused; execution-adjacent (live trading is core feature); complex configuration; heavy dependencies |
| **Overfitting risk** | Medium-High (hyperopt can overfit without discipline) |
| **Live trading risk** | **High** -- live trading is a core feature. Exchange API key management is built-in. |
| **Paper-trading support** | Yes, excellent dry-run mode |
| **Python service required** | Yes |
| **Recommendation** | **Inspiration only** -- excellent architecture and strategy pattern to study, but GPL license + live trading core = do not integrate. Study their strategy interface, backtesting methodology, and hyperopt guardrails. |

### 1.16 hummingbot/hummingbot

| Field | Value |
|-------|-------|
| **What** | Open-source market making and trading bot framework. |
| **License** | Apache-2.0 |
| **Maturity** | ~8k+ stars, active, VC-backed |
| **Strengths** | Good architecture; market making strategies; DEX/CEX support |
| **Weaknesses** | Primarily execution-focused; market making is advanced; complex setup; live trading is the primary use case |
| **Overfitting risk** | Low (market making is different from directional trading) |
| **Live trading risk** | **Very high** -- live execution is the primary purpose |
| **Paper-trading support** | Yes (paper trading mode) |
| **Python service required** | Yes |
| **Recommendation** | **Not now** -- execution-focused, not research-focused. Market making concepts are interesting but out of scope for a personal research lab. |

### 1.17 jesse-ai/jesse

| Field | Value |
|-------|-------|
| **What** | Python trading framework for crypto backtesting and live trading. |
| **License** | MIT |
| **Maturity** | ~6k+ stars, active |
| **Strengths** | Clean strategy API; good backtesting; optimization support |
| **Weaknesses** | Crypto-focused; live trading built-in; smaller community than freqtrade |
| **Overfitting risk** | Medium |
| **Live trading risk** | **High** -- live trading is a core feature |
| **Paper-trading support** | Yes |
| **Python service required** | Yes |
| **Recommendation** | **Not now** -- same concerns as freqtrade but with MIT license. Study their strategy interface design. |

### 1.18 juspay/hyperswitch

| Field | Value |
|-------|-------|
| **What** | Open-source payment orchestration platform (Stripe/Adyen/etc. aggregation). |
| **License** | Apache-2.0 |
| **Maturity** | ~13k+ stars, very active, production-grade |
| **Strengths** | Excellent payment infrastructure |
| **Weaknesses** | **Completely irrelevant** for a trading research lab. This is payment processing, not trading. |
| **Recommendation** | **Not relevant** -- payment orchestration, not trading/finance research. Only relevant if Finance-OS ever needs multi-provider payment processing, which is out of scope. |

---

## 2. Charting / Dataviz

### 2.1 TradingView Lightweight Charts

| Field | Value |
|-------|-------|
| **What** | High-performance financial charting library by TradingView. Candlestick, line, area, histogram, bar charts. |
| **License** | Apache-2.0 |
| **Maturity** | ~9k+ stars, TradingView-backed, widely used in fintech |
| **Strengths** | Purpose-built for financial data; excellent performance; small bundle (~45KB); candlestick/OHLCV native; mobile-friendly; dark theme support; plugin system |
| **Weaknesses** | Financial charts only (not general dataviz); limited customization compared to D3; fewer chart types than full TradingView |
| **Recommendation** | **Integrate now** -- perfect for OHLCV/candle charts, equity curves, and indicator overlays in Trading Lab. |

### 2.2 D3.js

| Field | Value |
|-------|-------|
| **What** | Low-level data visualization library. Maximum flexibility for custom visualizations. |
| **License** | ISC |
| **Maturity** | ~110k+ stars, gold standard for custom dataviz |
| **Strengths** | Unlimited flexibility; any visualization possible; excellent for custom risk/signal/knowledge visualizations |
| **Weaknesses** | Steep learning curve; verbose; not React-native; requires significant code for each visualization |
| **Recommendation** | **Use selectively** -- for custom visualizations (attention map, risk waterfall, knowledge paths) where TradingView/Recharts don't fit. Don't use for standard charts. |

### 2.3 Existing Finance-OS chart stack

The app already uses Recharts-style patterns for KPI/dashboard visualizations. Keep existing charts, add TradingView Lightweight Charts for financial-specific needs, and D3 for custom dataviz only when needed.

---

## 3. Summary Decision Matrix

| Tool | Decision | Timeline | Role in Finance-OS |
|------|----------|----------|-------------------|
| **vectorbt (open)** | Integrate | Now | Core backtesting engine |
| **QuantStats** | Integrate | Now | Portfolio analytics/metrics |
| **TradingView Lightweight Charts** | Integrate | Now | Financial chart rendering |
| **D3** | Use selectively | Now | Custom dataviz (risk, attention, knowledge) |
| **OpenBB SDK** | Monitor | Later | Optional data adapter |
| **Qlib** | Study | Later | ML alpha research patterns |
| **backtesting.py** | Skip | -- | AGPL license, vectorbt is better |
| **freqtrade** | Inspiration | -- | Strategy pattern study only |
| **jesse** | Inspiration | -- | Strategy API design study |
| **FinRL** | Skip | -- | Too experimental, high overfitting |
| **FinGPT** | Skip | -- | Finance-OS has own AI stack |
| **Kronos** | Skip | -- | Too early, unproven |
| **TradingAgents** | Skip | -- | Research inspiration only |
| **ai-hedge-fund** | Skip | -- | Educational reference only |
| **AutoHypothesis** | Skip | -- | Data snooping risk |
| **hummingbot** | Skip | -- | Execution-focused |
| **hyperswitch** | Skip | -- | Irrelevant (payments) |

---

## 4. Architecture Implications

### Selected Stack for Trading Lab
1. **Backtesting**: vectorbt (MIT) as primary engine, with thin internal fallback for tests/demo
2. **Analytics**: QuantStats (Apache-2.0) for metrics, with internal implementations as fallback
3. **Financial Charts**: TradingView Lightweight Charts (Apache-2.0)
4. **Custom Dataviz**: D3 where needed
5. **Data**: Existing Finance-OS market backbone (EODHD/FRED/Twelve Data), no new data providers yet

### Python Service Decision
- **Yes, add `apps/quant-service`** as an internal-only Python FastAPI service
- Follows the same pattern as `apps/knowledge-service`
- Internal Docker network only, no public exposure
- Frontend never calls it directly; `apps/api` is the safe boundary

### Key Risk Mitigations
- vectorbt runs in simulation-only mode (no execution backends)
- No broker/exchange credential management
- All strategies tagged with experimental/trust levels
- Walk-forward validation enforced
- Overfitting warnings built into every backtest result
- `TRADING_LAB_PAPER_ONLY=true` enforced at env level

---

## 5. Trading Concepts Audit

### 5.1 Proven / Well-Established

| Concept | Status | Notes |
|---------|--------|-------|
| Buy & Hold | Benchmark | Standard benchmark, not a strategy |
| EMA/SMA | Established | Trend-following foundation, simple but effective as filters |
| RSI | Established | Momentum oscillator, well-studied |
| MACD | Established | Trend + momentum combo, widely used |
| Support/Resistance | Established | Core technical concept, implementation varies |
| Trend Following | Established | One of few documented long-term edges (in futures/FX) |
| Mean Reversion | Established | Documented edge in equities at certain timeframes |
| Momentum | Established | Academic factor, documented cross-sectional premium |
| Position Sizing | Established | Risk management fundamental |
| Stop-Loss | Established | Risk management fundamental |

### 5.2 Experimental / Not Proven

| Concept | Status | Key Caveat |
|---------|--------|------------|
| ICT/CRT | **Experimental** | Social media-driven, no academic validation, unfalsifiable claims, high survivorship bias in community |
| Volume Profile | Moderate | Useful market microstructure tool, but edge is debatable |
| ORB (Opening Range Breakout) | Moderate | Some academic support for intraday, highly dependent on market regime |
| Parabolic SAR | Moderate | Useful for trailing stops, poor as standalone signal |
| RCI (Rank Correlation Index) | Moderate | Japanese quant tool, limited Western academic study |
| Volatility Regime Detection | Established | Well-studied, but regime changes are only identifiable in hindsight |

### 5.3 Critical Risk Concepts

| Concept | Importance | Must-implement |
|---------|-----------|----------------|
| Survivorship Bias | Critical | Yes -- warn in every backtest |
| Lookahead Bias | Critical | Yes -- enforce in data pipeline |
| Data Snooping | Critical | Yes -- track tested hypotheses count |
| Overfitting | Critical | Yes -- walk-forward + OOS testing |
| Transaction Costs | Critical | Yes -- fees/slippage/spread modeling |
| Backtest vs Live Gap | Critical | Yes -- document in every result |
| Regime Shift | High | Yes -- note assumption of stationarity |
| Walk-Forward Validation | High | Yes -- implement as standard |
| Kelly Criterion | Medium | Implement with strong caveat (theoretical, assumes known edge) |
