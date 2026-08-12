import type * as React from "react"

import { Status, type StatusTone } from "./status"
import { UNAVAILABLE_LABEL } from "@finance-os/ui/lib/format"

/**
 * ValuationState — canonical representation of the existing valuation
 * pipeline states. Pure presentation: maps the seven canonical states to
 * human French labels and semantic tones without touching valuation
 * business logic. Estimated, stale and unresolved stay identifiable —
 * they are never dressed up as precise values.
 */

type ValuationStateKind =
  | "priced"
  | "derived"
  | "estimated"
  | "manual"
  | "stale"
  | "unresolved"
  | "unavailable"

const VALUATION_STATE: Record<ValuationStateKind, { label: string; tone: StatusTone }> = {
  priced: { label: "Réel", tone: "positive" },
  derived: { label: "Dérivé", tone: "neutral" },
  estimated: { label: "Estimé", tone: "attention" },
  manual: { label: "Manuel", tone: "neutral" },
  stale: { label: "Ancien", tone: "attention" },
  unresolved: { label: "Non résolu", tone: "attention" },
  unavailable: { label: UNAVAILABLE_LABEL, tone: "neutral" },
}

function ValuationState({
  state,
  label,
  withDot,
  className,
  ...props
}: {
  state: ValuationStateKind
  /** Optional label override, e.g. the feminine `Estimée` for a valorisation. */
  label?: string
  withDot?: boolean
  className?: string
} & Omit<React.ComponentProps<"span">, "children">) {
  const mapped = VALUATION_STATE[state]
  return (
    <Status
      tone={mapped.tone}
      label={label ?? mapped.label}
      {...(withDot !== undefined ? { withDot } : {})}
      {...(className !== undefined ? { className } : {})}
      {...props}
    />
  )
}

export { VALUATION_STATE, ValuationState, type ValuationStateKind }
