# Database instructions

Scope: `packages/db/**`.

- Schema and migration journal are canonical. Add migrations; do not rewrite shipped migrations casually.
- Preserve financial precision, explicit null/default semantics, and provider-ingestion unique/idempotency constraints.
- Powens disconnects stay audit-preserving/soft-archived; unified account and asset provenance must remain aligned with worker upserts and read models.
- Never reintroduce the legacy `external_investment_credential` table (dropped in migration 0038); provider credentials are server environment only.
- Update every repository/domain/API consumer when an exported schema contract changes.

Verify with DB typecheck, `pnpm db:generate` (commit the SQL, the snapshot and the journal together), `pnpm db:check` (journal consistency and schema drift), a local `pnpm db:migrate` against a disposable database, `pnpm db:test:integration` with `TEST_DATABASE_URL`, and affected repository/ingestion tests. Migrations run only through `packages/db/src/migrate.ts` (the `migrate` Compose service); the API never migrates at startup.
