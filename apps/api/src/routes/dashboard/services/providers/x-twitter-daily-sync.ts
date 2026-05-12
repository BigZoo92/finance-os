/**
 * Pure orchestration for the X previous-day sync.
 *
 * Contract:
 *   1. Estimate the worst-case cost (post reads × $0.005 + user reads × $0.010)
 *      from the configured follow list and daily caps.
 *   2. If estimate would exceed daily budget OR remaining monthly budget → abort.
 *   3. Otherwise fetch each followed account's previous-day timeline, paginate
 *      until exhausted or until per-author caps (X_MAX_TWEETS_PER_AUTHOR_PER_DAY)
 *      and global caps (X_MAX_POST_READS_PER_DAY / X_MAX_PAGES_PER_USER_PER_DAY)
 *      are hit.
 *   4. Score each tweet with a deterministic heuristic (relevance, novelty,
 *      market hint). Tweets above `X_ADVISOR_RELEVANCE_THRESHOLD` flow to the
 *      Advisor; the rest stay queryable but are not pushed to the LLM.
 *
 * The previous-day window is interpreted in the configured timezone (Paris by
 * default) but converted to UTC bounds before calling X.
 */

export type XTwitterTimelineFetcher = (input: {
  userId: string
  startTime: string
  endTime: string
  paginationToken: string | null
  maxResults: number
}) => Promise<XTwitterTimelinePage>

export type XTwitterTimelinePage = {
  tweets: XTwitterTimelineTweet[]
  meta: {
    nextToken: string | null
    resultCount: number
  }
  /** Status code surfaced for budget / error handling. 200 means success. */
  statusCode: number
  errorCode:
    | 'TOKEN_INVALID'
    | 'PAYMENT_REQUIRED'
    | 'FORBIDDEN'
    | 'RATE_LIMITED'
    | 'PROVIDER_UNAVAILABLE'
    | 'NETWORK_ERROR'
    | null
}

export type XTwitterTimelineTweet = {
  id: string
  text: string
  authorId: string
  createdAt: string
  publicMetrics?: {
    likeCount?: number
    retweetCount?: number
    replyCount?: number
    quoteCount?: number
  } | null
  lang?: string | null
}

export type XTwitterFollowedAccount = {
  signalSourceId: number
  handle: string
  externalId: string | null
  priority: number
}

const POST_READ_COST_USD = 0.005

export const estimatePreviousDaySyncCost = ({
  accounts,
  maxPostReadsPerDay,
  maxPagesPerUserPerDay,
  maxResultsPerPage = 100,
}: {
  accounts: XTwitterFollowedAccount[]
  maxPostReadsPerDay: number
  maxPagesPerUserPerDay: number
  maxResultsPerPage?: number
}) => {
  const worstCasePostReads = Math.min(
    maxPostReadsPerDay,
    accounts.length * maxPagesPerUserPerDay * maxResultsPerPage
  )
  return {
    estimatedPostReads: worstCasePostReads,
    estimatedCostUsd: worstCasePostReads * POST_READ_COST_USD,
    accountCount: accounts.length,
  }
}

export type PreviousDayWindow = {
  startUtc: string
  endUtc: string
  windowDateLocal: string
  timezone: string
}

/**
 * Convert "previous day in timezone" to UTC bounds [start, end). Uses
 * `Intl.DateTimeFormat` for the timezone offset so we never depend on a
 * timezone-database npm package.
 */
export const computePreviousDayWindow = ({
  now,
  timezone,
}: {
  now: Date
  timezone: string
}): PreviousDayWindow => {
  const localFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = Object.fromEntries(localFormatter.formatToParts(now).map(p => [p.type, p.value]))
  const todayLocalIso = `${parts.year}-${parts.month}-${parts.day}`
  const todayLocal = new Date(`${todayLocalIso}T00:00:00Z`)
  const yesterdayLocal = new Date(todayLocal.getTime() - 24 * 60 * 60 * 1000)
  const yyyy = yesterdayLocal.getUTCFullYear()
  const mm = `${yesterdayLocal.getUTCMonth() + 1}`.padStart(2, '0')
  const dd = `${yesterdayLocal.getUTCDate()}`.padStart(2, '0')
  const windowDateLocal = `${yyyy}-${mm}-${dd}`

  // Compute the timezone offset for the start of the local day by formatting
  // the local-midnight date back through the timezone formatter and reading
  // the offset.
  const probe = new Date(`${windowDateLocal}T12:00:00Z`)
  const offsetMinutes = -getTimezoneOffsetMinutes(probe, timezone)
  const startUtcMs = Date.UTC(yyyy, yesterdayLocal.getUTCMonth(), yesterdayLocal.getUTCDate())
  // Local midnight in UTC = UTC-midnight + offsetMinutes
  const startUtc = new Date(startUtcMs - offsetMinutes * 60 * 1000).toISOString()
  const endUtc = new Date(
    startUtcMs + 24 * 60 * 60 * 1000 - offsetMinutes * 60 * 1000
  ).toISOString()
  return { startUtc, endUtc, windowDateLocal, timezone }
}

