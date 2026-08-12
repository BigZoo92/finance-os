/**
 * PageHeader — canonical header for internal pages.
 *
 * Command Pixel scale: Geist Mono uppercase eyebrow, 24px Geist Sans
 * semibold title. Identical across pages so navigation keeps titles
 * visually anchored.
 */
import { motion, useReducedMotion } from 'motion/react'
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
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.header
      initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className={`flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${className}`}
    >
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            {icon && (
              <span className="flex items-center text-primary/80" aria-hidden="true">
                {icon}
              </span>
            )}
            {eyebrow}
          </p>
        )}
        <h1
          className={`font-semibold tracking-tight text-foreground leading-tight ${
            compact ? 'text-xl' : 'text-2xl'
          } ${eyebrow ? 'mt-2.5' : ''}`}
        >
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-prose text-[13px] text-muted-foreground leading-relaxed">
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
