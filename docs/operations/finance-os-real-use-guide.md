# Finance-OS Real-Use Guide

> Last updated: 2026-05-10. Audience: the app owner (the user operating Finance-OS for personal finance).
> This guide is the single entry point for "stop building, start using". It is written for you, not future contributors.

This is **not** a feature spec. It explains how the app works today, how to use it daily, what to watch, and what must stay disabled until you have actually used it for two weeks.

---

## 1. What Finance-OS does today

Finance-OS is a personal finance cockpit that consolidates banking, investments, crypto, news, and an AI advisor in one local-first dashboard.

It currently:

- Aggregates bank accounts via **Powens** (read-only).
- Aggregates brokerage holdings via **IBKR Flex Query** (read-only).
- Aggregates crypto balances via **Binance** (read-only).
- Tracks goals, manual assets, taxes, projections, budgets.
- Surfaces curated market news (multi-source, deduplicated, scored).
- Runs a deterministic **AI Advisor** that produces a daily brief, recommendations, evals, post-mortems, decision-journal entries, replay views, and a fine-tuning readiness gate.
- Tracks technical-pattern detections (SMC/ICT pack) and Strategy Scorecards in the **Trading Lab** (paper-only).
- Persists a **Knowledge Graph** of decisions, recommendations, outcomes, and post-mortems for use as Advisor memory.
- Exposes operator endpoints for `/dashboard/providers/diagnostics` and `/dashboard/data-quality`.

## 2. What Finance-OS does NOT do

It will never:

- Execute trades, orders, or transfers.
- Move money between accounts.
- Hold custody of assets.
- Call broker/exchange write APIs.
- Auto-rebalance a portfolio.
- Produce signals as order tickets.
- Export your private financial data anywhere.
- Run the Advisor v2 committee or fine-tune any LLM unless you explicitly enable it after a dedicated ADR.

If a feature even *sounds* like execution, it is not implemented. Finance-OS is **advisory-only**.

## 3. What the AI Advisor does

The Advisor is a deterministic-first pipeline with optional LLM enrichment. On a daily run it:

1. Builds a financial context bundle from your local DB (cached snapshots, never live calls in the request path).
2. Computes deterministic spend, signal, and risk scores via `packages/finance-engine`.
3. Optionally calls OpenAI for the daily brief / chat / relabel, gated by `AI_OPENAI_API_KEY` + per-feature flags.
4. Optionally calls an Anthropic challenger to red-team the brief.
5. Persists recommendations, runs, journal entries, post-mortems, and eval scorecards.
6. Produces a closed-vocabulary advisor readiness level via `/dashboard/data-quality` → `advisorReadiness.level` ∈ `not_ready | limited | usable_with_caveats | ready`.

## 4. What the AI Advisor does NOT do

- It does not place orders, transfers, or trades.
- It does not produce binding investment advice.
- It does not export your data.
- It does not run Advisor v2 by default.
- It does not fine-tune any model.
- It does not call providers live during a request — it reads cached snapshots.
- It does not include free-text journal notes in replay or fine-tuning-readiness responses.

## 5. What happens during a daily run

When you call `POST /dashboard/advisor/run-daily` (or the worker schedules it, if you opted-in):

1. The advisor reads cached financial state.
2. Recurring commitments, budgets, signals, and goals are scored deterministically.
3. The classifier model (cheap) labels ambiguous transactions if `AI_RELABEL_ENABLED=true`.
4. The daily model produces the brief.
5. The challenger model (if `AI_CHALLENGER_ENABLED=true`) red-teams it.
6. Recommendations and the new run are persisted.
7. Eval scorers (causal, strategy, risk, post-mortem, closure) run against the run's outputs and update trends.

No provider HTTP request is initiated by the daily run. Provider data is whatever the **last successful sync** stored.

## 6. What happens during provider syncs

Provider syncs are run by the **worker**, not by API request handlers. They:

- Fetch fresh data from Powens / IBKR Flex / Binance when their scheduled cadence triggers.
- Encrypt sensitive payloads at rest using the configured encryption key.
- Update health snapshots used by `/dashboard/providers/diagnostics`.
- Never expose raw payloads, tokens, signatures, or account ids to the API/web tier.

