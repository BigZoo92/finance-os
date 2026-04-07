---
name: cluster-14
description: "Skill for the Cluster_14 area of finance-os. 6 symbols across 1 files."
---

# Cluster_14

6 symbols | 1 files | Cohesion: 100%

## When to Use

- Working with code in `apps/`
- Understanding how sanitizeProviderPayload, buildProviderRawImportRow work
- Modifying cluster_14-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `apps/worker/src/raw-import.ts` | isPlainObject, sanitizeProviderPayload, stableSerialize, buildPayloadChecksum, buildFallbackExternalObjectId (+1) |

## Entry Points

Start here when exploring this area:

- **`sanitizeProviderPayload`** (Function) — `apps/worker/src/raw-import.ts:31`
- **`buildProviderRawImportRow`** (Function) — `apps/worker/src/raw-import.ts:89`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `sanitizeProviderPayload` | Function | `apps/worker/src/raw-import.ts` | 31 |
| `buildProviderRawImportRow` | Function | `apps/worker/src/raw-import.ts` | 89 |
| `isPlainObject` | Function | `apps/worker/src/raw-import.ts` | 27 |
| `stableSerialize` | Function | `apps/worker/src/raw-import.ts` | 53 |
| `buildPayloadChecksum` | Function | `apps/worker/src/raw-import.ts` | 68 |
| `buildFallbackExternalObjectId` | Function | `apps/worker/src/raw-import.ts` | 85 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `BuildProviderRawImportRow → IsPlainObject` | intra_community | 5 |

## How to Explore

1. `gitnexus_context({name: "sanitizeProviderPayload"})` — see callers and callees
2. `gitnexus_query({query: "cluster_14"})` — find related execution flows
3. Read key files listed above for implementation details
