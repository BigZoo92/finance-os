import { describe, expect, it } from 'vitest'
import { isPowensConnectionRetryable } from './retry-connection'
import type { PowensConnectionStatus } from './types'

const makeConnection = (
  status: PowensConnectionStatus['status'],
): PowensConnectionStatus => ({
  id: 1,
  source: 'powens',
  provider: 'powens',
  powensConnectionId: 'conn-1',
  providerConnectionId: 'provider-1',
  providerInstitutionId: null,
  providerInstitutionName: null,
  status,
  lastSyncStatus: null,
  lastSyncReasonCode: null,
  lastSyncAttemptAt: null,
  lastSyncAt: null,
  lastSuccessAt: null,
  lastFailedAt: null,
  lastError: null,
  syncMetadata: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
})

describe('isPowensConnectionRetryable', () => {
  it('returns true when a connection is in error', () => {
    expect(isPowensConnectionRetryable(makeConnection('error'))).toBe(true)
  })

  it('returns true when a reconnect is required', () => {
    expect(isPowensConnectionRetryable(makeConnection('reconnect_required'))).toBe(true)
  })

  it('returns false when a connection is healthy or syncing', () => {
    expect(isPowensConnectionRetryable(makeConnection('connected'))).toBe(false)
    expect(isPowensConnectionRetryable(makeConnection('syncing'))).toBe(false)
  })
})
