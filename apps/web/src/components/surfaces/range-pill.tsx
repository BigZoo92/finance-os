/**
 * RangePill — shared segmented control for period/filter switches.
 *
 * Uses motion's layoutId to share a single animated pill across all
 * options. Works with any string or enum-shaped value.
 */
import { motion } from 'motion/react'

type RangeOption<T extends string> = {
  label: string
  value: T
  hint?: string
}

type RangePillProps<T extends string> = {
  options: Array<RangeOption<T>>
  value: T
  onChange: (next: T) => void
  /** Stable id so multiple pills on the page do not animate into each other. */
  layoutId: string
  className?: string
  size?: 'sm' | 'md'
  ariaLabel?: string
}

export function RangePill<T extends string>({
  options,
  value,
  onChange,
  layoutId,
  className = '',
  size = 'md',
  ariaLabel,
}: RangePillProps<T>) {
  const sizeCx = size === 'sm' ? 'p-0.5 text-[11px]' : 'p-1 text-xs'
  const itemCx = size === 'sm' ? 'px-2.5 py-1' : 'px-3 py-1.5'
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`glass-surface inline-flex items-center gap-0.5 rounded-full border border-border/60 ${sizeCx} ${className}`}
    >
      {options.map(opt => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`relative rounded-full ${itemCx} font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-0 ${
              active
                ? 'text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title={opt.hint ?? opt.label}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-full"
                style={{
                  background:
                    'linear-gradient(96deg, var(--aurora-a) 0%, var(--aurora-b) 55%, var(--aurora-c) 100%)',
                  boxShadow:
                    '0 6px 16px -6px oklch(from var(--primary) l c h / 45%), inset 0 1px 0 oklch(1 0 0 / 22%)',
                  zIndex: -1,
                }}
                transition={{ type: 'spring', bounce: 0.18, duration: 0.45 }}
              />
            )}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export default RangePill
