---
name: cluster-1
description: "Skill for the Cluster_1 area of finance-os. 13 symbols across 2 files."
---

# Cluster_1

13 symbols | 2 files | Cohesion: 89%

## When to Use

- Working with code in `apps/`
- Understanding how connect work
- Modifying cluster_1-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `apps/worker/src/index.ts` | pingDatabase, resolveWorkerVersion, sendJson, startStatusServer, toSafeErrorMessage (+7) |
| `packages/redis/src/index.ts` | connect |

## Entry Points

Start here when exploring this area:

- **`connect`** (Function) — `packages/redis/src/index.ts:9`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `connect` | Function | `packages/redis/src/index.ts` | 9 |
| `pingDatabase` | Function | `apps/worker/src/index.ts` | 89 |
| `resolveWorkerVersion` | Function | `apps/worker/src/index.ts` | 97 |
| `sendJson` | Function | `apps/worker/src/index.ts` | 109 |
| `startStatusServer` | Function | `apps/worker/src/index.ts` | 121 |
| `toSafeErrorMessage` | Function | `apps/worker/src/index.ts` | 242 |
| `updateHeartbeatFile` | Function | `apps/worker/src/index.ts` | 262 |
| `syncAllConnections` | Function | `apps/worker/src/index.ts` | 1134 |
| `handleJob` | Function | `apps/worker/src/index.ts` | 1174 |
| `startScheduler` | Function | `apps/worker/src/index.ts` | 1197 |
| `startNewsScheduler` | Function | `apps/worker/src/index.ts` | 1246 |
| `consumeJobs` | Function | `apps/worker/src/index.ts` | 1268 |
| `start` | Function | `apps/worker/src/index.ts` | 1304 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `ConsumeJobs → SyncRunKey` | cross_community | 6 |
| `ConsumeJobs → Expire` | cross_community | 6 |
| `ConsumeJobs → Incr` | cross_community | 6 |
| `SyncAllConnections → FormatDate` | cross_community | 5 |
| `ConsumeJobs → AcquireConnectionLock` | cross_community | 5 |
| `SyncAllConnections → Expire` | cross_community | 4 |
| `ConsumeJobs → ToSafeErrorMessage` | intra_community | 4 |
| `Start → SendJson` | intra_community | 3 |
| `Start → ResolveWorkerVersion` | intra_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Auth | 2 calls |
| Debug | 1 calls |

## How to Explore

1. `gitnexus_context({name: "connect"})` — see callers and callees
2. `gitnexus_query({query: "cluster_1"})` — find related execution flows
3. Read key files listed above for implementation details
