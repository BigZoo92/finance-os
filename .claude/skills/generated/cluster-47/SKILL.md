---
name: cluster-47
description: "Skill for the Cluster_47 area of finance-os. 7 symbols across 1 files."
---

# Cluster_47

7 symbols | 1 files | Cohesion: 88%

## When to Use

- Working with code in `apps/`
- Understanding how getApiBaseUrl, toApiUrl work
- Modifying cluster_47-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `apps/web/src/lib/api.ts` | toOptionalEnv, readServerRuntimeEnv, getClientApiBaseUrl, resolveApiBaseUrl, getApiBaseUrl (+2) |

## Entry Points

Start here when exploring this area:

- **`getApiBaseUrl`** (Function) — `apps/web/src/lib/api.ts:184`
- **`toApiUrl`** (Function) — `apps/web/src/lib/api.ts:196`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `getApiBaseUrl` | Function | `apps/web/src/lib/api.ts` | 184 |
| `toApiUrl` | Function | `apps/web/src/lib/api.ts` | 196 |
| `toOptionalEnv` | Function | `apps/web/src/lib/api.ts` | 94 |
| `readServerRuntimeEnv` | Function | `apps/web/src/lib/api.ts` | 116 |
| `getClientApiBaseUrl` | Function | `apps/web/src/lib/api.ts` | 136 |
| `resolveApiBaseUrl` | Function | `apps/web/src/lib/api.ts` | 139 |
| `toAbsolutePathPrefix` | Function | `apps/web/src/lib/api.ts` | 188 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `ApiRequest → ToOptionalEnv` | cross_community | 5 |
| `ApiRequest → GetClientApiBaseUrl` | cross_community | 3 |
| `ApiRequest → ToAbsolutePathPrefix` | cross_community | 3 |

## How to Explore

1. `gitnexus_context({name: "getApiBaseUrl"})` — see callers and callees
2. `gitnexus_query({query: "cluster_47"})` — find related execution flows
3. Read key files listed above for implementation details