const getTimezoneOffsetMinutes = (date: Date, timezone: string) => {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts = Object.fromEntries(fmt.formatToParts(date).map(p => [p.type, p.value]))
  const tzAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  )
  return Math.round((tzAsUtc - date.getTime()) / 60_000)
}

export const heuristicTweetRelevance = (tweet: XTwitterTimelineTweet): number => {
  const text = tweet.text.toLowerCase()
  const metrics = tweet.publicMetrics ?? {}
  let score = 30

  if (/\$[a-z]{1,5}\b/i.test(text)) score += 25 // cashtag
  if (/(spy|qqq|btc|eth|nasdaq|s&p|cpi|fed|earnings|guidance|sanction|cyber|ai)/.test(text)) {
    score += 15
  }
  if (/breaking|alert|just in|urgent/i.test(text)) score += 10
  if (text.startsWith('rt ')) score -= 30

  const engagement = (metrics.likeCount ?? 0) + (metrics.retweetCount ?? 0) * 2
  if (engagement > 100) score += 5
  if (engagement > 1000) score += 5
  if (engagement > 10000) score += 5

  return Math.max(0, Math.min(100, score))
}

export type PreviousDayRunMode = 'automatic_capped' | 'manual_full_previous_day' | 'dry_run'

export type PreviousDayCapReason =
  | 'complete'
  | 'capped_by_budget'
  | 'capped_by_author_limit'
  | 'capped_by_global_limit'
  | 'capped_by_page_limit'
  | 'capped_by_provider_error'

export type PreviousDaySyncOutcome = {
  status:
    | 'success'
    | 'partial'
    | 'skipped_budget_exceeded'
    | 'failed'
    | 'requires_manual_confirmation'
  runMode: PreviousDayRunMode
  capReason: PreviousDayCapReason
  estimatedPostReads: number
  estimatedUserReads: number
  estimatedCostUsd: number
  actualCostUsd: number
  fetchedTweetCount: number
  keptForAdvisorCount: number
  perAuthor: Array<{
    authorId: string
    handle: string
    fetchedCount: number
    keptForAdvisorCount: number
    pagesFetched: number
    aborted: boolean
    abortReason:
      | 'PER_AUTHOR_CAP'
      | 'GLOBAL_POST_CAP'
      | 'PAGE_CAP'
      | 'PROVIDER_ERROR'
      | 'BUDGET_EXCEEDED'
      | null
  }>
  errorCode: string | null
  errorMessage: string | null
  window: PreviousDayWindow
}

export type PreviousDaySyncConfig = {
  runMode: PreviousDayRunMode
  budget: {
    dailyBudgetUsd: number
    remainingMonthlyBudgetUsd: number
    spentTodayUsd: number
    requireManualConfirmationOverUsd: number
    manuallyConfirmed: boolean
    /** ADMIN-ONLY ESCAPE HATCH. When true, run anyway even if estimate exceeds
     *  budget caps. The route must require an admin session AND an explicit
     *  flag in the request body. Logged with a loud warning. */
    allowBudgetOverride: boolean
  }
  caps: {
    maxPostReadsPerDay: number
    maxPagesPerUserPerDay: number
    maxResultsPerPage: number
    maxTweetsPerAuthorPerDay: number
  }
  advisor: {
    relevanceThreshold: number
    maxTweetsPerDay: number
  }
}

/**
 * Aggregate per-author abort reasons into a single run-level cap reason.
 * If at least one author hit the global cap or page cap we report it because
 * that's actionable (raise the cap or split runs).
 */
const computeRunCapReason = (
  perAuthor: PreviousDaySyncOutcome['perAuthor']
): PreviousDayCapReason => {
  const reasons = perAuthor.map(p => p.abortReason).filter(Boolean) as string[]
  if (reasons.includes('GLOBAL_POST_CAP')) return 'capped_by_global_limit'
  if (reasons.includes('PAGE_CAP')) return 'capped_by_page_limit'
  if (reasons.includes('PER_AUTHOR_CAP')) return 'capped_by_author_limit'
  if (reasons.includes('PROVIDER_ERROR')) return 'capped_by_provider_error'
  if (reasons.includes('BUDGET_EXCEEDED')) return 'capped_by_budget'
  return 'complete'
}

