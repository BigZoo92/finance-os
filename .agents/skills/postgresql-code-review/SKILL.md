---
name: postgresql-code-review
description: "PostgreSQL-focused code review for schema design, query performance, indexes, JSONB, security, and Drizzle-specific patterns. Use when reviewing database changes, writing complex queries, or optimizing PostgreSQL performance."
---

# PostgreSQL Code Review

PostgreSQL-focused review skill covering schema design, query performance, indexing strategy, JSONB operations, security, and Drizzle ORM integration patterns.

## When to Use

- Reviewing schema changes or migrations
- Writing or reviewing complex queries or CTEs
- Optimizing query performance
- Reviewing index strategy
- Checking database security patterns
- Working with JSONB operations

## Finance-OS Context

- PostgreSQL 16, Drizzle ORM with `postgres` driver
- 8 table categories: powens, goals, assets, recurring, news, derived, enrichment, technical-probe
- Schema in `packages/db/src/schema/`, repositories in `apps/api/src/routes/*/repositories/`
- Batch upsert size: 800 rows per operation
- `generatedAlwaysAsIdentity()` for PKs, not `serial`
- Cursor pagination (not offset) on transactions
- Auto-migrations on API startup via `RUN_DB_MIGRATIONS`
- Advisory locks for singleton operations (recompute coordination)
- Single-user app -- no RLS, but never expose raw SQL errors to clients

## Schema Design Review

### Data Types

| Use | Type | Notes |
|-----|------|-------|
| Money | `numeric(18,2)` | Never `real` or `doublePrecision`. Returns as string. |
| Timestamps | `timestamptz` | Always `withTimezone: true`. Never bare `timestamp`. |
| Short text | `text` | PostgreSQL optimizes equally with `varchar`. Prefer `text`. |
| Identifiers | `text` | External IDs from providers are strings. |
| Flags | `boolean` | With `.notNull().default(true/false)`. |
| Structured data | `jsonb` | Type with `.$type<T>()`. Include `| null` for nullable. |
| Fixed value sets | `pgEnum` | Define before tables. Enum changes need `ALTER TYPE`. |

### Constraints

```
[ ] Primary key on every table (generatedAlwaysAsIdentity)
[ ] NOT NULL on all required columns
[ ] UNIQUE constraints on natural keys (provider + externalId patterns)
[ ] CHECK constraints for value ranges (amounts, percentages)
[ ] Default values for timestamps (defaultNow), booleans, status enums
```

### ENUMs

```typescript
// Define before the table
export const statusEnum = pgEnum('connection_status', [
  'connected', 'syncing', 'error', 'reconnect_required',
])

// Use in table
status: statusEnum('status').notNull().default('connected'),
```

**Review points:**
- Enum values should be exhaustive for current use cases
- Adding values is safe (`ALTER TYPE ... ADD VALUE`)
- Removing/renaming values requires migration with data transformation
- Never use enums for values that change frequently -- use text + CHECK instead

### Naming Conventions

- Tables: `snake_case`, singular (`financial_account`, not `financial_accounts`)
- Columns: `snake_case` in DB, `camelCase` in TypeScript
- Indexes: `{table}_{column(s)}_{type}` (e.g., `transaction_booking_date_idx`)
- Unique indexes: `{table}_{column(s)}_unique`
- Enums: `{domain}_{field}` (e.g., `powens_connection_status`)

## Query Performance

### EXPLAIN ANALYZE Patterns

Always check query plans for:

| Symptom | Problem | Fix |
|---------|---------|-----|
| Seq Scan on large table | Missing index | Add appropriate index |
| Nested Loop on large sets | Wrong join strategy | Add index or restructure query |
| Sort without index | Expensive in-memory sort | Add index matching ORDER BY |
| High estimate vs actual | Stale statistics | Run `ANALYZE` on table |
| Hash Join with high memory | Large intermediate sets | Add WHERE filters, reduce result size |

### Index Strategy

**Equality before range** in composite indexes:

```sql
-- For: WHERE account_id = ? AND booking_date > ?
CREATE INDEX idx_tx_account_date ON transaction(powens_account_id, booking_date);
-- NOT: (booking_date, powens_account_id)
```

**Partial indexes** for filtered queries:

```sql
-- For queries that only look at non-null transaction IDs
CREATE UNIQUE INDEX idx_tx_powens_unique
  ON transaction(powens_connection_id, powens_transaction_id)
  WHERE powens_transaction_id IS NOT NULL;
```

**Covering indexes** to avoid table lookups:

```sql
-- If query only needs id and booking_date
CREATE INDEX idx_tx_account_covering
  ON transaction(powens_account_id) INCLUDE (id, booking_date);
```

### Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| `SELECT *` | Fetches unnecessary data | Select specific columns |
| `OFFSET N` pagination | Scans and discards N rows | Cursor pagination (`WHERE id > last_id`) |
| `NOT IN (subquery)` | Breaks with NULLs, slow | Use `NOT EXISTS` |
| Missing `LIMIT` | Unbounded result sets | Always add `LIMIT` |
| `LIKE '%prefix'` | Cannot use index | Use `LIKE 'prefix%'` or full-text search |
| `OR` on different columns | Prevents index usage | Use `UNION ALL` |
| Functions on indexed columns | Prevents index usage | Create expression index |

