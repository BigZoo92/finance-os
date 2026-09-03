import { describe, expect, it } from 'vitest'
import type { SignalItem, SignalSource } from '@/features/signals-api'
import {
  buildSocialFacets,
  buildSourceCards,
  countActiveFilters,
  countRelatedSignals,
  describeCreateFailure,
  describeLookupOutcome,
  EMPTY_SOCIAL_FILTERS,
  filterSourceCards,
  filtersFromSearch,
  GROUP_LABEL,
  parseSocialSearch,
  PLATFORM_LABEL,
  searchFromFilters,
  STATUS_PRESENTATION,
  toInitials,
  toSourceCard,
} from './view-model'

const source = (overrides: Partial<SignalSource>): SignalSource => ({
  id: 1,
  provider: 'x_twitter',
  handle: '@zaborsky',
  displayName: 'Ben Zaborsky',
  url: 'https://x.com/zaborsky',
  group: 'finance',
  enabled: true,
  priority: 90,
  tags: ['macro', 'fed', 'rates'],
  language: 'en',
  includePatterns: [],
  excludePatterns: [],
  minRelevanceScore: 0,
  requiresAttentionPolicy: 'auto',
  lastFetchedAt: null,
  lastCursor: null,
  lastError: null,
  lastFetchedCount: null,
  createdAt: '2026-04-20T10:00:00Z',
  updatedAt: '2026-04-20T10:00:00Z',
  ...overrides,
})

const item = (overrides: Partial<SignalItem>): SignalItem => ({
  id: 1,
  sourceProvider: 'x_twitter',
  sourceType: 'post',
  externalId: 'ext',
  url: null,
  title: 'Titre',
  body: null,
  author: '@zaborsky',
  publishedAt: '2026-03-09T10:00:00.000Z',
  signalDomain: 'macro',
  relevanceScore: 50,
  impactScore: 50,
  urgencyScore: 50,
  requiresAttention: false,
  attentionReason: null,
  tickers: [],
  sectors: [],
  topics: [],
  graphIngestStatus: 'pending',
  advisorIngestStatus: 'pending',
  createdAt: '2026-03-09T10:00:00.000Z',
  ...overrides,
})

describe('toSourceCard', () => {
  it('leads with identity from the resolved profile and normalizes the handle', () => {
    const card = toSourceCard(
      source({
        handle: '@@Zaborsky/',
        profileImageUrl: 'https://img.example/avatar.png',
        profileMetadata: {
          username: 'Zaborsky',
          name: 'Ben Zaborsky',
          description: 'Macro et taux.',
          publicMetrics: {
            followersCount: 120_000,
            followingCount: 12,
            tweetCount: 3,
            listedCount: 1,
          },
        },
        verificationStatus: 'verified',
      })
    )

    expect(card.name).toBe('Ben Zaborsky')
    expect(card.handle).toBe('zaborsky')
    expect(card.initials).toBe('BZ')
    expect(card.avatarUrl).toBe('https://img.example/avatar.png')
    expect(card.bio).toBe('Macro et taux.')
    expect(card.tags).toEqual(['macro', 'fed', 'rates'])
    expect(card.platform).toBe('x')
    expect(card.status).toBe('active')
    expect(JSON.stringify(card)).not.toContain('followers')
  })

  it('falls back to the display name and omits the bio when no profile exists', () => {
    const card = toSourceCard(
      source({ provider: 'bluesky', handle: 'ecb.bsky.social', displayName: 'BCE' })
    )
    expect(card.name).toBe('BCE')
    expect(card.handle).toBe('ecb.bsky.social')
    expect(card.bio).toBeNull()
    expect(card.platform).toBe('bluesky')
    expect(toSourceCard(source({ provider: 'rss_feed' })).platform).toBe('other')
  })

  it('maps backend states to a light human status', () => {
    expect(toSourceCard(source({ enabled: false })).status).toBe('paused')
    expect(toSourceCard(source({ lastError: 'HTTP 429' })).status).toBe('attention')
    expect(toSourceCard(source({ verificationStatus: 'unresolved' })).status).toBe('attention')
    expect(toSourceCard(source({ verificationStatus: 'not_applicable' })).status).toBe('active')

    const labels = [
      ...Object.values(STATUS_PRESENTATION).map(status => status.label),
      ...Object.values(PLATFORM_LABEL),
      ...Object.values(GROUP_LABEL),
    ]
    for (const label of labels) {
      expect(label).not.toMatch(/x_twitter|manual_import|ai_tech|not_applicable|unresolved|[·—;]/)
    }
  })

  it('builds initials from names or handles', () => {
    expect(toInitials('Unusual Whales', 'unusual_whales')).toBe('UW')
    expect(toInitials('Anthropic', 'anthropicai')).toBe('A')
    expect(toInitials('', 'openai')).toBe('OP')
  })
})

