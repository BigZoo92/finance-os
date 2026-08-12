import type * as React from "react"

import { cn } from "@finance-os/ui/lib/utils"
import { formatPercent, UNAVAILABLE_LABEL } from "@finance-os/ui/lib/format"

/**
 * PercentChange — canonical null-aware percentage variation.
 *
 * Value is expressed in percentage points (8.51 → `+8,51 %`). Unknown is
 * rendered as unavailable, never `0 %`. Meaning never relies on color
 * alone: the explicit +/− sign is always part of the text.
 */

type PercentChangeProps = {
  value: number | null | undefined
  decimals?: number
  unavailableLabel?: string
  className?: string
} & Omit<React.ComponentProps<"span">, "children">

function PercentChange({
  value,
  decimals = 2,
  unavailableLabel = UNAVAILABLE_LABEL,
  className,
  ...props
}: PercentChangeProps) {
  const formatted = formatPercent(value, { decimals, signed: true })

  if (formatted === null) {
    return (
      <span
        data-slot="percent-change"
        data-unavailable="true"
        className={cn("text-muted-foreground", className)}
        {...props}
      >
        {unavailableLabel}
      </span>
    )
  }

  const numeric = value as number
  const tone =
    numeric > 0 ? "text-positive" : numeric < 0 ? "text-negative" : "text-muted-foreground"

  return (
    <span
      data-slot="percent-change"
      className={cn("font-financial tabular-nums", tone, className)}
      {...props}
    >
      {formatted}
    </span>
  )
}

/**
 * TrendIndicator — minimal directional glyph with a text equivalent.
 * Derives direction from a numeric delta or takes it explicitly.
 */

type TrendDirection = "up" | "down" | "flat"

const TREND: Record<TrendDirection, { glyph: string; label: string; tone: string }> = {
  up: { glyph: "▲", label: "en hausse", tone: "text-positive" },
  down: { glyph: "▼", label: "en baisse", tone: "text-negative" },
  flat: { glyph: "→", label: "stable", tone: "text-muted-foreground" },
}

function TrendIndicator({
  direction,
  value,
  className,
}: {
  direction?: TrendDirection
  value?: number | null | undefined
  className?: string
}) {
  const resolved: TrendDirection | null =
    direction ??
    (value === null || value === undefined || Number.isNaN(value)
      ? null
      : value > 0
        ? "up"
        : value < 0
          ? "down"
          : "flat")

  if (resolved === null) return null
  const trend = TREND[resolved]

  return (
    <span
      data-slot="trend-indicator"
      className={cn("inline-flex items-center text-[10px] leading-none", trend.tone, className)}
    >
      <span aria-hidden="true">{trend.glyph}</span>
      <span className="sr-only">{trend.label}</span>
    </span>
  )
}

export { PercentChange, TrendIndicator, type TrendDirection }
