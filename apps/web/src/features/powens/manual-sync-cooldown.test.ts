import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getPowensManualSyncCooldownSnapshot,
  getPowensManualSyncCooldownUiConfig,
  getPowensManualSyncUiState,
  logPowensManualSyncBlockedUiEvent,
  powensManualSyncCooldownStore,
  resetPowensManualSyncCooldown,
  startPowensManualSyncCooldown,
} from './manual-sync-cooldown'

describe('powens manual sync cooldown UI', () => {
  afterEach(() => {
    resetPowensManualSyncCooldown()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('defaults to an enabled UI guard with a 300 second cooldown', () => {
    expect(getPowensManualSyncCooldownUiConfig()).toEqual({
      enabled: true,
      durationSeconds: 300,
    })
  })

  it('reads runtime-safe window overrides for the feature flag and duration', () => {
    vi.stubGlobal('window', {
      __FINANCE_OS_PUBLIC_RUNTIME_ENV__: {
        VITE_POWENS_SYNC_COOLDOWN_UI_ENABLED: 'false',
        VITE_POWENS_SYNC_COOLDOWN_UI_SECONDS: '90',
      },
    } as Window & typeof globalThis)

    expect(getPowensManualSyncCooldownUiConfig()).toEqual({
      enabled: false,
      durationSeconds: 90,
    })
  })

  it('keeps an in-memory cooldown countdown and settles into ready after expiry', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-27T10:00:00.000Z'))
    vi.stubGlobal('window', {} as Window & typeof globalThis)

    startPowensManualSyncCooldown(120)

    expect(getPowensManualSyncCooldownSnapshot(powensManualSyncCooldownStore.state)).toEqual({
      isActive: true,
      remainingMs: 120_000,
      remainingSeconds: 120,
      lastActivatedAtMs: Date.parse('2026-03-27T10:00:00.000Z'),
    })

    vi.advanceTimersByTime(61_000)

    expect(getPowensManualSyncCooldownSnapshot(powensManualSyncCooldownStore.state)).toEqual({
      isActive: true,
      remainingMs: 59_000,
      remainingSeconds: 59,
      lastActivatedAtMs: Date.parse('2026-03-27T10:00:00.000Z'),
    })

    vi.advanceTimersByTime(60_000)

    expect(getPowensManualSyncCooldownSnapshot(powensManualSyncCooldownStore.state)).toEqual({
      isActive: false,
      remainingMs: 0,
      remainingSeconds: 0,
      lastActivatedAtMs: Date.parse('2026-03-27T10:00:00.000Z'),
    })
  })

  it('derives demo/admin block reasons and UI phases without server dependency', () => {
    const cooldownUiState = getPowensManualSyncUiState({
      cooldownUiEnabled: true,
      cooldownSnapshot: {
        isActive: true,
        remainingMs: 45_000,
        remainingSeconds: 45,
        lastActivatedAtMs: Date.parse('2026-03-27T10:00:00.000Z'),
      },
      isIntegrationsSafeMode: false,
      isSyncPending: false,
      mode: 'admin',
    })

    expect(cooldownUiState).toMatchObject({
      blocked: true,
      blockReason: 'cooldown',
      cooldownRemainingSeconds: 45,
      phase: 'cooldown',
      statusLabel: 'Cooldown 45s',
    })

    const demoUiState = getPowensManualSyncUiState({
      cooldownUiEnabled: true,
      cooldownSnapshot: {
        isActive: false,
        remainingMs: 0,
        remainingSeconds: 0,
        lastActivatedAtMs: null,
      },
      isIntegrationsSafeMode: false,
      isSyncPending: false,
      mode: 'demo',
    })

    expect(demoUiState).toMatchObject({
      blocked: true,
      blockReason: 'admin_only',
      phase: 'idle',
      statusLabel: 'Idle',
    })
    expect(demoUiState.statusMessage).toContain('Demo')
  })

  it('logs blocked click events with cooldown_remaining_s', () => {
    const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

    logPowensManualSyncBlockedUiEvent({
      blockReason: 'cooldown',
      cooldownRemainingSeconds: 37,
      mode: 'admin',
      connectionId: 'conn-1',
    })

    expect(consoleInfoSpy).toHaveBeenCalledWith(
      '[web:powens-sync-ui]',
      expect.objectContaining({
        event: 'manual_sync_click_blocked_ui',
        reason: 'cooldown',
        mode: 'admin',
        connectionId: 'conn-1',
        cooldown_remaining_s: 37,
      })
    )
  })
})
