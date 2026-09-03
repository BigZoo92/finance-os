/**
 * Radar view model.
 *
 * Pure mapping from the markets overview and the persisted signal items to
 * what Radar shows: monitored markets, macro context, observation signals,
 * dated events and freshness.
 *
 * Radar observes. Nothing here produces a recommendation, a score or a
 * pipeline detail: every field is backed by data the backend already
 * exposes, and unknown values stay unknown.
 */
import type {
  DashboardMarketMacroSeries,
  DashboardMarketQuote,
  DashboardMarketSignal,
  DashboardMarketsOverviewResponse,
} from '@/features/markets/types'
import type { SignalItem } from '@/features/signals-api'

export type RadarCategory = 'markets' | 'crypto' | 'macro'
export type RadarFilter = 'all' | RadarCategory
export type RadarSeverity = 'high' | 'medium' | 'low'
export type RadarTone = 'positive' | 'negative' | 'neutral'

export const RADAR_FILTERS: ReadonlyArray<RadarFilter> = ['all', 'markets', 'crypto', 'macro']

export const RADAR_FILTER_LABEL: Record<RadarFilter, string> = {
  all: 'Tout',
  markets: 'Marchés',
  crypto: 'Crypto',
  macro: 'Macro',
}

export const SEVERITY_LABEL: Record<RadarSeverity, string> = {
  high: 'Important',
  medium: 'À suivre',
  low: 'Faible',
}

export const SEVERITY_WEIGHT: Record<RadarSeverity, number> = { high: 3, medium: 2, low: 1 }

/** Human reading of the backend tone. Observational, never an instruction. */
export const TONE_LABEL: Record<RadarTone, string> = {
  negative: 'Vigilance',
  positive: 'Contexte favorable',
  neutral: 'Neutre',
}

export const QUOTE_MODE_LABEL: Record<DashboardMarketQuote['source']['mode'], string> = {
  eod: 'Cours de clôture',
  delayed: 'Cours différé',
  intraday: 'Cours intraday',
}

const REGION_LABEL: Record<string, string> = {
  us: 'US',
  europe: 'Europe',
  world: 'Monde',
  asia: 'Asie',
  emerging: 'Émergents',
  africa: 'Afrique',
}

/** Human labels for event providers. Raw provider keys are never shown. */
export const EVENT_SOURCE_LABEL: Record<string, string> = {
  hn_algolia: 'Hacker News',
  gdelt_doc: 'GDELT',
  ecb_rss: 'BCE',
  ecb_data: 'BCE',
  fed_rss: 'Fed',
  sec_edgar: 'SEC',
  fred: 'FRED',
  x_twitter: 'X',
  bluesky: 'Bluesky',
  manual_import: 'Import manuel',
  free_firehose: 'Veille',
}

const SOCIAL_PROVIDERS: ReadonlySet<string> = new Set(['x_twitter', 'bluesky'])

/** Shared query shape for the persisted items Radar and Social read. */
export const RADAR_EVENTS_QUERY = { limit: 30 } as const

export const MAX_RADAR_EVENTS = 6
export const MAX_STRIP_MARKETS = 6

export type RadarMarket = {
  id: string
  label: string
  symbol: string
  category: Exclude<RadarCategory, 'macro'>
  region: string
  currency: string
  price: number | null
  changePct: number | null
  asOf: string | null
  quoteMode: DashboardMarketQuote['source']['mode']
  sessionLabel: string
  history: Array<{ date: string; value: number }>
}

export type RadarMacro = {
  id: string
  label: string
  category: 'macro'
  displayValue: string
  changeDirection: DashboardMarketMacroSeries['changeDirection']
  comparisonValue: string | null
  observationDate: string | null
  description: string
}

export type RadarSignalValue =
  | { kind: 'percent'; value: number | null }
  | { kind: 'level'; display: string }

