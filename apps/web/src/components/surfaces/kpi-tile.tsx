/**
 * KpiTile — single source of truth for KPI surfaces across the cockpit.
 *
 * Null-aware by contract: an unknown value renders `Indisponible`, never a
 * fake zero and never an em-dash glyph. Canonical Command Pixel numeric
 * treatment: Geist Mono, tabular figures, medium weight.
 */
import { css, cva, cx } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
import { UNAVAILABLE_LABEL } from '@finance-os/ui/lib/format'
import { motion, useReducedMotion } from 'motion/react'

type Tone = 'plain' | 'brand' | 'ai' | 'positive' | 'negative' | 'warning'

type KpiTileProps = {
  label: string
  /** Numeric value. Use `displayValue` for the formatted string (e.g. "4 200 €").
   *  Optional when only `displayValue` is passed (non-numeric labels). */
  value?: number | null | undefined
  displayValue?: string
  /** @deprecated Use `displayValue`; kept so pre-migration callers still compile. */
  display?: string
  hint?: string
  tone?: Tone
  size?: 'default' | 'lg'
  loading?: boolean
  icon?: React.ReactNode
  trailing?: React.ReactNode
  className?: string
  /** Kept for API compatibility; numeric values render statically. */
  animate?: boolean
}

const NUMBER_FORMAT = new Intl.NumberFormat('fr-FR')

const kpiRoot = css({
  h: 'full',
  rounded: 'surface',
  borderWidth: '1px',
  borderColor: 'border/60',
  bg: 'card',
  px: '4',
  py: '3.5',
  md: { px: '5', py: '4' },
})

const kpiSkeleton = cva({
  base: {
    mt: '2',
    rounded: 'md',
    bgImage:
      'linear-gradient(90deg, {colors.muted} 0%, oklch(from {colors.muted} calc(l + 0.05) c h) 50%, {colors.muted} 100%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.8s ease-in-out infinite',
  },
  variants: {
    size: {
      default: { h: '6', w: '24' },
      lg: { h: '9', w: '36' },
    },
  },
})

// The financial text style owns the letter spacing (-0.01em): the former
// unlayered `font-financial` rule beat the `tracking-tight` utility.
const kpiValue = cva({
  base: {
    mt: '1.5',
    textStyle: 'financial',
    fontWeight: 'medium',
    lineHeight: 'none',
    fontVariantNumeric: 'tabular-nums',
  },
  variants: {
    size: {
      default: { fontSize: 'xl' },
      lg: { fontSize: '28px', md: { fontSize: '34px' } },
    },
    tone: {
      plain: { color: 'foreground' },
      brand: { color: 'primary' },
      ai: { color: 'ai' },
      positive: { color: 'positive' },
      negative: { color: 'negative' },
      warning: { color: 'warning' },
    },
  },
})

const kpiUnavailable = css({ mt: '2', textStyle: 'sm', color: 'muted.foreground' })

export function KpiTile({
  label,
  value,
  displayValue: displayValueProp,
  display,
  hint,
  tone = 'plain',
  size = 'default',
  loading,
  icon,
  trailing,
  className,
}: KpiTileProps) {
  const prefersReducedMotion = useReducedMotion()
  const displayValue = displayValueProp ?? display

  const unavailable = displayValue === undefined && typeof value !== 'number' && !value

  return (
    <div className={cx(kpiRoot, className)}>
      <styled.div display="flex" alignItems="flex-start" justifyContent="space-between" gap="3">
        <styled.p
          fontFamily="mono"
          fontSize="10px"
          fontWeight="medium"
          textTransform="uppercase"
          letterSpacing="0.16em"
          color="muted.foreground"
        >
          {icon && (
            <styled.span
              mr="1.5"
              display="inline-flex"
              translate="0 1px"
              verticalAlign="middle"
              opacity="0.7"
            >
              {icon}
            </styled.span>
          )}
          {label}
        </styled.p>
        {trailing}
      </styled.div>

      {loading ? (
        <div className={kpiSkeleton({ size })} />
      ) : (
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className={unavailable ? kpiUnavailable : kpiValue({ size, tone })}
        >
          {displayValue !== undefined ? (
            <span>{displayValue}</span>
          ) : typeof value === 'number' ? (
            <span>{NUMBER_FORMAT.format(value)}</span>
          ) : (
            <span>{value || UNAVAILABLE_LABEL}</span>
          )}
        </motion.div>
      )}

      {hint && (
        <styled.p mt="1.5" fontSize="11px" color="muted.foreground/70" lineHeight="relaxed">
          {hint}
        </styled.p>
      )}
    </div>
  )
}

export default KpiTile
