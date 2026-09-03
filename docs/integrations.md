# Provider integrations

All external ingestion is read-only analytics. Provider calls are admin/runtime behavior and never occur in demo.

## Shared provider contract

`packages/provider-contract` defines capabilities, health, redaction, and error vocabulary; `packages/provider-runtime` applies runtime policy. UI read routes consume normalized local data or cache, not live provider calls. Provider refresh is explicit through an admin/internal route or worker job.

Every adapter preserves provider, source identifier, observed timestamp, normalized timestamp, provenance, request ID, and safe failure state. Raw payloads stay server-side and are never logged or placed in prompts.

## Powens

Powens supplies banking connections, accounts, and transactions.

The connect URL includes a signed callback state from `apps/api/src/auth/powens-state.ts`. It is HMAC-signed with `AUTH_SESSION_SECRET`, contains `admin: true` and an expiry, lasts ten minutes with bounded clock skew, and is verified timing-safely. The callback accepts an admin session or valid state, respects `EXTERNAL_INTEGRATIONS_SAFE_MODE`, audits the decision, encrypts sensitive values, and never returns codes/tokens to the browser.

Typed jobs use `POWENS_JOB_QUEUE_KEY` (`powens:jobs`) and the serializers in `packages/powens/src/jobs.ts`. Connection status vocabulary comes from current schemas/repositories, not historical docs.

## IBKR Flex and Binance

IBKR remains on Flex reporting. Binance remains on signed read-only Spot/Wallet GET allowlists.

Server-only credentials:

- `IBKR_FLEX_TOKEN`
- `IBKR_FLEX_QUERY_IDS`
- `BINANCE_SPOT_API_KEY`
- `BINANCE_SPOT_API_SECRET`

Never add browser credential forms or read/write the legacy `external_investment_credential` table. Forbidden capabilities include orders, withdrawal, transfer, convert, margin/futures, staking/earn mutation, rebalancing, and any hidden execution-ready path.

Jobs use the package key `external-investments:jobs`. Normalized snapshots and provider health feed valuation, the investments UI, diagnostics, and the Advisor. Missing FX/price/provider data must remain visible as partial or stale rather than fabricated.

## News, markets, macro, and social signals

Worker/admin ingestion writes normalized cache/state tables. Dashboard routes read that local state and expose provenance, clustering/deduplication, freshness, and provider health. Supported source code lives under:

- `apps/api/src/routes/dashboard/routes/` and repositories/services for news, markets, signals;
- `apps/worker/src/` schedulers/ingestion;
- `packages/provider-contract` and `packages/provider-runtime`.

Social and news content is untrusted input. Sanitize metadata, bound fetches, enforce destination allowlists, and keep it out of execution decisions. A provider outage degrades its surface only.

The web surfaces are `/radar` (markets overview, deterministic market signals, persisted signal items shown as dated events, freshness; Admin-only manual market refresh) and `/social-intelligence` (followed sources; Admin-only create, enable/disable, delete, X lookup, and manual import). Ingestion runs, provider diagnostics, and raw statuses are not shown on either page and belong to the Ops surfaces.

When news fetching, ingestion, cache, fallback, fixtures, schema, or UI wiring changes, update this document in the same change.

## Adapter checklist

1. Declare capabilities and a closed error vocabulary.
2. Implement deterministic demo fixtures without constructing the live client.
3. Gate refresh with admin/internal auth and propagate `x-request-id`.
4. Redact credentials, signatures, raw bodies, and unsafe error detail.
5. Normalize and deduplicate idempotently.
6. Record freshness, success/failure, coverage, and provenance.
7. Test forbidden methods, timeout/retry, partial failure, duplicate delivery, and demo isolation.