export const runPreviousDaySync = async ({
  accounts,
  window,
  config,
  fetchTimeline,
  scoreTweet = heuristicTweetRelevance,
}: {
  accounts: XTwitterFollowedAccount[]
  window: PreviousDayWindow
  config: PreviousDaySyncConfig
  fetchTimeline: XTwitterTimelineFetcher
  scoreTweet?: (tweet: XTwitterTimelineTweet) => number
}): Promise<PreviousDaySyncOutcome & { tweets: Array<XTwitterTimelineTweet & { score: number; keptForAdvisor: boolean; sourceHandle: string }> }> => {
  const estimate = estimatePreviousDaySyncCost({
    accounts,
    maxPostReadsPerDay: config.caps.maxPostReadsPerDay,
    maxPagesPerUserPerDay: config.caps.maxPagesPerUserPerDay,
    maxResultsPerPage: config.caps.maxResultsPerPage,
  })

  const dailyBudgetRemaining = Math.max(0, config.budget.dailyBudgetUsd - config.budget.spentTodayUsd)
  const wouldExceedDailyBudget = estimate.estimatedCostUsd > dailyBudgetRemaining
  const wouldExceedMonthlyBudget = estimate.estimatedCostUsd > config.budget.remainingMonthlyBudgetUsd
  const requiresManual =
    estimate.estimatedCostUsd > config.budget.requireManualConfirmationOverUsd &&
    !config.budget.manuallyConfirmed
  const budgetExceeded = wouldExceedDailyBudget || wouldExceedMonthlyBudget
  const overrideActive = budgetExceeded && config.budget.allowBudgetOverride

  // Dry-run never spends — it only estimates and reports.
  if (config.runMode === 'dry_run') {
    return {
      status: budgetExceeded ? 'skipped_budget_exceeded' : 'success',
      runMode: 'dry_run',
      capReason: budgetExceeded ? 'capped_by_budget' : 'complete',
      estimatedPostReads: estimate.estimatedPostReads,
      estimatedUserReads: 0,
      estimatedCostUsd: estimate.estimatedCostUsd,
      actualCostUsd: 0,
      fetchedTweetCount: 0,
      keptForAdvisorCount: 0,
      perAuthor: accounts.map(a => ({
        authorId: a.externalId ?? `unresolved:${a.handle}`,
        handle: a.handle,
        fetchedCount: 0,
        keptForAdvisorCount: 0,
        pagesFetched: 0,
        aborted: false,
        abortReason: null,
      })),
      errorCode: null,
      errorMessage: budgetExceeded
        ? `Dry-run: estimate $${estimate.estimatedCostUsd.toFixed(2)} would exceed budget caps.`
        : null,
      window,
      tweets: [],
    }
  }

  if ((budgetExceeded && !overrideActive) || requiresManual) {
    return {
      status: requiresManual ? 'requires_manual_confirmation' : 'skipped_budget_exceeded',
      runMode: config.runMode,
      capReason: 'capped_by_budget',
      estimatedPostReads: estimate.estimatedPostReads,
      estimatedUserReads: 0,
      estimatedCostUsd: estimate.estimatedCostUsd,
      actualCostUsd: 0,
      fetchedTweetCount: 0,
      keptForAdvisorCount: 0,
      perAuthor: accounts.map(a => ({
        authorId: a.externalId ?? `unresolved:${a.handle}`,
        handle: a.handle,
        fetchedCount: 0,
        keptForAdvisorCount: 0,
        pagesFetched: 0,
        aborted: true,
        abortReason: 'BUDGET_EXCEEDED' as const,
      })),
      errorCode: requiresManual ? 'MANUAL_CONFIRMATION_REQUIRED' : 'BUDGET_EXCEEDED',
      errorMessage: requiresManual
        ? `Estimated cost $${estimate.estimatedCostUsd.toFixed(2)} exceeds manual-confirmation threshold ($${config.budget.requireManualConfirmationOverUsd.toFixed(2)}); require explicit approval.`
        : `Estimated cost $${estimate.estimatedCostUsd.toFixed(2)} exceeds budget caps (daily remaining: $${dailyBudgetRemaining.toFixed(2)}, monthly remaining: $${config.budget.remainingMonthlyBudgetUsd.toFixed(2)}).`,
      window,
      tweets: [],
    }
  }

  let totalPostReads = 0
  let totalFetched = 0
  let totalKeptForAdvisor = 0
  const perAuthor: PreviousDaySyncOutcome['perAuthor'] = []
  const seenTweetIds = new Set<string>()
  const scoredTweets: Array<XTwitterTimelineTweet & { score: number; keptForAdvisor: boolean; sourceHandle: string }> = []

  for (const account of accounts) {
    if (!account.externalId) {
      perAuthor.push({
        authorId: `unresolved:${account.handle}`,
        handle: account.handle,
        fetchedCount: 0,
        keptForAdvisorCount: 0,
        pagesFetched: 0,
        aborted: true,
        abortReason: 'PROVIDER_ERROR',
      })
      continue
    }
    if (totalPostReads >= config.caps.maxPostReadsPerDay) {
      perAuthor.push({
        authorId: account.externalId,
        handle: account.handle,
        fetchedCount: 0,
        keptForAdvisorCount: 0,
        pagesFetched: 0,
        aborted: true,
        abortReason: 'GLOBAL_POST_CAP',
      })
      continue
    }

    let paginationToken: string | null = null
    let pages = 0
    let authorFetched = 0
    let authorKept = 0
    let abortReason: PreviousDaySyncOutcome['perAuthor'][number]['abortReason'] = null

    while (true) {
      if (pages >= config.caps.maxPagesPerUserPerDay) {
        abortReason = 'PAGE_CAP'
        break
      }
      if (totalPostReads >= config.caps.maxPostReadsPerDay) {
        abortReason = 'GLOBAL_POST_CAP'
        break
      }
      if (authorFetched >= config.caps.maxTweetsPerAuthorPerDay) {
        abortReason = 'PER_AUTHOR_CAP'
        break
      }
      const remainingForAuthor = config.caps.maxTweetsPerAuthorPerDay - authorFetched
      const remainingGlobal = config.caps.maxPostReadsPerDay - totalPostReads
      const pageSize = Math.min(config.caps.maxResultsPerPage, remainingForAuthor, remainingGlobal)
      if (pageSize <= 0) break

      const page = await fetchTimeline({
        userId: account.externalId,
        startTime: window.startUtc,
        endTime: window.endUtc,
        paginationToken,
        maxResults: pageSize,
      })

      pages += 1
      totalPostReads += page.tweets.length

      if (page.statusCode !== 200) {
        abortReason = 'PROVIDER_ERROR'
        break
      }

      for (const tweet of page.tweets) {
        if (seenTweetIds.has(tweet.id)) continue
        seenTweetIds.add(tweet.id)
        authorFetched += 1
        totalFetched += 1
        const score = scoreTweet(tweet)
        const keptForAdvisor =
          score >= config.advisor.relevanceThreshold &&
          totalKeptForAdvisor < config.advisor.maxTweetsPerDay
        if (keptForAdvisor) {
          authorKept += 1
          totalKeptForAdvisor += 1
        }
        scoredTweets.push({
          ...tweet,
          score,
          keptForAdvisor,
          sourceHandle: account.handle,
        })
        if (authorFetched >= config.caps.maxTweetsPerAuthorPerDay) {
          abortReason = 'PER_AUTHOR_CAP'
          break
        }
      }

      if (!page.meta.nextToken) break
      paginationToken = page.meta.nextToken
    }

    perAuthor.push({
      authorId: account.externalId,
      handle: account.handle,
      fetchedCount: authorFetched,
      keptForAdvisorCount: authorKept,
      pagesFetched: pages,
      aborted: abortReason !== null,
      abortReason,
    })
  }

  const actualCostUsd = totalPostReads * POST_READ_COST_USD
  const everyAuthorAborted = perAuthor.every(a => a.aborted)
  const capReason = computeRunCapReason(perAuthor)

  return {
    status: everyAuthorAborted && totalFetched === 0 ? 'failed' : 'success',
    runMode: config.runMode,
    capReason,
    estimatedPostReads: estimate.estimatedPostReads,
    estimatedUserReads: 0,
    estimatedCostUsd: estimate.estimatedCostUsd,
    actualCostUsd,
    fetchedTweetCount: totalFetched,
    keptForAdvisorCount: totalKeptForAdvisor,
    perAuthor,
    errorCode: null,
    errorMessage: null,
    window,
    tweets: scoredTweets,
  }
}

export const __testing = { computeRunCapReason }
