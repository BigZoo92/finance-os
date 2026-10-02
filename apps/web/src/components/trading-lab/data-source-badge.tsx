import { cva, cx } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'

type Tone = 'real' | 'real-cached' | 'real-overlay' | 'synthetic' | 'unknown'

type Props = {
  resolvedMarketDataSource?: string | null | undefined
  dataProvider?: string | null | undefined
  dataQuality?: string | null | undefined
  fallbackUsed?: boolean | null | undefined
  className?: string
}

const badge = cva({
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '1',
    rounded: 'full',
    borderWidth: '1px',
    px: '2',
    py: '0.5',
    fontFamily: 'mono',
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: 'wide',
  },
  variants: {
    tone: {
      real: { bg: 'positive/15', color: 'positive', borderColor: 'positive/30' },
      'real-cached': { bg: 'teal/15', color: 'teal', borderColor: 'teal/30' },
      'real-overlay': { bg: 'teal/15', color: 'teal', borderColor: 'teal/30' },
      synthetic: { bg: 'warning/15', color: 'warning', borderColor: 'warning/30' },
      unknown: { bg: 'surface.2', color: 'muted.foreground', borderColor: 'border' },
    },
  },
})

const FRENCH_SOURCE: Record<string, string> = {
  caller_provided: 'données manuelles',
  cached: 'cache',
  provider_eodhd: 'EODHD live',
  provider_twelvedata: 'TwelveData live',
  deterministic_fixture: 'fixture démo',
  unavailable: 'indisponible',
}

const normalizeTone = (quality?: string | null, fallbackUsed?: boolean | null): Tone => {
  if (fallbackUsed) return 'synthetic'
  switch (quality) {
    case 'real':
      return 'real'
    case 'real-cached':
      return 'real-cached'
    case 'real-overlay':
      return 'real-overlay'
    case 'synthetic':
      return 'synthetic'
    default:
      return 'unknown'
  }
}

export function DataSourceBadge({
  resolvedMarketDataSource,
  dataProvider,
  dataQuality,
  fallbackUsed,
  className,
}: Props) {
  const tone = normalizeTone(dataQuality, fallbackUsed)
  const sourceLabel = resolvedMarketDataSource
    ? (FRENCH_SOURCE[resolvedMarketDataSource] ?? resolvedMarketDataSource.replace(/_/g, ' '))
    : 'Indisponible'
  const providerLabel = dataProvider && dataProvider !== 'fixture' ? ` (${dataProvider})` : ''
  const fallbackHint = fallbackUsed ? ' (secours)' : ''
  return (
    <span
      className={cx(badge({ tone }), className)}
      title={`source: ${sourceLabel}${providerLabel}${fallbackHint}`}
    >
      <styled.span aria-hidden boxSize="1.5" bg="currentColor" />
      <span>
        {sourceLabel}
        {providerLabel}
        {fallbackHint}
      </span>
    </span>
  )
}
