/**
 * Generic equity / ETF valuation enrichment. Given a normalized snapshot whose
 * positions may lack a `normalizedValue` (or carry a stale one), looks up
 * `market_quote_snapshot` rows by symbol / ISIN / provider symbol and updates
 * the position with the market-cache quote.
 *
 * This is intentionally provider-agnostic: it works for IBKR, manual assets,
 * and any future broker. It does NOT call live market data — it only consumes
 * the in-DB snapshot, which the market-data refresh worker writes separately.
 *
 * Failure modes are surfaced explicitly per-position:
 *   - MARKET_QUOTE_MISSING   — no row found via any join key
 *   - SYMBOL_MAPPING_MISSING — position has no usable lookup key
 *   - STALE_QUOTE            — quote exists but is older than `staleAfterMinutes`
 *
 * The caller picks the lookup function: an HTTP-free in-memory map for tests,
 * a Drizzle-backed repository in production.
 */

import type {
  ExternalInvestmentCanonicalPosition,
  ExternalInvestmentNormalizedSnapshot,
} from './types'

export type MarketQuoteRow = {
  symbol: string
  providerSymbol: string | null
  isin: string | null
  price: string
  currency: string
  quoteAsOf: string | null
  sourceProvider: string
  isDelayed: boolean
  marketState: string
  freshnessMinutes: number | null
}

export type MarketQuoteLookup = (keys: {
  symbol: string | null
  isin: string | null
  conid: string | null
}) => Promise<MarketQuoteRow | null>

export type MarketQuotedValuationResult = {
  snapshot: ExternalInvestmentNormalizedSnapshot
  enrichedCount: number
  staleCount: number
  missingCount: number
}

const QUOTEABLE_ASSET_CLASSES = new Set(['equity', 'etf', 'fund', 'bond', 'commodity'])

const isPositionAlreadyValued = (position: ExternalInvestmentCanonicalPosition) =>
  position.normalizedValue !== null && position.normalizedValue !== ''

const quoteIsStale = (quoteAsOf: string | null, generatedAt: string, staleAfterMinutes: number) => {
  if (!quoteAsOf) return true
  const quotedMs = Date.parse(quoteAsOf)
  const generatedMs = Date.parse(generatedAt)
  if (Number.isNaN(quotedMs) || Number.isNaN(generatedMs)) return true
  return generatedMs - quotedMs > staleAfterMinutes * 60 * 1000
}

const extractIsin = (position: ExternalInvestmentCanonicalPosition): string | null => {
  const meta = position.metadata
  if (meta && typeof meta === 'object' && 'isin' in meta) {
    const isin = (meta as Record<string, unknown>).isin
    if (typeof isin === 'string' && isin.length > 0) return isin
  }
  return null
}

const extractConid = (position: ExternalInvestmentCanonicalPosition): string | null => {
  const meta = position.metadata
  if (meta && typeof meta === 'object' && 'conid' in meta) {
    const conid = (meta as Record<string, unknown>).conid
    if (typeof conid === 'string' && conid.length > 0) return conid
  }
  return null
}

const computeValue = (quantity: string | null, price: string): string | null => {
  if (!quantity) return null
  const q = Number(quantity)
  const p = Number(price)
  if (!Number.isFinite(q) || !Number.isFinite(p) || q <= 0 || p <= 0) return null
  return (Math.round(q * p * 100) / 100).toString()
}

export const enrichMarketQuotedValuations = async ({
  snapshot,
  lookup,
  staleAfterMinutes,
}: {
  snapshot: ExternalInvestmentNormalizedSnapshot
  lookup: MarketQuoteLookup
  staleAfterMinutes: number
}): Promise<MarketQuotedValuationResult> => {
  let enrichedCount = 0
  let staleCount = 0
  let missingCount = 0

  const nextPositions: ExternalInvestmentCanonicalPosition[] = []
  for (const position of snapshot.positions) {
    if (isPositionAlreadyValued(position)) {
      nextPositions.push(position)
      continue
    }
    if (!QUOTEABLE_ASSET_CLASSES.has(position.assetClass)) {
      nextPositions.push(position)
      continue
    }
    const symbol = position.symbol
    const isin = extractIsin(position)
    const conid = extractConid(position)
    if (!symbol && !isin && !conid) {
      missingCount += 1
      nextPositions.push({
        ...position,
        degradedReasons: Array.from(
          new Set([...position.degradedReasons, 'SYMBOL_MAPPING_MISSING'])
        ),
      })
      continue
    }
    const quote = await lookup({ symbol, isin, conid })
    if (!quote) {
      missingCount += 1
      nextPositions.push({
        ...position,
        degradedReasons: Array.from(
          new Set([...position.degradedReasons, 'MARKET_QUOTE_MISSING'])
        ),
      })
      continue
    }
    const value = computeValue(position.quantity, quote.price)
    if (!value) {
      missingCount += 1
      nextPositions.push(position)
      continue
    }
    const stale = quoteIsStale(quote.quoteAsOf, snapshot.generatedAt, staleAfterMinutes)
    if (stale) {
      staleCount += 1
    }
    enrichedCount += 1
    nextPositions.push({
      ...position,
      providerValue: value,
      normalizedValue: value,
      valueCurrency: quote.currency,
      valueSource: 'market_cache',
      valueAsOf: quote.quoteAsOf ?? snapshot.generatedAt,
      assumptions: [
        ...position.assumptions,
        `Valued via market_quote_snapshot (${quote.sourceProvider}, mode=${quote.marketState}).`,
      ],
      degradedReasons: [
        ...position.degradedReasons.filter(reason => reason !== 'VALUATION_PARTIAL'),
        ...(stale ? ['STALE_QUOTE'] : []),
      ],
    })
  }

  const positionsStillPartial = nextPositions.some(position => position.normalizedValue === null)

  return {
    snapshot: {
      ...snapshot,
      positions: nextPositions,
      degradedReasons: positionsStillPartial
        ? Array.from(new Set([...snapshot.degradedReasons, 'VALUATION_PARTIAL']))
        : snapshot.degradedReasons.filter(reason => reason !== 'VALUATION_PARTIAL'),
    },
    enrichedCount,
    staleCount,
    missingCount,
  }
}
