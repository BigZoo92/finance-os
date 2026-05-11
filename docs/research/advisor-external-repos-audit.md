# PR13 — External Repositories Audit for Finance-OS Advisor

> **Status**: research / documentation only — no runtime code, no UI, no DB, no LLM, no provider, no graph, no worker, no execution.
> **Date**: 2026-05-08
> **Scope**: 30 distinct GitHub repositories + 15 concepts collected for the Finance-OS AI Advisor.
>
> **Macro Prompt 6 annotation (2026-05-10).** The Advisor v2 committee skeleton shipped in
> Macro Prompt 6 (`apps/api/src/routes/dashboard/domain/advisor/v2/committee-types.ts`)
> borrows **role-naming inspiration only** from `TauricResearch/TradingAgents` (§3.C.2) and
> `virattt/ai-hedge-fund` (§3.C.5). No code, no prompt, and no runtime behavior was reused.
> The Finance-OS committee is deterministic, advisory-only, and ships with five hard-coded
> forbidden roles (`executor`, `trader`, `order_manager`, `portfolio_manager_with_execution`,
> `broker_operator`) precisely because those external repos sometimes encode execution
> personas. Finance-OS remains structurally unable to express such a role.
>
> The user-supplied list contained 32 entries that resolved to **30 distinct repositories**:
> 1. `jesses-ai/jesse` returned 404 — it is a typo for the canonical `jesse-ai/jesse`. We audit the canonical entry. Net: 1 entry, 1 repo.
> 2. `tauricresearch/tradingagents` and `TauricResearch/TradingAgents` are the same repository (GitHub usernames are case-insensitive for routing). Net: 2 entries, 1 repo.
> **Companion file**: [`advisor-external-repos-decision-matrix.md`](./advisor-external-repos-decision-matrix.md)

---

## 0. Methodology

- **Data sources**: GitHub REST API (`GET /repos/{owner}/{name}`) for license, primary language, archived flag, last `pushed_at`, stargazers, public description. All 32 user-supplied entries were resolved as of **2026-05-08**, yielding **30 distinct repositories** (see scope note above).
- **What I add on top of READMEs**: every entry carries a Finance-OS-specific decision (integrate / adapt pattern / research only / avoid / later), a target Finance-OS area, and an integration-risk + ToS / license note. The intent is decision support, not summary.
- **Confidence levels**:
  - **Verified**: license, language, last activity, star count from the GitHub API at the date above.
  - **Inferred**: characterization of internals beyond the repo description (e.g. "uses asyncio", "has a backtest harness") is drawn from training-cutoff knowledge of well-known projects and explicit description text. Anything not directly verifiable is flagged as **needs review**.
- **Safety stance is non-negotiable**: see §1.

## 1. Hard safety framing (do not skip)

Finance-OS is, and remains, **advisory-only / paper-only / research-only**. This audit applies the following non-negotiable rules to every single recommendation in this document:

1. **Trading execution stays disabled.** No repository in this audit is integrated as a live execution engine. The `trading_lab_paper_only` env flag is unchanged.
2. **No bot/execution repo is integrated as-is.** Even when a repo's pattern is useful, the integration must extract only the *paper-side* abstractions (signal generation, backtest harness, metrics computation, journal capture). The live-broker code path is out of scope by ADR.
3. **No strategy or technical concept is treated as a proven edge.** SMC patterns, EMA200 one-touch, Parabolic+RCI, etc., are research hypotheses surfaced via the deterministic detectors shipped in PR10–PR12. They must be backtested AND scorecarded before any human "promote to paper" decision is taken.
4. **RL / LLM trading agents are research candidates, not production trading systems.** Any committee/agent pattern adopted goes through the existing PR4 post-mortem + PR2 deterministic-eval guardrails. The LLM never receives live execution authority and is structurally prevented from emitting execution-shaped output (see PR4 strict execution-vocabulary scanner).
5. **License risk gates integration.** GPL-3.0 / NOASSERTION / "none" repos cannot be integrated into the Finance-OS codebase as a library or copied verbatim — only patterns may be **re-implemented** under the project's own license, and only with a written attribution paper-trail.
6. **ToS risk gates use as a data source.** Wrappers around undocumented internal endpoints (TradingView, Google Finance) are not adopted as runtime providers. They may be used for offline research only, on the user's personal account, and never against an end-user-facing flow.

If a recommendation later in this document appears to contradict any of the above, treat the safety rule as authoritative and the recommendation as a writing error.

## 2. Definitions used in this audit

| Term | Meaning |
|---|---|
| **integrate** | We will reuse this repo's code (as a dependency or vendored module) in Finance-OS production runtime. Highest bar. |
| **adapt pattern** | We will copy the *idea*, re-implement under our license, and integrate the re-implementation. We do NOT take the upstream code. |
| **research only** | Read, learn, and document; do not import, fork, or rebuild. Useful for orientation. |
| **avoid** | Do not use as a runtime dependency under any circumstance. May or may not be useful as a *historical* read; flag the reason. |
| **later** | Defer. Revisit when a specific Finance-OS PR creates the need. |
| **execution risk** | Likelihood that copying the pattern leads to live-trading code paths if not deliberately scoped. |

## 3. Repository audit

Each entry follows the same 15-field structure required by the spec. Verification metadata at the top of every entry is from the 2026-05-08 GitHub API run unless stated otherwise.

### 3.A — Core data / terminal / finance platform

#### 3.A.1 — OpenBB-finance/OpenBB

1. **URL** (user-provided org/name): https://github.com/OpenBB-finance/OpenBB
2. **License**: NOASSERTION (per GitHub API). README states AGPL-3.0 for the core CLI / SDK. **Treat as AGPL-equivalent until verified by counsel.**
3. **Activity**: very active (last push 2026-05-08).
4. **Main purpose**: financial data platform — unifies hundreds of equity / macro / news / on-chain providers behind a Python SDK + CLI + optional terminal UI.
5. **Stack**: Python; FastAPI internally; pandas-first.
6. **Live trading / execution**: no live brokerage execution surface in core; the OpenBB Trading extension is paper / signals oriented.
7. **Backtesting / paper trading**: yes — extensions exist; not the core focus.
8. **Analytics / risk metrics**: extensive (Sharpe, Sortino, drawdowns, VaR, factor analysis, etc.) via SDK calls.
9. **Agentic / LLM**: yes — recently added agent / "AI agent friendly" surface; **not an LLM trading committee**, more a tool-use surface.
10. **Data-source integration**: **the** main value — provider abstraction over yfinance, FMP, Polygon, EODHD, Intrinio, Benzinga, and many others, with one normalized API.
11. **Value for Finance-OS**: **high** — Finance-OS already has a hand-rolled provider abstraction (Powens, IBKR, Binance, FRED, EODHD, Twelve Data). OpenBB's *abstraction architecture* is the gold standard to compare against.
12. **Integration risk**: **medium** — heavy dependency tree (pandas, plotly, FastAPI), AGPL contamination if linked as code.
13. **Security / ToS / provider-risk**: depends on which providers are enabled inside OpenBB. Each provider has its own ToS; OpenBB itself does not bypass any.
14. **Recommended decision**: **adapt pattern** — borrow the provider-abstraction architecture, **do not** add openbb as a runtime dep.
15. **Target Finance-OS area**: Data Providers + Quant Service.

#### 3.A.2 — Fincept-Corporation/FinceptTerminal

