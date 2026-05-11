# AI Advisor Roadmap Closure

> Status: **CLOSED** as of 2026-05-10. The next phase is real usage and bug fixes only.
> See [docs/operations/finance-os-real-use-guide.md](../operations/finance-os-real-use-guide.md) for the user operating plan.

This file is the closure checklist for the AI Advisor roadmap. It is the source of truth for "what shipped, what was deferred, what must NOT be enabled, what to do next".

---

## 1. Shipped

The following capabilities are landed and exercised by tests:

- Decision Journal (`/dashboard/advisor/journal*`)
- Post-mortems (`/dashboard/advisor/post-mortem*`, default-off via `AI_POST_MORTEM_ENABLED`)
- Deterministic evals + trends (`/dashboard/advisor/evals`, `/dashboard/advisor/evals/trends`)
- Hypothesis Lab (Trading Lab UI + routes)
- Technical Pattern Detection + SMC/ICT detector pack
- Trading Lab Pattern Detection UI
- Strategy Scorecards + advanced metrics
- Behavior Analytics (`/dashboard/advisor/behavior-analytics`)
- Provider abstraction ADR ([docs/adr/provider-abstraction-v2.md](../adr/provider-abstraction-v2.md))
- `packages/provider-contract`
- `packages/provider-runtime`
- `quant.patterns.detect` provider canary
- News-service diagnostics wrapper
- Sensitive provider diagnostics for Powens / IBKR / Binance (health-only)
- `GET /dashboard/providers/diagnostics`
- `GET /dashboard/data-quality` with `advisorReadiness`
- Advisor v2 skeleton (default-off via `AI_ADVISOR_V2_ENABLED`)
- Replay endpoint (`GET /dashboard/advisor/replay`)
- Fine-tuning readiness gate (`GET /dashboard/advisor/fine-tuning-readiness`)
- AI Advisor operating guide ([docs/operations/ai-advisor-operating-guide.md](../operations/ai-advisor-operating-guide.md))
- Finance-OS real-use guide ([docs/operations/finance-os-real-use-guide.md](../operations/finance-os-real-use-guide.md))

## 2. Intentionally deferred

These are explicitly out-of-scope for closure. Each is documented in its source ADR/wrapper. **Do not start any of them until the 14-day dogfooding report is written.**

- UI for `/dashboard/data-quality` (the operator JSON endpoint exists; cockpit UI is not built).
- Market-data provider migration to `provider-runtime`.
- Knowledge-service full route rewiring through `provider.call()`.
- Sensitive provider read-routing through `provider.call()` (Powens / IBKR / Binance return `unsupported_capability` with reason `deferred_read_routing`).
- Advisor v2 live LLM committee (only the deterministic skeleton is shipped).
- Fine-tuning pipeline (only the readiness gate is shipped).
- Provider live probes (`getHealth()`-only is the contract).
- Automatic trading / execution (forbidden by repo invariant).
- Additional pattern packs.

## 3. Disabled by default

These flags ship `false` and must remain `false` unless you explicitly enable them in your local `.env`/Dokploy after reading [finance-os-real-use-guide.md](../operations/finance-os-real-use-guide.md):

| Flag | Default | Scope | Effect when off |
|---|---|---|---|
| `AI_ADVISOR_V2_ENABLED` | `false` | API | `/advisor/v2/preview` returns `skipped_disabled`; capabilities reports v2 inactive |
| `AI_POST_MORTEM_ENABLED` | `false` | API | `/advisor/post-mortem/run` returns `skipped_disabled` |
| `AI_POST_MORTEM_AUTO_RUN_ENABLED` | `false` | Worker | No cron trigger emitted |
| `ADVISOR_GRAPH_INGEST_ENABLED` | `false` | API | No Decision/Learning ingest call to knowledge-service |
| `KNOWLEDGE_SERVICE_ENABLED` | `false` | API | All graph routes degrade to fixtures |
| `AI_DAILY_AUTO_RUN_ENABLED` | `false` | Worker | No automatic daily Advisor run |
| `VITE_LEARNING_LOOP_UI_ENABLED` | `false` | Web | Decision Recorder / Eval Scorecard / Post-Mortem feed UI hidden |

## 4. Must NOT enable yet

Even though the flags exist, do not enable these without an ADR:

- `AI_ADVISOR_V2_ENABLED` — Advisor v2 is a stub. Enabling it produces no value and may suggest a confidence we have not earned.
- Any future fine-tuning toggle — the readiness gate must say `candidate_later` first **and** an ADR must commit to a canary + rollback plan.

## 5. Known baseline

This is the verified baseline at closure (2026-05-10). Run `pnpm typecheck` and `pnpm test` for current truth — this list is a snapshot, not a contract.

- Provider runtime: redaction covers token/secret/apiKey/access_token/refresh_token/client_secret/cookie/authorization/bearer/signature.
- Provider diagnostics: `getHealth()`-only; `provider.call()` is never invoked from diagnostics.
- Sentinel-leak tests pass for replay, fine-tuning-readiness, data-quality, providers-diagnostics, advisor-v2.
- No `it.skip` / `test.skip` in advisor-related tests.
- No imports of `openai` / `@anthropic-ai/sdk` in `packages/provider-runtime` or `apps/api/src/routes/dashboard/services/providers/`.
- Powens / IBKR / Binance providers expose only health; their `call()` returns `unsupported_capability` with reason `deferred_read_routing`.
- Worker post-mortem scheduler uses Redis lock `finance-os:post-mortem:scheduler-lock` (TTL 1800s) and AbortController timeout 30s.

If `pnpm typecheck` or test suites surface failures, list them in your dogfooding report; do not ship new features to "fix" them.

## 6. Safe next steps

After (and only after) the 14-day dogfooding report:

- Add eval cases that capture failure modes you actually saw.
- Improve prompts / retrieval / context bundles.
- Add **small** UX fixes for frictions surfaced in the report.
- Consider an ADR for any concrete change before writing code.

## 7. Forbidden next steps before dogfooding

The following are off-limits until the dogfooding report is written:

- New Advisor features.
- Advisor v3 design or scoping.
- Enabling Advisor v2 by default.
- Adding LLM calls in new surfaces.
- Adding fine-tuning code.
- Calling fine-tuning APIs.
- Exporting private financial data.
- Adding graph ingest beyond existing behavior.
- Adding provider live probes.
- Changing Powens / IBKR / Binance credentials.
- Changing encryption.
- Changing sync jobs.
- Changing worker schedules.
- Changing Redis locks.
- Adding DB schema/migrations (unless a critical bug requires one — and even then, ADR first).
- Adding UI beyond fixing a broken existing route.
- Changing public API response shapes (except for clearly safe doc fixes).
- Adding trading/payment execution.
- Adding broker/exchange writes.
- Exposing raw provider payloads in logs/prompts/browser.
- Logging secrets/tokens/api keys/signatures/account ids/raw XML/raw JSON.
- Changing production env defaults.

## 8. 14-day usage commitment

The user (app owner) commits to:

- 14 consecutive days of real, daily personal use.
- Daily journal entries for any recommendation read.
- Weekly replay reviews.
- A written dogfooding report at day 14 (5 sections — see [finance-os-real-use-guide.md §G](../operations/finance-os-real-use-guide.md#g-14-day-dogfooding-plan)).
- No new feature work during these 14 days unless something is **broken**.

---

**This is the last entry of the AI Advisor roadmap. There is no Macro 7. Real usage and bug fixes only.**
