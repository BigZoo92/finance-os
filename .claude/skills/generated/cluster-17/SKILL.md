---
name: cluster-17
description: "Skill for the Cluster_17 area of finance-os. 7 symbols across 1 files."
---

# Cluster_17

7 symbols | 1 files | Cohesion: 80%

## When to Use

- Working with code in `apps/`
- Understanding how toStringValue, safeString, parseCurrency work
- Modifying cluster_17-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `apps/worker/src/index.ts` | toStringValue, safeString, parseCurrency, parseAccountType, parseEnabledFlag (+2) |

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `toStringValue` | Function | `apps/worker/src/index.ts` | 153 |
| `safeString` | Function | `apps/worker/src/index.ts` | 165 |
| `parseCurrency` | Function | `apps/worker/src/index.ts` | 174 |
| `parseAccountType` | Function | `apps/worker/src/index.ts` | 192 |
| `parseEnabledFlag` | Function | `apps/worker/src/index.ts` | 220 |
| `upsertAccounts` | Function | `apps/worker/src/index.ts` | 463 |
| `buildTransactionInsert` | Function | `apps/worker/src/index.ts` | 690 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `UpsertAccounts → ToStringValue` | intra_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Auth | 1 calls |

## How to Explore

1. `gitnexus_context({name: "toStringValue"})` — see callers and callees
2. `gitnexus_query({query: "cluster_17"})` — find related execution flows
3. Read key files listed above for implementation details
