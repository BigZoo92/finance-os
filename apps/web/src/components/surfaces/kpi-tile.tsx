/**
 * KpiTile — single source of truth for KPI surfaces across the cockpit.
 *
 * Composes SpotlightCard (cursor-follow glow on hover) + CountUp (smooth
 * numeric reveal). Lean on purpose: no decorative fluff that would fight
 * the data. Variants cover tone (`plain | brand | positive | negative`)
 * and size (`default | lg`).
 */
import { motion } from 'motion/react'
import { CountUp } from '@/components/reactbits/count-up'
import { SpotlightCard } from '@/components/reactbits/spotlight-card'

type Tone = 'plain' | 'brand' | 'violet' | 'positive' | 'negative' | 'warning'

type KpiTileProps = {
  label: string
  /** Numeric value. Use `display` for the formatted string (e.g. "€ 4 200").
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
  /** Animate the numeric reveal with CountUp. */
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

const TONE_PRESET = {
  plain: 'neutral',
  brand: 'rose',
  violet: 'violet',
  positive: 'neutral',
  negative: 'neutral',
  warning: 'neutral',
} as const

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
  animate = true,
}: KpiTileProps) {
  const valueClass =
    size === 'lg'
      ? 'mt-1 font-financial text-3xl md:text-[34px] font-semibold tracking-tight leading-none'
      : 'mt-1 font-financial text-xl md:text-[22px] font-semibold tracking-tight leading-none'

  return (
    <SpotlightCard
      preset={TONE_PRESET[tone]}
      className={`h-full px-4 py-3.5 md:px-5 md:py-4 transition-transform duration-200 hover:-translate-y-[1px] ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
          {icon && <span className="mr-1.5 opacity-70">{icon}</span>}
          {label}
        </p>
        {trailing}
      </div>

      {loading ? (
        <div className={`${size === 'lg' ? 'mt-2 h-9 w-36' : 'mt-2 h-6 w-24'} animate-shimmer rounded-md`} />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className={`${valueClass} ${TONE_ACCENT[tone]}`}
        >
          {display !== undefined ? (
            <span>{display}</span>
          ) : typeof value === 'number' && animate ? (
            <CountUp to={value} duration={0.9} locale="fr-FR" />
          ) : (
            <span>{value ?? '—'}</span>
          )}
        </motion.div>
      )}

      {hint && <p className="mt-1.5 text-[11px] text-muted-foreground/70 leading-relaxed">{hint}</p>}
    </SpotlightCard>
  )
}

export default KpiTile
