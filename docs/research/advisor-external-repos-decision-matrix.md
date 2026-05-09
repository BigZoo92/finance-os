# PR13 — External Repositories Decision Matrix

> **Companion to**: [`advisor-external-repos-audit.md`](./advisor-external-repos-audit.md)
> **As of**: 2026-05-09 (license / activity / stars verified via GitHub API).
> **Doc-only PR** — no runtime change.

## Counts at a glance

- **Unique repositories audited**: **30** (= 30 rows in the matrix below).
- **User-supplied entries that resolved to the same repo** (deduped here): `jesses-ai/jesse` → `jesse-ai/jesse` (typo, 404 on the original); `tauricresearch/tradingagents` ≡ `TauricResearch/TradingAgents` (case-variant of the same repo).
- **Primary-decision split** (sums to 30):
  - `adapt pattern` (any flavor): **8**
  - `research only` (any flavor): **15**
  - `avoid`: **7**
- **Group-tag split** (does NOT sum to 30 — repos may carry multiple tags): A=6, B=14, C=6, D=4, E=4 = **34 tags applied to 30 repos**. See [§5.0 of the audit](./advisor-external-repos-audit.md#counting-conventions-read-first) for the canonical accounting.

## Matrix

> Sort key: **decision priority** (adapt pattern → research only → avoid), then **value × low-risk** descending. Risk columns are graded on a 1–5 scale (5 = high risk). Star counts are at audit date.

| Repo | Category | License | Activity (last push) | Stars | Value | Integration risk | Execution risk | License risk | Recommended decision | Target PR candidate | Notes |
|---|---|---|---|---:|---|---:|---:|---:|---|---|---|
| ranaroussi/quantstats | Quant analytics | Apache-2.0 | 2026-01-13 | 7,084 | High | 1 | 1 | 1 | **adapt pattern** | PR14 | Port ~10 metrics into `metrics.py`. |
| GeneBO98/tradetally | Trading journal analytics | Apache-2.0 | 2026-05-06 | 249 | High | 1 | 1 | 1 | **adapt pattern** | PR15 | Decision-quality + mistake tagging on PR1+PR4 tables. |
| joshyattridge/smart-money-concepts | SMC/ICT detectors | MIT | 2026-04-03 | 1,637 | High | 1 | 1 | 1 | **adapt pattern** | PR15 | Re-implement FVG/order-block/BoS/CHoCH/sweep next to PR10 engine. |
| microsoft/qlib | Quant pipeline | MIT | 2026-04-22 | 42,256 | High | 3 | 2 | 1 | **adapt pattern** | PR17 | Pipeline shape; do not vendor heavy ML deps. |
| QuantConnect/Lean | Backtest+live engine | Apache-2.0 | 2026-05-08 | 18,863 | High (architecture) | 4 | 5 | 1 | **adapt pattern (architecture only)** | PR17 | Refuse the live-broker layer explicitly. |
| OpenBB-finance/OpenBB | Data platform | NOASSERTION (AGPL per README) | 2026-05-08 | 67,226 | High | 3 | 2 | 4 | **adapt pattern** | PR16 | Provider-abstraction architecture; do not vendor — license blocker. |
| juspay/hyperswitch | Payment switch | Apache-2.0 | 2026-05-08 | 42,597 | Medium | 1 | 1 | 1 | **research only / adapt pattern** | PR16 | Architectural read on provider abstraction. |
| TauricResearch/TradingAgents | Multi-agent LLM trader | Apache-2.0 | 2026-05-01 | 71,734 | High (architecture) | 4 | 5 | 1 | **adapt pattern** | PR18 | Replace "trader" role with advisor-only output; re-use PR4 banlist scanner. |
| mvanhorn/last30days-skill | Skill packaging | MIT | 2026-05-02 | 25,177 | High | 2 | 1 | 1 | **adapt pattern** | later | Multi-source synthesis with strict allowlist. |
| K-Dense-AI/scientific-agent-skills | Skill curation | MIT | 2026-05-06 | 20,403 | High | 1 | 1 | 1 | **research only** | later | Skill curation diff against `.claude/skills/`. |
| AI4Finance-Foundation/FinGPT | FinLLM | MIT | 2026-04-24 | 19,984 | Medium | 4 | 3 | 1 | **research only / later** | — | Generalist LLM + structure stack preferred today. |
| AI4Finance-Foundation/FinRL | RL trading | MIT | 2026-04-05 | 15,092 | Medium-low | 4 | 3 | 1 | **research only / later** | — | Revisit after Hypothesis Lab matures. |
| HKUDS/Vibe-Trading | Personal LLM trading agent | MIT | 2026-05-08 | 6,046 | Medium | 3 | 4 | 1 | **research only** | — | Academic; useful diff vs TradingAgents. |
| virattt/ai-hedge-fund | Persona agent committee | **none** ⚠️ | 2026-05-08 | 58,361 | High (pattern) | 4 | 4 | 5 | **research only / adapt pattern (re-implement)** | PR18 | License = all rights reserved; never vendor. |
| ginlix-ai/LangAlpha | Claude-driven finance toolkit | Apache-2.0 | 2026-05-08 | 1,060 | Medium | 2 | 3 | 1 | **research only** | — | Claude-native patterns to compare. |
| brokermr810/QuantDinger | AI quant platform | Apache-2.0 | 2026-05-08 | 3,955 | Medium | 4 | 4 | 1 | **research only** | — | Architectural diff. |
| 0xemmkty/QuantMuse | AI quant platform | MIT | 2025-07-29 | 2,457 | Low | 4 | 4 | 1 | **avoid** | — | Dormant + execution-heavy. |
| shiyu-coder/Kronos | Foundation model for markets | MIT | 2026-04-13 | 23,663 | Research | 5 | 2 | 1 | **research only / later** | — | Track as eval candidate after PR2 matures. |
| hsliuping/TradingAgents-CN | TradingAgents (CN fork) | NOASSERTION ⚠️ | 2026-04-20 | 25,962 | Locale-specific | 4 | 4 | 4 | **research only / later** | — | Useful only if CN-locale extension is planned. |
| chrisworsey55/atlas-gic | Self-improving trading agents | NOASSERTION ⚠️ | 2026-05-08 | 1,771 | Cautionary | 5 | 5 | 4 | **avoid** | — | Recursive autonomy violates ADR. |
| Fincept-Corporation/FinceptTerminal | Finance terminal | NOASSERTION | 2026-05-06 | 20,328 | Low-medium | 3 | 2 | 4 | **research only** | — | UI/UX inspiration only. |
| ZhuLinsen/daily_stock_analysis | LLM stock-analysis pipeline | MIT | 2026-05-08 | 34,651 | Low-medium | 3 | 2 | 1 | **research only** | — | Heavy use of unofficial data feeds. |
| staskh/trading_skills | Claude option-trader skill | MIT | 2026-05-06 | 180 | Medium | 1 | 1 | 1 | **research only** | — | Skill packaging diff. |
| jesse-ai/jesse | Crypto trading bot | MIT | 2026-05-08 | 7,853 | Medium | 4 | 5 | 1 | **research only** | — | Strategy DSL inspiration; user-supplied path `jesses-ai/jesse` is wrong (canonical owner is `jesse-ai`). |
| Lumiwealth/lumibot | Backtest+live framework | **GPL-3.0** ⚠️ | 2026-05-08 | 1,458 | Medium | 5 | 5 | 5 | **avoid** | — | GPL contamination + live execution. |
| freqtrade/freqtrade | Crypto trading bot | **GPL-3.0** ⚠️ | 2026-05-08 | 49,991 | Medium | 5 | 5 | 5 | **avoid** | — | GPL contamination + live execution. |
| hummingbot/hummingbot | HFT crypto bot | Apache-2.0 | 2026-05-08 | 18,496 | Low | 5 | 5 | 1 | **avoid** | — | HFT/market-making out of scope. |
| Mathieu2301/TradingView-API | TradingView WS scraper | **none** ⚠️ | 2026-04-11 | 3,400 | Low | 5 | 1 | 5 | **avoid** | — | Unofficial endpoint + license = all rights reserved. |
| KilimcininKorOglu/Google-Finance-Api | Google Finance scraper | MIT | 2026-05-02 | 26 | Low | 4 | 1 | 1 | **avoid** | — | Internal RPC scrape; ToS risk. |
| deepentropy/tvscreener | TradingView Screener | Apache-2.0 | 2026-03-28 | 1,025 | Low-medium | 3 | 1 | 1 | **research only** | — | Screener rule schema useful; do not vendor JS client. |

## Risk legend

| Score | Meaning |
|---:|---|
| 1 | Negligible — pure-pandas math, MIT/Apache, no broker, no autonomy. |
| 2 | Minor — small surface, one provider with public ToS. |
| 3 | Moderate — meaningful surface or one ambiguous concern. |
| 4 | Material — execution-shaped code, NOASSERTION license, or unofficial endpoint. |
| 5 | Severe — GPL-3.0 contamination if linked, `none` license = all rights reserved, recursive autonomy, or HFT scope. |

## Decision groups (cross-reference) — *these are decision tags, not unique-repo counts*

A repository may carry multiple group tags (e.g. Lean's *architecture* belongs in **A** while its *live-broker layer* belongs in **C**). The five group tags therefore sum to **34 tags applied to 30 unique repos**, not 30. See [§5 of the audit](./advisor-external-repos-audit.md#5-decision-groups) for full reasoning and the primary-decision tally that does sum to 30.

- **A — High-priority inspiration** (6 tags): quantstats, qlib, Lean (architecture only), OpenBB, tradetally, smart-money-concepts.
- **B — Research-only / maybe later** (14 tags): FinGPT, FinRL, TradingAgents *(also A — committee shape adoption via PR18)*, Vibe-Trading, ai-hedge-fund *(pattern-only re-implement under our license)*, Kronos, LangAlpha, QuantDinger, TradingAgents-CN, daily_stock_analysis *(also D)*, atlas-gic *(also flagged for license + autonomy risk)*, staskh/trading_skills, scientific-agent-skills *(also E)*, last30days-skill *(also E; adapt-pattern candidate)*.
- **C — Useful but execution-heavy** (6 tags) *(do not vendor)*: freqtrade, hummingbot, jesse, lumibot, **Lean's live-broker layer** *(Lean's architecture is in A)*, QuantMuse.
- **D — Provider / API caution** (4 tags): TradingView-API, Google-Finance-Api, tvscreener, **daily_stock_analysis** *(also B)*.
- **E — Non-core but conceptually useful** (4 tags): hyperswitch, **last30days-skill** *(also B)*, **scientific-agent-skills** *(also B)*, FinceptTerminal.

## Proposed PR roadmap (cross-reference)

See [§8 of the audit](./advisor-external-repos-audit.md#8-proposed-pr14pr18-roadmap).

| PR | Theme | Primary inspirations | Hard constraints |
|---|---|---|---|
| PR14 | QuantStats-inspired analytics enrichment | quantstats | Re-implement, paper-only, no LLM/provider/graph. |
| PR15 | Behavior analytics + SMC/ICT detector pack | tradetally, smart-money-concepts | Read-only endpoint over PR1+PR4; new detectors keep PR10's contract. |
| PR16 | Provider abstraction architecture research | OpenBB, hyperswitch | Doc-first; ADR before any refactor PR. |
| PR17 | Quant research architecture comparison | qlib, Lean (architecture only) | Doc-only; live-broker layer explicitly refused. |
| PR18 | Advisor v2 committee (advisory-only) | TradingAgents, ai-hedge-fund (pattern-only) | No execute role; LLM output through PR4 strict scanner; flag-gated off. |
