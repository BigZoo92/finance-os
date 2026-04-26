<!-- GENERATED — DO NOT EDIT
     Source: .agentic/source/skills/generated/auth/SKILL.md
     Hash:   sha256:1e927519231ac045
     Sync:   pnpm agent:skills:sync -->

---
name: auth
description: "Skill for the Auth area of finance-os. 66 symbols across 13 files."
---

# Auth

66 symbols | 13 files | Cohesion: 91%

## When to Use

- Working with code in `apps/`
- Understanding how listConnectionAccounts, listAccountTransactions, createPowensCallbackState work
- Modifying auth-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `apps/worker/src/index.ts` | formatDate, toConnectionStatus, toErrorFingerprint, metricDaySuffix, incrementDailyMetric (+14) |
| `apps/api/src/auth/session.ts` | isAuthSessionPayload, decodeSessionPayload, getCookieValue, readSessionFromCookie, encodeSessionPayload (+3) |
| `apps/api/src/auth/powens-state.ts` | isPowensStatePayload, encodePayload, decodePayload, sign, verifySignature (+2) |
| `apps/api/src/auth/guard.ts` | DemoModeForbiddenError, requireAdminOrInternalToken, requireAdmin, InternalTokenRequiredError, requireInternalToken (+2) |
| `apps/api/src/auth/routes.test.ts` | expire, incr, ttl, createAuthTestEnv, createRedisClientMock (+1) |
| `apps/api/src/auth/routes.ts` | resolveClientIp, shouldUseSecureCookie, setNoStoreResponse, createAuthRoutes |
| `apps/api/src/auth/password.ts` | defaultVerifyPassword, parsePositiveInteger, decodeBase64Url, verifyPbkdf2Hash |
| `packages/powens/src/client.ts` | extractNextUrl, listConnectionAccounts, listAccountTransactions |
| `apps/api/src/auth/hash-password-utils.ts` | readPasswordFromStdin, readPasswordFromPrompt, readPasswordInput |
| `apps/api/src/auth/derive.ts` | resolveRequestId, deriveAuth |

## Entry Points

Start here when exploring this area:

- **`listConnectionAccounts`** (Function) — `packages/powens/src/client.ts:254`
- **`listAccountTransactions`** (Function) — `packages/powens/src/client.ts:267`
- **`createPowensCallbackState`** (Function) — `apps/api/src/auth/powens-state.ts:65`
- **`readPowensCallbackState`** (Function) — `apps/api/src/auth/powens-state.ts:84`
- **`consumeRateLimitSlot`** (Function) — `apps/api/src/auth/rate-limit.ts:2`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `DemoModeForbiddenError` | Class | `apps/api/src/auth/guard.ts` | 14 |
| `InternalTokenRequiredError` | Class | `apps/api/src/auth/guard.ts` | 25 |
| `listConnectionAccounts` | Function | `packages/powens/src/client.ts` | 254 |
| `listAccountTransactions` | Function | `packages/powens/src/client.ts` | 267 |
| `createPowensCallbackState` | Function | `apps/api/src/auth/powens-state.ts` | 65 |
| `readPowensCallbackState` | Function | `apps/api/src/auth/powens-state.ts` | 84 |
| `consumeRateLimitSlot` | Function | `apps/api/src/auth/rate-limit.ts` | 2 |
| `createDiagnosticsMetrics` | Function | `apps/api/src/routes/integrations/powens/services/create-diagnostics-metrics.ts` | 5 |
| `readSessionFromCookie` | Function | `apps/api/src/auth/session.ts` | 110 |
| `createSessionToken` | Function | `apps/api/src/auth/session.ts` | 94 |
| `createAuthRoutes` | Function | `apps/api/src/auth/routes.ts` | 40 |
| `readPasswordInput` | Function | `apps/api/src/auth/hash-password-utils.ts` | 35 |
| `requireAdminOrInternalToken` | Function | `apps/api/src/auth/guard.ts` | 106 |
| `requireAdmin` | Function | `apps/api/src/auth/guard.ts` | 122 |
| `requireInternalToken` | Function | `apps/api/src/auth/guard.ts` | 114 |
| `readInternalTokenFromRequest` | Function | `apps/api/src/auth/guard.ts` | 50 |
| `deriveAuth` | Function | `apps/api/src/auth/derive.ts` | 11 |
| `acquireManualSyncSlot` | Method | `apps/api/src/routes/integrations/powens/repositories/powens-sync-guard-repository.ts` | 9 |
| `extractNextUrl` | Function | `packages/powens/src/client.ts` | 115 |
| `formatDate` | Function | `apps/worker/src/index.ts` | 151 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `ConsumeJobs → SyncRunKey` | cross_community | 6 |
| `ConsumeJobs → Expire` | cross_community | 6 |
| `ConsumeJobs → Incr` | cross_community | 6 |
| `SyncAllConnections → FormatDate` | cross_community | 5 |
| `ConsumeJobs → AcquireConnectionLock` | cross_community | 5 |
| `SyncAllConnections → Expire` | cross_community | 4 |
| `CreateRequestSyncUseCase → Ttl` | cross_community | 3 |
| `ReadSessionFromCookie → SignSessionPayload` | cross_community | 3 |
| `ReadSessionFromCookie → IsAuthSessionPayload` | intra_community | 3 |
| `ReadPowensCallbackState → Sign` | intra_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Cluster_17 | 3 calls |
| Cluster_1 | 1 calls |

## How to Explore

1. `gitnexus_context({name: "listConnectionAccounts"})` — see callers and callees
2. `gitnexus_query({query: "auth"})` — find related execution flows
3. Read key files listed above for implementation details
