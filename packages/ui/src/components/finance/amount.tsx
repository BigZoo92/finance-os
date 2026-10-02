import { css, cx } from '@finance-os/styled-system/css'
import type { Assign, JsxStyleProps } from '@finance-os/styled-system/types'
import { formatAmount, UNAVAILABLE_LABEL } from '@finance-os/ui/lib/format'
import { withStyleProps } from '@finance-os/ui/lib/style-props'
import { financialFigures } from '@finance-os/ui/lib/typography'
import type * as React from 'react'

/**
 * Amount — canonical null-aware financial amount.
 *
 * Correctness primitive: an unknown value (`null`/`undefined`) is rendered
 * as unavailable, NEVER as `0 €`. A real zero renders as a real zero.
 * Geist Mono with tabular figures so comparable amounts align.
 *
 * Accepts Panda style props (`mt`, `textStyle`, `display`, `sm={{…}}`),
 * merged into the component's own styles so the consumer's values win.
 */

const unavailableText = css.raw({ color: 'muted.foreground' })
const visuallyHidden = css({ srOnly: true })

type UnavailableVariant = 'text' | 'dash'

type SpanProps = Assign<Omit<React.ComponentProps<'span'>, 'children'>, JsxStyleProps>

type AmountBaseProps = {
  value: number | null | undefined
  /** Fraction digits. Default 2 (compact: 1). */
  decimals?: number
  /** Compact French notation for dense contexts. */
  compact?: boolean
  /** Explicit +/− sign on nonzero values. */
  signed?: boolean
  /**
   * Unavailable rendering. `text` (default) shows `Indisponible`;
   * `dash` shows a hyphen for dense tabular contexts while keeping the
   * accessible label.
   */
  unavailable?: UnavailableVariant
  unavailableLabel?: string
  className?: string
} & SpanProps

function UnavailableValue({
  variant,
  label,
  className,
  ...props
}: { variant: UnavailableVariant; label: string; className?: string } & SpanProps) {
  if (variant === 'dash') {
    const { className: styles, rest } = withStyleProps(props, financialFigures, unavailableText)
    return (
      <span data-slot="amount" data-unavailable="true" className={cx(styles, className)} {...rest}>
        <span aria-hidden="true">-</span>
        <span className={visuallyHidden}>{label}</span>
      </span>
    )
  }
  const { className: styles, rest } = withStyleProps(props, unavailableText)
  return (
    <span data-slot="amount" data-unavailable="true" className={cx(styles, className)} {...rest}>
      {label}
    </span>
  )
}

/** EUR-denominated amount (the product's base currency). */
function Amount({
  value,
  decimals,
  compact,
  signed,
  unavailable = 'text',
  unavailableLabel = UNAVAILABLE_LABEL,
  className,
  ...props
}: AmountBaseProps) {
  return (
    <CurrencyAmount
      value={value}
      currency="EUR"
      {...(decimals !== undefined ? { decimals } : {})}
      {...(compact !== undefined ? { compact } : {})}
      {...(signed !== undefined ? { signed } : {})}
      unavailable={unavailable}
      unavailableLabel={unavailableLabel}
      {...(className !== undefined ? { className } : {})}
      {...props}
    />
  )
}

/**
 * CurrencyAmount — amount with an explicit source currency.
 *
 * `currency: null` means the source currency is unknown: the number is
 * rendered without a currency symbol. EUR is never inferred.
 */
function CurrencyAmount({
  value,
  currency,
  decimals,
  compact,
  signed,
  unavailable = 'text',
  unavailableLabel = UNAVAILABLE_LABEL,
  className,
  ...props
}: AmountBaseProps & { currency: string | null }) {
  const formatted = formatAmount(value, {
    currency,
    ...(decimals !== undefined ? { decimals } : {}),
    ...(compact !== undefined ? { compact } : {}),
    ...(signed ? { signDisplay: 'exceptZero' as const } : {}),
  })

  if (formatted === null) {
    return (
      <UnavailableValue
        variant={unavailable}
        label={unavailableLabel}
        {...(className !== undefined ? { className } : {})}
        {...props}
      />
    )
  }

  const { className: styles, rest } = withStyleProps(props, financialFigures)
  return (
    <span data-slot="amount" className={cx(styles, className)} {...rest}>
      {formatted}
    </span>
  )
}

export { Amount, CurrencyAmount }
