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
  actualCostToday?: number
  chargeableCostToday?: number
  costBasisToday?: 'actual' | 'estimated' | 'mixed'
  postReadsThisMonth?: number
  userReadsThisMonth?: number
  estimatedCostThisMonth?: number
  actualCostThisMonth?: number
  chargeableCostThisMonth?: number
  costBasisThisMonth?: 'actual' | 'estimated' | 'mixed'
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
    errorCode?: string | null
    errorStatusCode?: number | null
    errorMessage?: string | null
  }>
  dedupedSourcesCount?: number
  dedupedSources?: Array<{
    duplicateId: number
    keptId: number
    rawHandle: string
    canonicalHandle: string
    reason: string
  }>
  errorCode?: string | null
  errorMessage?: string | null
  autoResolve?: {
    enabled: boolean
    resolvedCount: number
    failedCount: number
  }
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

export type XResolveAllItemStatus =
  | 'resolved'
  | 'already_resolved'
  | 'merged_duplicate'
  | 'disabled_duplicate'
  | 'deleted_duplicate'
  | 'invalid_handle'
  | 'not_found'
  | 'provider_error'
  | 'rate_limited'
  | 'forbidden'
  | 'token_missing_or_invalid'
  | 'budget_exceeded'

export type XResolveAllResponse = {
  ok: boolean
  requestId: string
  code?: string
  message?: string
  summary?: {
    total: number
    resolved: number
    alreadyResolved: number
    invalidHandle: number
    notFound: number
    providerError: number
    tokenInvalid: number
    rateLimited: number
    forbidden: number
    mergedDuplicate?: number
    disabledDuplicate?: number
    deletedDuplicate?: number
    dedupedSourcesCount?: number
  }
  dedupedSourcesCount?: number
  dedupedSources?: Array<{
    duplicateId: number
    keptId: number
    rawHandle: string
    canonicalHandle: string
    reason: string
  }>
  items?: Array<{
    sourceId: number
    handleBefore: string
    handleAfter: string | null
    externalId: string | null
    status: XResolveAllItemStatus
    errorMessage: string | null
  }>
  userReads?: number
  estimatedCostUsd?: number
  rateLimit?: { limit: number | null; remaining: number | null; resetAt: number | null } | null
  providerError?: { code: string; message: string; statusCode: number | null } | null
}

export const resolveAllXSources = (body: { force?: boolean; sourceIds?: number[] } = {}) =>
  apiFetch<XResolveAllResponse>('/dashboard/signals/sources/x-twitter/resolve-all', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