1. **URL**: https://github.com/Fincept-Corporation/FinceptTerminal
2. **License**: NOASSERTION — needs clarification.
3. **Activity**: very active (2026-05-06).
4. **Main purpose**: desktop-style finance terminal (analytics, market scanning, research, economic data).
5. **Stack**: Python.
6. **Live execution**: not advertised as a broker engine; orient as an analyst terminal.
7. **Backtesting**: peripheral.
8. **Analytics**: yes — fundamentals, macro, scanners, news.
9. **Agentic / LLM**: not the focus.
10. **Data integration**: aggregator of public + free-tier providers.
11. **Value for Finance-OS**: **low–medium** — UI/UX inspiration for the analyst desktop, not the architecture.
12. **Integration risk**: high — license unclear; tight coupling to its own provider list.
13. **ToS / provider-risk**: depends on which scrapers are enabled — needs review per provider.
14. **Recommended decision**: **research only** — UI patterns to compare against the Finance-OS cockpit DESIGN.
15. **Target area**: UI/UX (read-only inspiration).

#### 3.A.3 — KilimcininKorOglu/Google-Finance-Api

1. **URL**: https://github.com/KilimcininKorOglu/Google-Finance-Api
2. **License**: MIT.
3. **Activity**: 2026-05-02; small repo (26 stars).
4. **Main purpose**: zero-dependency Go wrapper around Google Finance's *internal RPC endpoint*; no API key required.
5. **Stack**: Go.
6. **Live execution**: no.
7. **Backtesting**: no.
8. **Analytics**: minimal.
9. **Agentic / LLM**: no.
10. **Data integration**: read-only, screen-scraping Google Finance's undocumented backend.
11. **Value for Finance-OS**: low.
12. **Integration risk**: medium.
13. **ToS / provider-risk**: **high** — Google Finance does not expose a public API. Hitting an internal RPC at scale violates Google's general ToS and is at risk of breaking on any frontend redeploy.
14. **Recommended decision**: **avoid** as a runtime dependency. Acceptable for one-off offline research lookups by a developer on their own account.
15. **Target area**: Not applicable.

#### 3.A.4 — Mathieu2301/TradingView-API

1. **URL**: https://github.com/Mathieu2301/TradingView-API
2. **License**: **none** (= all rights reserved by default under copyright law).
3. **Activity**: 2026-04-11; 3,400 stars; JavaScript/Node.
4. **Main purpose**: real-time stock + indicator data scraped from TradingView's WebSocket feed.
5. **Stack**: Node.js.
6. **Live execution**: no.
7. **Backtesting**: no.
8. **Analytics**: depends on the user's TradingView indicators.
9. **Agentic / LLM**: no.
10. **Data integration**: TradingView (unofficial WS endpoint).
11. **Value for Finance-OS**: low.
12. **Integration risk**: high.
13. **ToS / provider-risk**: **high** — TradingView's ToS prohibits unauthorized access to its data feeds. Using this in a product against end-users likely breaches §3 of TradingView's Terms.
14. **Recommended decision**: **avoid**.
15. **Target area**: Not applicable.

#### 3.A.5 — deepentropy/tvscreener

1. **URL**: https://github.com/deepentropy/tvscreener
2. **License**: Apache-2.0.
3. **Activity**: 2026-03-28; 1,025 stars.
4. **Main purpose**: TradingView Screener wrapper — query the public screener for stocks/crypto/forex/bonds/futures/coins.
5. **Stack**: JavaScript.
6. **Live execution**: no.
7. **Backtesting**: no.
8. **Analytics**: no.
9. **Agentic / LLM**: no.
10. **Data integration**: TradingView screener (unofficial endpoint, less aggressive than TradingView-API).
11. **Value for Finance-OS**: low–medium — the *screener concept* (rule-based universe filtering) is interesting for Hypothesis Lab.
12. **Integration risk**: medium.
13. **ToS / provider-risk**: medium — same root concern as 3.A.4 but the screener public surface is less sensitive.
14. **Recommended decision**: **research only** — borrow the rule schema, do not integrate the JS client.
15. **Target area**: Trading Lab.

### 3.B — Quant / backtesting / analytics

#### 3.B.1 — microsoft/qlib

1. **URL**: https://github.com/microsoft/qlib
2. **License**: MIT.
3. **Activity**: 2026-04-22; 42,256 stars.
4. **Main purpose**: AI-oriented quant research platform — data lake, factor research, ML-backtest pipeline.
5. **Stack**: Python; PyTorch.
6. **Live execution**: limited; orientation is research / paper.
7. **Backtesting**: extensive — its core value.
8. **Analytics**: full risk-metric suite.
9. **Agentic / LLM**: not by default; an `RD-Agent` companion exists separately.
10. **Data integration**: bring-your-own; ships with crypto/equity loaders.
11. **Value for Finance-OS**: **high** — its `factor → model → backtest → evaluation` pipeline is exactly the architecture our Hypothesis Lab → Backtest → Scorecard flow already mirrors.
12. **Integration risk**: medium — heavy ML stack, but the *architecture* can be re-implemented at small scale.
13. **ToS / provider-risk**: low.
14. **Recommended decision**: **adapt pattern** — pipeline shape only.
15. **Target area**: Quant Service + Trading Lab.

#### 3.B.2 — QuantConnect/Lean

1. **URL**: https://github.com/QuantConnect/Lean
2. **License**: Apache-2.0.
3. **Activity**: 2026-05-08; 18,863 stars.
4. **Main purpose**: open-source Algorithmic Trading Engine — backtests + live trading via brokerage adapters (IB, Tradier, Coinbase, Binance, …).
5. **Stack**: C# (cross-runtime), Python wrappers.
6. **Live execution**: **yes — full live broker engine.**
7. **Backtesting**: extensive.
8. **Analytics**: yes — Sharpe, drawdown, exposure, per-trade.
9. **Agentic / LLM**: no.
10. **Data integration**: many.
11. **Value for Finance-OS**: **high — for architecture only**. The clean separation between `Algorithm`, `Backtest`, `Live`, and the `Brokerage` abstraction is the canonical reference for "how to keep paper and live distinct".
12. **Integration risk**: **high** if mixed in. The repo *contains* live execution code paths; any adoption beyond architectural reading creates execution risk.
13. **ToS / provider-risk**: low.
14. **Recommended decision**: **adapt pattern** — copy the conceptual separation only. **Do NOT** vendor any Lean adapter that produces broker-side orders.
15. **Target area**: Quant Service + Trading Lab (architecture only).

#### 3.B.3 — ranaroussi/quantstats

1. **URL**: https://github.com/ranaroussi/quantstats
2. **License**: Apache-2.0.
3. **Activity**: 2026-01-13; 7,084 stars.
4. **Main purpose**: portfolio analytics — Sharpe, Sortino, Omega, Calmar, MAR, tail ratio, drawdown clustering, rolling stats, monthly heatmaps.
5. **Stack**: Python; pandas.
6. **Live execution**: no.
7. **Backtesting**: no — analytics only.
8. **Analytics**: **the** value here, very thorough.
9. **Agentic / LLM**: no.
10. **Data integration**: BYO returns series.
11. **Value for Finance-OS**: **very high** — the PR12 scorecard already implements a small subset (winRate, profitFactor, sharpe, maxDrawdown, sortino). QuantStats has roughly 10× more metrics with battle-tested formulas.
12. **Integration risk**: **low** — pure-Python, pandas-native, fits inside `apps/quant-service`.
13. **ToS / provider-risk**: low.
14. **Recommended decision**: **adapt pattern** — port the most decision-relevant metrics into the Strategy Scorecard pipeline under our license. (See proposed PR14 below — **shipped** as additive `advancedMetrics` field on `GET /dashboard/trading-lab/strategies/:id/scorecard`, re-implemented in TypeScript inside `apps/api/src/routes/dashboard/domain/trading-lab/scorecard/compute-advanced-risk-metrics.ts`. QuantStats remains **not** a runtime dependency; no source vendored.)
15. **Target area**: Quant Service + Hypothesis Lab Scorecards.

