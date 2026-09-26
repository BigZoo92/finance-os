import { cva, cx } from '@finance-os/styled-system/css'
import type { Assign, JsxStyleProps } from '@finance-os/styled-system/types'
import { assessFreshness, UNAVAILABLE_LABEL } from '@finance-os/ui/lib/format'
import { withStyleProps } from '@finance-os/ui/lib/style-props'
import type * as React from 'react'

/**
 * Status family — canonical human-facing state rendering.
 *
 * One coherent system: a semantic tone, a 5px dot and an always-visible
 * French label (color never carries the meaning alone). Backend enums are
 * mapped to the canonical vocabulary (À jour, Attention, En cours,
 * Connecté, Reconnexion requise, Indisponible…), never exposed directly.
 *
 * Accepts Panda style props, merged into the component's own styles so the
 * consumer's values win (a `fontSize` override also needs
 * `lineHeight: 'inherit'` to keep the `xs` text style's line box).
 */

type StatusTone = 'positive' | 'attention' | 'negative' | 'progress' | 'neutral'

const statusText = cva({
  base: { display: 'inline-flex', alignItems: 'center', gap: '7px', textStyle: 'xs' },
  variants: {
    tone: {
      positive: { color: 'positive' },
      attention: { color: 'warning' },
      negative: { color: 'negative' },
      progress: { color: 'primary' },
      neutral: { color: 'muted.foreground' },
    },
  },
})

const statusDot = cva({
  base: { boxSize: '5px', flexShrink: '0', rounded: 'full' },
  variants: {
    tone: {
      positive: { bg: 'positive' },
      attention: { bg: 'warning' },
      negative: { bg: 'negative' },
      progress: { bg: 'primary' },
      neutral: { bg: 'muted.foreground/60' },
    },
  },
})

type SpanProps = Assign<Omit<React.ComponentProps<'span'>, 'children'>, JsxStyleProps>

type StatusProps = {
  tone: StatusTone
  label: React.ReactNode
  /** Hide the dot for pure-text contexts. */
  withDot?: boolean
  className?: string
} & SpanProps

function Status({ tone, label, withDot = true, className, ...props }: StatusProps) {
  const { className: styles, rest } = withStyleProps(props, statusText.raw({ tone }))
  return (
    <span data-slot="status" data-tone={tone} className={cx(styles, className)} {...rest}>
      {withDot && <span aria-hidden="true" className={statusDot({ tone })} />}
      {label}
    </span>
  )
}

/**
 * ProviderStatus — canonical provider connection state.
 * Maps machine states to the human vocabulary and semantic tones.
 */

type ProviderStatusKind =
  | 'connected'
  | 'up_to_date'
  | 'syncing'
  | 'attention'
  | 'reconnect_required'
  | 'error'
  | 'configured'
  | 'not_configured'
  | 'unavailable'

const PROVIDER_STATUS: Record<ProviderStatusKind, { label: string; tone: StatusTone }> = {
  connected: { label: 'Connecté', tone: 'positive' },
  up_to_date: { label: 'À jour', tone: 'positive' },
  syncing: { label: 'En cours', tone: 'progress' },
  attention: { label: 'Attention', tone: 'attention' },
  reconnect_required: { label: 'Reconnexion requise', tone: 'attention' },
  error: { label: 'Échec', tone: 'negative' },
  configured: { label: 'Configuré', tone: 'positive' },
  not_configured: { label: 'Non configuré', tone: 'neutral' },
  unavailable: { label: UNAVAILABLE_LABEL, tone: 'neutral' },
}

function ProviderStatus({
  status,
  label,
  className,
  ...props
}: {
  status: ProviderStatusKind
  /** Optional label override (keeps the semantic tone). */
  label?: string
  className?: string
} & SpanProps) {
  const mapped = PROVIDER_STATUS[status]
  return (
    <Status
      tone={mapped.tone}
      label={label ?? mapped.label}
      {...(className !== undefined ? { className } : {})}
      {...props}
    />
  )
}

/**
 * Freshness — canonical data-age state.
 * Unknown timestamps render as unavailable, never as fresh.
 */

function Freshness({
  asOf,
  staleAfterMinutes,
  className,
  ...props
}: {
  asOf: string | Date | null | undefined
  staleAfterMinutes?: number
  className?: string
} & SpanProps) {
  const assessment = assessFreshness(asOf, {
    ...(staleAfterMinutes !== undefined ? { staleAfterMinutes } : {}),
  })

  const tone: StatusTone =
    assessment.state === 'fresh'
      ? 'positive'
      : assessment.state === 'stale'
        ? 'attention'
        : 'neutral'

  return (
    <Status
      tone={tone}
      label={assessment.label}
      {...(className !== undefined ? { className } : {})}
      {...props}
    />
  )
}

export {
  Freshness,
  PROVIDER_STATUS,
  ProviderStatus,
  type ProviderStatusKind,
  Status,
  type StatusTone,
}
