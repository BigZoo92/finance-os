# Core Context Pack — Finance-OS

> Auto-generated. Source: AGENTS.md
> Do not edit directly — regenerate with `pnpm agent:context:pack`

## Global Invariants

- Finance-OS is a strictly personal, single-user finance cockpit.
- Every feature must preserve two explicit execution paths:
  - `demo` is the default and must use deterministic mocks only, with no DB reads/writes and no provider calls.
  - `admin` enables DB and providers behind the admin session cookie and/or valid signed internal state.
- Fail soft: if Powens or any other integration fails, the app must remain usable with clear fallback messaging.
- Privacy by design is mandatory:
  - never put secrets in `VITE_*`
  - never log Powens codes or tokens
  - encrypt sensitive tokens at rest
- Observability is mandatory:
  - propagate `x-request-id` end to end
  - keep API logs structured and secret-safe
  - keep error payloads normalized and safe to expose
  - keep deploy-time probes, smoke checks, and ops alerting aligned with the live route topology
- TypeScript optional-property invariant:
  - `exactOptionalPropertyTypes` is enabled; when an optional field is absent, omit the key entirely instead of passing `undefined`
- Ops alert-quality conventions (for monitor rules, digests, and review notes):
  - priority levels must be explicit and map to review severity: `critical -> P0`, `high -> P1`, `medium/low -> P2`
  - scoring must be transparent and additive: `impact (0-5) + confidence (0-3) + recency (0-2)`; include the final score in docs/PR notes when adding or tuning alerts
  - anti-noise defaults are required: deduplicate by fingerprint, suppress repeats inside a cooldown window, and prefer state-change notifications over interval spam
  - digests must be decision-first: include only top actionable items first (priority, score, owner, next step), then collapse informational tails to keep the signal concise
- Analytics conventions and source-of-truth requirements:
  - analytics is descriptive telemetry, never an execution dependency; core product behavior must not rely on event delivery
  - every metric, chart, or dashboard must declare one canonical source of truth (DB table/view, API contract, or deterministic demo fixture) and link to it in local docs when introduced
  - source-of-truth graphs must show upstream provenance and downstream consumers so reviewers can trace transformations end to end
  - assumptions (time windows, freshness SLOs, sampling, currency/FX handling, timezone boundaries, and null/default semantics) must be explicit and versioned with the feature
  - when data is delayed, missing, or inconsistent, fail soft with clear fallback UI copy and degraded-but-usable defaults instead of blocking flows
  - demo-mode analytics must remain deterministic and mock-backed; admin-only analytics may use live providers but must keep demo/admin split explicit
- Public traffic terminates on `apps/web` only. `/api/*` is proxied internally to `API_INTERNAL_URL`; `apps/api` should not require its own public route.
- The Temporal Knowledge Graph / GraphRAG layer is internal-only derived memory for the AI Advisor. It enriches, explains, and challenges deterministic finance-engine outputs; it is not a source of truth for transactions, not part of the agentic development pipeline, and must never enable trading execution.
- Knowledge graph demo mode must use deterministic fixtures only. Admin mode may call the internal knowledge service, but it must fail soft when unavailable and must preserve request IDs, safe errors, provenance, confidence, recency, temporal validity, and contradiction history.
- `batch:` issues are first-class product briefs. Preserve their context, objectives, design principles, non-negotiable constraints, expected result, cost bias, decision rules, and explicit out-of-scope when spawning downstream work.
- Autopilot workflow invariants:
  - batch spec expansion must stay 1:1 with the raw bullet list, with no extra spawned requested specs
  - only one implementation lane may auto-start from a batch at a time; the rest stay queued
  - `issue_comment` workflows must gate on Codex-authored comments before doing work
  - implementation PRs are created automatically as draft `agent/impl-*` branches; Codex should implement by replying on the PR thread with `AUTOPILOT_PATCH_V1`, and autopilot applies that patch onto the same branch
  - PR-thread implementation patches must be Git-generated diffs that pass `git apply --check`; autopilot may use `git apply --recount` to tolerate hunk-count drift, but hand-written malformed hunks still count as a workflow failure
  - once an implementation PR is created, the linked `spec:` and `improve:` issues are closed as `completed`; if that PR is closed without merge, autopilot reopens and requeues the linked work
  - only one autopilot implementation PR may stay open at a time; extra improve issues wait in `autopilot:queued-pr`
  - only one writer may own an active autopilot implementation branch at a time; if a human or Claude takes over locally, stop prompting Codex on that branch until the handoff is complete
  - merge-on-green may only promote and merge an autopilot PR after real non-stub files land on the branch, all `.github/agent-stubs/**` files are gone from the PR diff, and the branch is up to date with green CI
  - failed CI on an autopilot implementation PR must be summarized back onto the PR thread so Codex sees the runner error instead of relying on partial local checks
