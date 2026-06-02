export const toFiniteNumberOrNull = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

export const safeToFixed = (value: unknown, digits = 2): string | null => {
  const number = toFiniteNumberOrNull(value)
  return number === null ? null : number.toFixed(digits)
}

export const formatNullableNumber = safeToFixed

export const formatNumberOrDefault = ({
  value,
  digits = 2,
  fallback = 0,
}: {
  value: unknown
  digits?: number
  fallback?: number
}): string => {
  const formatted = safeToFixed(value, digits)
  if (formatted !== null) {
    return formatted
  }
  return (Number.isFinite(fallback) ? fallback : 0).toFixed(digits)
}

export const roundFiniteNumber = ({
  value,
  digits = 2,
  fallback = 0,
}: {
  value: unknown
  digits?: number
  fallback?: number
}): number => Number(formatNumberOrDefault({ value, digits, fallback }))
