# Finance-OS repository instructions

## Product boundaries

- Finance-OS is personal and single-user.
- `demo` is the default: deterministic fixtures only, with no DB, Redis, provider, model, or write side effects.
- `admin` may use live state only behind the admin session. Explicit server-to-server API routes may instead accept a valid `PRIVATE_ACCESS_TOKEN`; Powens callbacks use HMAC-signed state.
- Fail soft: one provider or advisory service must not make the cockpit unusable.
- Public traffic terminates on `apps/web`; `/api/*` is proxied to internal `apps/api` through `API_INTERNAL_URL`.
- The finance engine and normalized source data are authoritative. Analytics, LLM output, and the temporal knowledge graph are derived consumers.
- External investments are read-only analytics: IBKR Flex and signed read-only Binance Spot/Wallet GET allowlists only. Historical read-only records may describe orders, withdrawals, or transfers, but never add mutation or execution capability for trading, orders, withdrawals, transfers, convert, margin/futures, staking/earn, or automatic rebalancing.

## Security and contracts

- Never put secrets in `VITE_*`, browser DTOs/forms, URLs, fixtures, logs, errors, prompts, or analytics.
- Never log Powens callback codes, tokens, decrypted provider payloads, session values, or raw financial payloads.
- Encrypt sensitive tokens at rest with the existing envelope.
- IBKR/Binance credentials are server environment only. Do not read/write legacy `external_investment_credential` rows.
- Propagate `x-request-id` end to end; keep logs structured and error payloads normalized and safe.
- `exactOptionalPropertyTypes` is enabled: omit absent optional keys instead of passing `undefined`.
- Every behavior change preserves and tests both demo and admin paths.

## Engineering quality

- Prefer the simplest correct solution that is modern, performant, maintainable, testable, and consistent with the repository. Complexity must earn its place.
- Avoid over-engineering, speculative abstraction, unnecessary dependencies, duplicated state or work, code smells, and premature optimization.
- For new or materially changed TypeScript, React, backend, worker, module, or build code, apply `finance-os-engineering-optimization`: improve clear local issues in touched code when safe and bounded, and keep optimization within task scope.

## Frontend

- Read `DESIGN.md` before any UI/layout/style change.
- Command Pixel is canonical. Use Geist Sans, Geist Mono, and rare Geist Pixel accents; do not extend the previous luxury/Inter/JetBrains direction.
- Reuse tokens and canonical surfaces before adding values/components. Financial amounts use `.font-financial`; financial signals use `positive`, `negative`, and `warning` tokens.
- Preserve mobile behavior, accessibility, performance, and `prefers-reduced-motion`.
- Navigation changes update the route tree, `apps/web/src/components/shell/nav-items.ts`, and `docs/product.md` when product structure changes.

## Documentation

- Update only the guide whose durable contract changed: `docs/architecture.md`, `docs/product.md`, `docs/configuration.md`, `docs/deployment.md`, `docs/integrations.md`, `docs/advisor.md`, `docs/operations.md`, or `docs/agentic.md`.
- News ingestion/cache/fallback/schema/UI changes update `docs/integrations.md`.
- Do not add implementation diaries, completed plans, generated inventories, or archive folders; Git is the history.
- Run `pnpm docs:check` after Markdown changes.

## Skills and GitNexus

- Canonical skills: `.agentic/source/skills/<name>/SKILL.md`.
- `.claude/skills` and `.agents/skills` are fully generated projections; never edit them directly.
- Use `pnpm agent:skills:sync`, `pnpm agent:skills:check`, and `pnpm agent:skills:list`.
- Use GitNexus query/context for unfamiliar flows, upstream impact before editing functions/classes/methods, and change detection before handoff.
- Refresh only through `pnpm gitnexus:analyze`; raw analyze writes competing agent files.

## Verification and review

- Start with the smallest relevant test, then package lint/typecheck/test/build in proportion to risk.
- Canonical repo commands: `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm -r --if-present test`, `pnpm -r --if-present build`, and `pnpm check:ci`.
- Route/proxy/deploy changes use the smoke scripts. Ops-alert changes also run `node --test infra/docker/ops-alerts/monitor.test.mjs`.
- Review priorities: P0 security/secret/data-loss/execution; P1 demo/admin, auth, contract, observability, or missing behavior-test regression; P2 local maintainability/presentation.
- Never commit, push, deploy, or mutate an external system unless the user asks.
