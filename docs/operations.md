# Operations

## Daily posture

1. Confirm the cockpit loads in demo mode.
2. In admin mode inspect provider diagnostics and data quality before refreshing.
3. Run manual refresh/orchestration only when source freshness requires it; watch the operation status rather than repeatedly submitting.
4. Review stale/partial badges, the Advisor evidence window, and any P0/P1 actionable alert.
5. Keep decision journal and post-mortem entries factual; they are evidence for review, not execution instructions.

## Operational surfaces

- `/couts`: human cost view with fixed estimates, measured usage, provenance, currency, and incomplete-coverage states.
- `/sante`: provider health, data freshness, valuation coverage, unresolved assets, and recovery links without raw operational diagnostics.
- `/integrations`: provider lifecycle and the single UI owner for Powens, IBKR, and Binance synchronization.
- `/orchestration`: registered job status, global/manual runs, cancellation/recovery, recent results, valuation dry run, and confirmed Social/X maintenance actions.
- `/dashboard/providers/diagnostics`: admin-only read-only provider health snapshot.
- `/dashboard/data-quality`: local data-quality/readiness view; it does not trigger provider refresh.
- `/dashboard/advisor/manual-refresh-and-run`: guarded, locked orchestration with operation status.
- web `/healthz`, API `/health`, worker heartbeat, and internal service health checks.
- `infra/docker/ops-alerts`: 5xx probes, service health, heartbeat freshness, and disk capacity.

Exact route prefixes are mounted by `apps/api/src/routes/dashboard/router.ts`; tests beside each route are the contract.

Demo renders deterministic fixtures for the Ops routes and exposes no mutation controls. Admin actions preserve server locks, cooldowns, quotas, read-only provider boundaries, and explicit confirmations. UI feedback is intentionally human and safe; request IDs and raw errors remain available only to authorized operational tooling and structured logs.

## Degraded provider

1. Check configuration presence without printing values.
2. Compare last success/failure, freshness, provider-specific status, and request ID.
3. Determine whether the failure is auth/reconnect, rate limit, transient network, invalid payload, or local persistence.
4. Preserve cached/local data with a degraded marker; do not disable unrelated providers.
5. Retry only through the supported admin/worker path and respect locks/cooldowns.
6. Confirm recovery generates a state-change resolution, not repeated interval noise.

For Powens reconnect, use the signed connect flow. For IBKR/Binance, rotate server environment credentials—never add or recover a browser/database credential workflow.

## Alert policy

- `critical -> P0`, `high -> P1`, `medium/low -> P2`.
- Score = impact (0-5) + confidence (0-3) + recency (0-2).
- Deduplicate by fingerprint, suppress during cooldown, and prefer state transitions.
- Digest order: priority, score, owner, next step; collapse informational tails.

Monitor changes require `node --test infra/docker/ops-alerts/monitor.test.mjs`.

## Incident triage

Use the request ID to follow web -> API -> worker/provider. Inspect structured logs without copying tokens, URLs with secrets, raw bodies, or resolved environment. Classify:

- P0: secret exposure, unauthorized access, data loss, execution path;
- P1: demo/admin breach, broken contract, persistent provider/data pipeline, failed production probe;
- P2: isolated presentation or maintenance defect.

If only Advisor/knowledge/quant is unavailable, keep deterministic cockpit features online. If persistence integrity is uncertain, stop writes for the affected ingestion path and preserve evidence before retrying.

## Useful checks

```text
pnpm env:check:prod
pnpm docker:check
node --test infra/docker/ops-alerts/monitor.test.mjs
pnpm smoke:api
pnpm smoke:prod
```

Release and rollback procedures are in [Deployment](deployment.md); provider boundaries are in [Integrations](integrations.md).

## Measured guardrails

- `pnpm check:bundle-budget` measures the built web client (gzip and raw bytes, largest chunk) against `apps/web/bundle-budget.json`; CI fails when a budget is exceeded. Raise a budget only in the change that explains the growth.
- Every web response carries the baseline security headers (`apps/web/src/lib/security-headers.ts`: nosniff, no-referrer, restrictive permissions policy, `DENY` framing, `frame-ancestors 'none'`, no indexing, HSTS on HTTPS in production) and a `server-timing: app;dur=<ms>` header; requests slower than `WEB_SLOW_REQUEST_MS` (default 2000) are logged as `[web:ssr] slow request` without payloads.
- The API logs `api request completed` with `durationMs`, `status` and `requestId` for every request; correlate with the web `x-request-id`, which the `/api` proxy forwards unchanged.
