# Database instructions

Scope: `packages/db/**`.

- Schema and migration journal are canonical. Add migrations; do not rewrite shipped migrations casually.
- Preserve financial precision, explicit null/default semantics, and provider-ingestion unique/idempotency constraints.
- Powens disconnects stay audit-preserving/soft-archived; unified account and asset provenance must remain aligned with worker upserts and read models.
- Never resume reads/writes from legacy `external_investment_credential`.
- Update every repository/domain/API consumer when an exported schema contract changes.

Verify with DB typecheck, `pnpm db:generate`, local migration, and affected repository/ingestion tests.
