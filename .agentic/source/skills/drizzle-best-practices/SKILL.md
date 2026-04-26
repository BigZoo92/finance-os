---
name: drizzle-best-practices
description: "Drizzle ORM patterns for PostgreSQL. Use when writing or reviewing schema definitions, queries, migrations, upserts, batch operations, or repository code that uses drizzle-orm."
---

# Drizzle Best Practices

Use this skill when working with Drizzle ORM against PostgreSQL. Covers schema design, type-safe queries, migrations, relations, performance, and common pitfalls.

## Finance-OS Context

- PostgreSQL 16, Drizzle ORM with `postgres` driver (`drizzle-orm/postgres-js`)
- `exactOptionalPropertyTypes: true` -- nullable fields require explicit `null`, not `undefined`
- 8 schema categories: powens, goals, assets, recurring, news, derived, enrichment, technical-probe
- Schema lives in `packages/db/src/schema/`, client in `packages/db/src/client.ts`
- Repositories in `apps/api/src/routes/*/repositories/`
- Upserts use `onConflictDoUpdate` with explicit target columns
- Batch sizes capped at 800 rows for inserts
- Advisory locks via `pg_try_advisory_lock` for recompute coordination
- Raw SQL via tagged template for bulk CTE-based updates

## Schema Design

### Table Definition

```typescript
import { pgTable, integer, text, timestamp, numeric, jsonb, boolean } from 'drizzle-orm/pg-core'

export const account = pgTable(
  'account',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    name: text('name').notNull(),
    balance: numeric('balance', { precision: 18, scale: 2 }),
    enabled: boolean('enabled').notNull().default(true),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    uniqueIndex('account_name_unique').on(table.name),
    index('account_created_at_idx').on(table.createdAt),
  ]
)
```

### Rules

1. **Always use `withTimezone: true`** for timestamps. Never store bare timestamps.
2. **Use `generatedAlwaysAsIdentity()`** for integer PKs -- not `serial`.
3. **Use `numeric(precision, scale)`** for money, never `real`/`doublePrecision`.
4. **Type JSONB columns** with `.$type<T>()`. Include `| null` when the column is nullable.
5. **Use `pgEnum`** for fixed value sets. Define enums before tables that reference them.
6. **Name columns in snake_case** in the DB, camelCase in TypeScript.
7. **Indexes go in the third argument** as an array of index builder calls.
8. **Compound unique indexes** for natural keys (provider + externalId patterns).

### Conditional Unique Indexes

```typescript
uniqueIndex('transaction_powens_unique')
  .on(table.connectionId, table.transactionId)
  .where(sql`${table.transactionId} is not null`)
```

Use `.where()` for partial unique constraints -- common for nullable external IDs with fallback dedup.

### JSONB Typing

```typescript
// Explicit type with null
metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),

// Typed array
tags: jsonb('tags').$type<string[] | null>(),

// Complex nested type
history: jsonb('history').$type<Array<{ changedAt: string; previous: string | null }> | null>(),
```

Under `exactOptionalPropertyTypes`, you cannot assign `undefined` to a nullable JSONB column. Always use `null`.

### Enums

```typescript
export const statusEnum = pgEnum('connection_status', [
  'connected',
  'syncing',
  'error',
  'reconnect_required',
])

// Use in table definition
status: statusEnum('status').notNull().default('connected'),
```

Define enums at the top of the schema file, before any tables that reference them.

### Relations

```typescript
import { relations } from 'drizzle-orm'

export const accountRelations = relations(financialAccount, ({ one, many }) => ({
  connection: one(powensConnection, {
    fields: [financialAccount.powensConnectionId],
    references: [powensConnection.powensConnectionId],
  }),
  transactions: many(transaction),
}))
```

Relations are metadata-only -- they enable the relational query API but do not create FK constraints.

## Type-Safe Queries

### Select with Explicit Columns

```typescript
const rows = await db
  .select({
    id: schema.account.id,
    name: schema.account.name,
    balance: schema.account.balance,
  })
  .from(schema.account)
  .where(eq(schema.account.enabled, true))
  .orderBy(desc(schema.account.createdAt))
  .limit(50)
```

### Selection Objects

Extract reusable column selections as `const` objects:

```typescript
const accountSelection = {
  id: schema.account.id,
  name: schema.account.name,
  balance: schema.account.balance,
} as const

const rows = await db.select(accountSelection).from(schema.account)
```

