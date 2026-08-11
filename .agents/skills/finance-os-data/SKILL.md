---
name: finance-os-data
description: Evolve Finance-OS PostgreSQL and Drizzle models safely. Use for packages/db schemas, repositories, migrations, indexes, constraints, financial precision, or query-performance changes.
---

# Data layer

Read `packages/db/AGENTS.md`. The schema files and migration journal are authoritative; historical skill inventories are not.

## Workflow

1. Identify the canonical table/view and every API, worker, fixture, and analytics consumer.
2. Run GitNexus impact for repositories and domain mappers that will change.
3. Preserve money as exact decimal/minor-unit data according to the existing field contract; never introduce floating-point arithmetic for persisted amounts.
4. Make migrations additive and rollback-aware. Separate destructive cleanup from compatibility rollout.
5. Preserve unique constraints and idempotent conflict targets used by provider ingestion.
6. Omit absent optional values instead of writing `undefined`; decide null semantics explicitly.
7. Never resume reads/writes from legacy `external_investment_credential` rows.
8. Add indexes from measured query shapes, then inspect the query plan when performance motivates the change.

## Verification

Run schema/migration generation checks, repository tests, affected API/worker tests, and typecheck. Cover duplicate ingestion, decimal/currency boundaries, null/default behavior, and old-row compatibility. Never point tests or migrations at a production database.