describe('gallery composition', () => {
  const cards = buildSourceCards([
    source({ id: 1 }),
    source({ id: 2, handle: '@ZABORSKY', priority: 10 }),
    source({
      id: 3,
      handle: '@AnthropicAI',
      displayName: 'Anthropic',
      group: 'ai_tech',
      tags: ['Claude', 'modèles'],
      priority: 95,
    }),
    source({
      id: 4,
      provider: 'bluesky',
      handle: 'ecb.bsky.social',
      displayName: 'BCE',
      enabled: false,
      tags: ['macro', 'BCE'],
    }),
  ])

  it('dedupes duplicate X handles and keeps the backend order (priority, then name)', () => {
    expect(cards.map(card => card.id)).toEqual([3, 4, 1])
  })

  it('filters on platform, group, status, topic and accent-insensitive search', () => {
    expect(
      filterSourceCards(cards, { ...EMPTY_SOCIAL_FILTERS, platform: 'bluesky' }).map(c => c.id)
    ).toEqual([4])
    expect(
      filterSourceCards(cards, { ...EMPTY_SOCIAL_FILTERS, group: 'ai_tech' }).map(c => c.id)
    ).toEqual([3])
    expect(
      filterSourceCards(cards, { ...EMPTY_SOCIAL_FILTERS, status: 'paused' }).map(c => c.id)
    ).toEqual([4])
    expect(
      filterSourceCards(cards, { ...EMPTY_SOCIAL_FILTERS, status: 'active' }).map(c => c.id)
    ).toEqual([3, 1])
    expect(
      filterSourceCards(cards, { ...EMPTY_SOCIAL_FILTERS, tag: 'MACRO' }).map(c => c.id)
    ).toEqual([4, 1])
    expect(
      filterSourceCards(cards, { ...EMPTY_SOCIAL_FILTERS, q: 'modeles' }).map(c => c.id)
    ).toEqual([3])
    expect(filterSourceCards(cards, { ...EMPTY_SOCIAL_FILTERS, q: 'zab' }).map(c => c.id)).toEqual([
      1,
    ])
    expect(
      countActiveFilters({ ...EMPTY_SOCIAL_FILTERS, q: 'x', tag: 'macro', status: 'active' })
    ).toBe(2)
  })

  it('derives filter options from the sources present only', () => {
    const facets = buildSocialFacets(cards)
    expect(facets.platforms).toEqual(['x', 'bluesky'])
    expect(facets.groups).toEqual(['finance', 'ai_tech'])
    expect(facets.tags.slice(0, 1)).toEqual(['macro'])
    expect(facets.tags).toContain('Claude')
  })

  it('counts related events from real author matches only', () => {
    const zaborsky = cards.find(card => card.id === 1)
    const bce = cards.find(card => card.id === 4)
    if (!zaborsky || !bce) throw new Error('missing cards')
    const items = [
      item({ id: 1, author: '@Zaborsky' }),
      item({ id: 2, author: 'zaborsky', sourceProvider: 'bluesky' }),
      item({ id: 3, author: 'zaborsky', sourceProvider: 'hn_algolia' }),
      item({ id: 4, author: null }),
    ]
    expect(countRelatedSignals(zaborsky, items)).toBe(2)
    expect(countRelatedSignals(bce, items)).toBe(0)
  })
})

describe('route search', () => {
  it('parses human slugs leniently and round-trips filters', () => {
    const search = parseSocialSearch({
      q: 'macro',
      platform: 'x',
      tag: 'fed',
      status: 'paused',
      group: 'ia-tech',
      selected: '3',
      bogus: true,
    })
    expect(search).toEqual({
      q: 'macro',
      platform: 'x',
      tag: 'fed',
      status: 'paused',
      group: 'ia-tech',
      selected: 3,
    })

    const filters = filtersFromSearch(search)
    expect(filters.group).toBe('ai_tech')
    expect(searchFromFilters(filters, 3)).toEqual(search)
    expect(searchFromFilters(EMPTY_SOCIAL_FILTERS, undefined)).toEqual({})

    expect(
      parseSocialSearch({ platform: 'facebook', status: 'nope', group: 'x', selected: -1 })
    ).toEqual({})
    expect(parseSocialSearch({ q: '   ' })).toEqual({})
  })
})

describe('admin copy', () => {
  it('never surfaces HTTP codes or provider payloads', () => {
    const outcomes = [
      describeLookupOutcome('verified', true),
      describeLookupOutcome('unverified_payment_required', false),
      describeLookupOutcome('unverified_not_found', false),
      describeLookupOutcome(undefined, false),
      describeCreateFailure('SIGNAL_SOURCE_DUPLICATE'),
      describeCreateFailure('INVALID_HANDLE'),
      describeCreateFailure(undefined),
    ]
    for (const copy of outcomes) {
      expect(copy).not.toMatch(/HTTP|40\d|token|payload|[·—;]/i)
    }
    expect(describeLookupOutcome('unverified_not_found', false)).toBe('Compte introuvable sur X')
  })
})
