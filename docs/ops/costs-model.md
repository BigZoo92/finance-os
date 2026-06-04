# Costs model

`GET /dashboard/costs/overview` (admin) is the single surface that combines the
two cost families. Demo mode returns a deterministic fixture.

## Two families

- **Fixed recurring** — `recurring_provider_cost` rows (e.g. the "2 x 8 EUR" X
  API Basic seats). Each row has `amount`, `currency`, `cadence`
  (`daily`/`weekly`/`monthly`/`yearly`/`one_time`). The overview normalizes any
  cadence to a monthly amount and aggregates by currency
  (`recurringMonthlyByCurrency`, `recurringAnnualByCurrency`).
- **Variable usage** — pay-per-use:
  - X/Twitter from `x_twitter_usage_ledger`. Chargeable cost is
    `coalesce(actual_cost_usd, estimated_cost_usd)` per row, so a billed amount
    always takes precedence over the estimate. `costBasis` is `estimated` /
    `actual` / `mixed`.
  - Advisor model cost from `ai_cost_ledger` (real USD/EUR).

## Actual vs estimated

The UI (`/ia/couts`) must never present an estimate as a real billed amount. The
X variable tile labels the basis (`estimé` / `réel (facturé)` / `réel + estimé`)
and shows the estimated/actual breakdown when available.

## Seeding the fixed recurring cost

`recurring_provider_cost` is empty by default. Seed it with the idempotent,
controlled command (re-running never duplicates; rows carry a stable
`metadata.seedKey`):

```bash
pnpm db:seed:recurring-costs -- --dry-run   # preview
pnpm db:seed:recurring-costs                # apply (2 x 8 EUR X API Basic seats)
```

Source: `packages/db/src/seeds/recurring-provider-cost.ts`. Add/adjust entries
there rather than hardcoding amounts elsewhere.