export type RadarSignal = {
  id: string
  /** What moves: a market, a macro series or a basket. */
  subject: string
  /** The observation itself, in the backend's words. */
  observation: string
  detail: string
  severity: RadarSeverity
  tone: RadarTone
  evidence: string[]
  relatedMarketIds: string[]
  relatedMacroIds: string[]
  value: RadarSignalValue | null
}

export type RadarEvent = {
  id: string
  sourceLabel: string
  author: string | null
  title: string
  publishedAt: string
  requiresAttention: boolean
  usedByAdvisor: boolean
  social: boolean
  url: string | null
  relatedMarketIds: string[]
}

export type RadarFreshness = {
  asOf: string | null
  staleAfterMinutes: number
  stale: boolean
}

export type RadarViewModel = {
  markets: RadarMarket[]
  /** Panorama instruments first: the small set worth a first glance. */
  stripMarketIds: string[]
  macro: RadarMacro[]
  signals: RadarSignal[]
  events: RadarEvent[]
  filters: RadarFilter[]
  freshness: RadarFreshness
  isDemoData: boolean
  /** No signal and no attention event: a calm day, not an error. */
  quiet: boolean
}

export type RadarFocus = { kind: 'signal' | 'market' | 'event'; id: string }

export type RadarSearch = {
  focus?: string
  filter?: RadarFilter
}

const toFiniteOrNull = (value: number | null | undefined): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

const uniqueBy = <T>(items: T[], key: (item: T) => string): T[] => {
  const seen = new Set<string>()
  const result: T[] = []
  for (const item of items) {
    const id = key(item)
    if (seen.has(id)) continue
    seen.add(id)
    result.push(item)
  }
  return result
}

const toMarket = (quote: DashboardMarketQuote): RadarMarket => ({
  id: quote.instrumentId,
  label: quote.shortLabel,
  symbol: quote.symbol,
  category: quote.tags.includes('crypto') ? 'crypto' : 'markets',
  region: quote.region,
  currency: quote.currency,
  price: toFiniteOrNull(quote.price),
  changePct: toFiniteOrNull(quote.dayChangePct),
  asOf: quote.source.quoteAsOf ?? null,
  quoteMode: quote.source.mode,
  sessionLabel: quote.marketSession.label,
  history: quote.history
    .filter(point => Number.isFinite(point.value))
    .map(point => ({ date: point.date, value: point.value })),
})

const toMacro = (series: DashboardMarketMacroSeries): RadarMacro => ({
  id: series.seriesId,
  label: series.shortLabel,
  category: 'macro',
  displayValue: series.displayValue,
  changeDirection: series.changeDirection,
  comparisonValue: series.comparisonValue,
  observationDate: series.observationDate,
  description: series.description,
})

type DataRef =
  | { kind: 'macro'; id: string }
  | { kind: 'region'; region: string }
  | { kind: 'breadth' }

export const parseDataRef = (ref: string): DataRef | null => {
  const macro = /^macro:\s*(\S+)$/i.exec(ref.trim())
  if (macro?.[1]) return { kind: 'macro', id: macro[1] }
  const watchlist = /^watchlist:\s*(\S+)$/i.exec(ref.trim())
  if (watchlist?.[1]) {
    return watchlist[1] === 'breadth'
      ? { kind: 'breadth' }
      : { kind: 'region', region: watchlist[1] }
  }
  return null
}

const toTone = (tone: DashboardMarketSignal['tone']): RadarTone =>
  tone === 'risk' ? 'negative' : tone === 'opportunity' ? 'positive' : 'neutral'

const joinLabels = (labels: string[]): string =>
  labels.length <= 1 ? (labels[0] ?? '') : `${labels.slice(0, -1).join(', ')} et ${labels.at(-1)}`

