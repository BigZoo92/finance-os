import { beforeEach, describe, expect, it } from 'bun:test'
import { env } from '../env'
import { resolveDemoTransactionsFixture } from './demo-transactions-fixture'

describe('demo transactions fixture scenario coverage', () => {
  beforeEach(() => {
    env.DEMO_DATASET_STRATEGY = 'v1'
    env.DEMO_PERSONA_MATCHING_ENABLED = true
  })

  it('returns installation dataset for onboarding readiness checks', () => {
    const fixture = resolveDemoTransactionsFixture({
      scenario: 'installation_readiness',
    })

    expect(fixture.items.length).toBeGreaterThan(0)
    expect(fixture.items.every(item => item.tags.includes('installation'))).toBeTrue()
  })

  it('returns offline scenario rows without DB/provider dependency', () => {
    const fixture = resolveDemoTransactionsFixture({
      scenario: 'offline_resilience',
    })

    expect(fixture.items.length).toBeGreaterThan(0)
    expect(
      fixture.items.every(
        item => item.tags.includes('offline') || item.tags.includes('pending')
      )
    ).toBeTrue()
  })

  it('returns notification candidate rows for push flows', () => {
    const fixture = resolveDemoTransactionsFixture({
      scenario: 'notifications_candidate',
    })

    expect(fixture.items.length).toBeGreaterThan(0)
    expect(fixture.items.every(item => item.tags.includes('notification_candidate'))).toBeTrue()
  })

  it('returns export audit rows with mixed transaction types', () => {
    const fixture = resolveDemoTransactionsFixture({
      scenario: 'export_audit',
    })

    expect(fixture.items.length).toBeGreaterThan(0)
    expect(
      fixture.items.some(item => item.tags.includes('export_candidate')) ||
        fixture.items.some(item => item.tags.includes('salary')) ||
        fixture.items.some(item => item.tags.includes('refund'))
    ).toBeTrue()
  })
})
