/**
 * Freshness policy per loose asset class, in seconds.
 *
 * Not every asset moves at the same speed; a single blanket TTL would flag
 * bank balances stale on quiet weekends or hide week-old crypto prices.
 * Manual assets are exempt (the user's value is the truth; its date is shown).
 */
const HOUR = 60 * 60
const DAY = 24 * HOUR

const STALE_AFTER_SECONDS_BY_ASSET_CLASS: Record<string, number> = {
  crypto: 12 * HOUR,
  stablecoin: 2 * DAY,
  stock: 3 * DAY,
  etf: 3 * DAY,
  fund: 5 * DAY,
  bond: 5 * DAY,
  cash: 4 * DAY,
  other: 5 * DAY,
}

const DEFAULT_STALE_AFTER_SECONDS = 5 * DAY

export const resolveStaleAfterSeconds = ({
  assetClass,
  override,
}: {
  assetClass: string
  override?: number
}): number => {
  if (override !== undefined && Number.isFinite(override) && override > 0) {
    return override
  }
  return STALE_AFTER_SECONDS_BY_ASSET_CLASS[assetClass.toLowerCase()] ?? DEFAULT_STALE_AFTER_SECONDS
}