#### 3.B.4 — AI4Finance-Foundation/FinRL

1. **URL**: https://github.com/AI4Finance-Foundation/FinRL
2. **License**: MIT.
3. **Activity**: 2026-04-05; 15,092 stars.
4. **Main purpose**: financial reinforcement learning library — environments, agents (PPO, DQN, A3C…), benchmarks.
5. **Stack**: Python; Stable-Baselines3 / Ray RLlib.
6. **Live execution**: tutorials show paper-broker integrations; not a default path.
7. **Backtesting**: yes — gym-style env.
8. **Analytics**: standard.
9. **Agentic / LLM**: no — RL agents only.
10. **Data integration**: yfinance + Alpaca patterns.
11. **Value for Finance-OS**: **medium-low** — RL adds large training cost and reward-hacking risk; we don't yet need a learned policy. The `AdvisorSnapshot` shape could however serve as a `FinRL`-compatible observation.
12. **Integration risk**: high (training infra, policy drift, GPU, validation cost).
13. **ToS / provider-risk**: low.
14. **Recommended decision**: **research only / later** — revisit only when (a) Hypothesis Lab has produced 50+ scored backtests and (b) the deterministic evals consistently show a robustness ceiling.
15. **Target area**: Quant Service (long-term).

#### 3.B.5 — Lumiwealth/lumibot

1. **URL**: https://github.com/Lumiwealth/lumibot
2. **License**: **GPL-3.0** ⚠️
3. **Activity**: 2026-05-08; 1,458 stars.
4. **Main purpose**: backtesting + live trading framework (crypto, stocks, options, futures, FX).
5. **Stack**: Python.
6. **Live execution**: **yes — multi-broker live execution.**
7. **Backtesting**: yes.
8. **Analytics**: standard.
9. **Agentic / LLM**: no.
10. **Data integration**: Yahoo, Polygon, Alpaca, IBKR, Tradier.
11. **Value for Finance-OS**: medium — backtest API is clean.
12. **Integration risk**: **very high** — live execution AND GPL-3.0 contamination risk if linked.
13. **ToS / provider-risk**: per broker.
14. **Recommended decision**: **avoid** as a runtime dep. **Research only** for backtest API ergonomics.
15. **Target area**: Quant Service (read-only inspiration).

#### 3.B.6 — jesse-ai/jesse  *(user-supplied path `jesses-ai/jesse` is incorrect — corrected here)*

