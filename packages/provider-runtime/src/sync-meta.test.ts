import { describe, expect, it } from 'bun:test'
import { asProviderId } from '@finance-os/provider-contract'
import {
  computeProviderFreshness,
  createProviderSyncState,
  PROVIDER_SYNC_STATUSES,
} from './sync-meta'

const pid = asProviderId('test-provider')

describe('createProviderSyncState', () => {
  it('preserves null over fake zeros for unknown numerics', () => {
    const state = createProviderSyncState({
      providerId: pid,
      capability: 'market.quotes.read',
      status: 'idle',
    })
    expect(state.freshnessMinutes).toBeNull()
    expect(state.itemCount).toBeNull()
    expect(state.lastSuccessAt).toBeNull()
    expect(state.lastAttemptAt).toBeNull()
    expect(state.lastErrorCode).toBeNull()
    expect(state.requestId).toBeNull()
    expect(state.stale).toBe(false)
    expect(state.degraded).toBe(false)
  })

  it('exposes the closed sync status taxonomy', () => {
    expect(new Set(PROVIDER_SYNC_STATUSES)).toEqual(
      new Set(['idle', 'syncing', 'success', 'failed', 'disabled', 'degraded'])
    )
  })
})

describe('computeProviderFreshness', () => {
  it('returns null minutes when last-success is unknown', () => {
    const f = computeProviderFreshness({
      providerId: pid,
      capability: 'market.quotes.read',
      lastSuccessAt: null,
      now: new Date('2026-05-09T00:00:00Z'),
      maxAgeMinutes: 5,
    })
    expect(f.freshnessMinutes).toBeNull()
    expect(f.stale).toBe(false)
    expect(f.degraded).toBe(false)
  })

  it('marks stale when freshness exceeds the budget', () => {
    const f = computeProviderFreshness({
      providerId: pid,
      capability: 'market.quotes.read',
      lastSuccessAt: '2026-05-09T00:00:00Z',
      now: new Date('2026-05-09T00:30:00Z'),
      maxAgeMinutes: 5,
    })
    expect(f.freshnessMinutes).toBe(30)
    expect(f.stale).toBe(true)
    expect(f.degraded).toBe(true)
  })

  it('does not mark stale when budget is unknown', () => {
    const f = computeProviderFreshness({
      providerId: pid,
      capability: 'market.quotes.read',
      lastSuccessAt: '2026-05-09T00:00:00Z',
      now: new Date('2026-05-09T01:00:00Z'),
      maxAgeMinutes: null,
    })
    expect(f.freshnessMinutes).toBe(60)
    expect(f.stale).toBe(false)
  })

  it('floors negative drift to zero rather than fake-negative', () => {
    const f = computeProviderFreshness({
      providerId: pid,
      capability: 'market.quotes.read',
      lastSuccessAt: '2026-05-09T01:00:00Z',
      now: new Date('2026-05-09T00:00:00Z'),
      maxAgeMinutes: 5,
    })
    expect(f.freshnessMinutes).toBe(0)
  })
})