You do not need to schedule syncs for daily use. You can, however, manually trigger refresh via the existing manual-refresh use-case if you suspect data is stale.

## 7. How Powens / IBKR / Binance fit in

| Provider | Use | Live-called by API routes? | Sensitivity |
|---|---|---|---|
| Powens   | Bank accounts (read-only) | No — admin reads cached snapshots | Tokens stored encrypted; never in browser |
| IBKR     | Brokerage holdings via Flex Query (read-only) | No | Flex token + raw XML stay server-side, redacted from logs |
| Binance  | Crypto balances (read-only) | No | API key + secret + signature stay server-side, redacted |

All three are wired through `provider-runtime` health-only diagnostics. Their `provider.call()` returns `unsupported_capability` with reason `deferred_read_routing` — read routing through `provider.call()` is intentionally deferred.

## 8. How provider diagnostics work

`GET /dashboard/providers/diagnostics` returns a closed-vocabulary status snapshot of every registered provider:

- Status is one of: `ok | degraded | down | unknown | disabled`.
- It does **not** call the upstream — it reads the last persisted health snapshot.
- It does **not** return tokens, secrets, account ids, signatures, or raw payloads.
- Demo mode returns deterministic fixtures.

Use it to confirm that providers are visible. If a provider is `down` or `unknown` for a long time, look at the worker logs.

## 9. How data quality works

`GET /dashboard/data-quality` returns dimension-level scores for: `banking | investments | crypto | market_data | news | advisor_memory | evals | post_mortems`.

Each dimension has:

- `score` 0–100, `grade` (closed vocabulary), `freshnessMinutes`, `stale` flag, `degraded` flag, `missing` flag, `reasons[]`, contributing `providers[]`.

A `stale` Powens snapshot drags `banking` down. A missing news provider drags `news` down. The dimension grades roll up into `overall.grade` AND, separately, into `advisorReadiness.level`.

**Vocabulary boundary.** `overall.grade` and `dimension.grade` are NOT the same enum as `advisorReadiness.level`. Keep them mentally separate:
- `DataQualityGrade` (used for `overall.grade` and `dimension.grade`): `excellent | good | usable | degraded | insufficient | unknown`.
- `AdvisorReadinessLevel` (used only for `advisorReadiness.level`): `ready | usable_with_caveats | limited | not_ready`.

## 10. How `advisorReadiness` works

`advisorReadiness.level` is a closed-vocabulary signal that tells you how to read the Advisor's output. It is **not** a verdict on the recommendations themselves — Finance-OS is advisory-only:

- `ready` — read recommendations as usable within their stated caveats.
- `usable_with_caveats` — read recommendations as usable within their stated caveats, with extra attention to the listed caveats and stale inputs.
- `limited` — read as exploratory only; one required input is missing or down. Do not act yet.
- `not_ready` — do not act on advisor output. Two or more required inputs are missing or down.

In every case, recommendations remain advisory-only. Consider acting only when readiness is `ready` or `usable_with_caveats`, and even then treat the output as input to your own decision, not as a directive.

## 11. How Decision Journal works

The Decision Journal is the canonical learning loop. For each recommendation you read, record:

- `decision`: `accepted | rejected | deferred | ignored` — **the structured signal that matters most**.
- `reasonCode` — a short structured code (closed vocabulary).
- `expectedOutcomeAt` — when the decision should be evaluated.
- Later: `outcomeKind` — the structured outcome label once enough time has passed.
- Optional `learningTags` — short structured tags.
- Optional `freeNote` — a short, factual, non-sensitive comment.

**Structured fields matter most.** Replay, behavior analytics, evals, and post-mortems read the structured fields. `freeNote` is intentionally optional, and is intentionally excluded from `replay` and `fine-tuning-readiness` responses.

**`freeNote` rules.** Keep it short and factual. **Never** put:

- account numbers or partial account ids
- secrets, tokens, API keys, signatures
- raw transaction strings
- raw provider payloads (Powens / IBKR / Binance JSON or XML)
- highly personal details

