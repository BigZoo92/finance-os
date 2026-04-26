<!-- GENERATED — DO NOT EDIT
     Source: .agentic/source/skills/generated/cluster-3/SKILL.md
     Hash:   sha256:4d1b5e0a1b381b5b
     Sync:   pnpm agent:skills:sync -->

---
name: cluster-3
description: "Skill for the Cluster_3 area of finance-os. 12 symbols across 1 files."
---

# Cluster_3

12 symbols | 1 files | Cohesion: 90%

## When to Use

- Working with code in `packages/`
- Understanding how derivePowensAccountBalance, derivePowensAccountMetadata, derivePowensTransactionCategory work
- Modifying cluster_3-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `packages/powens/src/derived.ts` | isPlainObject, toStringValue, sanitizeMetadataText, readMetadataValue, parseProviderObjectAt (+7) |

## Entry Points

Start here when exploring this area:

- **`derivePowensAccountBalance`** (Function) — `packages/powens/src/derived.ts:99`
- **`derivePowensAccountMetadata`** (Function) — `packages/powens/src/derived.ts:147`
- **`derivePowensTransactionCategory`** (Function) — `packages/powens/src/derived.ts:182`
- **`derivePowensTransactionProviderObjectAt`** (Function) — `packages/powens/src/derived.ts:235`
- **`derivePowensTransactionExternalId`** (Function) — `packages/powens/src/derived.ts:243`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `derivePowensAccountBalance` | Function | `packages/powens/src/derived.ts` | 99 |
| `derivePowensAccountMetadata` | Function | `packages/powens/src/derived.ts` | 147 |
| `derivePowensTransactionCategory` | Function | `packages/powens/src/derived.ts` | 182 |
| `derivePowensTransactionProviderObjectAt` | Function | `packages/powens/src/derived.ts` | 235 |
| `derivePowensTransactionExternalId` | Function | `packages/powens/src/derived.ts` | 243 |
| `parsePowensTransactionBookingDate` | Function | `packages/powens/src/derived.ts` | 251 |
| `parsePowensTransactionAmount` | Function | `packages/powens/src/derived.ts` | 271 |
| `isPlainObject` | Function | `packages/powens/src/derived.ts` | 2 |
| `toStringValue` | Function | `packages/powens/src/derived.ts` | 6 |
| `sanitizeMetadataText` | Function | `packages/powens/src/derived.ts` | 33 |
| `readMetadataValue` | Function | `packages/powens/src/derived.ts` | 43 |
| `parseProviderObjectAt` | Function | `packages/powens/src/derived.ts` | 57 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `DerivePowensAccountMetadata → ToStringValue` | intra_community | 4 |
| `DerivePowensTransactionMerchant → ToStringValue` | cross_community | 3 |
| `DerivePowensTransactionLabel → ToStringValue` | cross_community | 3 |
| `DerivePowensTransactionProviderObjectAt → ToStringValue` | intra_community | 3 |

## How to Explore

1. `gitnexus_context({name: "derivePowensAccountBalance"})` — see callers and callees
2. `gitnexus_query({query: "cluster_3"})` — find related execution flows
3. Read key files listed above for implementation details