### Null Handling

```typescript
const [row] = await db.select(selection).from(table).where(condition).limit(1)
return row ?? null
```

### Infer Types from Schema

```typescript
type NewAccount = typeof schema.account.$inferInsert
type Account = typeof schema.account.$inferSelect
```

### Relational Query API

```typescript
const result = await db.query.financialAccount.findFirst({
  where: eq(schema.financialAccount.powensAccountId, accountId),
  with: { connection: true },
})
```

Requires `{ schema }` passed to `drizzle()` constructor.

## Upserts

### Standard Pattern

```typescript
await db
  .insert(schema.connection)
  .values({
    provider: 'powens',
    connectionId: id,
    accessTokenEncrypted: token,
    status: 'connected',
    updatedAt: now,
  })
  .onConflictDoUpdate({
    target: schema.connection.connectionId,
    set: {
      accessTokenEncrypted: token,
      status: 'connected',
      updatedAt: now,
    },
  })
```

### Rules

1. **Always specify `target`** -- the column(s) matching a unique constraint.
2. **Repeat the `set` fields explicitly** -- do not rely on spreading `values` into `set`.
3. **Include `updatedAt`** in the `set` clause to track last modification.
4. **Do not include auto-generated columns** (`id`, `createdAt`) in the `set` clause.
5. **Use `sql\`excluded.column_name\``** to reference the proposed row in `set` expressions.

### Multi-Column Conflict Target

```typescript
.onConflictDoUpdate({
  target: [
    schema.rawImport.provider,
    schema.rawImport.providerConnectionId,
    schema.rawImport.objectType,
    schema.rawImport.externalObjectId,
  ],
  set: { lastSeenAt: new Date(), payload: sql`excluded.payload` },
})
```

## Batch Inserts

### Chunked Inserts

```typescript
const BATCH_SIZE = 800

for (let i = 0; i < rows.length; i += BATCH_SIZE) {
  const chunk = rows.slice(i, i + BATCH_SIZE)
  await db.insert(schema.rawImport).values(chunk).onConflictDoUpdate({
    target: [
      schema.rawImport.provider,
      schema.rawImport.providerConnectionId,
      schema.rawImport.objectType,
      schema.rawImport.externalObjectId,
    ],
    set: {
      lastSeenAt: new Date(),
      payload: sql`excluded.payload`,
      payloadChecksum: sql`excluded.payload_checksum`,
    },
  })
}
```

### Why 800?

PostgreSQL has a parameter limit (~65535). Each row consumes one parameter per column. 800 rows x ~15 columns = ~12000 parameters, well within limits with headroom.

### Bulk Updates via CTE

When updating many rows with different values, use `jsonb_array_elements`:

```typescript
await db.execute(sql`
  with staged as (
    select
      (value->>'id')::int as id,
      value->>'label' as label,
      value->>'category' as category
    from jsonb_array_elements(${JSON.stringify(updates)}::jsonb) value
  )
  update "transaction" as t
  set
    label = staged.label,
    category = staged.category
  from staged
  where t.id = staged.id
`)
```

This is significantly faster than individual UPDATE statements for large batches.

### Guard Empty Arrays

```typescript
// Drizzle throws on empty values array
if (rows.length > 0) {
  await db.insert(schema.table).values(rows)
}
```

## Migrations

### Workflow

1. Schema changes go in `packages/db/src/schema/*.ts`
2. Generate migrations: `drizzle-kit generate`
3. Migrations folder: `packages/db/drizzle/`
4. Applied at boot via `migrate(db, { migrationsFolder })` in `apps/api/src/bootstrap.ts`
5. Toggle with `RUN_DB_MIGRATIONS=false` to skip in specific environments

### Rules

1. **Never edit a generated migration file** after it has been applied to any environment.
2. **One logical change per migration**. Do not bundle schema + data migrations.
3. **Add indexes concurrently** for large tables -- use raw SQL migrations with `CREATE INDEX CONCURRENTLY`.
4. **Test migration rollback** by verifying the app works with both old and new schemas during deploy.
5. **Enum changes** require `ALTER TYPE ... ADD VALUE` -- Drizzle generates this, but verify the output.
6. **Column renames** are destructive. Prefer add-new/backfill/drop-old over rename.
7. **Backward-compatible only** -- never drop or rename columns in a single step.

