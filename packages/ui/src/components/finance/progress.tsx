import type * as React from "react"

import { cn } from "@finance-os/ui/lib/utils"
import { UNAVAILABLE_LABEL } from "@finance-os/ui/lib/format"

/**
 * Progress — canonical accessible progress bar (goal progress, valuation
 * coverage). 4px track per the canonical frames, semantic fill, and a
 * mandatory textual equivalent: color never carries the meaning alone.
 *
 * `value: null` renders an explicit unavailable state, never an empty bar
 * pretending to be 0 %.
 */

type ProgressTone = "brand" | "positive" | "warning" | "negative" | "neutral"

const FILL: Record<ProgressTone, string> = {
  brand: "bg-primary",
  positive: "bg-positive",
  warning: "bg-warning",
  negative: "bg-negative",
  neutral: "bg-foreground/45",
}

type ProgressProps = {
  /** Current value, in [0, max]. `null`/`undefined` = unknown. */
  value: number | null | undefined
  max?: number
  tone?: ProgressTone
  /** Accessible name for the progressbar (e.g. the goal name). */
  label?: string
  /** Render the percentage as visible Geist Mono text. */
  showValue?: boolean
  className?: string
} & Omit<React.ComponentProps<"div">, "children">

function Progress({
  value,
  max = 100,
  tone = "brand",
  label,
  showValue = false,
  className,
  ...props
}: ProgressProps) {
  const known = typeof value === "number" && Number.isFinite(value) && max > 0
  const clamped = known ? Math.min(Math.max(value, 0), max) : null
  const percent = clamped === null ? null : (clamped / max) * 100
  const percentText =
    percent === null
      ? UNAVAILABLE_LABEL
      : `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(percent)} %`

  return (
    <div
      data-slot="progress"
      className={cn("flex items-center gap-3", className)}
      {...props}
    >
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        {...(clamped === null ? { "aria-valuetext": UNAVAILABLE_LABEL } : { "aria-valuenow": clamped })}
        {...(label ? { "aria-label": label } : {})}
        className="h-1 flex-1 overflow-hidden rounded-[2px] bg-foreground/9"
      >
        {percent !== null && (
          <div
            className={cn("h-full rounded-[2px] transition-[width] duration-200", FILL[tone])}
            style={{ width: `${percent}%` }}
          />
        )}
      </div>
      {showValue && (
        <span
          className={cn(
            "shrink-0 font-mono text-[11px] tabular-nums",
            percent === null ? "text-muted-foreground" : "text-foreground"
          )}
        >
          {percentText}
        </span>
      )}
    </div>
  )
}

export { Progress, type ProgressTone }
