import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Panel } from '@/components/surfaces/panel'

type SectionHeadingProps = {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}

export function PersonalSectionHeading({
  eyebrow,
  title,
  description,
  actions,
}: SectionHeadingProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/65">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">{title}</h2>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export type PersonalActionItem = {
  label: string
  description: string
  to: string
  icon?: ReactNode
  tone?: 'brand' | 'positive' | 'warning' | 'negative' | 'plain'
  disabled?: boolean
}

const ACTION_TONE_CLASS: Record<NonNullable<PersonalActionItem['tone']>, string> = {
  brand: 'text-primary border-primary/20 bg-primary/8',
  positive: 'text-positive border-positive/20 bg-positive/8',
  warning: 'text-warning border-warning/25 bg-warning/8',
  negative: 'text-negative border-negative/25 bg-negative/8',
  plain: 'text-muted-foreground border-border/60 bg-surface-1/70',
}

export function PersonalActionsPanel({
  title = 'Prochaines actions',
  description = 'Quelques gestes utiles, basés sur les données disponibles.',
  items,
}: {
  title?: string
  description?: string
  items: PersonalActionItem[]
}) {
  return (
    <Panel title={title} description={description} icon={<span aria-hidden="true">→</span>} tone="brand">
      <div className="grid gap-2">
        {items.slice(0, 5).map(item => {
          const tone = item.tone ?? 'plain'
          return item.disabled ? (
            <div
              key={item.label}
              className="flex items-start gap-3 rounded-xl border border-border/40 bg-surface-1/40 px-3 py-3 opacity-60"
              aria-disabled="true"
            >
              <ActionIcon tone={tone}>{item.icon ?? '·'}</ActionIcon>
              <ActionCopy label={item.label} description={item.description} />
            </div>
          ) : (
            <Link
              key={item.label}
              to={item.to}
              className="group flex items-start gap-3 rounded-xl border border-border/40 bg-surface-1/45 px-3 py-3 transition-colors hover:border-primary/25 hover:bg-surface-1"
            >
              <ActionIcon tone={tone}>{item.icon ?? '→'}</ActionIcon>
              <ActionCopy label={item.label} description={item.description} />
              <span
                aria-hidden="true"
                className="ml-auto pt-0.5 text-sm text-muted-foreground/40 transition-colors group-hover:text-primary"
              >
                →
              </span>
            </Link>
          )
        })}
      </div>
    </Panel>
  )
}

function ActionIcon({
  tone,
  children,
}: {
  tone: NonNullable<PersonalActionItem['tone']>
  children: ReactNode
}) {
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-sm ${ACTION_TONE_CLASS[tone]}`}
      aria-hidden="true"
    >
      {children}
    </span>
  )
}

function ActionCopy({ label, description }: { label: string; description: string }) {
  return (
    <span className="min-w-0">
      <span className="block text-sm font-medium text-foreground">{label}</span>
      <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{description}</span>
    </span>
  )
}

export function PersonalEmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border/45 bg-surface-1/35 px-4 py-8 text-center">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  )
}

