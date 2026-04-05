import { describe, expect, it } from 'bun:test'
import { parseDisabledProviders, resolveSyncWindow } from './sync-window'

describe('resolveSyncWindow', () => {
  const baseInput = {
    syncStart: new Date('2026-04-05T10:00:00.000Z'),
    lastSuccessAt: null as Date | null,
    fullResyncRequested: false,
    forceFullSync: false,
    incrementalLookbackDays: 5,
    defaultSyncWindowDays: 90,
    fullResyncWindowDays: 3650,
  }

  it('uses forced full sync when kill-switch is enabled', () => {
    const result = resolveSyncWindow({
      ...baseInput,
      forceFullSync: true,
      fullResyncRequested: false,
      lastSuccessAt: new Date('2026-04-03T10:00:00.000Z'),
    })

    expect(result).toEqual({
      fromDate: '2016-04-07',
      maxDate: '2026-04-05',
      reason: 'force_full_sync_enabled',
      syncMode: 'full',
    })
  })

  it('uses manual full resync when requested', () => {
    const result = resolveSyncWindow({
      ...baseInput,
      fullResyncRequested: true,
    })

    expect(result.reason).toBe('manual_full_resync_requested')
    expect(result.syncMode).toBe('full')
  })

  it('uses last_success_at watermark with conservative lookback', () => {
    const result = resolveSyncWindow({
      ...baseInput,
      lastSuccessAt: new Date('2026-04-04T10:00:00.000Z'),
      incrementalLookbackDays: 7,
    })

    expect(result).toEqual({
      fromDate: '2026-03-28',
      maxDate: '2026-04-05',
      reason: 'incremental_last_success_lookback',
      syncMode: 'incremental',
    })
  })

  it('falls back to initial backfill when no successful sync is recorded', () => {
    const result = resolveSyncWindow(baseInput)

    expect(result).toEqual({
      fromDate: '2026-01-05',
      maxDate: '2026-04-05',
      reason: 'incremental_initial_backfill',
      syncMode: 'incremental',
    })
  })
})

describe('parseDisabledProviders', () => {
  it('normalizes providers to a lower-cased set', () => {
    const disabledProviders = parseDisabledProviders([' Powens ', 'bridge', ''])

    expect(disabledProviders.has('powens')).toBe(true)
    expect(disabledProviders.has('bridge')).toBe(true)
    expect(disabledProviders.size).toBe(2)
  })
})
