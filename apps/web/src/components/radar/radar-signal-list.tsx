/**
 * Radar signal list — the accessible equivalent of the Signal Field.
 *
 * One row per observation: what moves, how important, the current value
 * when a single series backs it, and the observation in plain words. Rows
 * are toggle buttons that drive the same focus as the field.
 */
import { PercentChange } from '@finance-os/ui/components'
import {
  type RadarSeverity,
  type RadarSignal,
  type RadarTone,
  SEVERITY_LABEL,
} from '@/features/radar/view-model'

const SEVERITY_CHIP: Record<RadarSeverity, string> = {
  high: 'border-primary/40 text-primary',
  medium: 'border-foreground/16 text-foreground/70',
  low: 'border-foreground/12 text-foreground/45',
}

export function SeverityChip({ severity }: { severity: RadarSeverity }) {
  return (
    <span
      className={`shrink-0 rounded-[5px] border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] ${SEVERITY_CHIP[severity]}`}
    >
      {SEVERITY_LABEL[severity]}
    </span>
  )
}

const TONE_TEXT: Record<RadarTone, string> = {
  positive: 'text-positive',
  negative: 'text-negative',
  neutral: 'text-foreground/70',
}

export function SignalValue({
  signal,
  className = '',
}: {
  signal: RadarSignal
  className?: string
}) {
  if (!signal.value) return null
  if (signal.value.kind === 'percent') {
    return signal.value.value === null ? null : (
      <PercentChange value={signal.value.value} decimals={1} className={className} />
    )
  }
  return (
    <span className={`font-financial tabular-nums ${TONE_TEXT[signal.tone]} ${className}`}>
      {signal.value.display}
    </span>
  )
}

type RadarSignalListProps = {
  signals: RadarSignal[]
  focusedId: string | null
  onSelect: (signal: RadarSignal, trigger: HTMLElement) => void
}

export function RadarSignalList({ signals, focusedId, onSelect }: RadarSignalListProps) {
  return (
    <ul className="space-y-2" aria-label="Signaux">
      {signals.map((signal, index) => {
        const focused = focusedId === signal.id
        const lead = index === 0
        return (
          <li key={signal.id}>
            <button
              type="button"
              aria-pressed={focused}
              onClick={event => onSelect(signal, event.currentTarget)}
              className={`block w-full rounded-[11px] border text-left outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring/70 ${
                focused
                  ? 'border-primary/40 bg-surface-2/80'
                  : lead
                    ? 'border-foreground/16 bg-surface-1/60 hover:border-foreground/25'
                    : 'border-foreground/10 hover:border-foreground/20'
              } ${lead ? 'p-4' : 'px-4 py-3.5'}`}
            >
              <span className="flex items-center gap-2.5">
                <span
                  className={`min-w-0 truncate text-foreground ${
                    lead ? 'text-sm font-semibold' : 'text-[13px] font-medium'
                  }`}
                >
                  {signal.subject}
                </span>
                <SeverityChip severity={signal.severity} />
                <SignalValue signal={signal} className="ml-auto shrink-0 text-xs" />
              </span>
              <span className="mt-1.5 block text-xs leading-relaxed text-foreground/60">
                {signal.observation}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