const toSignal = (
  signal: DashboardMarketSignal,
  markets: RadarMarket[],
  macro: RadarMacro[]
): RadarSignal => {
  const refs = signal.dataRefs.map(parseDataRef).filter((ref): ref is DataRef => ref !== null)
  const relatedMacro = refs.flatMap(ref =>
    ref.kind === 'macro' ? macro.filter(series => series.id === ref.id) : []
  )
  const regions = refs.flatMap(ref => (ref.kind === 'region' ? [ref.region] : []))
  const breadth = refs.some(ref => ref.kind === 'breadth')
  const relatedMarkets = breadth
    ? markets
    : markets.filter(market => regions.includes(market.region))

  const subject =
    relatedMacro.length > 0
      ? joinLabels(relatedMacro.map(series => series.label))
      : breadth
        ? 'Ensemble des marchés'
        : regions.length > 0
          ? joinLabels(regions.map(region => REGION_LABEL[region] ?? region))
          : 'Marchés'

  const single = relatedMacro.length === 1 ? relatedMacro[0] : undefined
  const value: RadarSignalValue | null = single
    ? { kind: 'level', display: single.displayValue }
    : null

  return {
    id: signal.id,
    subject,
    observation: signal.title,
    detail: signal.detail,
    severity: signal.severity,
    tone: toTone(signal.tone),
    evidence: signal.evidence,
    relatedMarketIds: relatedMarkets.map(market => market.id),
    relatedMacroIds: relatedMacro.map(series => series.id),
    value,
  }
}

const normalizeHandle = (author: string): string => author.trim().replace(/^@+/, '').toLowerCase()

const toEvent = (item: SignalItem, marketIdBySymbol: Map<string, string>): RadarEvent => {
  const social = SOCIAL_PROVIDERS.has(item.sourceProvider)
  const author = social && item.author ? `@${normalizeHandle(item.author)}` : null
  const relatedMarketIds = uniqueBy(
    item.tickers
      .map(ticker => marketIdBySymbol.get(ticker.trim().toUpperCase()))
      .filter((id): id is string => id !== undefined),
    id => id
  )
  return {
    id: String(item.id),
    sourceLabel: EVENT_SOURCE_LABEL[item.sourceProvider] ?? 'Source',
    author,
    title: item.title,
    publishedAt: item.publishedAt,
    requiresAttention: item.requiresAttention,
    usedByAdvisor: item.advisorIngestStatus === 'sent',
    social,
    url: item.url,
    relatedMarketIds,
  }
}

const rankSignals = (signals: RadarSignal[]): RadarSignal[] =>
  signals
    .map((signal, index) => ({ signal, index }))
    .sort(
      (left, right) =>
        SEVERITY_WEIGHT[right.signal.severity] - SEVERITY_WEIGHT[left.signal.severity] ||
        left.index - right.index
    )
    .map(entry => entry.signal)

const toTime = (iso: string): number => {
  const time = new Date(iso).getTime()
  return Number.isFinite(time) ? time : 0
}

const rankEvents = (events: RadarEvent[]): RadarEvent[] =>
  [...events].sort(
    (left, right) =>
      Number(right.requiresAttention) - Number(left.requiresAttention) ||
      toTime(right.publishedAt) - toTime(left.publishedAt)
  )

const availableFilters = (markets: RadarMarket[], macro: RadarMacro[]): RadarFilter[] => {
  const categories: RadarFilter[] = []
  if (markets.some(market => market.category === 'markets')) categories.push('markets')
  if (markets.some(market => market.category === 'crypto')) categories.push('crypto')
  if (macro.length > 0) categories.push('macro')
  return categories.length > 1 ? ['all', ...categories] : []
}

