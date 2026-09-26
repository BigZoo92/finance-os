---
name: finance-os-external-investments
description: Change IBKR Flex or Binance external-investment ingestion while preserving the strict read-only boundary. Use for credentials, adapters, sync jobs, normalization, valuation, diagnostics, UI status, or Advisor investment inputs.
---

# External investments

Read `packages/external-investments/AGENTS.md` if present, then `docs/integrations.md` and the nearest API/worker guide.

## Non-negotiable boundary

- IBKR uses Flex reporting only.
- Binance uses signed read-only Spot/Wallet GET allowlists only.
- Never add mutations for order placement, withdrawals, transfers, convert, margin/futures, staking/earn, rebalancing, or hidden execution-ready DTOs. Read-only provider histories may include orders, trades, transfers, or withdrawals as analytics inputs.
- Preserve both runtime kill switches: `EXTERNAL_INTEGRATIONS_SAFE_MODE` and `EXTERNAL_INVESTMENTS_SAFE_MODE`.
- Credentials are server environment only: `BINANCE_SPOT_API_KEY`, `BINANCE_SPOT_API_SECRET`, `IBKR_FLEX_TOKEN`, `IBKR_FLEX_QUERY_IDS`.
- Provider requests go through `runProviderOperationOrThrow` from `@finance-os/provider-runtime/policy` (timeout, transient-only retry, lease cancellation via `signal`); never add ad-hoc AbortController/setTimeout/sleep retry loops in a client, and map `ProviderOperationError` (`timeout`/`cancelled`) to `PROVIDER_TIMEOUT`.
- Never add browser credential forms or reintroduce the legacy `external_investment_credential` table (dropped in migration 0038).

## Workflow

1. Trace adapter -> normalization -> queue -> repository -> valuation -> API/UI/Advisor consumers.
2. Preserve deterministic demo fixtures and ensure they do not instantiate provider clients.
3. Enforce method/path allowlists before signing Binance requests; redact signatures, query secrets, tokens, and raw payloads.
4. Keep source identifiers, account scope, currency, timestamps, and provenance through normalization.
5. Make ingestion idempotent and fail soft per provider; one stale provider must not break the cockpit.
6. Surface freshness, last success/failure, partial coverage, and valuation assumptions without overstating completeness.

## Verification

Test allowlist rejection, no-mutation methods, signature redaction, credential absence, duplicate snapshots, partial provider failure, FX/missing-price behavior, demo isolation, and Advisor provenance.
