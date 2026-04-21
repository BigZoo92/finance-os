import { describe, expect, it } from 'vitest'
import type { CtaPolicyDefinition } from './policy-registry'
import { computeCtaOrchestrationMetrics, orchestrateCtas } from './policy-registry'

const baseContext = {
  mode: 'demo' as const,
  nowMs: 2_000,
  requestId: 'req-demo-cta',
  featureFlagEnabled: true,
  orchestrationOff: false,
  emergencyDisableSet: new Set<string>(),
}

const createPolicy = (overrides: Partial<CtaPolicyDefinition> & Pick<CtaPolicyDefinition, 'id'>): CtaPolicyDefinition => ({
  id: overrides.id,
  priority: overrides.priority ?? 10,
  visibleIn: overrides.visibleIn ?? 'both',
  cooldownMs: overrides.cooldownMs ?? 0,
  dedupeKey: overrides.dedupeKey ?? (() => overrides.id),
  telemetryContract: overrides.telemetryContract ?? { version: 'v1' },
  evaluateEligibility: overrides.evaluateEligibility ?? (() => ({ eligible: true })),
})

describe('orchestrateCtas', () => {
  it('applies deterministic tie-break ordering by id when priorities are equal', () => {
    const decisions = orchestrateCtas({
      policies: [createPolicy({ id: 'cta-z', priority: 20 }), createPolicy({ id: 'cta-a', priority: 20 })],
      context: baseContext,
      cooldownSnapshot: new Map(),
    })

    expect(decisions.map(decision => decision.id)).toEqual(['cta-a', 'cta-z'])
    expect(decisions[0]).toMatchObject({ id: 'cta-a', enabled: true, state: 'enabled' })
    expect(decisions[1]).toMatchObject({ id: 'cta-z', enabled: false, resolutionReason: 'conflict_lost' })
  })

  it('suppresses duplicate dedupe keys and cooldowned entries', () => {
    const decisions = orchestrateCtas({
      policies: [
        createPolicy({ id: 'cta-primary', priority: 20, dedupeKey: () => 'same' }),
        createPolicy({ id: 'cta-duplicate', priority: 10, dedupeKey: () => 'same' }),
        createPolicy({ id: 'cta-cooldown', priority: 5, cooldownMs: 10_000, dedupeKey: () => 'cooldown' }),
      ],
      context: baseContext,
      cooldownSnapshot: new Map([
        ['cooldown', 1_500],
      ]),
    })

    expect(decisions.find(decision => decision.id === 'cta-duplicate')).toMatchObject({
      resolutionReason: 'deduped',
      state: 'hidden',
    })
    expect(decisions.find(decision => decision.id === 'cta-cooldown')).toMatchObject({
      resolutionReason: 'cooldown_active',
      state: 'disabled',
    })
  })

  it('computes suppression and conflict rates', () => {
    const metrics = computeCtaOrchestrationMetrics([
      {
        id: 'a',
        state: 'enabled',
        enabled: true,
        priority: 10,
        dedupeKey: 'a',
        resolutionReason: 'eligible',
      },
      {
        id: 'b',
        state: 'disabled',
        enabled: false,
        priority: 9,
        dedupeKey: 'b',
        resolutionReason: 'conflict_lost',
      },
      {
        id: 'c',
        state: 'hidden',
        enabled: false,
        priority: 8,
        dedupeKey: 'c',
        resolutionReason: 'deduped',
      },
    ])

    expect(metrics).toMatchObject({ evaluated: 3, suppressed: 1, conflicts: 1 })
    expect(metrics.suppressionRate).toBeCloseTo(1 / 3)
    expect(metrics.conflictRate).toBeCloseTo(1 / 3)
  })
})
