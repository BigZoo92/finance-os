/**
 * Deterministic OHLCV fixture generator for Trading Lab backtests.
 *
 * Used when:
 * - admin requests a backtest without providing OHLCV data
 * - market data is unavailable for the requested symbol
 * - demo/test scenarios need reproducible data
 *
 * NOT real market data — synthetic but deterministic for the same seed.
 */

export type OhlcvBar = {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

const stringToSeed = (s: string): number => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h >>> 0
}

const mulberry32 = (seed: number) => {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const addDays = (d: Date, n: number) => {
  const r = new Date(d)
  r.setUTCDate(r.getUTCDate() + n)
  return r
}

const isWeekend = (d: Date) => {
  const day = d.getUTCDay()
  return day === 0 || day === 6
}

/**
 * Generate deterministic synthetic daily OHLCV bars between startDate and endDate.
 * Same (symbol, startDate, endDate) inputs always produce identical output.
 */
export const generateDeterministicOhlcv = (input: {
  symbol: string
  startDate: Date
  endDate: Date
  basePrice?: number
  driftPerDay?: number
  volatility?: number
  maxBars?: number
}): OhlcvBar[] => {
  const seed = stringToSeed(`${input.symbol}|${input.startDate.toISOString().slice(0, 10)}|${input.endDate.toISOString().slice(0, 10)}`)
  const rand = mulberry32(seed)
  const drift = input.driftPerDay ?? 0.00035
  const vol = input.volatility ?? 0.012
  const maxBars = input.maxBars ?? 2000

  const bars: OhlcvBar[] = []
  let price = input.basePrice ?? 100 + (seed % 300)
  let cursor = new Date(input.startDate)
  while (cursor <= input.endDate && bars.length < maxBars) {
    if (!isWeekend(cursor)) {
      // Box-Muller for normal-ish noise
      const u1 = Math.max(rand(), 1e-9)
      const u2 = rand()
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
      const ret = drift + vol * z
      const open = price
      const close = Math.max(0.01, open * (1 + ret))
      const high = Math.max(open, close) * (1 + Math.abs(rand()) * 0.004)
      const low = Math.min(open, close) * (1 - Math.abs(rand()) * 0.004)
      const volume = Math.round(500_000 + rand() * 1_500_000)
      bars.push({
        date: cursor.toISOString().slice(0, 10),
        open: Math.round(open * 100) / 100,
        high: Math.round(high * 100) / 100,
        low: Math.round(low * 100) / 100,
        close: Math.round(close * 100) / 100,
        volume,
      })
      price = close
    }
    cursor = addDays(cursor, 1)
  }
  return bars
}