If a `freeNote` would need any of the above to be useful, leave it empty and rely on the structured fields. Replay and fine-tuning-readiness responses already strip `freeNote`; this rule is a defense-in-depth posture, not a runtime requirement.

The journal is the **only** mechanism by which the Advisor can learn from your decisions. It feeds PostgreSQL first (canonical), and optionally feeds the Knowledge Graph (see §15).

## 12. How Post-Mortems work

When a recommendation hits its `expectedOutcomeAt` (or batches stale ones), the post-mortem runner takes journal entries + outcomes and asks the LLM (Anthropic by default) to summarise what happened, what changed, and what should be remembered.

**Two independent gates** — both default `false`:

- `AI_POST_MORTEM_ENABLED=false` — the **runner itself**. When `false`, `POST /dashboard/advisor/post-mortem/run` returns `skipped_disabled`. This gate blocks **both** the manual/admin trigger and the scheduler.
- `AI_POST_MORTEM_AUTO_RUN_ENABLED=false` — the **worker scheduler only**. When `false`, the worker emits no cron trigger; the admin POST still works if the first gate is on.

You can enable the runner without enabling the scheduler. The weekly post-mortem routine in section C only applies **after** you intentionally enable `AI_POST_MORTEM_ENABLED=true` and/or manually trigger a run.

A Redis lock (`finance-os:post-mortem:scheduler-lock`, TTL 1800s) prevents parallel runs.

## 13. How Replay works

`GET /dashboard/advisor/replay` returns a closed-vocabulary list of past recommendations + decisions + outcomes for review. It is read-only and **never** includes:

- `freeNote`
- raw provider payloads
- account ids, tokens, secrets, signatures

It is the right surface to use during the **weekly** routine to review your own decision quality.

## 14. How Fine-Tuning Readiness works

`GET /dashboard/advisor/fine-tuning-readiness` is a deterministic **gate**, not a launcher:

- `level` ∈ `not_recommended | premature | candidate_later | candidate_now`
- `reasons[]`, `blockers[]`, `requiredBeforeConsidering[]`, `safeAlternatives[]`, `caveats[]`

It is admin-only. It does **not** export training data. It does **not** call any fine-tuning API. No fine-tuning code path exists in this repo. The default expected result is `not_recommended` or `premature`. The endpoint exists to **stop** premature fine-tuning, not to enable it.

## 15. How the Knowledge Graph is populated

The canonical learning loop writes to **PostgreSQL first**. Decision Journal entries, outcomes, and post-mortem outputs are persisted to Postgres before anything else. The Knowledge Graph is an **optional enrichment** layer on top.

The graph is populated **only when all three** of the following hold:

1. `KNOWLEDGE_SERVICE_ENABLED=true`
2. `ADVISOR_GRAPH_INGEST_ENABLED=true`
3. The relevant graph hook runs successfully (network reachable, no transient error).

If any of those is false, **you are still feeding the Advisor's canonical learning loop through Postgres** — the graph simply isn't enriched yet. There is no data loss; the journal, replay, evals, post-mortems, and behavior analytics all read from Postgres.

When the graph is on, the mapping is:
- Decision Journal entries → `DecisionPoint` nodes.
- Post-mortem outputs → `LearningAction` nodes.
- Recommendations and runs → linked references.

The graph is **Advisor memory only** — it is not the agentic developer pipeline (Codex/Claude). Trading/technical nodes are knowledge-only and paper-trading-ready at most.

## 16. Demo vs admin mode

Finance-OS has a strict dual path:

- **Demo mode** returns deterministic fixtures. No live data, no provider calls, no LLM calls.
- **Admin mode** is gated by your session and shows your real data.

This split is enforced everywhere a route can return data. It is what makes the app safe to share screenshots and to develop against without leaking your finances.

## 17. Feature flags safe to enable

Once you have used the app for a few days and are confident:

