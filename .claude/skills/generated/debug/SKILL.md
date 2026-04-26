<!-- GENERATED — DO NOT EDIT
     Source: .agentic/source/skills/generated/debug/SKILL.md
     Hash:   sha256:5e8ff5e98ef4b0f0
     Sync:   pnpm agent:skills:sync -->

---
name: debug
description: "Skill for the Debug area of finance-os. 11 symbols across 2 files."
---

# Debug

11 symbols | 2 files | Cohesion: 95%

## When to Use

- Working with code in `apps/`
- Understanding how ping, createDebugRoutes, checkRedisHealth work
- Modifying debug-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `apps/api/src/routes/debug/router.ts` | toDateKey, toCount, resolveCommitSha, resolveVersion, resolveDebugRuntimeVersion (+5) |
| `packages/redis/src/index.ts` | ping |

## Entry Points

Start here when exploring this area:

- **`ping`** (Function) — `packages/redis/src/index.ts:15`
- **`createDebugRoutes`** (Function) — `apps/api/src/routes/debug/router.ts:89`
- **`checkRedisHealth`** (Function) — `apps/api/src/routes/debug/router.ts:90`
- **`checkDbHealth`** (Function) — `apps/api/src/routes/debug/router.ts:118`
- **`ensureDebugAuthAccess`** (Function) — `apps/api/src/routes/debug/router.ts:137`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `ping` | Function | `packages/redis/src/index.ts` | 15 |
| `createDebugRoutes` | Function | `apps/api/src/routes/debug/router.ts` | 89 |
| `checkRedisHealth` | Function | `apps/api/src/routes/debug/router.ts` | 90 |
| `checkDbHealth` | Function | `apps/api/src/routes/debug/router.ts` | 118 |
| `ensureDebugAuthAccess` | Function | `apps/api/src/routes/debug/router.ts` | 137 |
| `toDateKey` | Function | `apps/api/src/routes/debug/router.ts` | 31 |
| `toCount` | Function | `apps/api/src/routes/debug/router.ts` | 33 |
| `resolveCommitSha` | Function | `apps/api/src/routes/debug/router.ts` | 61 |
| `resolveVersion` | Function | `apps/api/src/routes/debug/router.ts` | 65 |
| `resolveDebugRuntimeVersion` | Function | `apps/api/src/routes/debug/router.ts` | 69 |
| `toEnvPresence` | Function | `apps/api/src/routes/debug/router.ts` | 81 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `CreateDebugRoutes → Ping` | intra_community | 3 |

## How to Explore

1. `gitnexus_context({name: "ping"})` — see callers and callees
2. `gitnexus_query({query: "debug"})` — find related execution flows
3. Read key files listed above for implementation details
