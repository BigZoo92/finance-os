---
name: cluster-47
description: "Skill for the Cluster_47 area of finance-os. 10 symbols across 1 files."
---

# Cluster_47

10 symbols | 1 files | Cohesion: 90%

## When to Use

- Working with code in `apps/`
- Understanding how apiRequest, ApiRequestError work
- Modifying cluster_47-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `apps/web/src/lib/api.ts` | ApiRequestError, withDefined, getSsrRequestContext, truncate, toApiErrorPayload (+5) |

## Entry Points

Start here when exploring this area:

- **`apiRequest`** (Function) — `apps/web/src/lib/api.ts:333`
- **`ApiRequestError`** (Class) — `apps/web/src/lib/api.ts:50`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `ApiRequestError` | Class | `apps/web/src/lib/api.ts` | 50 |
| `apiRequest` | Function | `apps/web/src/lib/api.ts` | 333 |
| `withDefined` | Function | `apps/web/src/lib/api.ts` | 103 |
| `getSsrRequestContext` | Function | `apps/web/src/lib/api.ts` | 124 |
| `truncate` | Function | `apps/web/src/lib/api.ts` | 211 |
| `toApiErrorPayload` | Function | `apps/web/src/lib/api.ts` | 219 |
| `resolveMethod` | Function | `apps/web/src/lib/api.ts` | 245 |
| `toHintFromStatus` | Function | `apps/web/src/lib/api.ts` | 249 |
| `resolveServerInternalToken` | Function | `apps/web/src/lib/api.ts` | 279 |
| `createRequestHeaders` | Function | `apps/web/src/lib/api.ts` | 286 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `ApiRequest → ToOptionalEnv` | cross_community | 5 |
| `ApiRequest → GetClientApiBaseUrl` | cross_community | 3 |
| `ApiRequest → ToAbsolutePathPrefix` | cross_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Cluster_48 | 2 calls |

## How to Explore

1. `gitnexus_context({name: "apiRequest"})` — see callers and callees
2. `gitnexus_query({query: "cluster_47"})` — find related execution flows
3. Read key files listed above for implementation details
