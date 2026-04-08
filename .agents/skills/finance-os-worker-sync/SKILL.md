---
name: finance-os-worker-sync
description: "Worker sync engine — Redis BLPOP queue, lock-based sync, batch upserts, integrity checks. Use when working on the background worker, sync jobs, or Redis queue patterns."
---

# Finance-OS Worker Sync

## When to use
- Modifying the worker process (`apps/worker/`)
- Changing sync logic (incremental, full, batch upserts)
- Working on Redis queue patterns (BLPOP, locks, metrics)
- Debugging sync failures or data integrity issues
- Adding new background jobs

## When NOT to use
- API route changes that only enqueue jobs (use `core-invariants`)
- UI sync status display (use `ui-cockpit`)
- Powens client changes (use `powens-integration`)

---

## 1. Queue Architecture

```
API enqueues job → Redis LIST (LPUSH)
Worker consumes  → Redis BLPOP (blocking pop)
Worker acquires  → Redis lock (SET NX EX)
Worker processes → Fetch data, batch upsert, update status
Worker releases  → Delete lock, update metrics
```

**Redis keys**:
- `sync:queue` — job list (LPUSH/BLPOP)
- `sync:lock:{connectionId}` — per-connection lock (SET NX, TTL 15min)
- `sync:metrics:*` — counters for monitoring
- `worker:heartbeat` — heartbeat file for health monitoring

---

## 2. Lock-Based Sync

Each sync job acquires a per-connection lock to prevent concurrent syncs for the same bank connection.

```typescript
// Acquire lock (15 min TTL)
const acquired = await redis.set(`sync:lock:${connectionId}`, workerId, 'NX', 'EX', 900);
if (!acquired) {
  logger.info({ connectionId, msg: 'sync already in progress, skipping' });
  return;
}

try {
  await performSync(connectionId);
} finally {
  await redis.del(`sync:lock:${connectionId}`);
}
```

**Rules**:
- Lock TTL is 15 minutes — acts as safety net if worker crashes
- Always release lock in `finally` block
- Log lock acquisition failures (not errors — expected behavior)

---

## 3. Batch Upserts

Transactions are upserted in batches of 800 rows per transaction to balance throughput and memory.

```typescript
const BATCH_SIZE = 800;
for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
  const batch = transactions.slice(i, i + BATCH_SIZE);
  await db.insert(transactionsTable)
    .values(batch)
    .onConflictDoUpdate({
      target: transactionsTable.externalId,
      set: { /* updated fields */ }
    });
}
```

**Rules**:
- Batch size: 800 rows (tuned for PostgreSQL)
- Upsert on `externalId` (Powens transaction ID)
- Each batch is its own DB transaction (partial success is acceptable)
- Log batch progress: `{ batch: 2, of: 5, inserted: 800 }`

---

## 4. Incremental vs Full Sync

| Type | When | What it fetches |
|---|---|---|
| Incremental | Default, auto-sync | Transactions since last sync (lookback: `POWENS_SYNC_LOOKBACK_DAYS`, default 7d) |
| Full | Manual trigger or `POWENS_FORCE_FULL_SYNC=true` | All transactions for all accounts |

**Rules**:
- Auto-sync interval: `POWENS_AUTO_SYNC_INTERVAL_HOURS` (default 12h)
- Manual sync cooldown: `POWENS_MANUAL_SYNC_COOLDOWN_SECONDS` (default 300s)
- Full sync resets the lookback window

---

## 5. Integrity Checks

After each sync, the worker runs integrity checks:

- **Gap detection**: Flag if no transactions exist for >45 days (possible data loss)
- **Account coverage**: Verify all connected accounts have recent data
- **Amount consistency**: Cross-check account balances vs transaction sums

```typescript
// Gap detection
const lastTx = await getLatestTransactionDate(connectionId);
const gapDays = daysSince(lastTx);
if (gapDays > 45) {
  logger.warn({ connectionId, gapDays, msg: 'transaction gap detected' });
  await updateConnectionStatus(connectionId, 'warning');
}
```

---

## 6. Token Decryption in Worker

The worker decrypts Powens access tokens from DB before making API calls:

```typescript
// Worker decrypts token for API calls
const connection = await db.query.powensConnections.findFirst({ where: eq(id, connectionId) });
const accessToken = decrypt(connection.accessToken, APP_ENCRYPTION_KEY);
// Use accessToken for Powens API calls, then discard
```

**Rules**:
- Decrypted tokens exist only in memory during sync
- Never log decrypted tokens
- Never store decrypted tokens in Redis

---

## 7. Error Isolation

Each sync job is isolated — one connection's failure must not affect others.

```typescript
// Job processor with isolation
async function processJob(job: SyncJob) {
  try {
    await performSync(job.connectionId);
    await incrMetric('sync:success');
  } catch (error) {
    logger.error({ connectionId: job.connectionId, error: error.message });
    await updateConnectionStatus(job.connectionId, 'error');
    await incrMetric('sync:failure');
    // Do NOT re-throw — next job should still process
  }
}
```

---

## 8. Health & Metrics

- Worker writes heartbeat to `WORKER_HEALTHCHECK_FILE` every `WORKER_HEARTBEAT_MS` (30s)
- External monitor checks heartbeat file freshness
- Redis counters: `sync:success`, `sync:failure`, `sync:duration:avg`

## Common Mistakes

1. **Forgetting to release lock** — deadlocks future syncs for that connection
2. **Batch size too large** — OOM on large transaction sets
3. **Not isolating job failures** — one bad connection kills the worker
4. **Logging decrypted tokens** — secret leak
5. **No integrity checks after sync** — silent data gaps

## References
- [APP-ARCHITECTURES.md](docs/context/APP-ARCHITECTURES.md) — apps/worker section
- [EXTERNAL-SERVICES.md](docs/context/EXTERNAL-SERVICES.md) — Redis section
- [ENV-REFERENCE.md](docs/context/ENV-REFERENCE.md) — Worker variables
- GitNexus clusters: `cluster-1`, `cluster-3` (worker/sync symbols)