1. **URL**: https://github.com/jesse-ai/jesse  (the user-supplied `jesses-ai/jesse` returned 404 from GitHub; this entry uses the canonical owner `jesse-ai`).
2. **License**: MIT.
3. **Activity**: 2026-05-08; 7,853 stars.
4. **Main purpose**: advanced crypto trading bot (Python, despite GitHub's "JavaScript" tag from web bundle).
5. **Stack**: Python (engine) + JS dashboard.
6. **Live execution**: yes.
7. **Backtesting**: yes — its strength.
8. **Analytics**: solid.
9. **Agentic / LLM**: no.
10. **Data integration**: ccxt-style exchange adapters.
11. **Value for Finance-OS**: medium — strategy notation (entry/exit conditions as method overrides) is a clean DSL we can compare against PR3's hypothesis form.
12. **Integration risk**: high — execution paths are first-class.
13. **ToS / provider-risk**: per exchange.
14. **Recommended decision**: **research only** — strategy DSL inspiration.
15. **Target area**: Trading Lab (read-only inspiration).

#### 3.B.7 — freqtrade/freqtrade

1. **URL**: https://github.com/freqtrade/freqtrade
2. **License**: **GPL-3.0** ⚠️
3. **Activity**: 2026-05-08; 49,991 stars.
4. **Main purpose**: free open-source crypto trading bot.
5. **Stack**: Python.
6. **Live execution**: **yes — primary use case.**
7. **Backtesting**: yes — well-developed.
8. **Analytics**: yes.
9. **Agentic / LLM**: optional FreqAI module.
10. **Data integration**: ccxt.
11. **Value for Finance-OS**: medium — hyperopt + walk-forward harness is mature.
12. **Integration risk**: **very high** — execution-heavy AND GPL-3.0.
13. **ToS / provider-risk**: per exchange.
14. **Recommended decision**: **avoid** runtime; **research only** for the hyperopt + walk-forward CLI ergonomics.
15. **Target area**: Quant Service (read-only inspiration).

#### 3.B.8 — hummingbot/hummingbot

1. **URL**: https://github.com/hummingbot/hummingbot
2. **License**: Apache-2.0.
3. **Activity**: 2026-05-08; 18,496 stars.
4. **Main purpose**: high-frequency crypto market-making + arbitrage bot framework.
5. **Stack**: Python + Cython.
6. **Live execution**: **yes — primary use case (HFT-leaning).**
7. **Backtesting**: limited (HFT is hard to backtest faithfully).
8. **Analytics**: standard.
9. **Agentic / LLM**: no.
10. **Data integration**: many CEX/DEX connectors.
11. **Value for Finance-OS**: low — HFT/market-making is way out of advisory-only scope.
12. **Integration risk**: very high.
13. **ToS / provider-risk**: per exchange.
14. **Recommended decision**: **avoid**.
15. **Target area**: Not applicable.

#### 3.B.9 — brokermr810/QuantDinger

1. **URL**: https://github.com/brokermr810/QuantDinger
2. **License**: Apache-2.0.
3. **Activity**: 2026-05-08; 3,955 stars.
4. **Main purpose**: AI quant trading platform (crypto/stocks/forex) with backtesting, live trading, market data, multi-agent research. Description hints at "vibe-trading"-style framing.
5. **Stack**: Python.
6. **Live execution**: yes.
7. **Backtesting**: yes.
8. **Analytics**: yes.
9. **Agentic / LLM**: yes — multi-agent research.
10. **Data integration**: multi-source.
11. **Value for Finance-OS**: medium — "multi-agent research + backtest" architecture is close to what we already have separated across Advisor + Hypothesis Lab + Quant Service.
12. **Integration risk**: high — execution + LLM coupling.
13. **ToS / provider-risk**: needs review.
14. **Recommended decision**: **research only** — architectural diff against Finance-OS, then discard.
15. **Target area**: Advisor (architectural read).

#### 3.B.10 — 0xemmkty/QuantMuse

1. **URL**: https://github.com/0xemmkty/QuantMuse
2. **License**: MIT.
3. **Activity**: 2025-07-29; 2,457 stars. **Last push is older (~10 months) — semi-dormant.**
4. **Main purpose**: comprehensive quantitative trading system with AI analysis + real-time data + advanced risk management.
5. **Stack**: Python.
6. **Live execution**: yes.
7. **Backtesting**: yes.
8. **Analytics**: yes.
9. **Agentic / LLM**: yes.
10. **Data integration**: multi-source.
11. **Value for Finance-OS**: low — overlaps with QuantDinger but appears stale.
12. **Integration risk**: high.
13. **ToS / provider-risk**: needs review.
14. **Recommended decision**: **avoid** — dormant + execution-heavy.
15. **Target area**: Not applicable.

#### 3.B.11 — shiyu-coder/Kronos

1. **URL**: https://github.com/shiyu-coder/Kronos
2. **License**: MIT.
3. **Activity**: 2026-04-13; 23,663 stars.
4. **Main purpose**: foundation model for "the language of financial markets" — a transformer-based price/sequence model intended as a research base.
5. **Stack**: Python (PyTorch).
6. **Live execution**: no.
7. **Backtesting**: research-grade examples.
8. **Analytics**: model evaluation only.
9. **Agentic / LLM**: foundation-model approach (not chat-LLM).
10. **Data integration**: training corpora.
11. **Value for Finance-OS**: **research only / later**. Compelling as a future signal source IFF and only IFF Finance-OS first ships a robust evaluation harness (PR2 evals are the gate).
12. **Integration risk**: high — large model, GPU.
13. **ToS / provider-risk**: low.
14. **Recommended decision**: **research only / later** — track as a long-term candidate for PR2 evals.
15. **Target area**: Quant Service (long-term).

### 3.C — Financial AI / agents / research

#### 3.C.1 — AI4Finance-Foundation/FinGPT

1. **URL**: https://github.com/AI4Finance-Foundation/FinGPT
2. **License**: MIT.
3. **Activity**: 2026-04-24; 19,984 stars.
4. **Main purpose**: open-source financial LLMs — pre-trained / fine-tuned models, datasets, benchmarks.
5. **Stack**: Python; HuggingFace Transformers.
6. **Live execution**: no.
7. **Backtesting**: NLP eval only.
8. **Analytics**: NLP metrics.
9. **Agentic / LLM**: yes — its central topic.
10. **Data integration**: financial corpora.
11. **Value for Finance-OS**: **research only** — Finance-OS deliberately uses generalist LLMs (Claude/GPT) with strict structured-output schemas + execution-vocabulary banlist. A specialized FinLLM adds drift risk and isn't aligned with PR4 safety guarantees today.
12. **Integration risk**: high (model hosting, drift, eval cost).
13. **ToS / provider-risk**: low.
14. **Recommended decision**: **research only / later**.
15. **Target area**: Advisor (long-term).

#### 3.C.2 — TauricResearch/TradingAgents *(user-supplied lowercase variant resolves to the same repo)*

1. **URL**: https://github.com/TauricResearch/TradingAgents
2. **License**: Apache-2.0.
3. **Activity**: 2026-05-01; **71,734 stars** (highest in this audit).
4. **Main purpose**: multi-agent LLM trading framework — analysts (fundamental, sentiment, technical, macro) → researcher → trader → risk → portfolio.
5. **Stack**: Python; LangGraph/Langchain-style.
6. **Live execution**: tutorials integrate with brokers; default is paper.
7. **Backtesting**: yes — runs over historical periods.
8. **Analytics**: standard.
9. **Agentic / LLM**: **yes — its central topic.** Each role is a separate LLM call with a typed message bus.
10. **Data integration**: yfinance + news.
11. **Value for Finance-OS**: **high (architectural)** — the role-decomposition (analysts → researcher → trader → risk) is the cleanest published version of the "agent committee" pattern. Finance-OS's PR4 post-mortem already captures the *post-decision* leg of this loop; the *pre-decision* analyst committee is a candidate for a future Advisor v2 (see PR18 below) — but any port must keep the LLM strictly advisory.
12. **Integration risk**: **high if naïvely imported** — the repo's "trader" role is execution-shaped; we MUST replace it with a purely advisory recommender that emits structured advice + confidence + invalidation hints, never an order intent.
13. **ToS / provider-risk**: per provider used.
14. **Recommended decision**: **adapt pattern** for Advisor v2 — committee shape only; replace the execution leg.
15. **Target area**: Advisor.

#### 3.C.3 — hsliuping/TradingAgents-CN

1. **URL**: https://github.com/hsliuping/TradingAgents-CN
2. **License**: NOASSERTION ⚠️
3. **Activity**: 2026-04-20; 25,962 stars. Chinese-market enhanced fork of TradingAgents.
4. **Main purpose**: same multi-agent shape as 3.C.2, adapted for A-shares + Chinese data sources.
5. **Stack**: Python.
6. **Live execution**: same caveat as 3.C.2.
7. **Backtesting**: yes.
8. **Analytics**: standard.
9. **Agentic / LLM**: yes.
10. **Data integration**: A-share / HK data.
11. **Value for Finance-OS**: low for the EU/US user; useful if a future locale extension targets CN markets.
12. **Integration risk**: high (license unclear + execution path).
13. **ToS / provider-risk**: medium (CN data sources have provider terms).
14. **Recommended decision**: **research only / later**.
15. **Target area**: Advisor (long-term, locale-specific).

#### 3.C.4 — HKUDS/Vibe-Trading

1. **URL**: https://github.com/HKUDS/Vibe-Trading
2. **License**: MIT.
3. **Activity**: 2026-05-08; 6,046 stars. From HKU Data Science Lab — academic origin.
4. **Main purpose**: "personal trading agent" — agentic LLM with research + planning loops.
5. **Stack**: Python.
6. **Live execution**: paper-leaning, with broker adapters available.
7. **Backtesting**: yes.
8. **Analytics**: standard.
9. **Agentic / LLM**: yes.
10. **Data integration**: multi-source.
11. **Value for Finance-OS**: medium — academic codebase with cleaner separation than the bot ecosystem; useful diff against TradingAgents.
12. **Integration risk**: medium-high — agentic LLM execution coupling.
13. **ToS / provider-risk**: per provider.
14. **Recommended decision**: **research only**.
15. **Target area**: Advisor (read-only).

#### 3.C.5 — virattt/ai-hedge-fund

1. **URL**: https://github.com/virattt/ai-hedge-fund
2. **License**: **none** (= all rights reserved).
3. **Activity**: 2026-05-08; **58,361 stars**. Very popular tutorial-style repo.
4. **Main purpose**: AI hedge fund team — committee of "famous-investor-style" agents (Buffett, Munger, etc.) producing trade recommendations.
5. **Stack**: Python.
6. **Live execution**: simulated only by default.
7. **Backtesting**: yes.
8. **Analytics**: standard.
9. **Agentic / LLM**: yes.
10. **Data integration**: yfinance / Alpaca.
11. **Value for Finance-OS**: **high (architectural read)** — the persona-as-skill packaging is interesting for the Finance-OS skills system, and the committee shape is similar to TradingAgents.
12. **Integration risk**: **very high** — license = all rights reserved; we cannot vendor or copy code; we may only re-implement patterns under our license with attribution.
13. **ToS / provider-risk**: per provider.
14. **Recommended decision**: **research only / adapt pattern (re-implementation)** — copy the committee shape under our license, never the code.
15. **Target area**: Advisor.

#### 3.C.6 — ginlix-ai/LangAlpha

1. **URL**: https://github.com/ginlix-ai/LangAlpha
2. **License**: Apache-2.0.
3. **Activity**: 2026-05-08; 1,060 stars. Tagline: "Claude Code for Finance".
4. **Main purpose**: Claude/agent-driven finance toolkit.
5. **Stack**: Python.
6. **Live execution**: paper-leaning.
7. **Backtesting**: yes.
8. **Analytics**: standard.
9. **Agentic / LLM**: yes.
10. **Data integration**: multi-source.
11. **Value for Finance-OS**: medium — Claude-native patterns are interesting given Finance-OS already standardizes on Claude as the post-mortem provider.
12. **Integration risk**: medium.
13. **ToS / provider-risk**: per provider.
14. **Recommended decision**: **research only**.
15. **Target area**: Advisor (read-only).

#### 3.C.7 — ZhuLinsen/daily_stock_analysis

1. **URL**: https://github.com/ZhuLinsen/daily_stock_analysis
2. **License**: MIT.
3. **Activity**: 2026-05-08; **34,651 stars**. Description (cn/en): "LLM-powered stock analysis system for A/H/US markets — multi-source quotes + real-time news + LLM decision dashboard + multi-channel push, scheduled, zero-cost."
4. **Main purpose**: scheduled, multi-source LLM stock-analysis pipeline.
5. **Stack**: Python.
6. **Live execution**: no.
7. **Backtesting**: not the focus.
8. **Analytics**: dashboard.
9. **Agentic / LLM**: yes.
10. **Data integration**: heavy use of unofficial / "free" data sources (the description literally references "纯白嫖" = "pure freeloading").
11. **Value for Finance-OS**: **low–medium** — pipeline shape is similar to our Advisor daily run.
12. **Integration risk**: medium.
13. **ToS / provider-risk**: **high** — explicitly relies on unofficial data feeds. Same concern as 3.A.3 / 3.A.4 / 3.A.5.
14. **Recommended decision**: **research only**; do not adopt provider abstractions from this repo.
15. **Target area**: Advisor (read-only).

#### 3.C.8 — chrisworsey55/atlas-gic

1. **URL**: https://github.com/chrisworsey55/atlas-gic
2. **License**: NOASSERTION ⚠️
3. **Activity**: 2026-05-08; 1,771 stars.
4. **Main purpose**: "self-improving AI trading agents" using a Karpathy-style auto-research loop.
5. **Stack**: Python.
6. **Live execution**: capable.
7. **Backtesting**: yes.
8. **Analytics**: standard.
9. **Agentic / LLM**: yes — recursive self-improvement is the central claim.
10. **Data integration**: multi-source.
11. **Value for Finance-OS**: **research only** — auto-research recursion is a high-risk, high-cost pattern; the post-mortem + eval guardrails in PR4/PR2 already cover the "improve from feedback" leg without recursion.
12. **Integration risk**: **very high** — license unclear + recursive autonomy is exactly the failure mode the Finance-OS ADR forbids.
13. **ToS / provider-risk**: needs review.
14. **Recommended decision**: **avoid as a runtime dep**; treat as a **cautionary read**.
15. **Target area**: Not applicable.

#### 3.C.9 — staskh/trading_skills

1. **URL**: https://github.com/staskh/trading_skills
2. **License**: MIT.
3. **Activity**: 2026-05-06; 180 stars.
4. **Main purpose**: Claude-powered advisor for option traders — packaged as a skills bundle.
5. **Stack**: Python.
6. **Live execution**: no.
7. **Backtesting**: limited.
8. **Analytics**: limited.
9. **Agentic / LLM**: yes — Claude.
10. **Data integration**: TBD.
11. **Value for Finance-OS**: **medium** — it's a real-world example of how to package an advisor as a Claude skills bundle, which is exactly the model Finance-OS already uses (`.claude/skills/`).
12. **Integration risk**: low (small surface).
13. **ToS / provider-risk**: low.
14. **Recommended decision**: **research only — skills packaging diff**.
15. **Target area**: Advisor (skill packaging).

#### 3.C.10 — K-Dense-AI/scientific-agent-skills

1. **URL**: https://github.com/K-Dense-AI/scientific-agent-skills
2. **License**: MIT.
3. **Activity**: 2026-05-06; **20,403 stars**.
4. **Main purpose**: ready-to-use agent skills for research, science, engineering, analysis, finance, writing.
5. **Stack**: Python (skill manifests).
6. **Live execution**: n/a.
7. **Backtesting**: n/a.
8. **Analytics**: n/a.
9. **Agentic / LLM**: yes — skills.
10. **Data integration**: per skill.
11. **Value for Finance-OS**: **high (skills curation)** — Finance-OS already uses an agent-skills system; this repo is the largest curated skill set today and is a direct reference.
12. **Integration risk**: low.
13. **ToS / provider-risk**: low.
14. **Recommended decision**: **research only — skill curation diff** against `.claude/skills/`.
15. **Target area**: Skills system (Claude/Codex pipeline).

#### 3.C.11 — mvanhorn/last30days-skill

1. **URL**: https://github.com/mvanhorn/last30days-skill
2. **License**: MIT.
3. **Activity**: 2026-05-02; 25,177 stars.
4. **Main purpose**: AI agent skill that researches any topic across Reddit / X / YouTube / HN / Polymarket / web, then synthesizes a grounded summary.
5. **Stack**: Python.
6. **Live execution**: n/a.
7. **Backtesting**: n/a.
8. **Analytics**: n/a.
9. **Agentic / LLM**: yes — skill packaging + multi-source synthesis.
10. **Data integration**: Reddit, X, YouTube, HN, Polymarket, generic web.
11. **Value for Finance-OS**: **high (pattern)** — Polymarket inclusion is interesting because PR4 post-mortem could ingest prediction-market priors as one signal. The skill packaging shape is also a direct reference for our skills system.
12. **Integration risk**: medium — Reddit/X/Polymarket APIs each have their own ToS.
13. **ToS / provider-risk**: per source.
14. **Recommended decision**: **adapt pattern** — the multi-source-to-grounded-summary skill shape, with a strict source allowlist matching our integrations.
15. **Target area**: Advisor (knowledge-pack pattern).

### 3.D — Trading concepts / SMC

#### 3.D.1 — joshyattridge/smart-money-concepts

1. **URL**: https://github.com/joshyattridge/smart-money-concepts
2. **License**: MIT.
3. **Activity**: 2026-04-03; 1,637 stars.
4. **Main purpose**: Python package implementing ICT-style smart-money-concept indicators — order blocks, fair value gaps (FVG), liquidity sweeps, breaker blocks, etc.
5. **Stack**: Python; pandas-first.
6. **Live execution**: no.
7. **Backtesting**: BYO; functions return pandas series.
8. **Analytics**: pattern detection only.
9. **Agentic / LLM**: no.
10. **Data integration**: BYO OHLCV.
11. **Value for Finance-OS**: **high** — direct extension of PR10's deterministic pattern detectors (`ema20_horizontal_level`, `ema200_one_touch`, `parabolic_sar_rci`, `volume_profile_zones`). Adding ICT/SMC detectors alongside is a natural PR15 candidate.
12. **Integration risk**: **low** — pure-Python, MIT, deterministic, no broker.
13. **ToS / provider-risk**: low.
14. **Recommended decision**: **adapt pattern** — re-implement the most useful detectors (FVG, order block candidate, BoS/CHoCH, liquidity sweep) inside `apps/quant-service/src/finance_os_quant/engines/patterns.py`, keeping PR10's confidence-cap + invalidation-hint contract. (**PR15B shipped** — five SMC keys live behind PR10's existing `POST /quant/patterns/detect` route; smart-money-concepts remains **not** a runtime dependency.)
15. **Target area**: Quant Service + Trading Lab.

