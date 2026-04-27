/**
 * Trading Lab market data adapter.
 *
 * Resolves OHLCV bars for a backtest by walking a priority chain of sources:
 *   1. caller-provided OHLCV payload (full transparency)
 *   2. cached bars in `market_ohlcv_bar` (provider+symbol+interval+date PK)
 *   3. live provider fetch (EODHD or TwelveData) — admin paths only
 *   4. deterministic fixture fallback (clearly labeled)
 *
 * Rules / invariants:
 * - never logs provider tokens or API keys
 * - provider calls only run from admin mutations (never from GET routes)
 * - failures are fail-soft: any error escalates to the next priority
 * - `dataSourcePreference` lets the caller pin a specific source
 *   ("auto" walks the full chain).
 */
import { and, eq, sql } from 'drizzle-orm'
import { schema } from '@finance-os/db'
import type { ApiDb } from '../types'
import { fetchProviderJson } from './market-provider-http'
import { generateDeterministicOhlcv, type OhlcvBar } from './trading-lab-ohlcv-fixtures'

export type DataSourcePreference =
  | 'auto'
  | 'cached'
  | 'provider'
  | 'caller_provided'
  | 'deterministic_fixture'

export type MarketProviderId = 'eodhd' | 'twelvedata' | 'fixture' | 'cache' | 'caller'

export type ResolvedMarketData = {
  ok: true
  bars: OhlcvBar[]
  resolvedMarketDataSource:
    | 'caller_provided'
    | 'cached'
    | 'provider_eodhd'
    | 'provider_twelvedata'
    | 'deterministic_fixture'
  dataProvider: MarketProviderId
  dataQuality: 'real' | 'real-cached' | 'real-overlay' | 'synthetic'
  dataWarnings: string[]
  barsCount: number
  firstBarDate: string | null
  lastBarDate: string | null
  fallbackUsed: boolean
  fallbackReason: string | null
}

export type ResolveError = {
  ok: false
  code: 'DATA_UNAVAILABLE' | 'PROVIDER_UNCONFIGURED'
  message: string
  attempted: Array<{ source: string; reason: string }>
}

export type ResolveInput = {
  symbol: string
  exchange?: string
  interval?: string
  startDate: Date
  endDate: Date
  dataSourcePreference?: DataSourcePreference
  preferredProvider?: 'eodhd' | 'twelvedata' | 'auto'
  callerData?: Array<Record<string, unknown>> | null
  requestId: string
}

export type ResolveDeps = {
  db: ApiDb
  eodhdApiKey: string | undefined
  twelveDataApiKey: string | undefined
  marketDataEodhdEnabled: boolean
  marketDataTwelveDataEnabled: boolean
  /** Force fixture even if other sources are configured. */
  forceFixtureFallback: boolean
  /** Enable persisted cache lookup. Defaults to true. */
  cacheEnabled?: boolean
  /** Maximum bars to return (safety cap). */
  maxBars?: number
}

const DEFAULT_MAX_BARS = 5000
const ISO_DATE_LEN = 10

const formatDateOnly = (value: Date): string => value.toISOString().slice(0, ISO_DATE_LEN)

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

const normalizeCallerBar = (raw: Record<string, unknown>): OhlcvBar | null => {
  const date =
    typeof raw.date === 'string'
      ? raw.date.slice(0, ISO_DATE_LEN)
      : raw.date instanceof Date
        ? raw.date.toISOString().slice(0, ISO_DATE_LEN)
        : null
  const open = toFiniteNumber(raw.open)
  const high = toFiniteNumber(raw.high)
  const low = toFiniteNumber(raw.low)
  const close = toFiniteNumber(raw.close)
  const volume = toFiniteNumber(raw.volume) ?? 0

  if (!date || open === null || high === null || low === null || close === null) {
    return null
  }
  if (high < Math.max(open, close) || low > Math.min(open, close)) {
    return null
  }
  return { date, open, high, low, close, volume }
}

