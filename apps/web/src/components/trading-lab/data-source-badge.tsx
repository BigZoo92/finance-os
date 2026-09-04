type Tone = 'real' | 'real-cached' | 'real-overlay' | 'synthetic' | 'unknown'

type Props = {
  resolvedMarketDataSource?: string | null | undefined
  dataProvider?: string | null | undefined
  dataQuality?: string | null | undefined
  fallbackUsed?: boolean | null | undefined
  className?: string
}

const TONE_BG: Record<Tone, string> = {
  real: 'bg-positive/15 text-positive border-positive/30',
  'real-cached': 'bg-teal/15 text-teal border-teal/30',
  'real-overlay': 'bg-teal/15 text-teal border-teal/30',
  synthetic: 'bg-warning/15 text-warning border-warning/30',
  unknown: 'bg-surface-2 text-muted-foreground border-border',
}

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
    ? FRENCH_SOURCE[resolvedMarketDataSource] ?? resolvedMarketDataSource.replace(/_/g, ' ')
    : 'Indisponible'
  const providerLabel = dataProvider && dataProvider !== 'fixture' ? ` (${dataProvider})` : ''
  const fallbackHint = fallbackUsed ? ' (secours)' : ''
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${TONE_BG[tone]} ${className ?? ''}`}
      title={`source: ${sourceLabel}${providerLabel}${fallbackHint}`}
    >
      <span aria-hidden className="size-1.5 bg-current" />
      <span>
        {sourceLabel}
        {providerLabel}
        {fallbackHint}
      </span>
    </span>
  )
}
