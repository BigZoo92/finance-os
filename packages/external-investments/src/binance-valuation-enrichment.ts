/**
 * Post-normalization enrichment that resolves Binance crypto position values
 * via the public Binance ticker endpoints. Pure orchestration: it walks the
 * normalized snapshot, calls `resolveBinanceAssetValue` for each position
 * lacking a `normalizedValue`, and produces an updated snapshot with values,
 * provenance, and a per-position degraded reason when no pair is reachable.
 *
 * The whole-snapshot `degradedReasons` is recomputed: `VALUATION_PARTIAL` is
 * dropped once every position carries a value, and persisted snapshots for
 * each priced position are emitted for the worker to write into
 * `external_investment_valuation_snapshot`.
 */

import {
  type BinanceFxBridge,
  type BinancePriceOutcome,
  type BinanceTickerPriceFetcher,
  type FxRateFetcher,
  resolveBinanceAssetValue,
} from './binance-price-resolver'
import type {
  ExternalInvestmentCanonicalPosition,
  ExternalInvestmentNormalizedSnapshot,
} from './types'

export type BinanceValuationSnapshotEntry = {
  positionKey: string
  value: string
  currency: string
  source: 'binance_direct' | 'binance_via_stable'
  confidence: 'high' | 'medium' | 'low'
  asOf: string
  providerSymbol: string
  bridge: BinanceFxBridge | null
}

export type BinanceValuationEnrichmentResult = {
  snapshot: ExternalInvestmentNormalizedSnapshot
  valuationSnapshots: BinanceValuationSnapshotEntry[]
  enrichedCount: number
  failedCount: number
}

const CRYPTO_VALUEABLE_CLASSES = new Set(['crypto', 'stablecoin'])

const isPositionAlreadyValued = (position: ExternalInvestmentCanonicalPosition) =>
  position.normalizedValue !== null && position.normalizedValue !== ''

const hasUsableQuantity = (position: ExternalInvestmentCanonicalPosition) => {
  if (!position.quantity) return false
  const parsed = Number(position.quantity)
  return Number.isFinite(parsed) && parsed > 0
}

const positionToValuationSnapshot = (
  position: ExternalInvestmentCanonicalPosition,
  outcome: Extract<BinancePriceOutcome, { value: number }>
): BinanceValuationSnapshotEntry => ({
  positionKey: position.positionKey,
  value: outcome.value.toString(),
  currency: outcome.valueCurrency,
  source: outcome.source,
  confidence: outcome.confidence,
  asOf: outcome.asOf,
  providerSymbol: outcome.providerSymbol,
  bridge: outcome.bridge,
})

export const enrichBinanceValuations = async ({
  snapshot,
  targetCurrency,
  now,
  tickerFetcher,
  fxFetcher,
}: {
  snapshot: ExternalInvestmentNormalizedSnapshot
  targetCurrency: string
  now: () => string
  tickerFetcher: BinanceTickerPriceFetcher
  fxFetcher: FxRateFetcher
}): Promise<BinanceValuationEnrichmentResult> => {
  if (snapshot.provider !== 'binance') {
    return { snapshot, valuationSnapshots: [], enrichedCount: 0, failedCount: 0 }
  }

  const normalizedTarget = targetCurrency.trim().toUpperCase()
  const valuationSnapshots: BinanceValuationSnapshotEntry[] = []
  let enrichedCount = 0
  let failedCount = 0

  const nextPositions: ExternalInvestmentCanonicalPosition[] = []

  for (const position of snapshot.positions) {
    if (isPositionAlreadyValued(position) || !hasUsableQuantity(position)) {
      nextPositions.push(position)
      continue
    }
    if (!CRYPTO_VALUEABLE_CLASSES.has(position.assetClass)) {
      nextPositions.push(position)
      continue
    }
    const asset = position.symbol ?? position.metadata?.binanceAsset
    if (typeof asset !== 'string' || asset.length === 0) {
      nextPositions.push(position)
      continue
    }

    const outcome = await resolveBinanceAssetValue({
      asset,
      quantity: position.quantity ?? '0',
      targetCurrency: normalizedTarget,
      now,
      tickerFetcher,
      fxFetcher,
    })

    if (outcome.value !== null) {
      enrichedCount += 1
      const valuationEntry = positionToValuationSnapshot(position, outcome)
      valuationSnapshots.push(valuationEntry)
      // FX provenance is persisted with the position (assumptions +
      // valueSource marker); a stale FX bridge makes the value an estimate,
      // never a silently precise figure.
      const fxIsStale = outcome.bridge?.fxIsStale === true
      const fxProvenance = outcome.bridge
        ? ` FX ${outcome.bridge.stable}->${outcome.valueCurrency} via ${outcome.bridge.fxSource ?? 'unknown'} @ ${outcome.bridge.fxAsOf}${fxIsStale ? ' (stale)' : ''}.`
        : ''
      nextPositions.push({
        ...position,
        providerValue: outcome.value.toString(),
        normalizedValue: outcome.value.toString(),
        valueCurrency: outcome.valueCurrency,
        valueSource: fxIsStale ? 'market_resolved_estimated' : 'market_resolved',
        valueAsOf: outcome.asOf,
        assumptions: [
          ...position.assumptions.filter(
            entry =>
              entry !==
              'Binance Spot balances do not include EUR valuation in USER_DATA account info.'
          ),
          `Resolved via Binance ${outcome.providerSymbol} (${outcome.source}).${fxProvenance}`,
        ],
        degradedReasons: position.degradedReasons.filter(
          reason => reason !== 'VALUATION_PARTIAL'
        ),
      })
      continue
    }

    failedCount += 1
    nextPositions.push({
      ...position,
      degradedReasons: Array.from(
        new Set([...position.degradedReasons, `BINANCE_PRICE_${outcome.degradedReason}`])
      ),
    })
  }

  const positionsStillPartial = nextPositions.some(position => position.normalizedValue === null)

  const nextSnapshot: ExternalInvestmentNormalizedSnapshot = {
    ...snapshot,
    positions: nextPositions,
    accounts: snapshot.accounts.map(account => ({
      ...account,
      degradedReasons: positionsStillPartial
        ? Array.from(new Set([...account.degradedReasons, 'VALUATION_PARTIAL']))
        : account.degradedReasons.filter(reason => reason !== 'VALUATION_PARTIAL'),
    })),
    degradedReasons: positionsStillPartial
      ? Array.from(new Set([...snapshot.degradedReasons, 'VALUATION_PARTIAL']))
      : snapshot.degradedReasons.filter(reason => reason !== 'VALUATION_PARTIAL'),
  }

  return {
    snapshot: nextSnapshot,
    valuationSnapshots,
    enrichedCount,
    failedCount,
  }
}

