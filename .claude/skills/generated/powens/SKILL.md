---
name: powens
description: "Skill for the Powens area of finance-os. 30 symbols across 5 files."
---

# Powens

30 symbols | 5 files | Cohesion: 100%

## When to Use

- Working with code in `apps/`
- Understanding how resetPowensManualSyncCooldown, startPowensManualSyncCooldown, getPowensConnectionSyncBadgeModel work
- Modifying powens-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `apps/web/src/features/powens/manual-sync-cooldown.ts` | createInitialCooldownStoreState, stopCooldownTicker, syncCooldownClock, ensureCooldownTicker, normalizeDurationSeconds (+8) |
| `apps/web/src/features/powens/reconnect-banner.ts` | canUseLocalStorage, readReconnectBannerDeferredSnapshot, writeReconnectBannerDeferredSnapshot, clearReconnectBannerDeferredSnapshot, parseBooleanUiFlag (+1) |
| `apps/web/src/features/powens/sync-status.ts` | formatAttemptTime, toSnapshotFreshnessLabel, toTooltipLabel, getPowensConnectionSyncBadgeModel |
| `apps/web/src/routes/powens/callback.tsx` | toErrorState, renderLayout, PowensCallbackPendingPage, PowensCallbackPage |
| `apps/web/src/features/powens/internal-notifications.ts` | toIsoTimestamp, toConnectionDetail, getPowensInternalNotifications |

## Entry Points

Start here when exploring this area:

- **`resetPowensManualSyncCooldown`** (Function) — `apps/web/src/features/powens/manual-sync-cooldown.ts:145`
- **`startPowensManualSyncCooldown`** (Function) — `apps/web/src/features/powens/manual-sync-cooldown.ts:150`
- **`getPowensConnectionSyncBadgeModel`** (Function) — `apps/web/src/features/powens/sync-status.ts:51`
- **`readReconnectBannerDeferredSnapshot`** (Function) — `apps/web/src/features/powens/reconnect-banner.ts:70`
- **`writeReconnectBannerDeferredSnapshot`** (Function) — `apps/web/src/features/powens/reconnect-banner.ts:97`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `resetPowensManualSyncCooldown` | Function | `apps/web/src/features/powens/manual-sync-cooldown.ts` | 145 |
| `startPowensManualSyncCooldown` | Function | `apps/web/src/features/powens/manual-sync-cooldown.ts` | 150 |
| `getPowensConnectionSyncBadgeModel` | Function | `apps/web/src/features/powens/sync-status.ts` | 51 |
| `readReconnectBannerDeferredSnapshot` | Function | `apps/web/src/features/powens/reconnect-banner.ts` | 70 |
| `writeReconnectBannerDeferredSnapshot` | Function | `apps/web/src/features/powens/reconnect-banner.ts` | 97 |
| `clearReconnectBannerDeferredSnapshot` | Function | `apps/web/src/features/powens/reconnect-banner.ts` | 111 |
| `getPowensManualSyncCooldownUiConfig` | Function | `apps/web/src/features/powens/manual-sync-cooldown.ts` | 132 |
| `getPowensInternalNotifications` | Function | `apps/web/src/features/powens/internal-notifications.ts` | 39 |
| `getPowensReconnectBannerUiEnabled` | Function | `apps/web/src/features/powens/reconnect-banner.ts` | 47 |
| `getPowensManualSyncUiState` | Function | `apps/web/src/features/powens/manual-sync-cooldown.ts` | 215 |
| `createInitialCooldownStoreState` | Function | `apps/web/src/features/powens/manual-sync-cooldown.ts` | 34 |
| `stopCooldownTicker` | Function | `apps/web/src/features/powens/manual-sync-cooldown.ts` | 88 |
| `syncCooldownClock` | Function | `apps/web/src/features/powens/manual-sync-cooldown.ts` | 97 |
| `ensureCooldownTicker` | Function | `apps/web/src/features/powens/manual-sync-cooldown.ts` | 116 |
| `normalizeDurationSeconds` | Function | `apps/web/src/features/powens/manual-sync-cooldown.ts` | 126 |
| `formatAttemptTime` | Function | `apps/web/src/features/powens/sync-status.ts` | 17 |
| `toSnapshotFreshnessLabel` | Function | `apps/web/src/features/powens/sync-status.ts` | 33 |
| `toTooltipLabel` | Function | `apps/web/src/features/powens/sync-status.ts` | 38 |
| `canUseLocalStorage` | Function | `apps/web/src/features/powens/reconnect-banner.ts` | 66 |
| `toErrorState` | Function | `apps/web/src/routes/powens/callback.tsx` | 26 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `StartPowensManualSyncCooldown → StopCooldownTicker` | intra_community | 4 |
| `GetPowensManualSyncCooldownUiConfig → ToOptionalEnv` | intra_community | 3 |

## How to Explore

1. `gitnexus_context({name: "resetPowensManualSyncCooldown"})` — see callers and callees
2. `gitnexus_query({query: "powens"})` — find related execution flows
3. Read key files listed above for implementation details
