/**
 * Panel — the workhorse surface for data-dense widgets.
 *
 * Quieter than KpiTile: no spotlight, no glow. Just tokenized elevation,
 * an optional brand-tinted header rail, and a clean spacing rhythm so
 * tables, charts, and lists compose consistently.
 */
import { cva, cx } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
import type { ReactNode } from 'react'

type PanelProps = {
  title?: ReactNode
  description?: ReactNode
  icon?: ReactNode
  tone?: 'plain' | 'brand' | 'ai' | 'positive' | 'negative' | 'warning'
  /** Optional trailing actions (buttons, filters, badges). */
  actions?: ReactNode
  /** Reduce default padding — useful when the body is a full-bleed table. */
  bleed?: boolean
  className?: string
  headerClassName?: string
  bodyClassName?: string
  children: ReactNode
}

const panelRoot = cva({
  base: {
    position: 'relative',
    overflow: 'hidden',
    rounded: 'surface',
    borderWidth: '1px',
    borderColor: 'border/60',
    bg: 'card',
    shadow: 'surface',
  },
  variants: {
    // Toned panels get a 1px vertical rail fading from 80% to 10% of the tone.
    rail: {
      true: {
        _before: { content: '""', position: 'absolute', insetY: '3', left: '0', w: '1px' },
      },
      false: {},
    },
    tone: {
      plain: {},
      brand: {
        _before: {
          bgImage:
            'linear-gradient(180deg, oklch(from {colors.primary} l c h / 80%), oklch(from {colors.primary} l c h / 10%))',
        },
      },
      ai: {
        _before: {
          bgImage:
            'linear-gradient(180deg, oklch(from {colors.ai} l c h / 80%), oklch(from {colors.ai} l c h / 10%))',
        },
      },
      positive: {
        _before: {
          bgImage:
            'linear-gradient(180deg, oklch(from {colors.positive} l c h / 80%), oklch(from {colors.positive} l c h / 10%))',
        },
      },
      negative: {
        _before: {
          bgImage:
            'linear-gradient(180deg, oklch(from {colors.negative} l c h / 80%), oklch(from {colors.negative} l c h / 10%))',
        },
      },
      warning: {
        _before: {
          bgImage:
            'linear-gradient(180deg, oklch(from {colors.warning} l c h / 80%), oklch(from {colors.warning} l c h / 10%))',
        },
      },
    },
  },
})

const panelHeader = cva({
  base: { display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '3', px: '5', pb: '3' },
  variants: {
    bleed: {
      true: { pt: '4' },
      false: { pt: '5', md: { px: '6', pt: '6' } },
    },
  },
})

const panelIcon = cva({
  base: {
    display: 'flex',
    h: '8',
    w: '8',
    flexShrink: '0',
    alignItems: 'center',
    justifyContent: 'center',
    rounded: 'lg',
    bg: 'surface.1',
  },
  variants: {
    tone: {
      plain: { color: 'muted.foreground' },
      brand: { color: 'primary' },
      ai: { color: 'ai' },
      positive: { color: 'positive' },
      negative: { color: 'negative' },
      warning: { color: 'warning' },
    },
  },
})

const panelBody = cva({
  base: {},
  variants: {
    bleed: {
      true: {},
      false: { px: '5', pb: '5', md: { px: '6', pb: '6' } },
    },
  },
})

export function Panel({
  title,
  description,
  icon,
  tone = 'plain',
  actions,
  bleed,
  className,
  headerClassName,
  bodyClassName,
  children,
}: PanelProps) {
  const hasHeader = Boolean(title || description || actions || icon)
  return (
    <section className={cx(panelRoot({ tone, rail: tone !== 'plain' }), className)}>
      {hasHeader && (
        <header className={cx(panelHeader({ bleed: Boolean(bleed) }), headerClassName)}>
          {icon && (
            <span className={panelIcon({ tone })} aria-hidden="true">
              {icon}
            </span>
          )}
          <styled.div minW="0" flex="1">
            {title && (
              <styled.h3
                textStyle="sm"
                fontWeight="semibold"
                letterSpacing="tight"
                color="foreground"
                lineHeight="tight"
              >
                {title}
              </styled.h3>
            )}
            {description && (
              <styled.p mt="0.5" fontSize="12.5px" color="muted.foreground" lineHeight="relaxed">
                {description}
              </styled.p>
            )}
          </styled.div>
          {actions && (
            <styled.div ml="auto" display="flex" alignItems="center" gap="2">
              {actions}
            </styled.div>
          )}
        </header>
      )}
      <div className={cx(panelBody({ bleed: Boolean(bleed) }), bodyClassName)}>{children}</div>
    </section>
  )
}

export default Panel
