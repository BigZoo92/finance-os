import type { TradingLabStrategy } from '@/features/trading-lab-api'

type Props = {
  strategies: TradingLabStrategy[]
  value: number | null
  onChange: (id: number) => void
  disabled?: boolean
}

export function StrategyPicker({ strategies, value, onChange, disabled }: Props) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-muted-foreground">Stratégie</span>
      <select
        className="rounded-md border border-border bg-surface-1 px-2 py-1.5 text-sm text-foreground disabled:opacity-50"
        value={value ?? ''}
        disabled={disabled}
        onChange={event => {
          const next = Number(event.target.value)
          if (!Number.isNaN(next)) onChange(next)
        }}
      >
        <option value="" disabled>
          Choisir une stratégie…
        </option>
        {strategies.map(strategy => (
          <option key={strategy.id} value={strategy.id}>
            {strategy.name}
            {strategy.strategyType === 'experimental' ? ' · expérimentale' : ''}
            {strategy.strategyType === 'benchmark' ? ' · benchmark' : ''}
          </option>
        ))}
      </select>
    </label>
  )
}
