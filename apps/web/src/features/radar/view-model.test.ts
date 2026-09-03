import { describe, expect, it } from 'vitest'
import { getDemoMarketsOverview } from '@/features/markets/demo-data'
import type { DashboardMarketsOverviewResponse } from '@/features/markets/types'
import type { SignalItem } from '@/features/signals-api'
import {
  applyRadarFilter,
  buildRadarViewModel,
  computeMarketImportance,
  EVENT_SOURCE_LABEL,
  focusedMacroIds,
  focusedMarketIds,
  formatEventMoment,
  formatUpdateMoment,
  parseDataRef,
  parseRadarFocus,
  parseRadarSearch,
  QUOTE_MODE_LABEL,
  RADAR_FILTER_LABEL,
  resolveRadarFilter,
  resolveRadarFocus,
  serializeRadarFocus,
  SEVERITY_LABEL,
  signalsForMarket,
  TONE_LABEL,
  toneForChange,
} from './view-model'

const overview = getDemoMarketsOverview()

const item = (overrides: Partial<SignalItem>): SignalItem => ({
  id: 1,
  sourceProvider: 'hn_algolia',
  sourceType: 'news',
  externalId: 'ext-1',
  url: null,
  title: 'Titre',
  body: null,
  author: null,
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

const withSignals = (
  signals: DashboardMarketsOverviewResponse['signals']['items']
): DashboardMarketsOverviewResponse => ({ ...overview, signals: { items: signals } })

const RECOMMENDATION_VERBS = /\b(acheter|vendre|renforcer|alléger|investir)\b/i
const FORBIDDEN_PUNCTUATION = /[·—;]/

describe('buildRadarViewModel', () => {
  it('keeps every monitored market once and never turns an unknown variation into zero', () => {
    const firstQuote = overview.panorama.items[0]
    if (!firstQuote) throw new Error('fixture without quotes')
    const vm = buildRadarViewModel({
      overview: {
        ...overview,
        panorama: {
          items: [{ ...firstQuote, dayChangePct: null }, ...overview.panorama.items.slice(1)],
        },
        watchlist: { ...overview.watchlist, items: overview.panorama.items },
      },
      signalItems: [],
    })

    expect(vm.markets.map(market => market.id)).toEqual(['spy-us', 'qqq-us', 'cw8-pa'])
    expect(vm.markets[0]?.changePct).toBeNull()
    expect(vm.markets[0]?.price).toBe(536.2)
    expect(vm.markets[0]?.category).toBe('markets')
    expect(vm.stripMarketIds).toEqual(['spy-us', 'qqq-us', 'cw8-pa'])
  })

  it('maps macro series to human levels and ranks signals by importance', () => {
    const vm = buildRadarViewModel({ overview, signalItems: [] })

    expect(vm.macro.map(series => series.label)).toEqual(['Fed funds', '10Y-2Y', 'Inflation CPI'])
    expect(vm.signals.map(signal => signal.severity)).toEqual(['high', 'medium'])

    const rates = vm.signals[0]
    expect(rates?.subject).toBe('Fed funds')
    expect(rates?.observation).toBe('Les taux courts restent élevés')
    expect(rates?.value).toEqual({ kind: 'level', display: '4,50 %' })
    expect(rates?.relatedMacroIds).toEqual(['FEDFUNDS'])
    expect(rates?.relatedMarketIds).toEqual([])
    expect(rates?.tone).toBe('negative')
  })

  it('relates basket signals to the markets they reference', () => {
    const vm = buildRadarViewModel({
      overview: withSignals([
        {
          id: 'us-outperformance',
          title: 'Les actifs US surperforment',
          detail: '',
          tone: 'opportunity',
          severity: 'medium',
          evidence: [],
          dataRefs: ['watchlist:us', 'watchlist:europe'],
        },
        {
          id: 'breadth-positive',
          title: 'La breadth reste constructive',
          detail: '',
          tone: 'neutral',
          severity: 'low',
          evidence: [],
          dataRefs: ['watchlist:breadth'],
        },
      ]),
      signalItems: [],
    })

    const [regional, breadth] = vm.signals
    expect(regional?.subject).toBe('US et Europe')
    expect(regional?.relatedMarketIds).toEqual(['spy-us', 'qqq-us'])
    expect(regional?.value).toBeNull()
    expect(breadth?.subject).toBe('Ensemble des marchés')
    expect(breadth?.relatedMarketIds).toEqual(['spy-us', 'qqq-us', 'cw8-pa'])
  })

  it('exposes only the categories present in the data', () => {
    const vm = buildRadarViewModel({ overview, signalItems: [] })
    expect(vm.filters).toEqual(['all', 'markets', 'macro'])

    const noMacro = buildRadarViewModel({
      overview: { ...overview, macro: { items: [] } },
      signalItems: [],
    })
    expect(noMacro.filters).toEqual([])
  })

  it('maps persisted items to human events with attention first', () => {
    const vm = buildRadarViewModel({
      overview,
      signalItems: [
        item({ id: 1, sourceProvider: 'hn_algolia', publishedAt: '2026-03-09T10:00:00.000Z' }),
        item({
          id: 2,
          sourceProvider: 'x_twitter',
          author: '@Unusual_Whales',
          tickers: ['SPY', 'ZZZ'],
          requiresAttention: true,
          advisorIngestStatus: 'sent',
          publishedAt: '2026-03-08T10:00:00.000Z',
          url: 'https://x.com/unusual_whales/status/1',
        }),
        item({
          id: 3,
          sourceProvider: 'unknown_provider',
          publishedAt: '2026-03-10T10:00:00.000Z',
        }),
      ],
    })

    expect(vm.events.map(event => event.id)).toEqual(['2', '3', '1'])
    const social = vm.events[0]
    expect(social?.sourceLabel).toBe('X')
    expect(social?.author).toBe('@unusual_whales')
    expect(social?.social).toBe(true)
    expect(social?.usedByAdvisor).toBe(true)
    expect(social?.relatedMarketIds).toEqual(['spy-us'])
    expect(vm.events[1]?.sourceLabel).toBe('Source')
    expect(vm.events[2]?.sourceLabel).toBe('Hacker News')
    expect(vm.events[2]?.author).toBeNull()
  })

  it('treats no signal and no attention event as a quiet day', () => {
    const quiet = buildRadarViewModel({ overview: withSignals([]), signalItems: [item({})] })
    expect(quiet.quiet).toBe(true)

    const attention = buildRadarViewModel({
      overview: withSignals([]),
      signalItems: [item({ requiresAttention: true })],
    })
    expect(attention.quiet).toBe(false)
    expect(buildRadarViewModel({ overview, signalItems: [] }).quiet).toBe(false)
  })

  it('carries freshness through without inventing a timestamp', () => {
    const vm = buildRadarViewModel({
      overview: {
        ...overview,
        freshness: { ...overview.freshness, lastSuccessAt: null, stale: true },
      },
      signalItems: [],
    })
    expect(vm.freshness).toEqual({ asOf: null, staleAfterMinutes: 960, stale: true })
    expect(vm.isDemoData).toBe(true)
  })
})

describe('filters and importance', () => {
  const vm = buildRadarViewModel({
    overview: withSignals([
      ...overview.signals.items,
      {
        id: 'us-outperformance',
        title: 'Les actifs US surperforment',
        detail: '',
        tone: 'opportunity',
        severity: 'high',
        evidence: [],
        dataRefs: ['watchlist:us'],
      },
    ]),
    signalItems: [item({ id: 9, tickers: ['CW8'], requiresAttention: true })],
  })

  it('scopes the strip, signals and emphasis per filter', () => {
    const all = applyRadarFilter(vm, 'all')
    expect(all.strip.map(entry => entry.id)).toEqual(['spy-us', 'qqq-us', 'cw8-pa', 'FEDFUNDS'])
    expect(all.dimMarkets).toBe(false)

    const macro = applyRadarFilter(vm, 'macro')
    expect(macro.signals.map(signal => signal.id)).toEqual(['rates-high', 'inflation-cooling'])
    expect(macro.strip.every(entry => entry.kind === 'macro')).toBe(true)
    expect(macro.dimMarkets).toBe(true)

    const markets = applyRadarFilter(vm, 'markets')
    expect(markets.signals.map(signal => signal.id)).toEqual(['us-outperformance'])
    expect(markets.markets).toHaveLength(3)
  })

  it('derives market importance from related signals and attention events', () => {
    const importance = computeMarketImportance(vm)
    expect(importance.get('spy-us')).toBe(3)
    expect(importance.get('qqq-us')).toBe(3)
    expect(importance.get('cw8-pa')).toBe(2)
  })

  it('lists the signals pointing at a market', () => {
    expect(signalsForMarket(vm, 'spy-us').map(signal => signal.id)).toEqual(['us-outperformance'])
    expect(signalsForMarket(vm, 'cw8-pa')).toEqual([])
  })

  it('resolves focus against the current data only', () => {
    const signalFocus = resolveRadarFocus(vm, 'signal:rates-high')
    expect(signalFocus?.kind).toBe('signal')
    expect([...focusedMacroIds(signalFocus)]).toEqual(['FEDFUNDS'])
    expect(focusedMarketIds(signalFocus).size).toBe(0)

    const marketFocus = resolveRadarFocus(vm, 'market:spy-us')
    expect([...focusedMarketIds(marketFocus)]).toEqual(['spy-us'])

    const eventFocus = resolveRadarFocus(vm, 'event:9')
    expect([...focusedMarketIds(eventFocus)]).toEqual(['cw8-pa'])

    expect(resolveRadarFocus(vm, 'signal:unknown')).toBeNull()
    expect(resolveRadarFocus(vm, 'garbage')).toBeNull()
    expect(resolveRadarFocus(vm, undefined)).toBeNull()
  })
})

describe('search params', () => {
  it('parses and serializes focus and filter leniently', () => {
    expect(parseRadarFocus('market:spy-us')).toEqual({ kind: 'market', id: 'spy-us' })
    expect(parseRadarFocus('signal:rates-high')).toEqual({ kind: 'signal', id: 'rates-high' })
    expect(parseRadarFocus('event:12')).toEqual({ kind: 'event', id: '12' })
    expect(parseRadarFocus('nope:1')).toBeNull()
    expect(parseRadarFocus('market:<script>')).toBeNull()
    expect(serializeRadarFocus({ kind: 'event', id: '12' })).toBe('event:12')

    expect(parseRadarSearch({ focus: 'market:spy-us', filter: 'macro', extra: 1 })).toEqual({
      focus: 'market:spy-us',
      filter: 'macro',
    })
    expect(parseRadarSearch({ focus: 42, filter: 'all' })).toEqual({})
    expect(parseRadarSearch({ filter: 'bogus' })).toEqual({})
  })

  it('falls back to Tout when a filter is not available', () => {
    expect(resolveRadarFilter('macro', ['all', 'markets', 'macro'])).toBe('macro')
    expect(resolveRadarFilter('crypto', ['all', 'markets', 'macro'])).toBe('all')
    expect(resolveRadarFilter(undefined, [])).toBe('all')
  })

  it('parses backend data references', () => {
    expect(parseDataRef('macro: FEDFUNDS')).toEqual({ kind: 'macro', id: 'FEDFUNDS' })
    expect(parseDataRef('watchlist:us')).toEqual({ kind: 'region', region: 'us' })
    expect(parseDataRef('watchlist:breadth')).toEqual({ kind: 'breadth' })
    expect(parseDataRef('quote: spy-us')).toBeNull()
  })
})

describe('copy and formatting', () => {
  it('keeps every Radar label observational and free of forbidden punctuation', () => {
    const labels = [
      ...Object.values(SEVERITY_LABEL),
      ...Object.values(TONE_LABEL),
      ...Object.values(RADAR_FILTER_LABEL),
      ...Object.values(EVENT_SOURCE_LABEL),
      ...Object.values(QUOTE_MODE_LABEL),
    ]
    for (const label of labels) {
      expect(label).not.toMatch(RECOMMENDATION_VERBS)
      expect(label).not.toMatch(FORBIDDEN_PUNCTUATION)
    }
    expect(Object.values(EVENT_SOURCE_LABEL)).not.toContain('hn_algolia')
  })

  it('formats moments without exposing ISO timestamps', () => {
    const now = new Date('2026-03-10T15:00:00.000Z')
    expect(formatUpdateMoment(null, now)).toBeNull()
    expect(formatUpdateMoment('not a date', now)).toBeNull()
    expect(formatUpdateMoment('2026-03-10T14:10:00.000Z', now)).toMatch(/^\d{2}:\d{2}$/)
    expect(formatUpdateMoment('2026-02-03T14:10:00.000Z', now)).toMatch(/^3 f[ée]vr\.?$/)
    expect(formatEventMoment('2026-03-08T13:30:00.000Z', now)).toMatch(/^8 mars \d{2}:\d{2}$/)
    expect(formatEventMoment('nope', now)).toBeNull()
  })

  it('derives a semantic tone from the sign of a variation', () => {
    expect(toneForChange(null)).toBe('neutral')
    expect(toneForChange(0.02)).toBe('neutral')
    expect(toneForChange(0.8)).toBe('positive')
    expect(toneForChange(-2.4)).toBe('negative')
  })
})
