# User categorization rules

Reusable, additive transaction categorization rules live in
`user_categorization_rule`. They are applied by the deterministic engine
(`transaction-auto-categorization.ts`) with this precedence:

`manual_override` > `user_rule` > `merchant_rules` > `mcc` > `counterparty` > `fallback`

Rules are evaluated by `priority` descending; disabled rules and rules outside
their `validFrom`/`validTo` window are skipped. The same rules are applied by
the live transaction list AND by the backfill (dry-run by default).

All endpoints are admin-gated; demo mode is read-only / forbidden for mutations.

## Minimal verifiable flow (admin)

Create a rule:

```bash
curl -sS -X POST "$APP_URL/api/dashboard/transactions/categorization-rules" \
  -H 'content-type: application/json' \
  -d '{"name":"Starbucks","matcherType":"merchant_contains","matcherValue":"starbucks","priority":500,"category":"Restaurants & cafés"}'
```

List rules (sorted by priority desc):

```bash
curl -sS "$APP_URL/api/dashboard/transactions/categorization-rules"
```

Dry-run a candidate rule against a transaction (no write):

```bash
curl -sS -X POST "$APP_URL/api/dashboard/transactions/categorization-rules/dry-run" \
  -H 'content-type: application/json' \
  -d '{"rule":{"matcherType":"merchant_contains","matcherValue":"starbucks","priority":500,"category":"Restaurants & cafés"},"transaction":{"label":"STARBUCKS","merchant":"starbucks","amount":-4.5}}'
```

Backfill (dry-run by default — never destructive unless `dryRun:false`):

```bash
curl -sS -X POST "$APP_URL/api/dashboard/transactions/categorize/backfill" \
  -H 'content-type: application/json' -d '{"dryRun":true,"limit":100}'
```

## Validated behaviour

- Disabled rule ignored (engine skips `enabled=false`).
- Priority respected (highest-priority match wins).
- Validity window respected (`validFrom`/`validTo`).
- Backfill applies enabled user rules (consistent with the live list).
- No destructive backfill: `dryRun` defaults to true; only uncategorized rows
  (`customCategory` empty/Unknown) are considered.