### 3.E — Other architecture / payments / infrastructure

#### 3.E.1 — juspay/hyperswitch

1. **URL**: https://github.com/juspay/hyperswitch
2. **License**: Apache-2.0.
3. **Activity**: 2026-05-08; **42,597 stars**.
4. **Main purpose**: open-source payment switch (Rust) — unifies many PSP integrations behind one API.
5. **Stack**: Rust; Postgres; Redis.
6. **Live execution**: yes (in *payments*, not trading).
7. **Backtesting**: n/a.
8. **Analytics**: payment-side.
9. **Agentic / LLM**: no.
10. **Data integration**: many PSPs (Stripe, Adyen, Checkout, Razorpay, …).
11. **Value for Finance-OS**: **medium (architectural)** — the *provider abstraction* over many PSPs is exactly the architectural shape we ought to study before refactoring our own multi-broker / multi-bank provider layer (Powens, IBKR, Binance, EODHD, …). Hyperswitch is in a different domain but the engineering pattern is portable.
12. **Integration risk**: low (research-only).
13. **ToS / provider-risk**: low.
14. **Recommended decision**: **research only / adapt pattern** — for the provider abstraction architecture only.
15. **Target area**: Spend Intelligence / Data Providers.

#### 3.E.2 — GeneBO98/tradetally