export const buildRadarViewModel = ({
  overview,
  signalItems,
}: {
  overview: DashboardMarketsOverviewResponse
  signalItems: SignalItem[]
}): RadarViewModel => {
  const quotes = uniqueBy(
    [...overview.panorama.items, ...overview.watchlist.items],
    quote => quote.instrumentId
  )
  const markets = quotes.map(toMarket)
  const macro = overview.macro.items.map(toMacro)
  const signals = rankSignals(
    overview.signals.items.map(signal => toSignal(signal, markets, macro))
  )

  const marketIdBySymbol = new Map(markets.map(market => [market.symbol.toUpperCase(), market.id]))
  const events = rankEvents(signalItems.map(item => toEvent(item, marketIdBySymbol))).slice(
    0,
    MAX_RADAR_EVENTS
  )

  const stripMarketIds = overview.panorama.items
    .map(quote => quote.instrumentId)
    .filter((id, index, all) => all.indexOf(id) === index)
    .slice(0, MAX_STRIP_MARKETS)

  return {
    markets,
    stripMarketIds:
      stripMarketIds.length > 0
        ? stripMarketIds
        : markets.slice(0, MAX_STRIP_MARKETS).map(m => m.id),
    macro,
    signals,
    events,
    filters: availableFilters(markets, macro),
    freshness: {
      asOf: overview.freshness.lastSuccessAt,
      staleAfterMinutes: overview.freshness.staleAfterMinutes,
      stale: overview.freshness.stale,
    },
    isDemoData: overview.dataset?.isDemoData ?? overview.source === 'demo_fixture',
    quiet: signals.length === 0 && !events.some(event => event.requiresAttention),
  }
}

export type RadarScope = {
  filter: RadarFilter
  markets: RadarMarket[]
  signals: RadarSignal[]
  /** Items for the first-glance strip: markets, or macro levels under the macro focus. */
  strip: Array<
    | { kind: 'market'; id: string; label: string; changePct: number | null }
    | { kind: 'macro'; id: string; label: string; display: string }
  >
  /** Trajectories recede when the focus is macro. */
  dimMarkets: boolean
}

export const applyRadarFilter = (vm: RadarViewModel, filter: RadarFilter): RadarScope => {
  const marketsById = new Map(vm.markets.map(market => [market.id, market]))
  const stripMarkets = vm.stripMarketIds
    .map(id => marketsById.get(id))
    .filter((market): market is RadarMarket => market !== undefined)

  const marketStrip = (source: RadarMarket[]) =>
    source.map(market => ({
      kind: 'market' as const,
      id: market.id,
      label: market.label,
      changePct: market.changePct,
    }))
  const macroStrip = (series: RadarMacro[]) =>
    series.map(item => ({
      kind: 'macro' as const,
      id: item.id,
      label: item.label,
      display: item.displayValue,
    }))

  if (filter === 'macro') {
    return {
      filter,
      markets: vm.markets,
      signals: vm.signals.filter(signal => signal.relatedMacroIds.length > 0),
      strip: macroStrip(vm.macro.slice(0, MAX_STRIP_MARKETS)),
      dimMarkets: true,
    }
  }

  if (filter === 'markets' || filter === 'crypto') {
    const markets = vm.markets.filter(market => market.category === filter)
    const ids = new Set(markets.map(market => market.id))
    return {
      filter,
      markets,
      signals: vm.signals.filter(signal => signal.relatedMarketIds.some(id => ids.has(id))),
      strip: marketStrip(stripMarkets.filter(market => ids.has(market.id))),
      dimMarkets: false,
    }
  }

  const firstRate = vm.macro.find(series => series.id === 'FEDFUNDS') ?? vm.macro[0]
  return {
    filter: 'all',
    markets: vm.markets,
    signals: vm.signals,
    strip: [...marketStrip(stripMarkets), ...(firstRate ? macroStrip([firstRate]) : [])],
    dimMarkets: false,
  }
}

/** Importance 0 to 3 per market, from the signals and attention events pointing at it. */
export const computeMarketImportance = (vm: RadarViewModel): Map<string, number> => {
  const importance = new Map<string, number>()
  const raise = (id: string, weight: number) => {
    importance.set(id, Math.max(importance.get(id) ?? 0, weight))
  }
  for (const signal of vm.signals) {
    for (const id of signal.relatedMarketIds) raise(id, SEVERITY_WEIGHT[signal.severity])
  }
  for (const event of vm.events) {
    if (!event.requiresAttention) continue
    for (const id of event.relatedMarketIds) raise(id, 2)
  }
  return importance
}

export const toneForChange = (changePct: number | null): RadarTone =>
  changePct === null || Math.abs(changePct) < 0.05
    ? 'neutral'
    : changePct > 0
      ? 'positive'
      : 'negative'

