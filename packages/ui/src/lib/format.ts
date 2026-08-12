/**
 * Canonical Finance-OS financial formatting.
 *
 * Single source of truth for money and percentage rendering (French,
 * European conventions). The structural rule enforced here: an unknown
 * value is NEVER converted to zero. Formatters return `null` for
 * null/undefined input; components decide the unavailable rendering
 * (default `Indisponible`).
 */

export type NullableNumber = number | null | undefined

/** Canonical user-facing label for an unknown financial value. */
export const UNAVAILABLE_LABEL = 'Indisponible'

type AmountFormatOptions = {
  /**
   * ISO currency code. `null` means the source currency is unknown:
   * the number is formatted without any currency symbol (EUR is never
   * inferred).
   */
  currency?: string | null
  /** Fraction digits. Defaults to 2, or 1 in compact notation. */
  decimals?: number
  /** Compact French notation (67 k€) for dense contexts. */
  compact?: boolean
  /** 'exceptZero' renders an explicit +/− sign on nonzero values. */
  signDisplay?: 'auto' | 'exceptZero' | 'always' | 'never'
}

/**
 * Format a monetary or plain financial amount in French conventions.
 * Returns `null` when the value is unknown — never `0`.
 */
export const formatAmount = (
  value: NullableNumber,
  options: AmountFormatOptions = {}
): string | null => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null
  }

  const { currency = 'EUR', compact = false, signDisplay = 'auto' } = options
  const decimals = options.decimals ?? (compact ? 1 : 2)

  const base: Intl.NumberFormatOptions = {
    minimumFractionDigits: compact ? 0 : decimals,
    maximumFractionDigits: decimals,
    signDisplay,
    ...(compact ? { notation: 'compact' as const } : {}),
  }

  if (currency === null) {
    return new Intl.NumberFormat('fr-FR', base).format(value)
  }

  try {
    return new Intl.NumberFormat('fr-FR', {
      ...base,
      style: 'currency',
      currency,
    }).format(value)
  } catch {
    // Unknown/invalid currency code: fall back to the plain number with
    // the raw code as suffix rather than mislabelling the amount as EUR.
    const plain = new Intl.NumberFormat('fr-FR', base).format(value)
    return `${plain} ${currency}`
  }
}

type PercentFormatOptions = {
  /** Fraction digits, default 2 (canonical `+8,51 %`). */
  decimals?: number
  /** Render an explicit sign on nonzero values. Default true. */
  signed?: boolean
}

/**
 * Format a percentage expressed in percentage points (8.51 → `8,51 %`).
 * Returns `null` when the value is unknown — never `0 %`.
 */
export const formatPercent = (
  value: NullableNumber,
  options: PercentFormatOptions = {}
): string | null => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null
  }

  const { decimals = 2, signed = true } = options
  const formatted = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    signDisplay: signed ? 'exceptZero' : 'auto',
  }).format(value)

  return `${formatted} %`
}

export type FreshnessAssessment =
  | { state: 'unknown'; label: string }
  | { state: 'fresh'; label: string }
  | { state: 'stale'; label: string; ageMinutes: number }

/** Compact French duration for freshness copy (8 min, 4 h, 3 j). */
export const formatAge = (ageMinutes: number): string => {
  if (ageMinutes < 60) return `${Math.max(1, Math.round(ageMinutes))} min`
  const hours = ageMinutes / 60
  if (hours < 48) return `${Math.round(hours)} h`
  return `${Math.round(hours / 24)} j`
}

/**
 * Pure freshness assessment (component passes `now` so behavior is
 * testable). Unknown timestamps stay unknown — never "fresh".
 */
export const assessFreshness = (
  asOf: string | Date | null | undefined,
  options: { now?: Date; staleAfterMinutes?: number } = {}
): FreshnessAssessment => {
  if (!asOf) return { state: 'unknown', label: UNAVAILABLE_LABEL }

  const timestamp = asOf instanceof Date ? asOf.getTime() : new Date(asOf).getTime()
  if (!Number.isFinite(timestamp)) return { state: 'unknown', label: UNAVAILABLE_LABEL }

  const now = options.now ?? new Date()
  const staleAfterMinutes = options.staleAfterMinutes ?? 24 * 60
  const ageMinutes = Math.max(0, (now.getTime() - timestamp) / 60_000)

  if (ageMinutes > staleAfterMinutes) {
    return { state: 'stale', label: `Ancien (${formatAge(ageMinutes)})`, ageMinutes }
  }
  return { state: 'fresh', label: 'À jour' }
}
