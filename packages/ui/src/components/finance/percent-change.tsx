import { css, cva, cx } from '@finance-os/styled-system/css'
import type { Assign, JsxStyleProps } from '@finance-os/styled-system/types'
import { formatPercent, UNAVAILABLE_LABEL } from '@finance-os/ui/lib/format'
import { withStyleProps } from '@finance-os/ui/lib/style-props'
import { financialFigures } from '@finance-os/ui/lib/typography'
import type * as React from 'react'

/**
 * PercentChange — canonical null-aware percentage variation.
 *
 * Value is expressed in percentage points (8.51 → `+8,51 %`). Unknown is
 * rendered as unavailable, never `0 %`. Meaning never relies on color
 * alone: the explicit +/− sign is always part of the text.
 *
 * Accepts Panda style props, merged into the component's own styles.
 */

type Tone = 'positive' | 'negative' | 'neutral'

const toneColor = cva({
  variants: {
    tone: {
      positive: { color: 'positive' },
      negative: { color: 'negative' },
      neutral: { color: 'muted.foreground' },
    },
  },
})

type SpanProps = Assign<Omit<React.ComponentProps<'span'>, 'children'>, JsxStyleProps>

type PercentChangeProps = {
  value: number | null | undefined
  decimals?: number
  unavailableLabel?: string
  className?: string
} & SpanProps

function PercentChange({
  value,
  decimals = 2,
  unavailableLabel = UNAVAILABLE_LABEL,
  className,
  ...props
}: PercentChangeProps) {
  const formatted = formatPercent(value, { decimals, signed: true })

  if (formatted === null) {
    const { className: styles, rest } = withStyleProps(props, toneColor.raw({ tone: 'neutral' }))
    return (
      <span
        data-slot="percent-change"
        data-unavailable="true"
        className={cx(styles, className)}
        {...rest}
      >
        {unavailableLabel}
      </span>
    )
  }

  const numeric = value as number
  const tone: Tone = numeric > 0 ? 'positive' : numeric < 0 ? 'negative' : 'neutral'
  const { className: styles, rest } = withStyleProps(
    props,
    financialFigures,
    toneColor.raw({ tone })
  )

  return (
    <span data-slot="percent-change" className={cx(styles, className)} {...rest}>
      {formatted}
    </span>
  )
}

/**
 * TrendIndicator — minimal directional glyph with a text equivalent.
 * Derives direction from a numeric delta or takes it explicitly.
 */

type TrendDirection = 'up' | 'down' | 'flat'

const TREND: Record<TrendDirection, { glyph: string; label: string; tone: Tone }> = {
  up: { glyph: '▲', label: 'en hausse', tone: 'positive' },
  down: { glyph: '▼', label: 'en baisse', tone: 'negative' },
  flat: { glyph: '→', label: 'stable', tone: 'neutral' },
}

const trendGlyph = css({
  display: 'inline-flex',
  alignItems: 'center',
  fontSize: '10px',
  lineHeight: 'none',
})
const visuallyHidden = css({ srOnly: true })

function TrendIndicator({
  direction,
  value,
  className,
}: {
  direction?: TrendDirection
  value?: number | null | undefined
  className?: string
}) {
  const resolved: TrendDirection | null =
    direction ??
    (value === null || value === undefined || Number.isNaN(value)
      ? null
      : value > 0
        ? 'up'
        : value < 0
          ? 'down'
          : 'flat')

  if (resolved === null) return null
  const trend = TREND[resolved]

  return (
    <span
      data-slot="trend-indicator"
      className={cx(trendGlyph, toneColor({ tone: trend.tone }), className)}
    >
      <span aria-hidden="true">{trend.glyph}</span>
      <span className={visuallyHidden}>{trend.label}</span>
    </span>
  )
}

export { PercentChange, type TrendDirection, TrendIndicator }
