import { MARKET_PROVIDER_LABELS, type MarketProviderId } from './market-definitions'

const numberFormatter = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const percentFormatter = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const toParts = (value: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  return Object.fromEntries(
    formatter.formatToParts(value).flatMap(part =>
      part.type === 'literal' ? [] : [[part.type, part.value]]
    )
  ) as Record<string, string>
}

const toMinutes = (value: string) => {
  const [hoursPart, minutesPart] = value.split(':')
  const hours = Number(hoursPart)
  const minutes = Number(minutesPart)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return 0
  }

  return hours * 60 + minutes
}

export const clampHistory = <T>(items: T[], maxItems: number) => {
  return items.length <= maxItems ? items : items.slice(items.length - maxItems)
}

export const roundNumber = (value: number, precision = 4) => {
  const multiplier = 10 ** precision
  return Math.round(value * multiplier) / multiplier
}

export const safeNumber = (value: string | number | null | undefined) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value !== 'string') {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export const toIsoOrNull = (value: Date | null | undefined) => {
  return value ? value.toISOString() : null
}

export const formatPercent = (value: number | null) => {
  if (value === null) {
    return 'n/d'
  }

  return `${value >= 0 ? '+' : ''}${percentFormatter.format(value)} %`
}

export const formatPercentNoSign = (value: number | null) => {
  if (value === null) {
    return 'n/d'
  }

  return `${percentFormatter.format(value)} %`
}

export const formatNumber = (value: number | null) => {
  if (value === null) {
    return 'n/d'
  }

  return numberFormatter.format(value)
}

export const getMarketSessionState = ({
  now,
  timeZone,
  opensAt,
  closesAt,
}: {
  now: Date
  timeZone: string
  opensAt: string
  closesAt: string
}) => {
  const parts = toParts(now, timeZone)
  const weekday = parts.weekday?.toLowerCase()
  const hour = Number(parts.hour ?? '0')
  const minute = Number(parts.minute ?? '0')
  const dayMinutes = hour * 60 + minute
  const isWeekend = weekday === 'sat' || weekday === 'sun'

  if (isWeekend) {
    return {
      state: 'closed' as const,
      isOpen: false,
      label: 'Marché fermé',
    }
  }

  const openMinutes = toMinutes(opensAt)
  const closeMinutes = toMinutes(closesAt)
  const isOpen = dayMinutes >= openMinutes && dayMinutes <= closeMinutes

  return {
    state: isOpen ? ('open' as const) : ('closed' as const),
    isOpen,
    label: isOpen ? 'Marché ouvert' : 'Marché fermé',
  }
}

export const computeFreshnessMinutes = ({
  capturedAt,
  quoteAsOf,
}: {
  capturedAt: Date
  quoteAsOf: Date | null
}) => {
  if (!quoteAsOf) {
    return null
  }

  return Math.max(0, Math.round((capturedAt.getTime() - quoteAsOf.getTime()) / 60000))
}

export const computeChangePct = (current: number | null, previous: number | null) => {
  if (current === null || previous === null || previous === 0) {
    return null
  }

  return roundNumber(((current - previous) / previous) * 100, 4)
}

export const pickHistoryAnchor = (values: number[], distance: number) => {
  if (values.length <= distance) {
    return values[0] ?? null
  }

  return values[values.length - (distance + 1)] ?? null
}

export const toMarketProviderNote = (provider: MarketProviderId) => {
  switch (provider) {
    case 'eodhd':
      return 'Source globale primaire EOD / retardée.'
    case 'fred':
      return 'Séries macro officielles de la Federal Reserve Bank of St. Louis.'
    case 'twelve_data':
      return 'Surcouche optionnelle plus fraîche sur quelques symboles US.'
  }
}

export const toProviderFreshnessLabel = ({
  provider,
  successAt,
}: {
  provider: MarketProviderId
  successAt: Date | null
}) => {
  if (!successAt) {
    return `${MARKET_PROVIDER_LABELS[provider]}: jamais rafraîchi`
  }

  return `${MARKET_PROVIDER_LABELS[provider]}: ${successAt.toISOString()}`
}