1. **URL**: https://github.com/GeneBO98/tradetally
2. **License**: Apache-2.0.
3. **Activity**: 2026-05-06; 249 stars.
4. **Main purpose**: trade tracking + analytics (TraderVue-style).
5. **Stack**: JavaScript (Node).
6. **Live execution**: no.
7. **Backtesting**: no.
8. **Analytics**: behavior-oriented (tags, mistakes, win-by-symbol, time-of-day).
9. **Agentic / LLM**: no.
10. **Data integration**: brokerage statement imports.
11. **Value for Finance-OS**: **high (concept)** — *behavior analytics* is the missing complement to PR1 Decision Journal + PR4 Post-Mortem. This is a direct fit for the Advisor's calibration loop.
12. **Integration risk**: **low** — Apache-2.0, small.
13. **ToS / provider-risk**: low.
14. **Recommended decision**: **adapt pattern** — re-implement the "decision-quality over time" + "mistake tagging" surface on top of PR1's `advisor_decision_journal` + PR4's `advisor_post_mortem`. (See proposed PR15 below — **PR15A shipped** as `GET /dashboard/advisor/behavior-analytics`, freeNote-free, re-implemented in TypeScript inside `apps/api/src/routes/dashboard/domain/advisor/get-advisor-behavior-analytics.ts`. Tradetally remains **not** a runtime dependency. SMC/ICT detector pack from PR15 spec deferred to PR15B.)
15. **Target area**: Advisor.

## 4. Concept audit

For each concept the user listed, the table notes (a) one-line definition, (b) Finance-OS coverage today, (c) recommendation.

| Concept | Definition | Finance-OS today | Recommendation |
|---|---|---|---|
| **Prediction-market trading bot pattern** | Bot that places trades on prediction markets (Polymarket, Manifold) using a calibrated probabilistic model, sized by Kelly. | None. Closest is the post-mortem calibration loop in PR4. | **Research only.** A *prediction-market signal* surface (read prices, never trade) is interesting for the advisor's calibration data — see Top-5 idea #5. |
| **Agent swarm pattern (scan / research / predict / risk / execute / compound)** | Multi-agent decomposition where each role is a typed LLM call. | PR4 post-mortem is one role. Advisor `getAdvisorOverview` is one synchronous monolith. | **Adapt pattern**, with the "execute" leg replaced by "advise + invalidation hints". See proposed PR18. |
| **Kelly sizing** | Position size = `(bp − q) / b` for known edge `p` and odds `b`. | Not implemented. Hypothesis Lab today has no sizing recommender. | **Adapt with caution.** Kelly is over-leveraged in practice. If implemented, must default to fractional Kelly (≤ 0.25× full) and live behind a paper-only flag. |
| **Brier score** | Mean squared error between predicted probability and observed outcome. | Not yet computed. PR4 post-mortem captures `previousConfidence` and `calibratedConfidence` qualitatively. | **Adapt pattern.** Add a deterministic Brier-score scorer alongside the PR2 deterministic eval scorers. Cheap, valuable, no new infra. |
| **Sharpe** | `(R − Rf) / σ`. | Computed by `apps/quant-service/.../metrics.py`. | Already covered. |
| **Sortino** | Sharpe variant using only downside deviation. | Computed. | Already covered. |
| **Max drawdown** | Worst peak-to-trough decline. | Computed; surfaced in PR12 scorecard. | Already covered. |
| **VaR** | Value-at-Risk at confidence `α`. | Not computed. | **Adapt pattern.** Add as a metric in `metrics.py` with an explicit "historical, not predictive" caveat. |
| **Profit factor** | Gross profit / gross loss. | Computed. | Already covered. |
| **Volume Profile (CRT/ICT)** | Volume distribution by price; classifies "candle range theory" / ICT levels. | Partial — PR10 implements `volume_profile_zones` (POC/VAH/VAL). | **Adapt pattern** further — add CRT-specific detectors (e.g., 3-bar CRT) inside the existing PR10 engine. |
| **Failed auction model** | When a session opens above value, sells off, then closes below — taken as a directional regime shift signal. | Not implemented. | **Research only** initially; candidate for a future PR15 SMC detector. |
| **VAH / VAL / POC / FVG / buy-side purge** | Standard ICT/Volume-Profile vocabulary. | POC / VAH / VAL: implemented (PR10). FVG / buy-side purge: not implemented. | **Adapt pattern** in PR15. |
| **200EMA × One-Touch** | First touch of EMA200 after a sustained extension is treated as a research signal. | Implemented (PR10 `ema200_one_touch`). | Already covered. |
| **Parabolic × RCI** | Alignment between Parabolic SAR and RCI. | Implemented (PR10 `parabolic_sar_rci`, capped at medium confidence). | Already covered. |
| **EMA20 × horizontal line** | EMA20 confluence with retested horizontal level. | Implemented (PR10 `ema20_horizontal_level`). | Already covered. |

## 5. Decision groups

### Counting conventions (read first)

The 30 audited repositories are classified along **two distinct axes**:

1. **Primary recommended decision** — exactly one of `adapt pattern` / `research only` / `avoid` per repo, taken from the matrix's `Recommended decision` column. These three counts sum to 30 (= unique repositories).
2. **Decision groups (Group A–E below)** — a repository can be tagged into multiple groups when its rationale spans more than one (e.g. Lean is in **A** for its backtest/algorithm architecture *and* in **C** for its live-broker layer that we explicitly refuse). Group tags therefore **do not** sum to the unique-repo count.

#### 5.0.1 — Primary-decision tally (sums to 30)

| Primary decision | Count | Notes |
|---|---:|---|
| `adapt pattern` (any flavor — including "architecture only" and "research only / adapt pattern" compounds) | **8** | The repo's primary outcome is that we will copy a pattern under our license. |
| `research only` (any flavor — including "research only / later") | **15** | The repo informs design but is not adopted in any form. |
| `avoid` | **7** | License, ToS, dormant-and-execution-heavy, recursive-autonomy, or HFT scope. |
| **Total** | **30** | = unique repositories audited. |

The split, by repo:
- **adapt pattern** (8): quantstats, qlib, Lean (architecture only), OpenBB, tradetally, smart-money-concepts, TradingAgents, last30days-skill.
- **research only** (15): FinGPT, FinRL, Vibe-Trading, ai-hedge-fund *(also adapt-pattern via re-implementation under our license — primary-decision label kept as `research only` per the matrix's leftmost token rule)*, LangAlpha, QuantDinger, Kronos, TradingAgents-CN, FinceptTerminal, daily_stock_analysis, staskh/trading_skills, scientific-agent-skills, jesse-ai/jesse, tvscreener, hyperswitch *(matrix label `research only / adapt pattern`)*.
- **avoid** (7): freqtrade, hummingbot, lumibot, QuantMuse, atlas-gic, TradingView-API, Google-Finance-Api.

#### 5.0.2 — Group-tag tally (does NOT sum to 30 — repos may appear in multiple groups)

| Group | Tag count | Cross-listed examples |
|---|---:|---|
| **A** — High-priority inspiration | 6 | — |
| **B** — Research-only / maybe later | 14 | TradingAgents (also A via PR18), ai-hedge-fund (re-implement only), last30days-skill (also E via skill packaging), scientific-agent-skills (also E), atlas-gic (also flagged for license + autonomy risk), daily_stock_analysis (also D for ToS) |
| **C** — Useful but execution-heavy | 6 | Lean's *live-broker* layer (Lean's *architecture* is in A) |
| **D** — Provider / API caution (ToS) | 4 | daily_stock_analysis (also B) |
| **E** — Non-core but conceptually useful | 4 | last30days-skill (also B), scientific-agent-skills (also B) |
| **Total tags applied** | **34** | Applied across 30 unique repos — extras come from explicit cross-listings. |

### A — High-priority inspiration *(adapt pattern, near-term PRs)*