const dedupeAndSort = (bars: OhlcvBar[]): OhlcvBar[] => {
  const map = new Map<string, OhlcvBar>()
  for (const bar of bars) {
    map.set(bar.date, bar)
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
}

const filterRange = (bars: OhlcvBar[], startDate: Date, endDate: Date): OhlcvBar[] => {
  const startIso = formatDateOnly(startDate)
  const endIso = formatDateOnly(endDate)
  return bars.filter(bar => bar.date >= startIso && bar.date <= endIso)
}

// ---------------------------------------------------------------------------
// Cache: read & write `market_ohlcv_bar`
// ---------------------------------------------------------------------------

const readCachedBars = async ({
  db,
  provider,
  symbol,
  interval,
  startDate,
  endDate,
}: {
  db: ApiDb
  provider: string
  symbol: string
  interval: string
  startDate: Date
  endDate: Date
}): Promise<OhlcvBar[]> => {
  const startIso = formatDateOnly(startDate)
  const endIso = formatDateOnly(endDate)
  const rows = await db
    .select({
      barDate: schema.marketOhlcvBar.barDate,
      open: schema.marketOhlcvBar.open,
      high: schema.marketOhlcvBar.high,
      low: schema.marketOhlcvBar.low,
      close: schema.marketOhlcvBar.close,
      volume: schema.marketOhlcvBar.volume,
    })
    .from(schema.marketOhlcvBar)
    .where(
      and(
        eq(schema.marketOhlcvBar.provider, provider),
        eq(schema.marketOhlcvBar.symbol, symbol),
        eq(schema.marketOhlcvBar.interval, interval),
        sql`${schema.marketOhlcvBar.barDate} >= ${startIso}`,
        sql`${schema.marketOhlcvBar.barDate} <= ${endIso}`
      )
    )
    .orderBy(schema.marketOhlcvBar.barDate)

  return rows
    .map(row => {
      const open = toFiniteNumber(row.open)
      const high = toFiniteNumber(row.high)
      const low = toFiniteNumber(row.low)
      const close = toFiniteNumber(row.close)
      if (open === null || high === null || low === null || close === null) {
        return null
      }
      return {
        date: row.barDate,
        open,
        high,
        low,
        close,
        volume: toFiniteNumber(row.volume) ?? 0,
      } satisfies OhlcvBar
    })
    .filter((bar): bar is OhlcvBar => bar !== null)
}

export const persistOhlcvBars = async ({
  db,
  provider,
  symbol,
  interval,
  bars,
  exchange,
  currency,
  sourceRef,
}: {
  db: ApiDb
  provider: string
  symbol: string
  interval: string
  bars: OhlcvBar[]
  exchange?: string | null
  currency?: string | null
  sourceRef?: string | null
}): Promise<void> => {
  if (bars.length === 0) {
    return
  }

  const now = new Date()
  const rows = bars.map(bar => ({
    provider,
    symbol,
    interval,
    barDate: bar.date,
    open: String(bar.open),
    high: String(bar.high),
    low: String(bar.low),
    close: String(bar.close),
    volume: String(bar.volume ?? 0),
    fetchedAt: now,
    ...(exchange ? { exchange } : {}),
    ...(currency ? { currency } : {}),
    ...(sourceRef ? { sourceRef } : {}),
  }))

  await db
    .insert(schema.marketOhlcvBar)
    .values(rows)
    .onConflictDoUpdate({
      target: [
        schema.marketOhlcvBar.provider,
        schema.marketOhlcvBar.symbol,
        schema.marketOhlcvBar.interval,
        schema.marketOhlcvBar.barDate,
      ],
      set: {
        open: sql`excluded.open`,
        high: sql`excluded.high`,
        low: sql`excluded.low`,
        close: sql`excluded.close`,
        volume: sql`excluded.volume`,
        fetchedAt: now,
        updatedAt: now,
      },
    })
}

// ---------------------------------------------------------------------------
// Provider fetchers (admin-only paths)
// ---------------------------------------------------------------------------

type EodhdEodRow = {
  date?: string
  open?: number | string
  high?: number | string
  low?: number | string
  close?: number | string
  adjusted_close?: number | string
  volume?: number | string
}

const fetchEodhdOhlcv = async ({
  symbol,
  apiKey,
  startDate,
  endDate,
  requestId,
}: {
  symbol: string
  apiKey: string
  startDate: Date
  endDate: Date
  requestId: string
}): Promise<OhlcvBar[]> => {
  const url = new URL(`https://eodhd.com/api/eod/${encodeURIComponent(symbol)}`)
  url.searchParams.set('api_token', apiKey)
  url.searchParams.set('fmt', 'json')
  url.searchParams.set('from', formatDateOnly(startDate))
  url.searchParams.set('to', formatDateOnly(endDate))

  const rows = await fetchProviderJson<EodhdEodRow[]>({
    url: url.toString(),
    requestId,
  })
  return rows
    .map(row => {
      if (!row.date) return null
      const open = toFiniteNumber(row.open)
      const high = toFiniteNumber(row.high)
      const low = toFiniteNumber(row.low)
      const close = toFiniteNumber(row.adjusted_close ?? row.close)
      const volume = toFiniteNumber(row.volume) ?? 0
      if (open === null || high === null || low === null || close === null) {
        return null
      }
      return {
        date: row.date.slice(0, ISO_DATE_LEN),
        open,
        high,
        low,
        close,
        volume,
      } satisfies OhlcvBar
    })
    .filter((bar): bar is OhlcvBar => bar !== null)
}

type TwelveDataTimeSeriesResponse = {
  status?: string
  message?: string
  values?: Array<{
    datetime?: string
    open?: string
    high?: string
    low?: string
    close?: string
    volume?: string
  }>
}

const fetchTwelveDataOhlcv = async ({
  symbol,
  interval,
  apiKey,
  startDate,
  endDate,
  requestId,
}: {
  symbol: string
  interval: string
  apiKey: string
  startDate: Date
  endDate: Date
  requestId: string
}): Promise<OhlcvBar[]> => {
  const url = new URL('https://api.twelvedata.com/time_series')
  url.searchParams.set('symbol', symbol)
  url.searchParams.set('interval', interval === '1d' ? '1day' : interval)
  url.searchParams.set('start_date', formatDateOnly(startDate))
  url.searchParams.set('end_date', formatDateOnly(endDate))
  url.searchParams.set('format', 'JSON')
  url.searchParams.set('apikey', apiKey)
  url.searchParams.set('outputsize', '5000')

  const response = await fetchProviderJson<TwelveDataTimeSeriesResponse>({
    url: url.toString(),
    requestId,
  })

  if (response.status === 'error') {
    throw Object.assign(new Error('TWELVE_DATA_ERROR'), {
      code: 'TWELVE_DATA_ERROR',
      safeMessage: response.message ?? 'Twelve Data returned an error.',
    })
  }

  const values = response.values ?? []
  return values
    .map(row => {
      if (!row.datetime) return null
      const open = toFiniteNumber(row.open)
      const high = toFiniteNumber(row.high)
      const low = toFiniteNumber(row.low)
      const close = toFiniteNumber(row.close)
      const volume = toFiniteNumber(row.volume) ?? 0
      if (open === null || high === null || low === null || close === null) {
        return null
      }
      return {
        date: row.datetime.slice(0, ISO_DATE_LEN),
        open,
        high,
        low,
        close,
        volume,
      } satisfies OhlcvBar
    })
    .filter((bar): bar is OhlcvBar => bar !== null)
    .reverse() // TwelveData ships descending; we want ascending
}

// ---------------------------------------------------------------------------
// Resolver: orchestrates the priority chain
// ---------------------------------------------------------------------------

const buildFixture = (input: ResolveInput, maxBars: number) =>
  generateDeterministicOhlcv({
    symbol: input.symbol,
    startDate: input.startDate,
    endDate: input.endDate,
    maxBars,
  })

const tryCallerProvided = (
  input: ResolveInput
): { bars: OhlcvBar[]; warnings: string[]; reason?: string } | null => {
  if (!input.callerData || input.callerData.length === 0) {
    return null
  }
  const warnings: string[] = []
  const normalized = input.callerData
    .map(normalizeCallerBar)
    .filter((bar): bar is OhlcvBar => bar !== null)
  const sorted = dedupeAndSort(normalized)
  const inRange = filterRange(sorted, input.startDate, input.endDate)
  if (inRange.length < normalized.length) {
    warnings.push(`${normalized.length - inRange.length} caller bars dropped (out of range)`)
  }
  if (inRange.length === 0) {
    return null
  }
  return { bars: inRange, warnings }
}

export const resolveMarketData = async ({
  input,
  deps,
}: {
  input: ResolveInput
  deps: ResolveDeps
}): Promise<ResolvedMarketData | ResolveError> => {
  const interval = input.interval ?? '1d'
  const cacheEnabled = deps.cacheEnabled ?? true
  const maxBars = deps.maxBars ?? DEFAULT_MAX_BARS
  const preference: DataSourcePreference = input.dataSourcePreference ?? 'auto'
  const attempted: Array<{ source: string; reason: string }> = []
  const warnings: string[] = []

  // 1. Caller-provided
  if (preference === 'caller_provided' || preference === 'auto') {
    const caller = tryCallerProvided(input)
    if (caller) {
      const bars = caller.bars
      return {
        ok: true,
        bars,
        resolvedMarketDataSource: 'caller_provided',
        dataProvider: 'caller',
        dataQuality: 'real',
        dataWarnings: [...caller.warnings, ...warnings],
        barsCount: bars.length,
        firstBarDate: bars[0]?.date ?? null,
        lastBarDate: bars[bars.length - 1]?.date ?? null,
        fallbackUsed: false,
        fallbackReason: null,
      }
    }
    if (preference === 'caller_provided') {
      attempted.push({ source: 'caller', reason: 'no_valid_bars' })
      return {
        ok: false,
        code: 'DATA_UNAVAILABLE',
        message: 'Caller did not provide valid OHLCV data.',
        attempted,
      }
    }
    attempted.push({ source: 'caller', reason: 'not_provided' })
  }

  // Forced fixture
  if (preference === 'deterministic_fixture' || deps.forceFixtureFallback) {
    const bars = buildFixture(input, maxBars)
    return {
      ok: true,
      bars,
      resolvedMarketDataSource: 'deterministic_fixture',
      dataProvider: 'fixture',
      dataQuality: 'synthetic',
      dataWarnings: [
        'Synthetic deterministic OHLCV — not real market data.',
        ...warnings,
      ],
      barsCount: bars.length,
      firstBarDate: bars[0]?.date ?? null,
      lastBarDate: bars[bars.length - 1]?.date ?? null,
      fallbackUsed: deps.forceFixtureFallback && preference !== 'deterministic_fixture',
      fallbackReason: deps.forceFixtureFallback
        ? 'MARKET_DATA_FORCE_FIXTURE_FALLBACK'
        : null,
    }
  }

  // Decide on provider order
  const providerOrder: Array<'eodhd' | 'twelvedata'> = []
  if (input.preferredProvider === 'eodhd') providerOrder.push('eodhd')
  if (input.preferredProvider === 'twelvedata') providerOrder.push('twelvedata')
  if (input.preferredProvider === 'auto' || !input.preferredProvider) {
    providerOrder.push('eodhd', 'twelvedata')
  }
  // Filter to enabled+keyed providers
  const enabledProviders = providerOrder.filter(p => {
    if (p === 'eodhd') return deps.marketDataEodhdEnabled && Boolean(deps.eodhdApiKey)
    if (p === 'twelvedata') return deps.marketDataTwelveDataEnabled && Boolean(deps.twelveDataApiKey)
    return false
  })

  // 2. Cache lookup
  if (cacheEnabled && (preference === 'cached' || preference === 'auto')) {
    for (const provider of enabledProviders.length > 0 ? enabledProviders : providerOrder) {
      try {
        const cached = await readCachedBars({
          db: deps.db,
          provider,
          symbol: input.symbol,
          interval,
          startDate: input.startDate,
          endDate: input.endDate,
        })
        if (cached.length >= 5) {
          return {
            ok: true,
            bars: cached,
            resolvedMarketDataSource: 'cached',
            dataProvider: provider,
            dataQuality: 'real-cached',
            dataWarnings: [
              `Cached OHLCV from ${provider} — provider may have updated since fetch.`,
              ...warnings,
            ],
            barsCount: cached.length,
            firstBarDate: cached[0]?.date ?? null,
            lastBarDate: cached[cached.length - 1]?.date ?? null,
            fallbackUsed: false,
            fallbackReason: null,
          }
        }
        attempted.push({ source: `cache:${provider}`, reason: `only_${cached.length}_bars` })
      } catch (error) {
        attempted.push({
          source: `cache:${provider}`,
          reason: error instanceof Error ? error.message.slice(0, 80) : 'cache_error',
        })
      }
    }
    if (preference === 'cached') {
      return {
        ok: false,
        code: 'DATA_UNAVAILABLE',
        message: 'No cached OHLCV bars found for this symbol/range.',
        attempted,
      }
    }
  }

  // 3. Live provider fetch
  if (preference === 'provider' || preference === 'auto') {
    if (enabledProviders.length === 0 && preference === 'provider') {
      return {
        ok: false,
        code: 'PROVIDER_UNCONFIGURED',
        message:
          'No market data provider is enabled or configured. Configure EODHD_API_KEY or TWELVEDATA_API_KEY.',
        attempted,
      }
    }
    for (const provider of enabledProviders) {
      try {
        const bars =
          provider === 'eodhd'
            ? await fetchEodhdOhlcv({
                symbol: input.symbol,
                apiKey: deps.eodhdApiKey ?? '',
                startDate: input.startDate,
                endDate: input.endDate,
                requestId: input.requestId,
              })
            : await fetchTwelveDataOhlcv({
                symbol: input.symbol,
                interval,
                apiKey: deps.twelveDataApiKey ?? '',
                startDate: input.startDate,
                endDate: input.endDate,
                requestId: input.requestId,
              })
        const sortedBars = dedupeAndSort(bars).slice(0, maxBars)
        if (sortedBars.length < 5) {
          attempted.push({
            source: `provider:${provider}`,
            reason: `only_${sortedBars.length}_bars`,
          })
          continue
        }
        // Persist to cache (fail-soft)
        try {
          await persistOhlcvBars({
            db: deps.db,
            provider,
            symbol: input.symbol,
            interval,
            bars: sortedBars,
            ...(input.exchange ? { exchange: input.exchange } : {}),
            sourceRef: 'trading-lab-backtest',
          })
        } catch {
          /* fail-soft */
        }
        return {
          ok: true,
          bars: sortedBars,
          resolvedMarketDataSource:
            provider === 'eodhd' ? 'provider_eodhd' : 'provider_twelvedata',
          dataProvider: provider,
          dataQuality: 'real',
          dataWarnings: warnings,
          barsCount: sortedBars.length,
          firstBarDate: sortedBars[0]?.date ?? null,
          lastBarDate: sortedBars[sortedBars.length - 1]?.date ?? null,
          fallbackUsed: false,
          fallbackReason: null,
        }
      } catch (error) {
        attempted.push({
          source: `provider:${provider}`,
          reason: error instanceof Error ? error.message.slice(0, 80) : 'provider_error',
        })
      }
    }
  }

  // 4. Fixture fallback (auto only — not when caller asked for provider/cached)
  if (preference === 'auto') {
    const bars = buildFixture(input, maxBars)
    return {
      ok: true,
      bars,
      resolvedMarketDataSource: 'deterministic_fixture',
      dataProvider: 'fixture',
      dataQuality: 'synthetic',
      dataWarnings: [
        'Synthetic deterministic OHLCV used as fallback — not real market data.',
        ...warnings,
      ],
      barsCount: bars.length,
      firstBarDate: bars[0]?.date ?? null,
      lastBarDate: bars[bars.length - 1]?.date ?? null,
      fallbackUsed: true,
      fallbackReason:
        attempted.length > 0
          ? `provider_fallback:${attempted.map(a => a.source).join(',').slice(0, 100)}`
          : 'no_provider_configured',
    }
  }

  return {
    ok: false,
    code: 'DATA_UNAVAILABLE',
    message: 'No OHLCV data could be resolved for this request.',
    attempted,
  }
}
