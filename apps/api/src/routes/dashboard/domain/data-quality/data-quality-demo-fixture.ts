// Macro Prompt 5 — Deterministic demo fixture for /dashboard/data-quality.
//
// Fixed-shape, fixed-content snapshot. Demo mode never reads DB rows or
// provider snapshots; this fixture is what the route returns. Values are
// chosen to look healthy enough to demonstrate the UI without implying
// financial advice and without exposing any sensitive sentinel.

import type { DataQualityDimensionInput } from './data-quality-types'

const DEMO_NOW = new Date('2026-05-09T12:00:00.000Z')

export const buildDataQualityDemoFixtureInput = (): {
  readonly generatedAt: Date
  readonly dimensions: ReadonlyArray<DataQualityDimensionInput>
} => ({
  generatedAt: DEMO_NOW,
  dimensions: [
    {
      key: 'banking',
      status: 'ok',
      lastSuccessAt: '2026-05-09T11:30:00.000Z',
      lastFailureAt: null,
      providers: ['powens'],
      staleAfterMinutes: 1440,
    },
    {
      key: 'investments',
      status: 'ok',
      lastSuccessAt: '2026-05-09T10:45:00.000Z',
      lastFailureAt: null,
      providers: ['ibkr'],
      staleAfterMinutes: 1440,
    },
    {
      key: 'crypto',
      status: 'ok',
      lastSuccessAt: '2026-05-09T11:55:00.000Z',
      lastFailureAt: null,
      providers: ['binance'],
      staleAfterMinutes: 1440,
    },
    {
      key: 'market_data',
      status: 'ok',
      lastSuccessAt: '2026-05-09T11:50:00.000Z',
      lastFailureAt: null,
      providers: ['eodhd', 'fred'],
      staleAfterMinutes: 60,
    },
    {
      key: 'news',
      status: 'ok',
      lastSuccessAt: '2026-05-09T11:00:00.000Z',
      lastFailureAt: null,
      providers: ['news-service'],
      staleAfterMinutes: 360,
    },
    {
      key: 'advisor_memory',
      status: 'ok',
      lastSuccessAt: '2026-05-09T08:00:00.000Z',
      lastFailureAt: null,
      providers: ['knowledge-service'],
      staleAfterMinutes: 10080,
    },
    {
      key: 'evals',
      status: 'ok',
      lastSuccessAt: '2026-05-08T07:00:00.000Z',
      lastFailureAt: null,
      providers: [],
      staleAfterMinutes: 43200,
    },
    {
      key: 'post_mortems',
      status: 'ok',
      lastSuccessAt: '2026-05-01T07:00:00.000Z',
      lastFailureAt: null,
      providers: [],
      staleAfterMinutes: 86400,
    },
  ],
})
