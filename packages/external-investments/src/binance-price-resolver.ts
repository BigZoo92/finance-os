/**
 * Resolve a Binance crypto asset balance into a target-currency value (default
 * EUR), using only public Binance ticker endpoints. No order side effect, no
 * signed request — strictly market data.
 *
 * Resolution order (first hit wins):
 *   1. Direct asset-target pair (e.g. BTC + EUR target → BTCEUR)
 *   2. Stablecoin bridge (BTCUSDT, BTCUSDC, BTCBUSD…) + FX bridge usd→target
 *
 * The resolver returns a structured outcome with `source`, `providerSymbol`,
 * `confidence`, `asOf` and `degradedReason` so callers can persist provenance
 * alongside the numeric value.
 *
 * Integration: the worker external-investments sync stage should call
 * `resolveBinanceAssetValue` for each crypto position where
 * `normalizedValue === null` AND the asset is in `RESOLVABLE_CRYPTO_ASSETS`
 * (or just non-stable), then write back the result.
 */

export type BinanceTickerPriceFetcher = (params: { symbol: string }) => Promise<{
  symbol: string
  price: string
}>

export type FxRateFetcher = (params: { from: string; to: string }) => Promise<{
  rate: number
  asOf: string
} | null>

export type BinancePriceResolution = {
  value: number
  valueCurrency: string
  providerSymbol: string
  source: 'binance_direct' | 'binance_via_stable'
  bridge: { stable: string; fxRate: number; fxAsOf: string } | null
  asOf: string
  confidence: 'high' | 'medium' | 'low'
  degradedReason: null
}

export type BinancePriceFailure = {
  value: null
  valueCurrency: string
  providerSymbol: null
  source: null
  bridge: null
  asOf: string
  confidence: 'none'
  degradedReason:
    | 'NO_DIRECT_PAIR'
    | 'NO_STABLE_PAIR'
    | 'FX_RATE_UNAVAILABLE'
    | 'INVALID_QUANTITY'
    | 'TICKER_FETCH_FAILED'
}

export type BinancePriceOutcome = BinancePriceResolution | BinancePriceFailure

const STABLECOIN_BRIDGES = ['USDT', 'USDC', 'BUSD', 'FDUSD'] as const
const STABLE_TO_FX_BASE: Record<string, string> = {
  USDT: 'USD',
  USDC: 'USD',
  BUSD: 'USD',
  FDUSD: 'USD',
}

const tryPrice = async (
  fetcher: BinanceTickerPriceFetcher,
  symbol: string
): Promise<number | null> => {
  try {
    const result = await fetcher({ symbol })
    const parsed = Number(result.price)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  } catch {
    return null
  }
}

export const resolveBinanceAssetValue = async ({
  asset,
  quantity,
  targetCurrency,
  now,
  tickerFetcher,
  fxFetcher,
}: {
  asset: string
  quantity: string | number
  targetCurrency: string
  now: () => string
  tickerFetcher: BinanceTickerPriceFetcher
  fxFetcher: FxRateFetcher
}): Promise<BinancePriceOutcome> => {
  const normalizedAsset = asset.trim().toUpperCase()
  const normalizedTarget = targetCurrency.trim().toUpperCase()
  const quantityNumber = Number(quantity)
  if (!Number.isFinite(quantityNumber) || quantityNumber <= 0) {
    return {
      value: null,
      valueCurrency: normalizedTarget,
      providerSymbol: null,
      source: null,
      bridge: null,
      asOf: now(),
      confidence: 'none',
      degradedReason: 'INVALID_QUANTITY',
    }
  }

  // 1. Try direct asset/target pair, e.g. BTCEUR
  const directSymbol = `${normalizedAsset}${normalizedTarget}`
  if (normalizedAsset !== normalizedTarget) {
    const directPrice = await tryPrice(tickerFetcher, directSymbol)
    if (directPrice !== null) {
      return {
        value: roundCurrency(quantityNumber * directPrice),
        valueCurrency: normalizedTarget,
        providerSymbol: directSymbol,
        source: 'binance_direct',
        bridge: null,
        asOf: now(),
        confidence: 'high',
        degradedReason: null,
      }
    }
  }

  // 2. Try stablecoin bridge + FX conversion
  for (const stable of STABLECOIN_BRIDGES) {
    if (stable === normalizedAsset) continue
    const stableSymbol = `${normalizedAsset}${stable}`
    const stablePrice = await tryPrice(tickerFetcher, stableSymbol)
    if (stablePrice === null) continue
    const fxBase = STABLE_TO_FX_BASE[stable] ?? stable
    if (fxBase === normalizedTarget) {
      // Stable pegs 1:1 to target (e.g. USDT→USD)
      return {
        value: roundCurrency(quantityNumber * stablePrice),
        valueCurrency: normalizedTarget,
        providerSymbol: stableSymbol,
        source: 'binance_via_stable',
        bridge: { stable, fxRate: 1, fxAsOf: now() },
        asOf: now(),
        confidence: 'high',
        degradedReason: null,
      }
    }
    const fx = await fxFetcher({ from: fxBase, to: normalizedTarget })
    if (fx === null) {
      return {
        value: null,
        valueCurrency: normalizedTarget,
        providerSymbol: null,
        source: null,
        bridge: null,
        asOf: now(),
        confidence: 'none',
        degradedReason: 'FX_RATE_UNAVAILABLE',
      }
    }
    return {
      value: roundCurrency(quantityNumber * stablePrice * fx.rate),
      valueCurrency: normalizedTarget,
      providerSymbol: stableSymbol,
      source: 'binance_via_stable',
      bridge: { stable, fxRate: fx.rate, fxAsOf: fx.asOf },
      asOf: now(),
      confidence: 'medium',
      degradedReason: null,
    }
  }

  // 3. No pair at all
  return {
    value: null,
    valueCurrency: normalizedTarget,
    providerSymbol: null,
    source: null,
    bridge: null,
    asOf: now(),
    confidence: 'none',
    degradedReason: normalizedAsset === normalizedTarget ? 'NO_DIRECT_PAIR' : 'NO_STABLE_PAIR',
  }
}

const roundCurrency = (value: number) => Math.round(value * 100) / 100
