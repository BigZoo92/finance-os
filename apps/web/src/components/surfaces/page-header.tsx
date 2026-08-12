/**
 * PageHeader — canonical header for internal pages.
 *
 * Plain `<h1>` with responsive clamp() sizing. Sizing is identical across
 * pages (no layout measurement) so navigation keeps titles visually anchored.
 */
import { motion } from 'motion/react'
import type { ReactNode } from 'react'

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
  // One clamp token per size. `clamp(min, preferred, max)` guarantees the
  // title never falls below `min` on narrow viewports and never exceeds
  // `max` on wide ones.
  const fontSize = compact ? 'clamp(26px, 4vw, 38px)' : 'clamp(32px, 5vw, 52px)'

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
            {icon && (
              <span className="flex items-center text-primary/90" aria-hidden="true">
                {icon}
              </span>
            )}
            {eyebrow}
          </p>
        )}
        <h1
          className="mt-1.5 font-semibold tracking-tight text-foreground leading-[1.02]"
          style={typeof title === 'string' ? { fontSize } : undefined}
        >
          {title}
        </h1>
        {description && (
          <p className="mt-3 max-w-prose text-[13.5px] text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
        {status && <div className="mt-3">{status}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </motion.header>
  )
}

export default PageHeader
