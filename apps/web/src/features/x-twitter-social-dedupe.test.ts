import { describe, expect, it } from 'vitest'
import type { SignalSource } from './signals-api'
import { dedupeSignalSourcesForDisplay, normalizeXHandleForUi } from './x-twitter-social-dedupe'

const source = (overrides: Partial<SignalSource>): SignalSource => {
  const value: SignalSource = {
    id: overrides.id ?? 1,
    provider: overrides.provider ?? 'x_twitter',
    handle: overrides.handle ?? 'aleabitoreddit',
    displayName: overrides.displayName ?? 'Alea',
    url: overrides.url ?? null,
    group: overrides.group ?? 'finance',
    enabled: overrides.enabled ?? true,
    priority: overrides.priority ?? 50,
    tags: overrides.tags ?? [],
    language: overrides.language ?? 'en',
    includePatterns: overrides.includePatterns ?? [],
    excludePatterns: overrides.excludePatterns ?? [],
    minRelevanceScore: overrides.minRelevanceScore ?? 0,
    requiresAttentionPolicy: overrides.requiresAttentionPolicy ?? 'auto',
    lastFetchedAt: overrides.lastFetchedAt ?? null,
    lastCursor: overrides.lastCursor ?? null,
    lastError: overrides.lastError ?? null,
    lastFetchedCount: overrides.lastFetchedCount ?? null,
    createdAt: overrides.createdAt ?? '2026-05-19T10:00:00Z',
    updatedAt: overrides.updatedAt ?? '2026-05-19T10:00:00Z',
  }
  if (overrides.externalId !== undefined) value.externalId = overrides.externalId
  if (overrides.profileImageUrl !== undefined) value.profileImageUrl = overrides.profileImageUrl
  if (overrides.profileMetadata !== undefined) value.profileMetadata = overrides.profileMetadata
  if (overrides.profileCachedAt !== undefined) value.profileCachedAt = overrides.profileCachedAt
  if (overrides.verificationStatus !== undefined)
    value.verificationStatus = overrides.verificationStatus
  return value
}

describe('x-twitter social UI dedupe', () => {
  it('normalizes URL and repeated-at handles for display', () => {
    expect(normalizeXHandleForUi('https://x.com/aleabitoreddit')).toBe('aleabitoreddit')
    expect(normalizeXHandleForUi('@@tom_doerr')).toBe('tom_doerr')
  })

  it('keeps one visible card per canonical X account', () => {
    const result = dedupeSignalSourcesForDisplay([
      source({ id: 1, handle: 'https://x.com/aleabitoreddit', externalId: null }),
      source({
        id: 2,
        handle: 'aleabitoreddit',
        externalId: '1940360837547565056',
        profileMetadata: { username: 'aleabitoreddit', name: 'Alea' },
      }),
    ])

    expect(result.sources).toHaveLength(1)
    expect(result.sources[0]?.id).toBe(2)
    expect(result.duplicates).toEqual([
      {
        duplicateId: 1,
        keptId: 2,
        rawHandle: 'https://x.com/aleabitoreddit',
        canonicalHandle: 'aleabitoreddit',
        reason: 'kept_has_external_id',
      },
    ])
  })
})
