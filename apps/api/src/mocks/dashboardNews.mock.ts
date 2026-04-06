import type { DashboardNewsResponse } from '../routes/dashboard/types'

export const getDashboardNewsMock = (): DashboardNewsResponse => ({
  source: 'demo_fixture',
  lastUpdatedAt: '2026-04-05T10:30:00.000Z',
  staleCache: false,
  providerError: null,
  metrics: {
    cacheHitRate: 1,
    dedupeDropRate: 0,
    providerFailureRate: 0,
  },
  items: [
    {
      id: 'demo-news-1',
      title: 'Global equity ETFs hold steady despite macro volatility',
      summary: 'Major index ETFs remained range-bound as markets priced in a slower rate-cut cycle.',
      url: 'https://example.com/demo-news-1',
      sourceName: 'Demo Wire',
      topic: 'etf',
      language: 'en',
      publishedAt: '2026-04-05T08:00:00.000Z',
    },
    {
      id: 'demo-news-2',
      title: 'Bitcoin reclaims key technical level after risk-on session',
      summary: 'Crypto markets advanced with improving liquidity and lighter liquidation pressure.',
      url: 'https://example.com/demo-news-2',
      sourceName: 'Demo Wire',
      topic: 'crypto',
      language: 'en',
      publishedAt: '2026-04-05T07:15:00.000Z',
    },
  ],
})
