import type { AuthMode } from '@/features/auth-types'
import { readPublicRuntimeEnv } from '@/lib/public-runtime-env'

const CTA_POLICY_SCOPE = '[web:cta-policy-registry]'
export const CTA_POLICY_VERSION = 'v1'

export type CtaUiState =
  | 'hidden'
  | 'disabled'
  | 'enabled'
  | 'in_progress'
  | 'success'
  | 'degraded_fallback'

export type CtaResolutionReason =
  | 'eligible'
  | 'ineligible'
  | 'feature_flag_off'
  | 'mode_hidden'
  | 'cooldown_active'
  | 'deduped'
  | 'conflict_lost'
  | 'dependency_failed'
  | 'emergency_disabled'

export type CtaTelemetryEventName =
  | 'cta_evaluated'
  | 'cta_rendered'
  | 'cta_clicked'
  | 'cta_blocked'
  | 'cta_conflict_resolved'

export type CtaPolicyContext = {
  mode: AuthMode
  nowMs: number
  requestId: string
  featureFlagEnabled: boolean
  orchestrationOff: boolean
  emergencyDisableSet: ReadonlySet<string>
}

export type CtaEligibilityResult = {
  eligible: boolean
  disabledReason?: string
  state?: Extract<CtaUiState, 'hidden' | 'enabled' | 'disabled' | 'degraded_fallback'>
  resolutionReason?: CtaResolutionReason
}

export type CtaPolicyDefinition = {
  id: string
  priority: number
  visibleIn: 'demo' | 'admin' | 'both'
  cooldownMs: number
  dedupeKey: (context: CtaPolicyContext) => string
  telemetryContract: {
    version: string
  }
  evaluateEligibility: (context: CtaPolicyContext) => CtaEligibilityResult
}

export type CtaDecision = {
  id: string
  state: CtaUiState
  enabled: boolean
  priority: number
  dedupeKey: string
  disabledReason?: string
  resolutionReason: CtaResolutionReason
}

const parseBoolean = (value: string | undefined) => {
  const normalized = value?.trim().toLowerCase()

  if (!normalized) {
    return undefined
  }

  if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') {
    return true
  }

  if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') {
    return false
  }

  return undefined
}

const parseEmergencyDisableList = (value: string | undefined) => {
  if (!value) {
    return new Set<string>()
  }

  return new Set(
    value
      .split(',')
      .map(token => token.trim())
      .filter(token => token.length > 0)
  )
}

export const readCtaPolicyRuntime = (mode: AuthMode, requestId: string): CtaPolicyContext => {
  const featureFlagEnabled = parseBoolean(readPublicRuntimeEnv('VITE_CTA_POLICY_REGISTRY_V1')) ?? false
  const orchestrationOff = parseBoolean(readPublicRuntimeEnv('VITE_CTA_ORCHESTRATION_OFF')) ?? false
  const emergencyDisableSet = parseEmergencyDisableList(
    readPublicRuntimeEnv('VITE_CTA_EMERGENCY_DISABLE_LIST')
  )

  return {
    mode,
    nowMs: Date.now(),
    requestId,
    featureFlagEnabled,
    orchestrationOff,
    emergencyDisableSet,
  }
}

