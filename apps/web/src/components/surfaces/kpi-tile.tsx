/**
 * KpiTile — single source of truth for KPI surfaces across the cockpit.
 *
 * Null-aware by contract: an unknown value renders `Indisponible`, never a
 * fake zero and never an em-dash glyph. Canonical Command Pixel numeric
 * treatment: Geist Mono, tabular figures, medium weight.
 */
import { UNAVAILABLE_LABEL } from '@finance-os/ui/lib/format'
import { motion, useReducedMotion } from 'motion/react'

type Tone = 'plain' | 'brand' | 'violet' | 'positive' | 'negative' | 'warning'

type KpiTileProps = {
  label: string
  /** Numeric value. Use `display` for the formatted string (e.g. "4 200 €").
   *  Optional when only `display` is passed (non-numeric labels). */
  value?: number | null | undefined
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

const TONE_ACCENT: Record<Tone, string> = {
  plain: 'text-foreground',
  brand: 'text-primary',
  violet: 'text-accent-2',
  positive: 'text-positive',
  negative: 'text-negative',
  warning: 'text-warning',
}

const NUMBER_FORMAT = new Intl.NumberFormat('fr-FR')

export function KpiTile({
  label,
  value,
  display,
  hint,
  tone = 'plain',
  size = 'default',
  loading,
  icon,
  trailing,
  className = '',
}: KpiTileProps) {
  const prefersReducedMotion = useReducedMotion()
  const valueClass =
    size === 'lg'
      ? 'mt-1.5 font-financial text-[28px] md:text-[34px] font-medium tracking-tight leading-none'
      : 'mt-1.5 font-financial text-xl font-medium tracking-tight leading-none'

  const unavailable = display === undefined && typeof value !== 'number' && !value

  return (
    <div
      className={`h-full rounded-surface border border-border/60 bg-card px-4 py-3.5 md:px-5 md:py-4 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {icon && (
            <span className="mr-1.5 inline-flex translate-y-[1px] align-middle opacity-70">
              {icon}
            </span>
          )}
          {label}
        </p>
        {trailing}
      </div>

      {loading ? (
        <div
          className={`${size === 'lg' ? 'mt-2 h-9 w-36' : 'mt-2 h-6 w-24'} animate-shimmer rounded-md`}
        />
      ) : (
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className={
            unavailable
              ? 'mt-2 text-sm text-muted-foreground'
              : `${valueClass} tabular-nums ${TONE_ACCENT[tone]}`
          }
        >
          {display !== undefined ? (
            <span>{display}</span>
          ) : typeof value === 'number' ? (
            <span>{NUMBER_FORMAT.format(value)}</span>
          ) : (
            <span>{value || UNAVAILABLE_LABEL}</span>
          )}
        </motion.div>
      )}

      {hint && (
        <p className="mt-1.5 text-[11px] text-muted-foreground/70 leading-relaxed">{hint}</p>
      )}
    </div>
  )
}

export default KpiTile
