import { describe, expect, it } from 'bun:test'
import {
  computePreviousDayWindow,
  estimatePreviousDaySyncCost,
  heuristicTweetRelevance,
  runPreviousDaySync,
  type XTwitterFollowedAccount,
  type XTwitterTimelineFetcher,
  type XTwitterTimelinePage,
  type XTwitterTimelineTweet,
} from './x-twitter-daily-sync'

const tweet = (overrides: Partial<XTwitterTimelineTweet> = {}): XTwitterTimelineTweet => ({
  id: overrides.id ?? `t${Math.random()}`,
  text: overrides.text ?? 'normal tweet text',
  authorId: overrides.authorId ?? 'A1',
  createdAt: overrides.createdAt ?? '2026-05-11T12:00:00.000Z',
  publicMetrics: overrides.publicMetrics ?? { likeCount: 10, retweetCount: 1 },
  lang: overrides.lang ?? 'en',
})

const okPage = (tweets: XTwitterTimelineTweet[], nextToken: string | null = null): XTwitterTimelinePage => ({
  tweets,
  meta: { nextToken, resultCount: tweets.length },
  statusCode: 200,
  errorCode: null,
})

const baseConfig = {
  runMode: 'automatic_capped' as const,
  budget: {
    dailyBudgetUsd: 0.6,
    remainingMonthlyBudgetUsd: 20,
    spentTodayUsd: 0,
    requireManualConfirmationOverUsd: 0.4,
    manuallyConfirmed: true,
    allowBudgetOverride: false,
  },
  caps: {
    maxPostReadsPerDay: 115,
    maxPagesPerUserPerDay: 20,
    maxResultsPerPage: 100,
    maxTweetsPerAuthorPerDay: 3,
  },
  advisor: { relevanceThreshold: 60, maxTweetsPerDay: 40 },
}

const window = {
  startUtc: '2026-05-10T22:00:00.000Z',
  endUtc: '2026-05-11T22:00:00.000Z',
  windowDateLocal: '2026-05-11',
  timezone: 'Europe/Paris',
}

describe('estimatePreviousDaySyncCost', () => {
  it('caps the worst-case estimate at maxPostReadsPerDay', () => {
    const estimate = estimatePreviousDaySyncCost({
      accounts: Array.from({ length: 50 }, (_, i) => ({
        signalSourceId: i,
        handle: `h${i}`,
        externalId: `${i}`,
        priority: 0,
      })),
      maxPostReadsPerDay: 115,
      maxPagesPerUserPerDay: 20,
    })
    expect(estimate.estimatedPostReads).toBe(115)
    expect(estimate.estimatedCostUsd).toBeCloseTo(0.575, 5)
  })
})

describe('computePreviousDayWindow', () => {
  it('returns the previous day in the configured timezone, exposed as UTC bounds', () => {
    const window = computePreviousDayWindow({
      now: new Date('2026-05-12T05:00:00Z'),
      timezone: 'Europe/Paris',
    })
    expect(window.windowDateLocal).toBe('2026-05-11')
    expect(window.timezone).toBe('Europe/Paris')
    expect(window.startUtc.endsWith('Z')).toBe(true)
    expect(window.endUtc.endsWith('Z')).toBe(true)
    // The window must be 24h
    const span = new Date(window.endUtc).getTime() - new Date(window.startUtc).getTime()
    expect(span).toBe(24 * 60 * 60 * 1000)
  })
})

describe('heuristicTweetRelevance', () => {
  it('rewards cashtags and macro keywords', () => {
    const tag = heuristicTweetRelevance(tweet({ text: '$SPY breaking out on CPI release' }))
    const noise = heuristicTweetRelevance(tweet({ text: 'morning coffee' }))
    expect(tag).toBeGreaterThan(noise)
  })

  it('penalises retweets', () => {
    const rt = heuristicTweetRelevance(tweet({ text: 'RT @whoever cool stuff' }))
    expect(rt).toBeLessThan(30)
  })
})

