import { css, cx } from '@finance-os/styled-system/css'
import { formatAmount, UNAVAILABLE_LABEL } from '@finance-os/ui/lib/format'
import type * as React from 'react'

/**
 * Amount — canonical null-aware financial amount.
 *
 * Correctness primitive: an unknown value (`null`/`undefined`) is rendered
 * as unavailable, NEVER as `0 €`. A real zero renders as a real zero.
 * Geist Mono with tabular figures so comparable amounts align.
 */

const financialFigures = css({ textStyle: 'financial', fontVariantNumeric: 'tabular-nums' })
const unavailableText = css({ color: 'muted.foreground' })
const visuallyHidden = css({ srOnly: true })

type UnavailableVariant = 'text' | 'dash'

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
} & Omit<React.ComponentProps<'span'>, 'children'>

function UnavailableValue({
  variant,
  label,
  className,
  ...props
}: { variant: UnavailableVariant; label: string; className?: string } & Omit<
  React.ComponentProps<'span'>,
  'children'
>) {
  if (variant === 'dash') {
    return (
      <span
        data-slot="amount"
        data-unavailable="true"
        className={cx(financialFigures, unavailableText, className)}
        {...props}
      >
        <span aria-hidden="true">-</span>
        <span className={visuallyHidden}>{label}</span>
      </span>
    )
  }
  return (
    <span
      data-slot="amount"
      data-unavailable="true"
      className={cx(unavailableText, className)}
      {...props}
    >
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

  return (
    <span data-slot="amount" className={cx(financialFigures, className)} {...props}>
      {formatted}
    </span>
  )
}

export { Amount, CurrencyAmount }
