# AGENTS.md - Finance-OS

Last updated: 2026-04-04

Use the nearest `AGENTS.md` before editing. Keep this root file small and durable; push local detail into nested `AGENTS.md`, `.agents/skills/`, and `docs/agentic/`.

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
- Public traffic terminates on `apps/web` only. `/api/*` is proxied internally to `API_INTERNAL_URL`; `apps/api` should not require its own public route.
- `batch:` issues are first-class product briefs. Preserve their context, objectives, design principles, non-negotiable constraints, expected result, cost bias, decision rules, and explicit out-of-scope when spawning downstream work.
- Autopilot workflow invariants:
  - batch spec expansion must stay 1:1 with the raw bullet list, with no extra spawned requested specs
  - only one implementation lane may auto-start from a batch at a time; the rest stay queued
  - `issue_comment` workflows must gate on Codex-authored comments before doing work
  - implementation PRs are created automatically as draft `agent/impl-*` branches; Codex should implement by replying on the PR thread with `AUTOPILOT_PATCH_V1`, and autopilot applies that patch onto the same branch
  - once an implementation PR is created, the linked `spec:` and `improve:` issues are closed as `completed`; if that PR is closed without merge, autopilot reopens and requeues the linked work
  - only one autopilot implementation PR may stay open at a time; extra improve issues wait in `autopilot:queued-pr`
  - only one writer may own an active autopilot implementation branch at a time; if a human or Claude takes over locally, stop prompting Codex on that branch until the handoff is complete
  - merge-on-green may only promote and merge an autopilot PR after real non-stub files land on the branch, all `.github/agent-stubs/**` files are gone from the PR diff, and the branch is up to date with green CI
  - failed CI on an autopilot implementation PR must be summarized back onto the PR thread so Codex sees the runner error instead of relying on partial local checks
- When code changes alter local architecture, contracts, env, testing, or review guidance, update the nearest `AGENTS.md`, the relevant `docs/agentic/*.md`, and any affected skill in `.agents/skills/` in the same change.

## Global Verification

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

## Global Review

- `P0`: security issue, secret leak, Powens token/code exposure, data loss, or broken demo/admin split
- `P1`: contract regression, missing demo path, missing behavior-change tests, SSR auth flash regression, unsafe logging, or broken observability wiring
- `P2`: local cleanup or style feedback
- Always check dual-path correctness, `VITE_*` safety, logging safety, observability wiring, and test evidence for behavior changes.
- UI changes require rationale plus screenshot notes; see [docs/agentic/code_review.md](docs/agentic/code_review.md).

## Local Guides

- [apps/api/AGENTS.md](apps/api/AGENTS.md)
- [apps/web/AGENTS.md](apps/web/AGENTS.md)
- [apps/worker/AGENTS.md](apps/worker/AGENTS.md)
- [infra/docker/AGENTS.md](infra/docker/AGENTS.md)
- [packages/db/AGENTS.md](packages/db/AGENTS.md)
- [packages/env/AGENTS.md](packages/env/AGENTS.md)
- [packages/powens/AGENTS.md](packages/powens/AGENTS.md)
- [packages/redis/AGENTS.md](packages/redis/AGENTS.md)
- [packages/ui/AGENTS.md](packages/ui/AGENTS.md)
- [packages/prelude/AGENTS.md](packages/prelude/AGENTS.md)

## Agentic Maps

- [docs/agentic/INDEX.md](docs/agentic/INDEX.md)
- [docs/agentic/architecture-map.md](docs/agentic/architecture-map.md)
- [docs/agentic/contracts-map.md](docs/agentic/contracts-map.md)
- [docs/agentic/testing-map.md](docs/agentic/testing-map.md)
- [docs/agentic/ui-quality-map.md](docs/agentic/ui-quality-map.md)
- [docs/agentic/release-map.md](docs/agentic/release-map.md)
- Repo-local skills live under `.agents/skills/`.
