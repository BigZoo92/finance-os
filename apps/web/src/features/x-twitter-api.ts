import { apiFetch } from '@/lib/api'

export type XHealthResponse = {
  ok: boolean
  mode: 'admin' | 'demo'
  source: 'db' | 'demo_fixture'
  enabled: boolean
  configured: boolean
  tokenPresent: boolean
  billingStatus?: string
  budgetStatus?: 'healthy' | 'monthly_low' | 'daily_exhausted' | 'monthly_exhausted'
  monthlyBudgetUsd?: number
  dailyBudgetUsd?: number
  postReadsToday?: number
  userReadsToday?: number
  estimatedCostToday?: number
  postReadsThisMonth?: number
  userReadsThisMonth?: number
  estimatedCostThisMonth?: number
  estimatedMonthlyCostAtCurrentRate?: number
  remainingDailyBudget?: number
  remainingMonthlyBudget?: number
  lastStatusCode?: number | null
  lastErrorCode?: string | null
  lastErrorAt?: string | null
  lastDailyRunStartedAt?: string | null
  lastDailyRunStatus?: string | null
  lastDailyRunFetchedCount?: number
  lastDailyRunKeptForAdvisorCount?: number
  dailySyncSchedulerEnabled?: boolean
  requestId: string
}

export type XProfileLookupBody = {
  handle: string
  forceRefresh?: boolean
  persist?: boolean
}

export type XProfileLookupResponse = {
  ok: boolean
  source?: 'cache' | 'x_api'
  fetchedFromX?: boolean
  userReads?: number
  estimatedCostUsd?: number
  persisted?: boolean
  verificationStatus?: string
  profile?: {
    id: string
    username: string
    name: string
    description: string | null
    profileImageUrl: string | null
    profileBannerUrl: string | null
    verified: boolean
    verifiedType: string | null
    protected: boolean
    publicMetrics: {
      followersCount: number | null
      followingCount: number | null
      tweetCount: number | null
      listedCount: number | null
    }
    createdAt: string | null
  }
  code?: string
  message?: string
  statusCode?: number | null
}

export type XDailySyncBody = {
  runMode?: 'automatic_capped' | 'manual_full_previous_day' | 'dry_run'
  dryRun?: boolean
  manualConfirm?: boolean
  allowBudgetOverride?: boolean
  limitAccounts?: number
}

export type XDailySyncResponse = {
  ok: boolean
  runId?: string
  mode?: string
  runStatus?: string
  capReason?: string
  window?: { startUtc: string; endUtc: string; windowDateLocal: string; timezone: string }
  estimatedPostReads?: number
  estimatedCostUsd?: number
  actualCostUsd?: number
  fetchedTweetCount?: number
  keptForAdvisorCount?: number
  signalItemCounts?: { insertedCount: number; dedupedCount: number }
  perAuthor?: Array<{
    authorId: string
    handle: string
    fetchedCount: number
    keptForAdvisorCount: number
    pagesFetched: number
    aborted: boolean
    abortReason: string | null
  }>
  errorCode?: string | null
  errorMessage?: string | null
  code?: string
  message?: string
}

export const fetchXHealth = () =>
  apiFetch<XHealthResponse>('/dashboard/signals/x-twitter/health')

export const lookupXHandle = (body: XProfileLookupBody) =>
  apiFetch<XProfileLookupResponse>('/dashboard/signals/sources/x-twitter/lookup-handle', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

export const runXDailyPreviousDaySync = (body: XDailySyncBody) =>
  apiFetch<XDailySyncResponse>('/dashboard/signals/x-twitter/daily-previous-day-sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
