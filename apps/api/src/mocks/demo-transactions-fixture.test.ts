import { describe, expect, it } from 'bun:test'
import type { DemoTransactionsScenario } from './demo-scenario-library'
import { resolveDemoTransactionsFixture } from './demo-transactions-fixture'

const resolveV1 = (scenario: DemoTransactionsScenario) =>
  resolveDemoTransactionsFixture({ scenario, strategy: 'v1', personaMatchingEnabled: true })

describe('demo transactions fixture scenario coverage', () => {
  it('returns installation dataset for onboarding readiness checks', () => {
    const fixture = resolveV1('installation_readiness')

    expect(fixture.items.length).toBeGreaterThan(0)
    expect(fixture.items.every(item => item.tags.includes('installation'))).toBeTrue()
  })

  it('returns offline scenario rows without DB/provider dependency', () => {
    const fixture = resolveV1('offline_resilience')

    expect(fixture.items.length).toBeGreaterThan(0)
    expect(
      fixture.items.every(item => item.tags.includes('offline') || item.tags.includes('pending'))
    ).toBeTrue()
  })

  it('returns notification candidate rows for push flows', () => {
    const fixture = resolveV1('notifications_candidate')

    expect(fixture.items.length).toBeGreaterThan(0)
    expect(fixture.items.every(item => item.tags.includes('notification_candidate'))).toBeTrue()
  })

  it('returns export audit rows with mixed transaction types', () => {
    const fixture = resolveV1('export_audit')

    expect(fixture.items.length).toBeGreaterThan(0)
    expect(
      fixture.items.some(item => item.tags.includes('export_candidate')) ||
        fixture.items.some(item => item.tags.includes('salary')) ||
        fixture.items.some(item => item.tags.includes('refund'))
    ).toBeTrue()
  })

  it('falls back to the default scenario when persona matching is disabled', () => {
    const fixture = resolveDemoTransactionsFixture({
      scenario: 'default',
      profile: 'student',
      strategy: 'v1',
      personaMatchingEnabled: false,
    })

    expect(fixture.personaMatch.overrideReason).toBe('kill_switch_disabled')
    expect(fixture.personaMatch.scenarioId).toBe('default')
  })
})