describe('runPreviousDaySync', () => {
  const accounts: XTwitterFollowedAccount[] = [
    { signalSourceId: 1, handle: 'a', externalId: 'AID1', priority: 0 },
    { signalSourceId: 2, handle: 'b', externalId: 'AID2', priority: 0 },
  ]

  it('skips with BUDGET_EXCEEDED when daily budget is fully consumed', async () => {
    const fetched: number[] = []
    const fetcher: XTwitterTimelineFetcher = async () => {
      fetched.push(1)
      return okPage([])
    }
    const outcome = await runPreviousDaySync({
      accounts,
      window,
      config: {
        ...baseConfig,
        budget: { ...baseConfig.budget, spentTodayUsd: 0.6 },
      },
      fetchTimeline: fetcher,
    })
    expect(outcome.status).toBe('skipped_budget_exceeded')
    expect(outcome.errorCode).toBe('BUDGET_EXCEEDED')
    expect(outcome.capReason).toBe('capped_by_budget')
    expect(fetched).toHaveLength(0)
  })

  it('requires manual confirmation when estimate exceeds the manual threshold', async () => {
    const outcome = await runPreviousDaySync({
      accounts,
      window,
      config: {
        ...baseConfig,
        budget: { ...baseConfig.budget, manuallyConfirmed: false, requireManualConfirmationOverUsd: 0.05 },
      },
      fetchTimeline: async () => okPage([]),
    })
    expect(outcome.status).toBe('requires_manual_confirmation')
    expect(outcome.errorCode).toBe('MANUAL_CONFIRMATION_REQUIRED')
    expect(outcome.errorMessage ?? '').toContain('manual-confirmation')
  })

  it('50 accounts × $20/month: nominal monthly cost stays under budget with safety margin', () => {
    const POST_READ_COST_USD = 0.005
    const USER_READ_COST_USD = 0.01
    const nominalMonthlyPostReads =
      baseConfig.caps.maxPostReadsPerDay * 30 * POST_READ_COST_USD
    // Post-reads alone must fit in 20 USD with margin (nominal automatic_capped run)
    expect(nominalMonthlyPostReads).toBeLessThan(20)
    // Even with the absolute ceiling of 3 user-reads/day for 30 days, the total
    // worst case must remain under the monthly budget.
    const monthlyUserReadCeiling = 3 * 30 * USER_READ_COST_USD
    expect(nominalMonthlyPostReads + monthlyUserReadCeiling).toBeLessThan(20)
  })

  it('respects 50 accounts × $20/month — automatic_capped never exceeds $0.60/day', async () => {
    const accounts50 = Array.from({ length: 50 }, (_, i) => ({
      signalSourceId: i,
      handle: `h${i}`,
      externalId: `A${i}`,
      priority: 0,
    }))
    // Realistic stub: X returns up to maxResults tweets per page, with infinite pagination available.
    const fetcher: XTwitterTimelineFetcher = async ({ maxResults }) =>
      okPage(
        Array.from({ length: maxResults }, (_, i) => tweet({ id: `pageT${i}-${Math.random()}` })),
        'more'
      )
    const outcome = await runPreviousDaySync({
      accounts: accounts50,
      window,
      config: baseConfig,
      fetchTimeline: fetcher,
    })
    // 50 accounts × maxTweetsPerAuthorPerDay=3 = 150 → capped by maxPostReadsPerDay=130
    expect(outcome.actualCostUsd).toBeLessThanOrEqual(baseConfig.budget.dailyBudgetUsd + 0.005)
    expect(outcome.fetchedTweetCount).toBeLessThanOrEqual(baseConfig.caps.maxPostReadsPerDay)
    // The combination of caps must produce one of these cap reasons (not "complete")
    expect(['capped_by_author_limit', 'capped_by_global_limit', 'capped_by_page_limit']).toContain(
      outcome.capReason
    )
  })

  it('dry-run mode never spends but reports the estimate', async () => {
    let called = 0
    const outcome = await runPreviousDaySync({
      accounts,
      window,
      config: { ...baseConfig, runMode: 'dry_run' as const },
      fetchTimeline: async () => {
        called += 1
        return okPage([])
      },
    })
    expect(called).toBe(0)
    expect(outcome.runMode).toBe('dry_run')
    expect(outcome.actualCostUsd).toBe(0)
    expect(outcome.estimatedCostUsd).toBeGreaterThan(0)
  })

  it('allowBudgetOverride lets a manual_full run proceed despite budget exceeded', async () => {
    const fetcher: XTwitterTimelineFetcher = async () =>
      okPage([tweet({ id: 't1' }), tweet({ id: 't2' })], null)
    const outcome = await runPreviousDaySync({
      accounts: accounts.slice(0, 1),
      window,
      config: {
        ...baseConfig,
        runMode: 'manual_full_previous_day' as const,
        budget: {
          ...baseConfig.budget,
          spentTodayUsd: 0.59, // basically exhausted
          allowBudgetOverride: true,
          manuallyConfirmed: true,
        },
      },
      fetchTimeline: fetcher,
    })
    expect(outcome.status).toBe('success')
    expect(outcome.runMode).toBe('manual_full_previous_day')
  })

  it('paginates each account until nextToken is exhausted or the per-author cap is reached', async () => {
    let callCount = 0
    const fetcher: XTwitterTimelineFetcher = async ({ paginationToken }) => {
      callCount += 1
      if (paginationToken === null) {
        return okPage([tweet({ id: 't1' }), tweet({ id: 't2' })], 'next-1')
      }
      return okPage([tweet({ id: 't3' })], null)
    }
    const outcome = await runPreviousDaySync({
      accounts: accounts.slice(0, 1),
      window,
      config: baseConfig,
      fetchTimeline: fetcher,
    })
    expect(outcome.status).toBe('success')
    expect(outcome.fetchedTweetCount).toBe(3)
    expect(callCount).toBe(2)
    expect(outcome.perAuthor[0]?.fetchedCount).toBe(3)
  })

  it('aborts an author with PER_AUTHOR_CAP when X_MAX_TWEETS_PER_AUTHOR_PER_DAY is reached', async () => {
    const tweets = Array.from({ length: 12 }, (_, i) => tweet({ id: `t${i}` }))
    const fetcher: XTwitterTimelineFetcher = async () => okPage(tweets, null)
    const outcome = await runPreviousDaySync({
      accounts: accounts.slice(0, 1),
      window,
      config: { ...baseConfig, caps: { ...baseConfig.caps, maxTweetsPerAuthorPerDay: 3 } },
      fetchTimeline: fetcher,
    })
    expect(outcome.fetchedTweetCount).toBe(3)
    expect(outcome.perAuthor[0]?.abortReason).toBe('PER_AUTHOR_CAP')
    expect(outcome.capReason).toBe('capped_by_author_limit')
  })

  it('deduplicates tweet IDs across pages and across authors', async () => {
    const fetcher: XTwitterTimelineFetcher = async () => okPage([tweet({ id: 'dup' })], null)
    const outcome = await runPreviousDaySync({
      accounts,
      window,
      config: baseConfig,
      fetchTimeline: fetcher,
    })
    expect(outcome.fetchedTweetCount).toBe(1)
  })

  it('marks tweets as keptForAdvisor only above relevance threshold and within max-per-day', async () => {
    const tweets = [tweet({ id: 'h', text: '$SPY breaking out' }), tweet({ id: 'l', text: 'cat picture' })]
    const fetcher: XTwitterTimelineFetcher = async () => okPage(tweets, null)
    const outcome = await runPreviousDaySync({
      accounts: accounts.slice(0, 1),
      window,
      config: baseConfig,
      fetchTimeline: fetcher,
    })
    const high = outcome.tweets.find(t => t.id === 'h')!
    const low = outcome.tweets.find(t => t.id === 'l')!
    expect(high.keptForAdvisor).toBe(true)
    expect(low.keptForAdvisor).toBe(false)
  })

  it('aborts an author with PROVIDER_ERROR when X returns a non-200 page', async () => {
    const fetcher: XTwitterTimelineFetcher = async () => ({
      tweets: [],
      meta: { nextToken: null, resultCount: 0 },
      statusCode: 429,
      errorCode: 'RATE_LIMITED',
    })
    const outcome = await runPreviousDaySync({
      accounts: accounts.slice(0, 1),
      window,
      config: baseConfig,
      fetchTimeline: fetcher,
    })
    expect(outcome.perAuthor[0]?.abortReason).toBe('PROVIDER_ERROR')
  })

  it('marks an account UNRESOLVED with PROVIDER_ERROR when externalId is missing', async () => {
    const outcome = await runPreviousDaySync({
      accounts: [{ signalSourceId: 99, handle: 'lost', externalId: null, priority: 0 }],
      window,
      config: baseConfig,
      fetchTimeline: async () => okPage([]),
    })
    expect(outcome.perAuthor[0]?.abortReason).toBe('PROVIDER_ERROR')
    expect(outcome.fetchedTweetCount).toBe(0)
  })
})