- **ranaroussi/quantstats** → richer scorecard analytics (PR14 candidate).
- **microsoft/qlib** → research / backtest pipeline shape (PR17 candidate).
- **QuantConnect/Lean** → architectural separation between paper, backtest, and live (PR17 candidate, **architecture only**).
- **OpenBB-finance/OpenBB** → provider abstraction architecture (PR16 candidate).
- **GeneBO98/tradetally** → behavior analytics on top of decision journal + post-mortem (PR15 candidate).
- **joshyattridge/smart-money-concepts** → SMC/ICT deterministic detectors next to PR10 engine.

### B — Research-only / maybe later

- **AI4Finance-Foundation/FinGPT**
- **AI4Finance-Foundation/FinRL**
- **TauricResearch/TradingAgents** *(architecture only — adapt-pattern path goes through PR18 with the execution leg replaced)*
- **HKUDS/Vibe-Trading**
- **virattt/ai-hedge-fund** *(license blocks direct use; pattern-only)*
- **shiyu-coder/Kronos**
- **ginlix-ai/LangAlpha**
- **brokermr810/QuantDinger**
- **hsliuping/TradingAgents-CN**
- **ZhuLinsen/daily_stock_analysis** *(also flagged for ToS — see group D)*
- **chrisworsey55/atlas-gic** *(also flagged for license + autonomy risk)*
- **staskh/trading_skills**
- **K-Dense-AI/scientific-agent-skills**
- **mvanhorn/last30days-skill** *(adapt-pattern candidate for the multi-source synthesis skill, with an allowlist)*

### C — Useful but dangerous because execution-heavy

- **freqtrade/freqtrade** *(GPL-3.0 + execution)*
- **hummingbot/hummingbot** *(HFT — out of scope)*
- **jesse-ai/jesse** *(execution; pattern-only)*
- **Lumiwealth/lumibot** *(GPL-3.0 + execution)*
- **QuantConnect/Lean** *(architecture only — already group A; the *execution adapter* parts are group C)*
- **0xemmkty/QuantMuse** *(also dormant — group B/C overlap)*

### D — Provider / API caution (ToS)

- **Mathieu2301/TradingView-API** *(license `none` + unofficial endpoint)*
- **KilimcininKorOglu/Google-Finance-Api** *(unofficial Google endpoint)*
- **deepentropy/tvscreener** *(unofficial TradingView screener)*
- **ZhuLinsen/daily_stock_analysis** *(self-described as "纯白嫖" — uses unofficial data feeds)*

### E — Non-core but conceptually useful

- **juspay/hyperswitch** *(payment-switch architecture as a reference for our provider layer)*
- **mvanhorn/last30days-skill** *(skill packaging + multi-source synthesis pattern)*
- **K-Dense-AI/scientific-agent-skills** *(skill curation diff against our skills system)*
- **Fincept-Corporation/FinceptTerminal** *(UI/UX read-only)*

## 6. Top 5 actionable ideas

In rough priority order, based on **(value × low integration risk)**:

1. **Port a tighter slice of QuantStats metrics into PR12 scorecards.**
   The PR12 `StrategyScorecardMetrics` shape today carries `winRate / expectancy / profitFactor / maxDrawdown / sharpe / sortino / averageTradeReturn`. QuantStats offers ~50 additional metrics. Re-implementing **Calmar, Omega, Tail ratio, Recovery factor, Ulcer index, MAR ratio, Skew, Kurtosis, monthly heatmap, rolling Sharpe** would meaningfully improve the scorecard. Low risk: pure pandas math, no broker, no LLM. *(Apache-2.0 source; we re-implement, don't vendor.)* → PR14.

2. **Behavior-analytics layer on top of `advisor_decision_journal` + `advisor_post_mortem`.**
   Tradetally proves out the value of *decision quality over time* — win-rate by reason-code, hold-time analysis, mistake tagging. Finance-OS already has the journal (PR1) and post-mortem (PR4) tables; adding a thin read-only behavior-analytics endpoint is small and high-leverage. → PR15.

3. **Brier-score scorer next to PR2 deterministic scorers.**
   PR4 captures `previousConfidence` + `calibratedConfidence` as ordinals (low/medium/high). Adding a deterministic Brier scorer over numeric confidence labels closes the calibration loop in eval-able form. Low cost; matches PR2's design exactly. *(Bonus: appears in the `risk_calibration` eval category list.)*

4. **Re-implement the most useful SMC/ICT detectors next to PR10's engine.**
   `joshyattridge/smart-money-concepts` is MIT, pure pandas, deterministic. Adding `fair_value_gap`, `order_block`, `bos_choch`, `liquidity_sweep` next to the PR10 detectors keeps the contract identical (confidence cap, invalidation hints, banlist self-scan). Pairs naturally with PR11's UI. → PR15 or PR16.

5. **Provider-abstraction architecture review against OpenBB + Hyperswitch.**
   Finance-OS today has 6+ provider integrations (Powens, IBKR, Binance, EODHD, Twelve Data, FRED). They were built incrementally and don't share an abstraction. OpenBB and Hyperswitch are the two best public references for "many providers behind one normalized API". A research doc + ADR comparing the two architectures against ours would inform the next refactor — no code change required for the doc. → PR16 (research) → eventually a refactor PR.

## 7. Top 5 risks

1. **License contamination**. GPL-3.0 (freqtrade, lumibot) cannot link into Finance-OS without forcing the whole product to GPL. NOASSERTION (OpenBB, FinceptTerminal, atlas-gic, TradingAgents-CN) and `none` (TradingView-API, virattt/ai-hedge-fund) leave no clear permission grant — under default copyright, that is "all rights reserved". *Mitigation*: re-implement under our license; never vendor; record attribution.

2. **ToS risk on unofficial data feeds**. TradingView-API, Google-Finance-Api, tvscreener, daily_stock_analysis all hit endpoints not exposed by their owner's public API. Using them in a product against end-users is at concrete risk of breach + service interruption. *Mitigation*: **avoid as runtime providers**; allow only for offline developer research on the developer's own account.

3. **Execution path leakage** when copying agent / bot architectures. TradingAgents, ai-hedge-fund, FinRL, QuantDinger, lumibot, jesse, freqtrade all contain "execute" / "live broker" code paths. Naïve adoption risks crossing the Finance-OS advisory-only line. *Mitigation*: every adopted pattern must be re-shaped to emit *advice + invalidation hints + structured uncertainty*, never order intent. PR4's strict execution-vocabulary scanner is the canonical example to extend.

4. **Recursive autonomy / self-improvement loops** (atlas-gic, parts of TradingAgents). Recursive agents that rewrite their own prompts or strategies are a category banned by the Finance-OS ADR — they make the post-mortem audit trail intractable and can drift outside the eval baseline silently. *Mitigation*: **never adopt the recursive leg**; only adopt the linear committee shape with explicit per-step persistence (which is what PR4 already does).

5. **LLM as judge of itself for trading**. FinGPT and similar fine-tuned-LLM-as-trader projects assume a specialized financial LLM produces better calls. Finance-OS deliberately uses a *generalist* LLM constrained by structured-output schemas, banlists, deterministic evals (PR2), and post-mortems (PR4). Switching to a financial LLM trades *marginal NLP gain* for *loss of safety guarantees*. *Mitigation*: keep the generalist + structure stack; track FinGPT for **research only**; never wire it into the daily run.

## 8. Proposed PR14–PR18 roadmap

This roadmap reflects the audit, not a prior plan; the user's seed roadmap is incorporated where supported by the findings.

### PR14 — QuantStats-inspired analytics enrichment *(✓ shipped)*

**Goal**: extend PR12's scorecard with a curated slice of QuantStats-inspired math (Calmar, MAR, Recovery factor, Ulcer index, Tail ratio, Omega, historical VaR 95, expected shortfall 95, rolling Sharpe + rolling drawdown, payoff/win/loss).

**Shipped scope**:
- New pure helper [`apps/api/src/routes/dashboard/domain/trading-lab/scorecard/compute-advanced-risk-metrics.ts`](../../apps/api/src/routes/dashboard/domain/trading-lab/scorecard/compute-advanced-risk-metrics.ts) — re-implemented in TypeScript under our license, **not** vendored. No QuantStats dependency.
- Additive `advancedMetrics` field on the existing `GET /dashboard/trading-lab/strategies/:id/scorecard` response. PR12 fields untouched.
- New collapsible "Métriques avancées" subsection inside the existing `StrategyScorecardCard` UI.
- 18 dedicated unit tests on the helper + 5 integration tests on the scorecard ensuring `evidenceGrade` is never upgraded by `advancedMetrics`.

**Hard constraints respected**: paper-only; no LLM; no provider; no graph; no worker change; no DB schema or migration; no broker integration; no execution wording. VaR/CVaR labelled "historique"; insufficient data → `null + warnings`, never fabricated zeros.

**Source**: ranaroussi/quantstats (Apache-2.0 — pattern adoption, not vendoring).

### PR15 — Behavior-analytics + SMC/ICT detector pack *(split into PR15A + PR15B)*

The original PR15 scope was split for safety / blast-radius reasons:

#### PR15A — Behavior-analytics *(✓ shipped)*

**Goal**: deterministic decision-quality analytics over `advisor_decision_journal` + `advisor_decision_outcome`.

**Shipped scope**:
- New read-only `GET /dashboard/advisor/behavior-analytics?windowDays=<7..365>` route.
- New freeNote-free repo helper `listDecisionsForBehaviorAnalytics` (column allowlist excludes `free_note` at SQL-select level — defense-in-depth on the no-raw-notes rule).
- New pure use-case `apps/api/src/routes/dashboard/domain/advisor/get-advisor-behavior-analytics.ts` covering decision counts/rates, outcome coverage, reason-code breakdown with descriptive cautions, six learning signals (`low_outcome_coverage`, `over_deferral`, `high_negative_acceptance`, `ignored_followups`, `positive_rejections`, `insufficient_sample`).
- `BehaviorAnalyticsCard` mounted on `/ia` behind `VITE_LEARNING_LOOP_UI_ENABLED`.
- 20 backend unit tests + 2 DOM smoke tests.

**Hard constraints respected**: paper-only; no LLM; no provider; no graph; no worker; no DB schema or migration; no broker integration; no execution wording. Causality and profitability are explicitly **not** claimed; the response never carries `freeNote` content.

**Source**: GeneBO98/tradetally (Apache-2.0 — pattern adoption, not vendoring).

#### PR15B — SMC/ICT detector pack *(✓ shipped)*

**Goal**: extend PR10's deterministic pattern engine with five SMC/ICT detectors.

**Shipped scope**:
- New keys on `POST /quant/patterns/detect`: `fair_value_gap`, `liquidity_sweep`, `break_of_structure`, `change_of_character`, `order_block_candidate`. Same contract as PR10 (confidence cap, invalidation hints, banlist self-scan).
- New helper functions in [`apps/quant-service/src/finance_os_quant/engines/patterns.py`](../../apps/quant-service/src/finance_os_quant/engines/patterns.py): `_find_swing_indices`, `_atr14`, `_is_displacement`, `_structure_breaks`, plus the five `_detect_*` functions.
- API proxy `t.Literal(...)` body schema and web `DashboardTradingLabPatternKey` union extended; `PATTERN_LABELS_FR` exposes neutral French labels (`Fair Value Gap`, `Liquidity Sweep`, `Break of Structure`, `Change of Character`, `Order Block (candidate)`).
- `PatternDetectionPanel` shows an "SMC/ICT research" badge when any SMC pattern is selected, and a "Candidate structure · Not a signal · Paper only" caption per SMC detection card.
- 15 new Python tests cover each detector + insufficient-data + no-clear-swing-no-false-BOS + no-high-confidence + banlist + deterministic IDs.
- Demo helper surfaces a deterministic bullish FVG entry when `fair_value_gap` is requested.

**Hard constraints respected**: paper-only; deterministic; banlist self-scan; SMC patterns capped at low/medium confidence; `order_block_candidate` always low-confidence; no execution wording; smart-money-concepts is **not** a runtime dependency.

**Source**: joshyattridge/smart-money-concepts (MIT — pattern adoption, re-implementation under our license).

### PR16 — Provider abstraction architecture research doc + prototype

**Goal**: research-only doc + small prototype comparing OpenBB-style and Hyperswitch-style provider abstractions against the current Finance-OS layer.

**Scope**:
- `docs/research/provider-abstraction-architecture.md` — comparative ADR, decision matrix, recommendation.
- Optional: tiny prototype (`packages/provider-abstraction-experiment/`) with 1 stub provider in the candidate shape — disabled by default, never wired into runtime.

**Hard constraints**: doc-first; no runtime change in the prototype path; ADR must be ratified before any refactor PR.

**Sources**: OpenBB-finance/OpenBB (NOASSERTION — read-only architectural reference); juspay/hyperswitch (Apache-2.0 — read-only architectural reference).

### PR17 — Qlib / Lean research-architecture comparison

**Goal**: research doc comparing the Qlib pipeline + Lean engine boundary patterns against `apps/quant-service` + Trading Lab. Identify what Finance-OS should adopt structurally and what it should explicitly refuse (Lean's live-broker layer being the headline refusal).

**Scope**:
- `docs/research/quant-research-architecture.md` — pipeline/engine ADR + decision matrix.
- No runtime change.

**Hard constraints**: doc-only.

**Sources**: microsoft/qlib (MIT — read-only); QuantConnect/Lean (Apache-2.0 — read-only architectural reference; live-broker layer explicitly refused per §1).

### PR18 — Advisor v2: committee shape (advisory-only)

**Goal**: a multi-role pre-decision committee for the Advisor (analysts → researcher → judge → calibration) — strictly advisory, no execution leg, paper-only.

**Scope**:
- Re-implement the role decomposition under our license, with each role producing structured advice + confidence + invalidation hints. Never an order intent.
- Reuse PR4's strict execution-vocabulary scanner at the committee output. Reuse PR2 deterministic scorers for committee-level evals.
- Reuse PR8 graph ingest for `DecisionPoint` / `LearningAction` produced by the committee.
- Feature-flagged off by default (`AI_ADVISOR_COMMITTEE_ENABLED=false`).

**Hard constraints**: advisory-only; no execute role; LLM output goes through the existing strict scanner; per-role calls use the existing budget guard.

**Sources**: TauricResearch/TradingAgents (Apache-2.0 — pattern adoption, execute role explicitly replaced); virattt/ai-hedge-fund (license `none` — pattern-only inspiration, never vendored).

---

## 9. Confirmation

This document does not change runtime code. No package added. No env var introduced. No DB migration. No LLM call. No provider call. No graph ingest. No worker change. No UI mounted. No broker integration.

The only files touched by this PR are:
- `docs/research/advisor-external-repos-audit.md` (this file).
- `docs/research/advisor-external-repos-decision-matrix.md` (companion table).
- A small cross-reference in `docs/context/FEATURES.md` and `docs/context/LEARNING-LOOP-RELEASE-CHECKLIST.md` documenting that PR13 is doc-only.

The audit is intentionally biased toward conservative recommendations: when in doubt, the recommended decision is **research only**, because the cost of a wrong "integrate" call is contamination (license, ToS, or execution-shaped code paths) and the cost of a wrong "research only" call is a delayed PR.
