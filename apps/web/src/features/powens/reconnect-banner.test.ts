import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearReconnectBannerDeferredSnapshot,
  createReconnectRequiredFingerprint,
  getPowensReconnectBannerUiEnabled,
  getReconnectRequiredConnectionIds,
  readReconnectBannerDeferredSnapshot,
  writeReconnectBannerDeferredSnapshot,
} from './reconnect-banner'

describe('powens reconnect banner helpers', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('extracts reconnect-required connection ids deterministically', () => {
    const ids = getReconnectRequiredConnectionIds({
      connections: [
        {
          id: 1,
          source: 'banking',
          provider: 'powens',
          powensConnectionId: 'conn-b',
          providerConnectionId: 'conn-b',
          providerInstitutionId: null,
          providerInstitutionName: null,
          status: 'reconnect_required',
          lastSyncStatus: 'KO',
          lastSyncReasonCode: 'RECONNECT_REQUIRED',
          lastSyncAttemptAt: null,
          lastSyncAt: null,
          lastSuccessAt: null,
          lastFailedAt: null,
          lastError: null,
          syncMetadata: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 2,
          source: 'banking',
          provider: 'powens',
          powensConnectionId: 'conn-a',
          providerConnectionId: 'conn-a',
          providerInstitutionId: null,
          providerInstitutionName: null,
          status: 'connected',
          lastSyncStatus: 'OK',
          lastSyncReasonCode: 'SUCCESS',
          lastSyncAttemptAt: null,
          lastSyncAt: null,
          lastSuccessAt: null,
          lastFailedAt: null,
          lastError: null,
          syncMetadata: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 3,
          source: 'banking',
          provider: 'powens',
          powensConnectionId: 'conn-c',
          providerConnectionId: 'conn-c',
          providerInstitutionId: null,
          providerInstitutionName: null,
          status: 'reconnect_required',
          lastSyncStatus: 'KO',
          lastSyncReasonCode: 'RECONNECT_REQUIRED',
          lastSyncAttemptAt: null,
          lastSyncAt: null,
          lastSuccessAt: null,
          lastFailedAt: null,
          lastError: null,
          syncMetadata: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      safeModeActive: false,
      syncStatusPersistenceEnabled: true,
      lastCallback: null,
    })

    expect(ids).toEqual(['conn-b', 'conn-c'])
    expect(createReconnectRequiredFingerprint(ids)).toBe('conn-b|conn-c')
  })

  it('reads runtime-safe feature flag overrides', () => {
    vi.stubGlobal('window', {
      __FINANCE_OS_PUBLIC_RUNTIME_ENV__: {
        VITE_UI_RECONNECT_BANNER_ENABLED: 'false',
      },
    } as Window & typeof globalThis)

    expect(getPowensReconnectBannerUiEnabled()).toBe(false)
  })

  it('persists deferred state in localStorage', () => {
    const storage = new Map<string, string>()

    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value)
        },
        removeItem: (key: string) => {
          storage.delete(key)
        },
      },
    } as Window & typeof globalThis)

    clearReconnectBannerDeferredSnapshot()

    expect(readReconnectBannerDeferredSnapshot()).toBeNull()

    writeReconnectBannerDeferredSnapshot({
      fingerprint: 'conn-a',
      deferredAt: '2026-04-05T10:00:00.000Z',
    })

    expect(readReconnectBannerDeferredSnapshot()).toEqual({
      fingerprint: 'conn-a',
      deferredAt: '2026-04-05T10:00:00.000Z',
    })

    clearReconnectBannerDeferredSnapshot()
    expect(readReconnectBannerDeferredSnapshot()).toBeNull()
  })
})
