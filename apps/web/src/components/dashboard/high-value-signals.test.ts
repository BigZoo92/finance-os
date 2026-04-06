import { describe, expect, it } from 'vitest'
import { buildHighValueSignalDigest } from './high-value-signals'

describe('buildHighValueSignalDigest', () => {
  it('returns null when no signal is available', () => {
    expect(buildHighValueSignalDigest([])).toBeNull()
  })

  it('builds a compact digest with counts and top titles', () => {
    const digest = buildHighValueSignalDigest([
      { id: 'alert-1', kind: 'alert', title: 'Sync backlog' },
      { id: 'alert-2', kind: 'alert', title: 'Transaction freshness degraded' },
      { id: 'insight-1', kind: 'insight', title: 'Top expense group' },
      { id: 'insight-2', kind: 'insight', title: 'Cashflow trend' },
    ])

    expect(digest).toEqual({
      fingerprint: 'alert:alert-1|alert:alert-2|insight:insight-1',
      alertCount: 2,
      insightCount: 2,
      topTitles: ['Sync backlog', 'Transaction freshness degraded', 'Top expense group'],
    })
  })
})
