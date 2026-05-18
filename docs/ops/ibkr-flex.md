# IBKR Flex — daily sync vs backfill, normalization semantics

## Query mode contract

IBKR Flex Queries are configured **on IBKR's side** (Account Management →
Reports → Flex Queries → Activity Flex Query). Each query has a fixed
period setting; the period cannot be changed at request time.

For Finance-OS we expect **three distinct queries**, identified by their
`queryId`:

| Logical mode               | IBKR period setting        | When it runs                                   |
| --- | --- | --- |
| Daily sync                 | **Last Business Day**      | Cron `daily-intelligence` job, market open ish.|
| Manual backfill — month    | Last Month *or* Last 30 Calendar Days | Admin clicks "Backfill 30d" in the integrations UI. |
| Manual backfill — year     | Last 365 Calendar Days     | Admin one-shot for a fresh deployment / audit. |

The connection record stored at `external_investment_connections` has a
`queryIds: string[]` field — historically a single id was sufficient.
Going forward, the operator should store all three (in any order); the
orchestrator will pick the matching id by intent.

> **Until the per-mode picker lands**, the daily cron will read whichever
> queryId is first in the `queryIds` array. **Move the Last-Business-Day
> queryId to the FIRST position** in the IBKR settings UI to make the cron
> consistent with the new contract.

## Error semantics

The provider error code is mapped to a refresh-job status by the
orchestrator. `packages/external-investments/src/errors.ts` exposes
`isSoftExternalInvestmentError(code)` for this mapping:

| Code                          | Refresh job status | Notes |
| --- | --- | --- |
| `PROVIDER_NO_ACTIVITY` (new)  | `success` / partial-empty | Last Business Day on a weekend/holiday returns an empty statement. **Not an error.** |
| `PROVIDER_PARTIAL_DATA`       | `partial`          | IBKR returned "report not ready yet"; retry budget consumed. |
| `PROVIDER_STALE_DATA`         | `partial`          | Report date older than expected (warned via `STALE_PROVIDER_REPORT_DATE`). |
| `PROVIDER_RATE_LIMITED`       | `partial`          | Retry later. |
| `PROVIDER_TIMEOUT`            | `failed`           | Hit `IBKR_FLEX_TIMEOUT_MS`. |
| `PROVIDER_CREDENTIALS_INVALID`| `failed`           | Token / queryId no longer valid. |
| `PROVIDER_SCHEMA_CHANGED`     | `failed`           | XML shape changed — needs code fix. |
| `NORMALIZATION_FAILED`        | `failed`           | Catch-all fallback; investigate the structured `details`. |

## Normalization warnings (non-fatal)

The normalizer never throws on a partial section; it emits structured
`degradedReasons` per account:

- `CASH_REPORT_MISSING` — no `CashReport` element. Falls back to
  `EquitySummary` if cash > 0 is reported there.
- `PROVIDER_REPORTED_ZERO_CASH` — neither cash report nor equity summary
  cash is positive. May be legitimate (account in equities only).
- `STALE_PROVIDER_REPORT_DATE` — equity summary report date is more than
  30 days behind `generatedAt`.

These warnings flow up to the Ops Refresh Center as part of the run
`details` and do not change the run status.

## Logging contract

The Flex client must never log raw token / queryId values. Helpers:
`toSafeExternalInvestmentErrorMessage(error)` redacts `token=`, `apiKey=`,
`signature=` query parameters. Use it before forwarding an error to
`logApiEvent()`.

## What to set in IBKR Account Management

1. Sign in → Reports → Flex Queries → Activity Flex Query.
2. Create three queries — one per logical mode above — each with the
   period set appropriately (Last Business Day, Last Month, Last 365 Days).
3. Make sure every query includes the sections Finance-OS reads:
   AccountInformation, OpenPositions, Trades, CashTransactions, CashReport,
   EquitySummary.
4. Copy each `queryId` and add it to the connection in the Finance-OS
   integrations page (Patrimoine → Integrations → IBKR → queryIds).
5. **Verify the Last Business Day query is FIRST in the list** until the
   per-mode picker lands.

## What still needs to happen in code (follow-up tickets)

- Producer side: in the orchestrator's IBKR runner, detect "empty
  statement" (zero positions, zero trades, zero cash transactions for the
  reporting period) and raise `PROVIDER_NO_ACTIVITY` instead of a generic
  partial. The error code + helper are already in place.
- Per-mode picker: replace the "first queryId in the array" heuristic with
  an intent-aware picker (daily / backfill-month / backfill-year).
- Surface normalization `degradedReasons` in the Ops Refresh Center detail
  view.
