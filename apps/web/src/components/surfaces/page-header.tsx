/**
 * PageHeader — canonical header for internal pages.
 *
 * For plain-string titles we render TextPressure with an **explicit** CSS
 * `clamp()` fontSize, a solid inline flow (`flex=false`), and the width
 * axis disabled (`width=false`). This keeps:
 *
 *   - sizing identical across pages (no `getBoundingClientRect` dependency
 *     = no layout jump when navigating between routes);
 *   - titles bounded in width (the wght axis at hover only grows letters
 *     modestly — no dramatic wdth blow-up that used to clip on long words
 *     like "Investissements" or "Intégrations");
 *   - responsive typography via a single clamp token (mobile → desktop).
 *
 * When `title` is a ReactNode the component falls back to a plain `<h1>`
 * with Inter so custom layouts (e.g. a balance display) stay in control.
 */
import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { TextPressure } from '@/components/reactbits/text-pressure'

type PageHeaderProps = {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  actions?: ReactNode
  status?: ReactNode
  /** Tightens vertical rhythm — used for dense sub-pages. */
  compact?: boolean
  className?: string
}

export function PageHeader({
  eyebrow,
  title,
  description,
  icon,
  actions,
  status,
  compact,
  className = '',
}: PageHeaderProps) {
  const titleIsString = typeof title === 'string'

  // One clamp token per size. `clamp(min, preferred, max)` guarantees the
  // title never falls below `min` on narrow viewports and never exceeds
  // `max` on wide ones — no dependency on container width, so navigation
  // between pages keeps the title visually anchored at the same spot.
  const fontSize = compact
    ? 'clamp(26px, 4vw, 38px)'
    : 'clamp(32px, 5vw, 52px)'

  return (
    <motion.header
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={`flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${className}`}
    >
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-primary/70">
            {icon && <span className="text-primary/90" aria-hidden="true">{icon}</span>}
            {eyebrow}
          </p>
        )}
        {titleIsString ? (
          // The wrapper is only there to reserve vertical breathing room
          // so the pressure-expanded letters never clip the description
          // below. Horizontal breathing is a bit of right-padding.
          <div className="mt-1.5 overflow-visible pr-2">
            <TextPressure
              as="h1"
              text={title as string}
              ariaLabel={title as string}
              fontSize={fontSize}
              /* Width axis OFF — it's the axis that causes the big
                 horizontal overflow when letters pressure-expand. We keep
                 the weight axis so letters still bold up near the cursor,
                 which is a subtle, readable flourish. */
              width={false}
              weight
              italic={false}
              flex={false}
              scale={false}
              gradient="linear-gradient(92deg, var(--aurora-a) 0%, var(--aurora-b) 50%, var(--aurora-c) 100%)"
              className="text-left leading-[1.02] tracking-tight"
            />
          </div>
        ) : (
          <h1
            className={`mt-1.5 font-semibold tracking-tighter text-foreground ${
              compact ? 'text-[26px] leading-[1.1]' : 'text-[34px] md:text-[40px] leading-[1.02]'
            }`}
          >
            {title}
          </h1>
        )}
        {description && (
          <p className="mt-3 max-w-prose text-[13.5px] text-muted-foreground leading-relaxed">{description}</p>
        )}
        {status && <div className="mt-3">{status}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </motion.header>
  )
}

export default PageHeader