## Transactions

```typescript
await db.transaction(async tx => {
  const accounts = await tx.select(selection).from(schema.account)
  await tx.insert(schema.snapshot).values(snapshotRows)
  await tx.update(schema.run).set({ status: 'completed' }).where(eq(schema.run.id, runId))
})
```

### Rules

1. **Keep transactions short**. Do reads and computation before the transaction, write inside.
2. **Use advisory locks** (`pg_try_advisory_lock`) for singleton operations, not row-level locks.
3. **Never nest transactions**. Drizzle does not support savepoints automatically.
4. **Pass `tx` to all queries** inside the transaction block, never `db`.

### Advisory Locks

```typescript
// Acquire (non-blocking)
const rows = await db.execute(
  sql`select pg_try_advisory_lock(${namespace}, ${key}) as acquired`
)
const acquired = rows[0]?.acquired ?? false

// Release
await db.execute(sql`select pg_advisory_unlock(${namespace}, ${key})`)
```

## Connection Management

```typescript
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

const sql = postgres(databaseUrl)
const db = drizzle(sql, { schema })

const close = async () => {
  await sql.end({ timeout: 5 })
}
```

### Rules

1. **One pool per process**. Do not create pools per request.
2. **Always close on shutdown** with a timeout.
3. **Pass `{ schema }` to `drizzle()`** to enable relational query API.
4. **Use `DATABASE_URL` from env**, never hardcode connection strings.

## Performance

### Index Strategy

- **Index foreign keys** that appear in WHERE/JOIN clauses.
- **Composite indexes** for multi-column lookups -- column order matters (most selective first).
- **Partial indexes** with `.where()` for filtered queries on nullable columns.
- **Covering indexes** (include non-key columns) when avoiding table lookups.
- **Use `prepare()`** for frequently executed queries.

### Query Patterns

- **Use `.limit()`** on all list queries. Never return unbounded result sets.
- **Prefer `select()` with explicit columns** over `select()` (all columns).
- **Use `sql` template tag** for complex expressions -- Drizzle parameterizes automatically.
- **Avoid N+1**: use joins or batch lookups with `IN (...)` instead of per-row queries.
- **Cursor pagination** (WHERE id > lastId) over offset pagination for large datasets.

## Common Pitfalls

### 1. undefined vs null with exactOptionalPropertyTypes

```typescript
// BAD: TypeScript error under exactOptionalPropertyTypes
.set({ lastError: undefined })

// GOOD
.set({ lastError: null })
```

### 2. Missing as const on Selection Objects

```typescript
// BAD: loses literal types
const selection = { id: schema.table.id }

// GOOD: preserves column reference types
const selection = { id: schema.table.id } as const
```

### 3. Forgetting .notNull() on Required Columns

Columns without `.notNull()` are nullable by default. The TypeScript type will include `| null`.

### 4. Using serial() Instead of generatedAlwaysAsIdentity()

`serial` creates a sequence but does not prevent manual ID injection. `generatedAlwaysAsIdentity()` enforces server-side generation.

### 5. Empty Array in Batch Inserts

Drizzle throws on `db.insert(table).values([])`. Always guard with a length check.

### 6. Raw SQL Without Parameterization

```typescript
// DANGEROUS: string interpolation bypasses parameterization
db.execute(sql.raw(`SELECT * FROM users WHERE id = '${rawUserInput}'`))

// SAFE: sql template tag parameterizes automatically
db.execute(sql`SELECT * FROM users WHERE id = ${rawUserInput}`)
```

### 7. Assuming returning() Always Returns Rows

```typescript
const [row] = await db.insert(table).values(data).returning()
if (!row) throw new Error('Insert failed')
```

### 8. Numeric Columns Return Strings

`numeric()` columns return strings from PostgreSQL, not numbers:

```typescript
const balance = parseFloat(row.balance) // row.balance is string
```

### 9. Spreading Values into onConflictDoUpdate set

```typescript
// BAD: includes id, createdAt which should not be updated
.onConflictDoUpdate({ target: table.externalId, set: values })

// GOOD: explicit set fields
.onConflictDoUpdate({
  target: table.externalId,
  set: { name: values.name, updatedAt: values.updatedAt },
})
```

### 10. Forgetting to Pass Schema to drizzle()

Without `{ schema }`, the relational query API (`db.query.*`) is unavailable and will throw at runtime.
