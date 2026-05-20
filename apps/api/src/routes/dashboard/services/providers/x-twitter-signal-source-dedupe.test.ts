import { describe, expect, it } from 'bun:test'
import {
  chooseCanonicalXSignalSource,
  dedupeXSignalSources,
  getCanonicalXHandle,
  mergeTags,
} from './x-twitter-signal-source-dedupe'

const source = (
  overrides: Partial<Parameters<typeof dedupeXSignalSources>[0][number]>
): Parameters<typeof dedupeXSignalSources>[0][number] => {
  const value: Parameters<typeof dedupeXSignalSources>[0][number] = {
    id: overrides.id ?? 1,
    handle: overrides.handle ?? 'aleabitoreddit',
    externalId: overrides.externalId ?? null,
    enabled: overrides.enabled ?? true,
    priority: overrides.priority ?? 50,
  }
  if (overrides.profileImageUrl !== undefined) value.profileImageUrl = overrides.profileImageUrl
  if (overrides.profileMetadata !== undefined) value.profileMetadata = overrides.profileMetadata
  if (overrides.profileCachedAt !== undefined) value.profileCachedAt = overrides.profileCachedAt
  if (overrides.createdAt !== undefined) value.createdAt = overrides.createdAt
  if (overrides.updatedAt !== undefined) value.updatedAt = overrides.updatedAt
  if (overrides.tags !== undefined) value.tags = overrides.tags
  return value
}

describe('x-twitter signal source dedupe', () => {
  it('maps a historical x.com URL and @handle to the same canonical handle', () => {
    expect(getCanonicalXHandle('https://x.com/aleabitoreddit')).toBe('aleabitoreddit')
    expect(getCanonicalXHandle('@aleabitoreddit')).toBe('aleabitoreddit')
  })

  it('keeps the resolved duplicate before the unresolved historical URL', () => {
    const result = dedupeXSignalSources([
      source({ id: 1, handle: 'https://x.com/aleabitoreddit', externalId: null }),
      source({
        id: 2,
        handle: 'aleabitoreddit',
        externalId: '1940360837547565056',
        profileImageUrl: 'https://img',
      }),
    ])

    expect(result.sources).toHaveLength(1)
    expect(result.sources[0]?.id).toBe(2)
    expect(result.dedupedSources).toEqual([
      {
        duplicateId: 1,
        keptId: 2,
        rawHandle: 'https://x.com/aleabitoreddit',
        canonicalHandle: 'aleabitoreddit',
        reason: 'kept_has_external_id',
      },
    ])
  })

  it('uses externalId, then profile metadata, then enabled, then recency as the canonical rule', () => {
    expect(
      chooseCanonicalXSignalSource(
        [
          source({ id: 1, externalId: null, profileImageUrl: 'https://img' }),
          source({ id: 2, externalId: '200' }),
        ],
        'aleabitoreddit'
      ).id
    ).toBe(2)

    expect(
      chooseCanonicalXSignalSource(
        [
          source({ id: 1, profileImageUrl: 'https://img' }),
          source({ id: 2, profileImageUrl: null }),
        ],
        'aleabitoreddit'
      ).id
    ).toBe(1)

    expect(
      chooseCanonicalXSignalSource(
        [
          source({ id: 1, enabled: false, updatedAt: '2026-05-20T10:00:00Z' }),
          source({ id: 2, enabled: true, updatedAt: '2026-05-19T10:00:00Z' }),
        ],
        'aleabitoreddit'
      ).id
    ).toBe(2)

    expect(
      chooseCanonicalXSignalSource(
        [
          source({ id: 1, enabled: true, updatedAt: '2026-05-19T10:00:00Z' }),
          source({ id: 2, enabled: true, updatedAt: '2026-05-20T10:00:00Z' }),
        ],
        'aleabitoreddit'
      ).id
    ).toBe(2)
  })

  it('merges tags deterministically for duplicate reconciliation', () => {
    expect(mergeTags([source({ tags: ['macro', 'ai'] }), source({ tags: ['ai', 'x'] })])).toEqual([
      'ai',
      'macro',
      'x',
    ])
  })
})
