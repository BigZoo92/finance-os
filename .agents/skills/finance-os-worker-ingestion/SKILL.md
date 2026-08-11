---
name: finance-os-worker-ingestion
description: Modify Finance-OS worker queues and ingestion orchestration without losing idempotency, isolation, or observability. Use for apps/worker, Redis jobs, provider schedules, locks, heartbeats, or ingestion retries.
---

# Worker and ingestion

Read `apps/worker/AGENTS.md` plus the package guide for any provider touched.

## Current queue model

- The worker blocks on the queue keys exported by provider packages, including `powens:jobs` and `external-investments:jobs`.
- Producers use the shared Redis wrapper and typed serializers; do not duplicate key strings or parse untrusted JSON with casts alone.
- The typed job field `requestId` carries the incoming `x-request-id` and must survive enqueue, execution, API callbacks, and logs.

## Change workflow

1. Trace producer, serializer/parser, consumer dispatch, lock/idempotency key, repository writes, and status reporting.
2. Keep job failure isolated: record a safe failure, release owned locks in `finally`, and continue consuming.
3. Use bounded retries/backoff only for retryable provider/network failures; never retry validation or authorization failures blindly.
4. Preserve idempotent upsert/dedupe semantics and transaction boundaries already defined by each ingestion domain.
5. Keep demo deterministic and provider-free. Worker schedules are admin/runtime concerns, never demo dependencies.
6. Maintain the heartbeat path shared with Compose and `infra/docker/ops-alerts`.

## Verification

Test malformed jobs, duplicate delivery, lock contention, provider timeout, partial batch failure, request-ID propagation, and graceful shutdown. Use in-memory Redis tests where they prove the contract; use provider fixtures instead of live calls.