export type SnapshotFxRateReader = (params: {
  baseCurrency: string
  quoteCurrency: string
}) => Promise<{
  rate: number
  rateTimestamp: string
  staleAfterSeconds: number
  provider: string
} | null>

/**
 * FX fetcher backed by the canonical `fx_rate_snapshot` rows (ECB convention:
 * base EUR, `rate` = quote units per 1 EUR). `from → EUR` therefore converts
 * with `1 / rate(EUR → from)`. The result carries provenance and an explicit
 * staleness flag — a stale rate is still returned (callers downgrade the
 * valuation to an estimate), a missing rate returns null, never a constant.
 */
export const createSnapshotFxFetcher = ({
  readLatestRate,
  now,
}: {
  readLatestRate: SnapshotFxRateReader
  now: () => string
}): FxRateFetcher => {
  return async ({ from, to }) => {
    const normalizedFrom = from.trim().toUpperCase()
    const normalizedTo = to.trim().toUpperCase()

    if (normalizedFrom === normalizedTo) {
      return { rate: 1, asOf: now(), source: 'identity', isStale: false }
    }

    // Snapshots are stored base→quote (EUR→USD); converting into the base.
    const row = await readLatestRate({
      baseCurrency: normalizedTo,
      quoteCurrency: normalizedFrom,
    })
    if (row === null || !Number.isFinite(row.rate) || row.rate <= 0) {
      return null
    }

    const rateMs = new Date(row.rateTimestamp).getTime()
    const isStale =
      !Number.isFinite(rateMs) ||
      new Date(now()).getTime() - rateMs > row.staleAfterSeconds * 1000

    return {
      rate: 1 / row.rate,
      asOf: row.rateTimestamp,
      source: `${row.provider}_snapshot`,
      isStale,
    }
  }
}

/**
 * FX fetcher for the Binance valuation chain. USD → EUR resolves first from
 * the live Binance EURUSDT spot ticker (a real market rate), then from the
 * canonical `fx_rate_snapshot` fallback when provided. Other pairs go straight
 * to the snapshot fallback. There is NO static rate: when no reliable FX
 * exists the fetcher returns null and the position stays unvalued
 * (`FX_RATE_UNAVAILABLE`) instead of receiving a fake precise value.
 */
export const createBinanceUsdEurFxFetcher = ({
  tickerFetcher,
  now,
  snapshotFxFetcher,
}: {
  tickerFetcher: BinanceTickerPriceFetcher
  now: () => string
  snapshotFxFetcher: FxRateFetcher | null
}): FxRateFetcher => {
  let cachedUsdEur: Awaited<ReturnType<FxRateFetcher>> = null

  return async ({ from, to }) => {
    const normalizedFrom = from.trim().toUpperCase()
    const normalizedTo = to.trim().toUpperCase()

    if (normalizedFrom === normalizedTo) {
      return { rate: 1, asOf: now(), source: 'identity', isStale: false }
    }

    if (normalizedFrom !== 'USD' || normalizedTo !== 'EUR') {
      return snapshotFxFetcher
        ? snapshotFxFetcher({ from: normalizedFrom, to: normalizedTo })
        : null
    }

    if (cachedUsdEur) {
      return cachedUsdEur
    }

    try {
      const eurUsdt = await tickerFetcher({ symbol: 'EURUSDT' })
      const eurUsdtPrice = Number(eurUsdt.price)
      if (Number.isFinite(eurUsdtPrice) && eurUsdtPrice > 0) {
        cachedUsdEur = {
          rate: 1 / eurUsdtPrice,
          asOf: now(),
          source: 'binance_eurusdt',
          isStale: false,
        }
        return cachedUsdEur
      }
    } catch {
      // Fall through to the canonical snapshot fallback.
    }

    if (snapshotFxFetcher) {
      const snapshotRate = await snapshotFxFetcher({ from: 'USD', to: 'EUR' })
      if (snapshotRate !== null) {
        cachedUsdEur = snapshotRate
        return cachedUsdEur
      }
    }

    return null
  }
}