| Flag | Default | Safe to enable when |
|---|---|---|
| `AI_ADVISOR_ENABLED` | `true` | Already on; keeps Advisor available |
| `AI_CHAT_ENABLED` | `true` | You want grounded chat |
| `AI_CHALLENGER_ENABLED` | `true` | You want a red-team pass |
| `AI_RELABEL_ENABLED` | `true` | You want LLM re-classification of ambiguous transactions |
| `AI_KNOWLEDGE_QA_RETRIEVAL_ENABLED` | `true` | You want educational Q&A retrieval |
| `KNOWLEDGE_SERVICE_ENABLED` | `false` | You have started the knowledge service and want admin queries |
| `AI_POST_MORTEM_ENABLED` | `false` | You have ≥10 journal entries with outcomes |
| `AI_POST_MORTEM_AUTO_RUN_ENABLED` | `false` | You want the worker to fire post-mortems on cron |
| `ADVISOR_GRAPH_INGEST_ENABLED` | `false` | `KNOWLEDGE_SERVICE_ENABLED=true` AND the `advisor_memory` dimension grade is at least `usable` |
| `VITE_LEARNING_LOOP_UI_ENABLED` | `false` | You want the Decision Recorder / Eval Scorecard / Post-Mortem feed UI |

## 18. Flags that must remain disabled for now

- `AI_ADVISOR_V2_ENABLED` — must stay `false` until a dedicated ADR. Advisor v2 is a skeleton, not a product.
- Fine-tuning is **not behind a flag** because no fine-tuning code path exists. Do not invent one.
- `AI_DAILY_AUTO_RUN_ENABLED` — keep `false` while you want the manual-first cadence.

## 19. Warning signs that should narrow how you read the Advisor

Treat Advisor output as exploratory only — or skip it entirely for the day — when any of these are true:

- `advisorReadiness.level = not_ready` (do not act) or `limited` (read as exploratory only).
- Any of `banking | investments | crypto` dimensions show `stale=true` and you have not refreshed in >24h.
- A provider has been `down` for >24h and the Advisor is still recommending around it.
- `evals` or `post_mortems` dimensions have grade `insufficient` or are missing entirely.
- A recommendation's `caveats[]` mentions stale or missing data and you didn't already fix the upstream issue.

In all these cases, treat output as "interesting reading" and revisit after a sync. Recommendations remain advisory-only in every case.

## 20. What to do when data quality is degraded

1. Open `/dashboard/data-quality`.
2. Find the dimension that's `degraded` or `stale`.
3. Open `/dashboard/providers/diagnostics` for the same provider family.
4. If the provider is `down` or `disabled`: check env / connection settings (without rotating credentials).
5. If the provider is `ok` but `freshnessMinutes` is high: trigger a manual refresh.
6. Re-check both endpoints after the refresh.
7. Only resume daily routine when `advisorReadiness.level` is `ready` or `usable_with_caveats`.

## 21. What to do when a provider is stale

- Powens stale: re-link the bank connection from the existing UI; do **not** reset tokens by hand.
- IBKR stale: regenerate the Flex Query if it expired (server-side env), do not commit tokens.
- Binance stale: confirm API key permissions are still **read-only**. If not, rotate via the Binance UI and update env. Never paste secrets into the app UI.

## 22. What to do when Advisor output feels wrong

Walk this checklist before "the Advisor is broken":

1. Is `advisorReadiness.level` `ready` or `usable_with_caveats`?
2. Are the relevant providers fresh?
3. Did you record outcomes for past recommendations? (Stale journal → poor evals.)
4. Are caveats[] giving you a hint about *why* the recommendation is uncertain?
5. Have you reviewed the last week's replay?

If after those steps the recommendation still looks wrong: log a Decision Journal `rejected` entry with a structured reason. Do **not** edit code. Real signal comes from journaling, not from changing prompts.

## 23. Why Advisor v2 is default-off

Advisor v2 is the **committee skeleton** (context_summarizer, opportunity_mapper, risk_reviewer, challenger, final_synthesizer) — see [docs/research/advisor-external-repos-audit.md](../research/advisor-external-repos-audit.md). It is intentionally a deterministic stub:

- No LLM calls.
- No provider calls.
- No graph calls.
- No DB writes.
- No recommendation persistence.

It exists to publish a stable contract for a future committee. Enabling it produces no value yet. Keep it `false` until a dedicated ADR commits to v2.

