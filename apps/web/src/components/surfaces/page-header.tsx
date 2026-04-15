/**
 * PageHeader — canonical header for internal pages.
 *
 * When `title` is a plain string, we render it via TextPressure (Compressa
 * VF variable font) so every main heading in the cockpit shares the same
 * signature motion as the "/ cockpit" hero. Screen readers read the full
 * title once (handled inside TextPressure via `aria-label` + `sr-only`).
 *
 * When `title` is a ReactNode we fall back to a plain `<h1>` so pages that
 * need a custom composition (e.g. a balance display) keep control.
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
          // Inline-block with a capped max-width so TextPressure measures a
          // sensible container width and produces a readable fontSize. Short
          // titles like "Santé" don't get stretched edge-to-edge, long ones
          // like "Investissements" stay bounded.
          //
          // Generous vertical + horizontal padding is NECESSARY because the
          // pressure-expanded letters overflow their natural bounding box at
          // hover. Without this padding, letters get clipped by neighboring
          // content. `overflow-visible` on the component lets them breathe.
          <div
            className={`mt-1 inline-block w-full px-1 py-2 ${
              compact
                ? 'h-[56px] max-w-[320px] sm:max-w-[360px] md:h-[64px]'
                : 'h-[60px] max-w-[420px] sm:h-[72px] sm:max-w-[480px] md:h-[88px] md:max-w-[560px]'
            }`}
          >
            <TextPressure
              as="h1"
              text={title as string}
              ariaLabel={title as string}
              minFontSize={compact ? 32 : 40}
              width
              weight
              italic={false}
              flex
              scale
              gradient="linear-gradient(92deg, var(--aurora-a) 0%, var(--aurora-b) 50%, var(--aurora-c) 100%)"
              /* keep flex (so the per-character algorithm stays accurate) but
                 switch justify so the title hugs the left edge of its container. */
              className="justify-start text-left"
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
