import { css } from '@finance-os/styled-system/css'
import type { TradingLabStrategy } from '@/features/trading-lab-api'

type Props = {
  strategies: TradingLabStrategy[]
  value: number | null
  onChange: (id: number) => void
  disabled?: boolean
}

const field = css({ display: 'flex', flexDirection: 'column', gap: '1', textStyle: 'xs' })

const fieldLabel = css({ color: 'muted.foreground' })

const control = css({
  rounded: 'md',
  borderWidth: '1px',
  borderColor: 'border',
  bg: 'surface.1',
  px: '2',
  py: '1.5',
  textStyle: 'sm',
  color: 'foreground',
  _disabled: { opacity: '0.5' },
})

export function StrategyPicker({ strategies, value, onChange, disabled }: Props) {
  return (
    <label className={field}>
      <span className={fieldLabel}>Stratégie</span>
      <select
        className={control}
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
            {strategy.strategyType === 'experimental' ? ' (expérimentale)' : ''}
            {strategy.strategyType === 'benchmark' ? ' (benchmark)' : ''}
          </option>
        ))}
      </select>
    </label>
  )
}
