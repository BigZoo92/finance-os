/**
 * PageHeader — canonical header for internal pages.
 *
 * A compact header with an eyebrow (section kicker + glyph), a display
 * title, an optional subtitle and slot for right-hand actions (filters,
 * buttons). No aurora backdrop by default — add one explicitly via
 * AuroraBackdrop when the page deserves a hero.
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
  return (
    <motion.header
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={`flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${className}`}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-primary/70">
            {icon && <span className="text-primary/90" aria-hidden="true">{icon}</span>}
            {eyebrow}
          </p>
        )}
        <h1
          className={`mt-1.5 font-semibold tracking-tighter text-foreground ${
            compact ? 'text-[26px] leading-[1.1]' : 'text-[34px] md:text-[40px] leading-[1.02]'
          }`}
        >
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-prose text-[13.5px] text-muted-foreground leading-relaxed">{description}</p>
        )}
        {status && <div className="mt-3">{status}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </motion.header>
  )
}

export default PageHeader