- When code changes alter local architecture, contracts, env, testing, or review guidance, update the nearest `AGENTS.md`, the relevant `docs/agentic/*.md`, and any affected skill in `.agents/skills/` in the same change.
- When modifying the dashboard news feature (fetch, ingestion, cache, fallback, fixtures, schema, or UI wiring), update [docs/context/NEWS-FETCH.md](docs/context/NEWS-FETCH.md) in the same change.
- Design system and frontend identity invariants (direction "Aurora Pink"):
  - Always consult `DESIGN.md` before modifying any UI component, layout, or visual styling.
  - Always consult `docs/frontend/design-system.md` before creating or modifying a shared component.
  - Always reuse or extend the existing design system tokens (colors, spacing, radius, motion, typography) before introducing isolated values.
  - Always preserve the Aurora Pink brand identity: rose magenta primary (`oklch ~355° hue`), electric violet accent-2 (`oklch ~295° hue`), Inter + JetBrains Mono typography, and the 4-step surface depth system (`surface-0/1/2/3`). Never revert to the legacy amber/gold primary.
  - Always prefer the canonical Finance-OS surface components (`KpiTile`, `Panel`, `PageHeader`, `RangePill`, `BrandMark`, `AuroraBackdrop`, `StatusDot`) before coding a bespoke equivalent.
  - React Bits components live under `apps/web/src/components/reactbits/` as MIT + Commons Clause copies; customize tokens in-place rather than re-installing via CLI.
  - Always maintain mobile responsiveness, performance constraints, and accessibility (including `prefers-reduced-motion`) when changing UI.
  - When adding new design tokens, patterns, components, or routes, update the relevant frontend documentation (`DESIGN.md`, `docs/frontend/*.md`, `docs/context/DESIGN-DIRECTION.md`) in the same change.
  - When modifying navigation or route structure, update `docs/frontend/information-architecture.md` and the `NAV_ITEMS` in `apps/web/src/components/shell/app-sidebar.tsx`.
  - Financial amounts must use the `.font-financial` class (monospace, tabular figures) for readability.
  - Use semantic color tokens (`positive`, `negative`, `warning`) for financial data, never hardcoded colors and never the brand rose/violet for signal.

## Verification

- Start with the smallest checks that match the changed scope.
- Use canonical repo-wide commands from [package.json](package.json):
  - `pnpm check:ci`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm -r --if-present test`
  - `pnpm -r --if-present build`
- Use [scripts/smoke-api.mjs](scripts/smoke-api.mjs) and [scripts/smoke-prod.mjs](scripts/smoke-prod.mjs) when route, proxy, or deploy behavior changes.
- For production Compose alerting or health-monitor changes, run `node --test infra/docker/ops-alerts/monitor.test.mjs` in addition to the relevant runtime checks.
- Validate the agentic foundation after changing `AGENTS.md`, `.agents/skills/`, or `docs/agentic/`:
  - `node .agents/skills/scripts/validate-agent-foundation.mjs`

## Review Severity

- `P0`: security issue, secret leak, Powens token/code exposure, data loss, or broken demo/admin split
- `P1`: contract regression, missing demo path, missing behavior-change tests, SSR auth flash regression, unsafe logging, or broken observability wiring
- `P2`: local cleanup or style feedback
- Always check dual-path correctness, `VITE_*` safety, logging safety, observability wiring, and test evidence for behavior changes.
- UI changes require rationale plus screenshot notes; see [docs/agentic/code_review.md](docs/agentic/code_review.md).

## Key Rules

- Single-user finance cockpit, no multi-tenancy
- demo/admin dual-path mandatory
- `exactOptionalPropertyTypes` enabled
- No secrets in VITE_*, no PII logging
- Fail-soft on all integrations
- Public traffic via apps/web only
