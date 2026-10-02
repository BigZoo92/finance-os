/**
 * Radar signal list — the accessible equivalent of the Signal Field.
 *
 * One row per observation: what moves, how important, the current value
 * when a single series backs it, and the observation in plain words. Rows
 * are toggle buttons that drive the same focus as the field.
 */
import { css, cva, cx } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
import type { JsxStyleProps } from '@finance-os/styled-system/types'
import { PercentChange } from '@finance-os/ui/components'
import { withStyleProps } from '@finance-os/ui/lib/style-props'
import { financialFigures } from '@finance-os/ui/lib/typography'
import { type RadarSeverity, type RadarSignal, SEVERITY_LABEL } from '@/features/radar/view-model'

const severityChip = cva({
  base: {
    flexShrink: '0',
    rounded: '5px',
    borderWidth: '1px',
    px: '1.5',
    py: '0.5',
    fontFamily: 'mono',
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  variants: {
    severity: {
      high: { borderColor: 'primary/40', color: 'primary' },
      medium: { borderColor: 'foreground/16', color: 'foreground/70' },
      low: { borderColor: 'foreground/12', color: 'foreground/45' },
    },
  },
})

export function SeverityChip({ severity }: { severity: RadarSeverity }) {
  return <span className={severityChip({ severity })}>{SEVERITY_LABEL[severity]}</span>
}

// Callers size the value through `textStyle`, so the figures use the longhands.
const signalValueTone = cva({
  variants: {
    tone: {
      positive: { color: 'positive' },
      negative: { color: 'negative' },
      neutral: { color: 'foreground/70' },
    },
  },
})

/** Style props (`ml`, `textStyle`, `fontSize`…) merge into the value's own styles. */
export function SignalValue({
  signal,
  className = '',
  ...styleProps
}: {
  signal: RadarSignal
  className?: string
} & JsxStyleProps) {
  if (!signal.value) return null
  if (signal.value.kind === 'percent') {
    return signal.value.value === null ? null : (
      <PercentChange
        value={signal.value.value}
        decimals={1}
        className={className}
        {...styleProps}
      />
    )
  }
  const { className: styles } = withStyleProps(
    styleProps,
    financialFigures,
    signalValueTone.raw({ tone: signal.tone })
  )
  return <span className={cx(styles, className)}>{signal.value.display}</span>
}

const signalRow = cva({
  base: {
    display: 'block',
    w: 'full',
    rounded: '11px',
    borderWidth: '1px',
    textAlign: 'left',
    outlineStyle: 'none',
    transitionProperty: 'colors',
    transitionDuration: '150ms',
    transitionTimingFunction: 'default',
    _focusVisible: { boxShadow: '0 0 0 2px color-mix(in srgb, {colors.ring} 70%, transparent)' },
  },
  variants: {
    emphasis: {
      focused: { borderColor: 'primary/40', bg: 'surface.2/80' },
      lead: {
        borderColor: 'foreground/16',
        bg: 'surface.1/60',
        _hover: { borderColor: 'foreground/25' },
      },
      quiet: { borderColor: 'foreground/10', _hover: { borderColor: 'foreground/20' } },
    },
    lead: {
      true: { p: '4' },
      false: { px: '4', py: '3.5' },
    },
  },
})

const signalSubject = cva({
  base: { minW: '0', truncate: true, color: 'foreground' },
  variants: {
    lead: {
      true: { textStyle: 'sm', fontWeight: 'semibold' },
      false: { fontSize: '13px', fontWeight: 'medium' },
    },
  },
})

const signalObservation = css({
  mt: '1.5',
  display: 'block',
  fontSize: 'xs',
  lineHeight: 'relaxed',
  color: 'foreground/60',
})

type RadarSignalListProps = {
  signals: RadarSignal[]
  focusedId: string | null
  onSelect: (signal: RadarSignal, trigger: HTMLElement) => void
}

export function RadarSignalList({ signals, focusedId, onSelect }: RadarSignalListProps) {
  return (
    <styled.ul spaceY="2" aria-label="Signaux">
      {signals.map((signal, index) => {
        const focused = focusedId === signal.id
        const lead = index === 0
        return (
          <li key={signal.id}>
            <button
              type="button"
              aria-pressed={focused}
              onClick={event => onSelect(signal, event.currentTarget)}
              className={signalRow({
                emphasis: focused ? 'focused' : lead ? 'lead' : 'quiet',
                lead,
              })}
            >
              <styled.span display="flex" alignItems="center" gap="2.5">
                <span className={signalSubject({ lead })}>{signal.subject}</span>
                <SeverityChip severity={signal.severity} />
                <SignalValue signal={signal} ml="auto" flexShrink="0" textStyle="xs" />
              </styled.span>
              <span className={signalObservation}>{signal.observation}</span>
            </button>
          </li>
        )
      })}
    </styled.ul>
  )
}
