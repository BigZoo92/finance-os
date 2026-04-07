---
name: cluster-7
description: "Skill for the Cluster_7 area of finance-os. 6 symbols across 1 files."
---

# Cluster_7

6 symbols | 1 files | Cohesion: 91%

## When to Use

- Working with code in `packages/`
- Understanding how requestJson work
- Modifying cluster_7-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `packages/powens/src/client.ts` | toUrl, withTrailingSlash, isRetryableError, sleep, readResponseBody (+1) |

## Entry Points

Start here when exploring this area:

- **`requestJson`** (Function) — `packages/powens/src/client.ts:160`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `requestJson` | Function | `packages/powens/src/client.ts` | 160 |
| `toUrl` | Function | `packages/powens/src/client.ts` | 64 |
| `withTrailingSlash` | Function | `packages/powens/src/client.ts` | 87 |
| `isRetryableError` | Function | `packages/powens/src/client.ts` | 91 |
| `sleep` | Function | `packages/powens/src/client.ts` | 99 |
| `readResponseBody` | Function | `packages/powens/src/client.ts` | 103 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `RequestJson → WithTrailingSlash` | intra_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Repositories | 1 calls |

## How to Explore

1. `gitnexus_context({name: "requestJson"})` — see callers and callees
2. `gitnexus_query({query: "cluster_7"})` — find related execution flows
3. Read key files listed above for implementation details
