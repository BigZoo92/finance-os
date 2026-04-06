import type { DashboardNewsResponse } from '../types'

export const DASHBOARD_STATIC_FIXTURE_PACK_VERSION = 'dashboard-fixture-pack:2026-04-06'

export type DashboardFixtureDomain = 'alerts' | 'news' | 'insights'

const FIXTURE_TIMESTAMP = '2026-04-06T09:00:00.000Z'

export const DASHBOARD_STATIC_FIXTURE_META = {
  version: DASHBOARD_STATIC_FIXTURE_PACK_VERSION,
  generatedAt: FIXTURE_TIMESTAMP,
  domains: ['alerts', 'news', 'insights'] as const,
}

export const getDashboardNewsFixture = (requestId: string): DashboardNewsResponse => ({
  source: 'demo_fixture',
  resilience: {
    domain: 'news',
    status: 'ok',
    source: 'demo',
    requestId,
    reasonCode: null,
    policy: {
      enabled: true,
      sourceOrder: ['demo'],
    },
    slo: {
      degradedRate: 0,
      hardFailRate: 0,
      staleAgeSeconds: null,
    },
  },
  dataset: {
    version: DASHBOARD_STATIC_FIXTURE_META.version,
    source: 'demo_fixture',
    mode: 'demo',
    isDemoData: true,
  },
  lastUpdatedAt: FIXTURE_TIMESTAMP,
  staleCache: false,
  providerError: null,
  metrics: {
    cacheHitRate: 1,
    dedupeDropRate: 0,
    providerFailureRate: 0,
  },
  items: [
    {
      id: 'fixture-news-1',
      title: 'Diversified ETFs hold range while inflation cools',
      summary: 'Broad-market ETFs stayed resilient as investors priced a gradual policy path.',
      url: 'https://example.com/fixture-news-1',
      sourceName: 'Finance-OS Fixture Wire',
      topic: 'etf',
      language: 'en',
      publishedAt: '2026-04-06T07:40:00.000Z',
    },
    {
      id: 'fixture-news-2',
      title: 'Blue-chip tech leads low-volatility session',
      summary: 'Large-cap technology names outperformed with stable breadth and lower dispersion.',
      url: 'https://example.com/fixture-news-2',
      sourceName: 'Finance-OS Fixture Wire',
      topic: 'stocks',
      language: 'en',
      publishedAt: '2026-04-06T06:25:00.000Z',
    },
  ],
})