### Query Patterns

**Aggregations return strings in Drizzle:**

```typescript
const result = await db.select({
  total: sql<string>`COALESCE(sum(${table.amount}), '0')`,
}).from(table)
// Must parseFloat() the result
```

**Cursor pagination:**

```typescript
const rows = await db
  .select(selection)
  .from(schema.transaction)
  .where(gt(schema.transaction.id, lastId))
  .orderBy(asc(schema.transaction.id))
  .limit(pageSize)
```

## JSONB Operations

### Storage

```typescript
// Type JSONB columns explicitly
metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
tags: jsonb('tags').$type<string[] | null>(),
```

### Querying

```sql
-- Extract text value
SELECT payload->>'label' as label FROM provider_raw_import;

-- Extract nested value
SELECT payload->'nested'->>'field' FROM table;

-- Filter on JSONB field
SELECT * FROM table WHERE payload->>'type' = 'transaction';

-- Array contains
SELECT * FROM table WHERE tags @> '["important"]'::jsonb;
```

### Indexing JSONB

```sql
-- GIN index for @>, ?, ?|, ?& operators
CREATE INDEX idx_payload_gin ON provider_raw_import USING gin(payload);

-- Expression index for specific keys
CREATE INDEX idx_payload_type ON provider_raw_import ((payload->>'type'));
```

### Performance Rules

- **Do not query deeply nested JSONB** in WHERE clauses on large tables without indexes
- **Prefer expression indexes** over GIN for known query patterns
- **Extract hot fields** into proper columns if queried frequently
- **Use `jsonb_array_elements`** for bulk CTE operations (not per-row extraction)

### Bulk Updates via JSONB CTE

```typescript
// Finance-OS pattern: batch update different values per row
await db.execute(sql`
  with staged as (
    select
      (value->>'transactionId')::int as transaction_id,
      value->>'label' as label,
      value->>'category' as category
    from jsonb_array_elements(${JSON.stringify(updates)}::jsonb) value
  )
  update "transaction" as t
  set label = staged.label, category = staged.category
  from staged
  where t.id = staged.transaction_id
`)
```

## Security Review

### Parameterization

```typescript
// SAFE: sql tagged template parameterizes automatically
db.execute(sql`SELECT * FROM users WHERE id = ${userId}`)

// DANGEROUS: string interpolation bypasses parameterization
db.execute(sql.raw(`SELECT * FROM users WHERE id = '${userId}'`))
```

**Review rule:** Any use of `sql.raw()` with variable input is a blocking finding.

### Error Exposure

- Never return raw PostgreSQL errors to clients (constraint names, table names leak schema)
- Catch database errors and map to safe application errors
- Log the full error server-side with request context

### Sensitive Data

- Encrypt tokens/secrets at the application layer before storage (`accessTokenEncrypted`)
- Never store plaintext credentials in the database
- JSONB columns should not contain raw API keys or tokens

### Access Control

- Single-user app: no RLS, but API routes must still have auth middleware
- Debug endpoints (`/debug/*`) must require admin authentication
- Never expose database connection details in error responses

## Extensions

### uuid-ossp

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
SELECT uuid_generate_v4();  -- for UUID primary keys if needed
```

Finance-OS uses integer identity PKs, not UUIDs. Only use if there is a specific need for distributed ID generation.

### pgcrypto

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
SELECT gen_random_uuid();  -- alternative to uuid-ossp
SELECT encode(digest('data', 'sha256'), 'hex');  -- checksums
```

Finance-OS handles encryption at the application layer (Node.js crypto), not in PostgreSQL. Review any DB-level crypto usage carefully.

## Drizzle-Specific Review Points

### Schema

```
[ ] generatedAlwaysAsIdentity() for PKs (not serial)
[ ] withTimezone: true on all timestamps
[ ] .$type<T>() on all JSONB columns
[ ] pgEnum for fixed value sets
[ ] Indexes in third argument array
[ ] notNull() on all required columns
```

### Queries

```
[ ] Explicit column selection (not select())
[ ] Selection objects use as const
[ ] .limit() on all list queries
[ ] sql tagged template for raw SQL (not string interpolation)
[ ] Null handling: row ?? null pattern
[ ] returning() result checked for undefined
```

### Upserts

```
[ ] target matches a unique constraint
[ ] set clause is explicit (not spread from values)
[ ] updatedAt included in set
[ ] id/createdAt excluded from set
[ ] Empty array guarded before insert
```

### Batch Operations

```
[ ] Batch size <= 800 rows
[ ] Empty array check before .values()
[ ] onConflictDoUpdate target matches unique constraint
[ ] CTE bulk updates use jsonb_array_elements pattern
```

### Transactions

```
[ ] Short duration (reads before, writes inside)
[ ] Uses tx, not db, for all queries
[ ] No nested transactions
[ ] Advisory locks for singleton coordination
```

## Migration Review

```
[ ] One logical change per migration
[ ] Backward-compatible (no breaking drops/renames in single step)
[ ] Enum additions use ALTER TYPE ... ADD VALUE
[ ] Large table indexes use CREATE INDEX CONCURRENTLY
[ ] Generated by drizzle-kit (not hand-edited after generation)
[ ] Tested against existing data
```
