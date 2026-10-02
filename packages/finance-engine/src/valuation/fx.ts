import type { FxConversion, FxRateInput } from './types'

const round12 = (value: number) => Math.round(value * 1e12) / 1e12

export interface FxConverter {
  baseCurrency: string
  /** Convert an amount expressed in `currency` into the base currency. Null when no usable rate exists. */
  toBase: (amount: number, currency: string) => FxConversion | null
  /** True when a rate (fresh or stale) exists for the currency. */
  hasRate: (currency: string) => boolean
  /** Currencies with a stale (but still used) rate. */
  staleCurrencies: () => string[]
}

/**
 * Builds a converter over base-quoted FX rates (ECB convention:
 * `rate` = quote units per 1 base unit, base = EUR).
 *
 * - identical currency converts with rate 1 and no provenance;
 * - a stale rate is still used but flagged `isStale` (caller downgrades the
 *   valuation status, never fabricates a value);
 * - a missing rate returns `null` — never 0.
 */
export const createFxConverter = ({
  baseCurrency,
  rates,
  now,
}: {
  baseCurrency: string
  rates: FxRateInput[]
  now: Date
}): FxConverter => {
  const normalizedBase = baseCurrency.toUpperCase()
  const byQuote = new Map<string, FxRateInput>()

  for (const rate of rates) {
    if (rate.baseCurrency.toUpperCase() !== normalizedBase) {
      continue
    }
    if (!Number.isFinite(rate.rate) || rate.rate <= 0) {
      continue
    }
    const quote = rate.quoteCurrency.toUpperCase()
    const existing = byQuote.get(quote)
    if (
      !existing ||
      new Date(rate.rateTimestamp).getTime() > new Date(existing.rateTimestamp).getTime()
    ) {
      byQuote.set(quote, rate)
    }
  }

  const isRateStale = (rate: FxRateInput) => {
    const rateMs = new Date(rate.rateTimestamp).getTime()
    if (!Number.isFinite(rateMs)) {
      return true
    }
    return now.getTime() - rateMs > rate.staleAfterSeconds * 1000
  }

  return {
    baseCurrency: normalizedBase,
    toBase: (amount, currency) => {
      if (!Number.isFinite(amount)) {
        return null
      }
      const quote = currency.toUpperCase()
      if (quote === normalizedBase) {
        return {
          value: amount,
          rate: 1,
          provider: null,
          rateTimestamp: null,
          isStale: false,
        }
      }

      const rate = byQuote.get(quote)
      if (!rate) {
        return null
      }

      const converted = amount / rate.rate
      if (!Number.isFinite(converted)) {
        return null
      }

      return {
        value: converted,
        rate: round12(1 / rate.rate),
        provider: rate.provider,
        rateTimestamp: rate.rateTimestamp,
        isStale: isRateStale(rate),
      }
    },
    hasRate: currency => {
      const quote = currency.toUpperCase()
      return quote === normalizedBase || byQuote.has(quote)
    },
    staleCurrencies: () =>
      [...byQuote.values()]
        .filter(rate => isRateStale(rate))
        .map(rate => rate.quoteCurrency.toUpperCase()),
  }
}
