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
  bridge: { stable: string; fxRate: number; fxAsOf: string } | null
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
      nextPositions.push({
        ...position,
        providerValue: outcome.value.toString(),
        normalizedValue: outcome.value.toString(),
        valueCurrency: outcome.valueCurrency,
        valueSource: 'market_resolved',
        valueAsOf: outcome.asOf,
        assumptions: [
          ...position.assumptions.filter(
            entry =>
              entry !==
              'Binance Spot balances do not include EUR valuation in USER_DATA account info.'
          ),
          `Resolved via Binance ${outcome.providerSymbol} (${outcome.source}).`,
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

/**
 * Build an FX fetcher that uses the Binance EURUSDT spot ticker to derive
 * USDT/USDC → EUR rates without depending on a paid FX provider. Falls back to
 * the supplied static rate (e.g. `env.AI_USD_TO_EUR_RATE`) when Binance fails
 * to return a usable EURUSDT price.
 */
export const createBinanceUsdEurFxFetcher = ({
  tickerFetcher,
  now,
  fallbackUsdEurRate,
}: {
  tickerFetcher: BinanceTickerPriceFetcher
  now: () => string
  fallbackUsdEurRate: number | null
}): FxRateFetcher => {
  let cached: { rate: number; asOf: string } | null = null

  return async ({ from, to }) => {
    const normalizedFrom = from.trim().toUpperCase()
    const normalizedTo = to.trim().toUpperCase()

    if (normalizedFrom === normalizedTo) {
      return { rate: 1, asOf: now() }
    }

    if (normalizedFrom !== 'USD' || normalizedTo !== 'EUR') {
      return null
    }

    if (cached) {
      return cached
    }

    try {
      const eurUsdt = await tickerFetcher({ symbol: 'EURUSDT' })
      const eurUsdtPrice = Number(eurUsdt.price)
      if (Number.isFinite(eurUsdtPrice) && eurUsdtPrice > 0) {
        cached = { rate: 1 / eurUsdtPrice, asOf: now() }
        return cached
      }
    } catch {
      // Fall through to fallback rate
    }

    if (fallbackUsdEurRate !== null && fallbackUsdEurRate > 0) {
      cached = { rate: fallbackUsdEurRate, asOf: now() }
      return cached
    }

    return null
  }
}
