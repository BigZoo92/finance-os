// PR6 — Advisor Learning Loop visibility predicates.
//
// Centralizes the "should this PR5 surface render?" decision so both routes (`/ia`,
// `/ia/trading-lab`) and the smoke tests use the same truth table. Pure logic — no React, no
// network, no DOM.

import type { AuthMode } from './auth-types'

export interface LearningLoopVisibilityInputs {
  /** Result of `getLearningLoopUiFlags().enabled` — UI-side feature flag, off by default. */
  learningLoopFlag: boolean
  /** Result of `getAiAdvisorUiFlags().enabled && (!adminOnly || isAdmin)`. */
  aiAdvisorVisible: boolean
  /** Resolved auth mode after auth-view-state, or `undefined` while pending. */
  mode: AuthMode | undefined
}

/**
 * The Learning Loop sections on `/ia` (Decision Recorder, Eval Scorecard, Post-Mortem feed) are
 * visible only when:
 *   1. the AI advisor itself is visible (existing precondition for the whole page surface)
 *   2. the Learning Loop UI flag is on
 *   3. an auth mode is resolved (no flicker before SSR auth)
 *
 * When any of those is false the route renders exactly as it did before PR5 — no extra queries,
 * no extra components, no flag-dependent layout.
 */
export const shouldShowLearningLoopOnIa = (inputs: LearningLoopVisibilityInputs): boolean =>
  inputs.aiAdvisorVisible === true &&
  inputs.learningLoopFlag === true &&
  inputs.mode !== undefined

/**
 * The Hypothesis Lab section on `/ia/trading-lab` is visible only when the flag is on and an
 * auth mode is resolved (admin OR demo — both can read; demo gets a read-only view).
 *
 * The advisor flag does NOT gate this surface because the Trading Lab page is independent of
 * the advisor enable/admin-only flags.
 */
export const shouldShowHypothesisLabOnTradingLab = (inputs: {
  learningLoopFlag: boolean
  mode: AuthMode | undefined
}): boolean => inputs.learningLoopFlag === true && inputs.mode !== undefined

/**
 * The Post-Mortem run button is visible only in admin mode and only when the Learning Loop UI
 * flag is on. Demo mode never sees the button — feature flag off hides it as well.
 *
 * Server-side guards remain authoritative even if a stale UI somehow shows the button: the
 * route returns 403 / `skipped_disabled` / `skipped_budget_blocked` accordingly.
 */
export const shouldShowPostMortemRunButton = (inputs: {
  learningLoopFlag: boolean
  mode: AuthMode | undefined
}): boolean => inputs.learningLoopFlag === true && inputs.mode === 'admin'

/**
 * Decision Recorder mutations (the `Enregistrer la décision` submit button + the `<select>`s)
 * must be disabled in demo mode regardless of feature flag state. The component itself only
 * renders when the flag is on AND a mode is resolved; this predicate reports the disabled
 * state of inner controls.
 */
export const decisionRecorderControlsDisabled = (inputs: {
  mode: AuthMode | undefined
}): boolean => inputs.mode !== 'admin'

/**
 * Hypothesis Lab admin actions ("Nouvelle hypothèse", "Archiver", "Créer un scénario paper")
 * are only available in admin mode. Demo mode renders a read-only list.
 */
export const hypothesisLabAdminActionsVisible = (inputs: {
  mode: AuthMode | undefined
}): boolean => inputs.mode === 'admin'