## 24. Why fine-tuning is not enabled

Fine-tuning would require:

- Months of high-quality decision/outcome data.
- A documented ADR.
- An export pipeline that scrubs sensitive details.
- A canary plan and a rollback plan.
- A cost analysis vs. prompt + retrieval improvements.

None of that exists yet. The fine-tuning readiness gate is there to **stop you from prematurely fine-tuning**, not to encourage it. The right move first is always: more eval cases, better prompts, better retrieval, better journaling.

## 25. Why the app is advisory-only and never executes

By design and by repository invariant: Finance-OS does not execute. It cannot place orders, move money, sign trades, or write to broker/exchange APIs. There is no execution code path, and the Advisor's output vocabulary explicitly forbids execution terms.

This is **not** a feature-flag toggle. It is an architectural property. Do not ask Codex/Claude to add execution. If you ever need execution, that is a separate product that does not live in this repo.

---

# How I should use the app

This section is the action plan. Treat it as a contract with yourself.

## A. First-setup checklist

Before any daily use:

- [ ] Open `/dashboard/providers/diagnostics`. Confirm Powens / IBKR / Binance show `ok` (or `degraded` with a clear note).
- [ ] Open `/dashboard/data-quality`. Confirm `advisorReadiness.level` is `ready` or `usable_with_caveats` (the two values that justify reading recommendations).
- [ ] Confirm Powens connection is fresh (`freshnessMinutes` < a few hours during a workday).
- [ ] Confirm IBKR status is visible (Flex Query token present server-side).
- [ ] Confirm Binance status is visible and **read-only** key.
- [ ] Confirm provider statuses are not leaking raw details (no tokens, account ids, raw XML/JSON).
- [ ] Confirm Advisor readiness level is shown in the cockpit.
- [ ] Confirm post-mortem scheduler status (`AI_POST_MORTEM_AUTO_RUN_ENABLED`) — should be `false` initially.
- [ ] Confirm Graph ingest status (`ADVISOR_GRAPH_INGEST_ENABLED`) — should be `false` initially.
- [ ] Confirm `AI_ADVISOR_V2_ENABLED=false`.
- [ ] Confirm there is no fine-tuning code path you can accidentally trigger.
- [ ] Confirm the app cannot place orders. (You verify by absence — no order routes exist.)

## B. Daily routine — 5 to 10 minutes

1. Open the dashboard.
2. Glance at `overall.grade`. If it is `degraded` or `insufficient`, stop here and run section 20 instead.
3. Check banking freshness for accounts you actually use today.
4. Check investments and crypto freshness if relevant to your decisions today.
5. Read Advisor recommendations **only if** `advisorReadiness.level` is `ready` or `usable_with_caveats`. Read them as usable within their stated caveats — they remain advisory-only.
6. For each recommendation, fill the **structured fields first**: `decision` ∈ `accepted | rejected | deferred | ignored`, `reasonCode`, `expectedOutcomeAt`, optional `learningTags`.
7. Add a short, factual `freeNote` only when the structured fields are not enough. Skip it if you would need sensitive details to make it useful.
8. **Never** put account numbers, full transaction strings, tokens, secrets, raw provider payloads, or highly personal details in `freeNote`.
9. Do **not** treat any Advisor recommendation as an order signal — Finance-OS is advisory-only.
10. Do **not** act on pattern detections (Trading Lab) without a separate human review.

## C. Weekly routine — 20 to 30 minutes

1. Open `/dashboard/advisor/replay`. Review the last 7 days of recommendations + decisions.
2. Review behavior analytics; look for repeated rejections or ignored entries.
3. Review post-mortems **only if you have explicitly enabled `AI_POST_MORTEM_ENABLED=true` or manually triggered a run**. By default both gates are off and there is nothing to review here.
4. Add **outcomes** to past decisions whose `expectedOutcomeAt` has passed.
5. Identify repeated failure modes (e.g. "I keep ignoring the same kind of recommendation").
6. Check stale providers and refresh.
7. Eyeball data-quality trends manually.
8. Visit Trading Lab hypotheses; archive weak or stale ones.
9. Create paper scenarios only for ideas worth tracking; never as orders.
10. Keep all notes factual and short.