export const orchestrateCtas = ({
  policies,
  context,
  cooldownSnapshot,
}: {
  policies: readonly CtaPolicyDefinition[]
  context: CtaPolicyContext
  cooldownSnapshot: ReadonlyMap<string, number>
}) => {
  const sortedPolicies = [...policies].sort((left, right) => {
    if (left.priority !== right.priority) {
      return right.priority - left.priority
    }

    return left.id.localeCompare(right.id)
  })

  const decisions: CtaDecision[] = []
  const seenDedupe = new Set<string>()
  const enabledCandidates: string[] = []

  for (const policy of sortedPolicies) {
    const dedupeKey = policy.dedupeKey(context)

    const buildDecision = (decision: Omit<CtaDecision, 'id' | 'priority' | 'dedupeKey'>): CtaDecision => ({
      id: policy.id,
      priority: policy.priority,
      dedupeKey,
      ...decision,
    })

    if (!context.featureFlagEnabled || context.orchestrationOff) {
      decisions.push(
        buildDecision({
          state: 'hidden',
          enabled: false,
          resolutionReason: 'feature_flag_off',
        })
      )
      continue
    }

    if (context.emergencyDisableSet.has(policy.id)) {
      decisions.push(
        buildDecision({
          state: 'disabled',
          enabled: false,
          disabledReason: 'Action temporairement désactivée.',
          resolutionReason: 'emergency_disabled',
        })
      )
      continue
    }

    if (policy.visibleIn !== 'both' && policy.visibleIn !== context.mode) {
      decisions.push(
        buildDecision({
          state: 'hidden',
          enabled: false,
          resolutionReason: 'mode_hidden',
        })
      )
      continue
    }

    const lastShownAt = cooldownSnapshot.get(dedupeKey)
    if (typeof lastShownAt === 'number' && policy.cooldownMs > 0 && context.nowMs - lastShownAt < policy.cooldownMs) {
      decisions.push(
        buildDecision({
          state: 'disabled',
          enabled: false,
          disabledReason: 'Action en cooldown.',
          resolutionReason: 'cooldown_active',
        })
      )
      continue
    }

    if (seenDedupe.has(dedupeKey)) {
      decisions.push(
        buildDecision({
          state: 'hidden',
          enabled: false,
          resolutionReason: 'deduped',
        })
      )
      continue
    }

    seenDedupe.add(dedupeKey)
    const evaluation = policy.evaluateEligibility(context)

    if (!evaluation.eligible) {
      decisions.push(
        buildDecision({
          state: evaluation.state ?? 'disabled',
          enabled: false,
          ...(evaluation.disabledReason ? { disabledReason: evaluation.disabledReason } : {}),
          resolutionReason: evaluation.resolutionReason ?? 'ineligible',
        })
      )
      continue
    }

    decisions.push(
      buildDecision({
        state: evaluation.state ?? 'enabled',
        enabled: true,
        resolutionReason: evaluation.resolutionReason ?? 'eligible',
      })
    )
    enabledCandidates.push(policy.id)
  }

  if (enabledCandidates.length > 1) {
    const winner = enabledCandidates[0]
    for (const decision of decisions) {
      if (decision.id !== winner && decision.enabled) {
        decision.enabled = false
        decision.state = 'disabled'
        decision.resolutionReason = 'conflict_lost'
        decision.disabledReason = 'Une action prioritaire est déjà proposée.'
      }
    }
  }

  return decisions
}

export const computeCtaOrchestrationMetrics = (decisions: readonly CtaDecision[]) => {
  const evaluated = decisions.length
  const suppressed = decisions.filter(
    decision =>
      decision.resolutionReason === 'deduped' ||
      decision.resolutionReason === 'cooldown_active' ||
      decision.resolutionReason === 'mode_hidden' ||
      decision.resolutionReason === 'feature_flag_off' ||
      decision.resolutionReason === 'emergency_disabled'
  ).length
  const conflicts = decisions.filter(decision => decision.resolutionReason === 'conflict_lost').length

  return {
    evaluated,
    suppressed,
    conflicts,
    suppressionRate: evaluated > 0 ? suppressed / evaluated : 0,
    conflictRate: evaluated > 0 ? conflicts / evaluated : 0,
  }
}

export const logCtaPolicyEvent = ({
  event,
  context,
  ctaId,
  resolutionReason,
  state,
}: {
  event: CtaTelemetryEventName
  context: CtaPolicyContext
  ctaId: string
  resolutionReason: CtaResolutionReason
  state: CtaUiState
}) => {
  console.info(CTA_POLICY_SCOPE, {
    event,
    'x-request-id': context.requestId,
    mode: context.mode,
    cta_id: ctaId,
    policy_version: CTA_POLICY_VERSION,
    resolution_reason: resolutionReason,
    state,
    timestamp: new Date(context.nowMs).toISOString(),
  })
}
