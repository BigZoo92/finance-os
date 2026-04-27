import type { DataSourcePreference, PreferredProvider } from '@/features/trading-lab-api'

type Props = {
  source: DataSourcePreference
  onSourceChange: (source: DataSourcePreference) => void
  provider: PreferredProvider
  onProviderChange: (provider: PreferredProvider) => void
  disabled?: boolean
}

const SOURCE_OPTIONS: Array<{ value: DataSourcePreference; label: string; hint: string }> = [
  { value: 'auto', label: 'Auto', hint: 'cache → provider → fixture' },
  { value: 'cached', label: 'Cache', hint: 'OHLCV déjà persistées' },
  { value: 'provider', label: 'Provider', hint: 'fetch live (admin)' },
  { value: 'caller_provided', label: 'Données manuelles', hint: 'OHLCV fournies' },
  { value: 'deterministic_fixture', label: 'Fixture démo', hint: 'OHLCV synthétiques' },
]

const PROVIDER_OPTIONS: Array<{ value: PreferredProvider; label: string }> = [
  { value: 'auto', label: 'Auto (EODHD → TwelveData)' },
  { value: 'eodhd', label: 'EODHD' },
  { value: 'twelvedata', label: 'TwelveData' },
]

export function MarketDataSourcePicker({
  source,
  onSourceChange,
  provider,
  onProviderChange,
  disabled,
}: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-muted-foreground">Source des données</span>
        <select
          className="rounded-md border border-border bg-surface-1 px-2 py-1.5 text-sm text-foreground disabled:opacity-50"
          value={source}
          disabled={disabled}
          onChange={event => onSourceChange(event.target.value as DataSourcePreference)}
        >
          {SOURCE_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>
              {option.label} — {option.hint}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs">
        <span className="text-muted-foreground">Provider préféré</span>
        <select
          className="rounded-md border border-border bg-surface-1 px-2 py-1.5 text-sm text-foreground disabled:opacity-50"
          value={provider}
          disabled={disabled || (source !== 'provider' && source !== 'auto' && source !== 'cached')}
          onChange={event => onProviderChange(event.target.value as PreferredProvider)}
        >
          {PROVIDER_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