const isRadarFilter = (value: unknown): value is RadarFilter =>
  typeof value === 'string' && (RADAR_FILTERS as ReadonlyArray<string>).includes(value)

const FOCUS_PATTERN = /^(signal|market|event):([A-Za-z0-9_./:-]{1,80})$/

export const parseRadarFocus = (raw: unknown): RadarFocus | null => {
  if (typeof raw !== 'string') return null
  const match = FOCUS_PATTERN.exec(raw)
  if (!match?.[1] || !match[2]) return null
  return { kind: match[1] as RadarFocus['kind'], id: match[2] }
}

export const serializeRadarFocus = (focus: RadarFocus): string => `${focus.kind}:${focus.id}`

/** Lenient route search validation: unknown or invalid values are dropped. */
export const parseRadarSearch = (raw: Record<string, unknown>): RadarSearch => {
  const search: RadarSearch = {}
  const focus = parseRadarFocus(raw.focus)
  if (focus) search.focus = serializeRadarFocus(focus)
  if (isRadarFilter(raw.filter) && raw.filter !== 'all') search.filter = raw.filter
  return search
}

export const resolveRadarFilter = (
  requested: RadarFilter | undefined,
  available: RadarFilter[]
): RadarFilter => (requested && available.includes(requested) ? requested : 'all')

export type ResolvedRadarFocus =
  | { kind: 'signal'; signal: RadarSignal }
  | { kind: 'market'; market: RadarMarket }
  | { kind: 'event'; event: RadarEvent }

export const resolveRadarFocus = (
  vm: RadarViewModel,
  raw: string | undefined
): ResolvedRadarFocus | null => {
  const focus = parseRadarFocus(raw)
  if (!focus) return null
  if (focus.kind === 'signal') {
    const signal = vm.signals.find(item => item.id === focus.id)
    return signal ? { kind: 'signal', signal } : null
  }
  if (focus.kind === 'market') {
    const market = vm.markets.find(item => item.id === focus.id)
    return market ? { kind: 'market', market } : null
  }
  const event = vm.events.find(item => item.id === focus.id)
  return event ? { kind: 'event', event } : null
}

/** Market ids to emphasize in the field for the current focus. */
export const focusedMarketIds = (focus: ResolvedRadarFocus | null): ReadonlySet<string> => {
  if (!focus) return new Set()
  if (focus.kind === 'market') return new Set([focus.market.id])
  if (focus.kind === 'signal') return new Set(focus.signal.relatedMarketIds)
  return new Set(focus.event.relatedMarketIds)
}

export const focusedMacroIds = (focus: ResolvedRadarFocus | null): ReadonlySet<string> =>
  focus?.kind === 'signal' ? new Set(focus.signal.relatedMacroIds) : new Set()

/** Signals that point at a market, most important first. */
export const signalsForMarket = (vm: RadarViewModel, marketId: string): RadarSignal[] =>
  vm.signals.filter(signal => signal.relatedMarketIds.includes(marketId))

const DAY_MONTH = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
const CLOCK = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })

const toDate = (iso: string | null | undefined): Date | null => {
  if (!iso) return null
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

const isSameDay = (left: Date, right: Date): boolean =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate()

/** "13 août 14:30" for a dated event. Invalid input renders nothing. */
export const formatEventMoment = (iso: string, now: Date = new Date()): string | null => {
  const date = toDate(iso)
  if (!date) return null
  return isSameDay(date, now)
    ? CLOCK.format(date)
    : `${DAY_MONTH.format(date)} ${CLOCK.format(date)}`
}

/** "16:10" when the timestamp is today, "10 avr." otherwise. */
export const formatUpdateMoment = (iso: string | null, now: Date = new Date()): string | null => {
  const date = toDate(iso)
  if (!date) return null
  return isSameDay(date, now) ? CLOCK.format(date) : DAY_MONTH.format(date)
}

/** "1 mars" for axis and marker labels. */
export const formatDayMonth = (time: number): string => DAY_MONTH.format(new Date(time))
