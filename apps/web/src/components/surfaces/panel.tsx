/**
 * Panel — the workhorse surface for data-dense widgets.
 *
 * Quieter than KpiTile: no spotlight, no glow. Just tokenized elevation,
 * an optional brand-tinted header rail, and a clean spacing rhythm so
 * tables, charts, and lists compose consistently.
 */
import type { ReactNode } from 'react'

type PanelProps = {
  title?: ReactNode
  description?: ReactNode
  icon?: ReactNode
  tone?: 'plain' | 'brand' | 'violet' | 'positive' | 'negative' | 'warning'
  /** Optional trailing actions (buttons, filters, badges). */
  actions?: ReactNode
  /** Reduce default padding — useful when the body is a full-bleed table. */
  bleed?: boolean
  className?: string
  headerClassName?: string
  bodyClassName?: string
  children: ReactNode
}

const TONE_RAIL: Record<NonNullable<PanelProps['tone']>, string> = {
  plain: 'before:bg-border/0',
  brand: 'before:bg-[linear-gradient(180deg,oklch(from_var(--primary)_l_c_h/80%),oklch(from_var(--primary)_l_c_h/10%))]',
  violet: 'before:bg-[linear-gradient(180deg,oklch(from_var(--accent-2)_l_c_h/80%),oklch(from_var(--accent-2)_l_c_h/10%))]',
  positive: 'before:bg-[linear-gradient(180deg,oklch(from_var(--positive)_l_c_h/80%),oklch(from_var(--positive)_l_c_h/10%))]',
  negative: 'before:bg-[linear-gradient(180deg,oklch(from_var(--negative)_l_c_h/80%),oklch(from_var(--negative)_l_c_h/10%))]',
  warning: 'before:bg-[linear-gradient(180deg,oklch(from_var(--warning)_l_c_h/80%),oklch(from_var(--warning)_l_c_h/10%))]',
}

const TONE_ICON: Record<NonNullable<PanelProps['tone']>, string> = {
  plain: 'text-muted-foreground',
  brand: 'text-primary',
  violet: 'text-accent-2',
  positive: 'text-positive',
  negative: 'text-negative',
  warning: 'text-warning',
}

export function Panel({
  title,
  description,
  icon,
  tone = 'plain',
  actions,
  bleed,
  className = '',
  headerClassName = '',
  bodyClassName = '',
  children,
}: PanelProps) {
  const hasHeader = Boolean(title || description || actions || icon)
  return (
    <section
      className={[
        'relative overflow-hidden rounded-2xl border border-border/60 bg-card',
        'transition-shadow duration-200 ease-out',
        'shadow-[0_1px_2px_oklch(0_0_0/4%),0_6px_20px_-10px_oklch(0_0_0/6%)]',
        'hover:shadow-[0_2px_4px_oklch(0_0_0/5%),0_18px_40px_-16px_oklch(0_0_0/10%)]',
        tone !== 'plain' &&
          `before:content-[''] before:absolute before:inset-y-3 before:left-0 before:w-[3px] before:rounded-full ${TONE_RAIL[tone]}`,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {hasHeader && (
        <header
          className={`flex flex-wrap items-start gap-3 ${
            bleed ? 'px-5 pt-4' : 'px-5 pt-5 md:px-6 md:pt-6'
          } pb-3 ${headerClassName}`}
        >
          {icon && (
            <span
              className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-surface-1 ${TONE_ICON[tone]}`}
              aria-hidden="true"
            >
              {icon}
            </span>
          )}
          <div className="min-w-0 flex-1">
            {title && (
              <h3 className="text-sm font-semibold tracking-tight text-foreground leading-tight">{title}</h3>
            )}
            {description && (
              <p className="mt-0.5 text-[12.5px] text-muted-foreground leading-relaxed">{description}</p>
            )}
          </div>
          {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={`${bleed ? '' : 'px-5 pb-5 md:px-6 md:pb-6'} ${bodyClassName}`}>{children}</div>
    </section>
  )
}

export default Panel
