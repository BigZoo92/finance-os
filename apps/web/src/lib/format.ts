/**
 * Shared formatting utilities for Finance-OS dashboard.
 *
 * Money and percentage formatting are owned by the canonical
 * `@finance-os/ui/lib/format` module (null-aware, French conventions).
 * `formatMoney` remains for existing non-null call sites; new code should
 * use the `Amount`/`CurrencyAmount`/`PercentChange` primitives or
 * `formatAmount` directly.
 */
import { formatAmount } from '@finance-os/ui/lib/format'
import { ApiRequestError } from './api'

export const formatMoney = (value: number, currency = 'EUR') =>
  formatAmount(value, { currency }) ?? ''

export const formatDateTime = (value: string | null) => {
  if (!value) {
    return '-'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return '-'
  }

  return parsed.toLocaleString('fr-FR')
}

export const formatDate = (value: string) => {
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export const formatRelativeDateTime = (value: string | null) => {
  if (!value) {
    return null
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  const diffMs = parsed.getTime() - Date.now()
  const formatter = new Intl.RelativeTimeFormat('fr-FR', {
    numeric: 'auto',
  })

  const units = [
    [60_000, 'minute'],
    [3_600_000, 'hour'],
    [86_400_000, 'day'],
  ] as const

  for (const [unitMs, unit] of units) {
    const delta = diffMs / unitMs
    if (Math.abs(delta) < (unit === 'minute' ? 60 : unit === 'hour' ? 24 : Infinity)) {
      return formatter.format(Math.round(delta), unit)
    }
  }

  return formatDateTime(value)
}

export const formatQuantity = (value: number | null) => {
  if (value === null) {
    return '-'
  }

  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 8,
  }).format(value)
}

export const formatDuration = (startedAt: string, endedAt: string | null) => {
  const started = new Date(startedAt).getTime()
  const ended = endedAt ? new Date(endedAt).getTime() : Date.now()

  if (!Number.isFinite(started) || !Number.isFinite(ended) || ended < started) {
    return null
  }

  const seconds = Math.round((ended - started) / 1000)
  if (seconds < 60) {
    return `${seconds}s`
  }

  const minutes = Math.floor(seconds / 60)
  const remainderSeconds = seconds % 60
  if (minutes < 60) {
    return `${minutes}m ${remainderSeconds}s`
  }

  const hours = Math.floor(minutes / 60)
  const remainderMinutes = minutes % 60
  return `${hours}h ${remainderMinutes}m`
}

export const formatCompactNumber = (value: number) => {
  return new Intl.NumberFormat('fr-FR', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

export const toErrorMessage = (value: unknown) => {
  if (value instanceof ApiRequestError) {
    if (value.status === 401 || value.status === 403) return 'Action réservée au mode admin.'
    if (value.status === 429) return 'Trop de demandes. Réessayez dans un instant.'
    return 'Action impossible pour le moment. Réessayez dans un instant.'
  }
  if (value instanceof Error) {
    return value.message
  }
  return String(value)
}

export const pickLatestDate = (values: Array<string | null>) => {
  const timestamps = values
    .filter((value): value is string => Boolean(value))
    .map(value => new Date(value).getTime())
    .filter(timestamp => Number.isFinite(timestamp))

  if (!timestamps.length) {
    return null
  }

  return new Date(Math.max(...timestamps)).toISOString()
}