## D. Bi-weekly routine

1. Open `/dashboard/advisor/fine-tuning-readiness`.
2. Confirm it returns `not_recommended` or `premature`. If it returns `candidate_later`, **do not** fine-tune yet — write down the reasons it advances.
3. Spend the saved time **expanding eval cases** (in `packages/ai/src/evals/default-eval-cases.ts`) instead of fine-tuning.
4. Improve prompts / retrieval / context first. Model customization is the last resort.
5. Review Knowledge Graph memory topics if `KNOWLEDGE_SERVICE_ENABLED=true`.
6. Validate whether the Advisor is actually learning from your decisions and outcomes (does the post-mortem narrative cite real journal entries?).

## E. How to feed the Knowledge Graph properly

- Use the Decision Journal **consistently** — it is the only signal source.
- Record outcomes after enough time has passed; don't backfill outcomes you don't actually know.
- Prefer factual notes over emotional ones.
- Link decisions to recommendations whenever possible.
- Use post-mortems to capture what changed (data, market, your intent).
- **Never** put secrets, account numbers, or raw transaction details in free text.
- Do not manually add noisy knowledge nodes.
- Let repeated patterns emerge through decisions, outcomes, post-mortems, and evals — not through manual node-shaping.

## F. What I should NOT do

- Do not enable Advisor v2 just because the flag exists.
- Do not enable graph ingest without first checking `data-quality` and security posture.
- Do not use pattern detections as trading signals.
- Do not use fine-tuning until the gate says `candidate_later` **and** there is an ADR.
- Do not add more providers until the current ones are stable for two weeks.
- Do not keep building before two weeks of real usage.
- Do not act on output when `overall.grade` is `degraded` or `insufficient`, or when `advisorReadiness.level` is `limited` or `not_ready`.
- Do not put secrets, account numbers, raw transaction strings, tokens, signatures, raw provider payloads, or sensitive personal details into `freeNote`.
- Do not bypass demo/admin guards "just to test".
- Do not export private financial data.

## G. 14-day dogfooding plan

The point of this plan is to use the app **as-is** and produce a real-usage report. No feature work during these 14 days unless something is **broken**.

**Day 1**
- Run section A (first-setup checklist).
- Record first manual decisions in the journal.
- Do not change code unless something is broken.

**Days 2–4**
- Use the dashboard daily.
- Record decisions.
- Observe freshness drift.
- Do not add features.

**Days 5–7**
- Review the first replay.
- Review behavior analytics.
- Add missing outcomes.
- Note frictions in a personal scratch file (not in code).

**Days 8–10**
- Check post-mortems (only if you enabled `AI_POST_MORTEM_ENABLED` for the dogfood).
- Check Knowledge Graph memory.
- Review bad recommendations one-by-one.
- For each bad recommendation, decide: data-quality issue, prompt issue, missing context, or UI issue.

**Days 11–14**
- Produce a written **dogfooding report** with five sections:
  1. What was useful.
  2. What was confusing.
  3. What data was stale.
  4. What recommendations were wrong, and why.
  5. What should be fixed before any new feature is started.
- Only after this report is written may a new roadmap be considered.

## H. Definition of "ready for real use"

Finance-OS is ready for real personal use when **all** of the following hold:

- Providers visible: `/dashboard/providers/diagnostics` shows the three core providers and none are `down` for >24h.
- Data quality at least usable: `overall.grade` is `usable`, `good`, or `excellent` for ≥ 7 consecutive days.
- Advisor readiness: `advisorReadiness.level` is `ready` or `usable_with_caveats` on those same days.
- No sensitive leakage: a redaction sentinel sweep on every advisor/data-quality/diagnostics response returns clean.
- Daily routine stable: section B can be executed in under 10 minutes without confusion.
- You can articulate **why** the output is limited or not_ready when it is, without asking Claude.
- You don't need Claude every day to interpret basic status.

When all of those are true, Finance-OS has achieved "stop building, start using". The next phase is real usage and bug fixes only — not new features.
