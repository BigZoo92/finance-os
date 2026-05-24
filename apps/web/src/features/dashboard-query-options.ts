import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'
import {
  fetchAdvisorDecisionJournal,
  fetchAdvisorPostMortems,
  fetchDashboardAdvisor,
  fetchDashboardAdvisorAssumptions,
  fetchDashboardAdvisorChat,
  fetchDashboardAdvisorEvals,
  fetchDashboardAdvisorBehaviorAnalytics,
  fetchDashboardAdvisorEvalsTrends,
  fetchDashboardAdvisorKnowledgeTopics,
  fetchDashboardAdvisorLatestManualOperation,
  fetchDashboardAdvisorManualOperationById,
  fetchDashboardAdvisorAssetsSearch,
  fetchDashboardAdvisorAssetWatchlist,
  fetchDashboardAdvisorRecommendations,
  fetchDashboardAdvisorRuns,
  fetchDashboardAdvisorSignals,
  fetchDashboardAdvisorSpend,
  fetchDashboardInvestmentHypotheses,
  fetchDashboardInvestmentLessons,
  fetchDashboardInvestmentPlanLatest,
  fetchDashboardInvestmentScorecard,
  fetchDashboardInvestmentStatus,
  fetchDashboardInvestmentStrategy,
  fetchDashboardManualAssets,
  fetchTradingLabHypotheses,
  fetchTradingLabStrategyScorecard,
  getDemoTradingLabStrategyScorecard,
  fetchTradingLabHypothesisById,
  getDemoDashboardAdvisor,
  getDemoDashboardAdvisorAssumptions,
  getDemoDashboardAdvisorChat,
  getDemoDashboardAdvisorBehaviorAnalytics,
  getDemoDashboardAdvisorEvals,
  getDemoDashboardAdvisorEvalsTrends,
  getDemoDashboardAdvisorKnowledgeTopics,
  getDemoDashboardManualAssets,
  getDemoDashboardAdvisorRecommendations,
  getDemoDashboardAdvisorRuns,
  getDemoDashboardAdvisorSignals,
  getDemoDashboardAdvisorSpend,
  fetchDashboardDerivedRecomputeStatus,
  fetchDashboardNews,
  fetchDashboardSummary,
  fetchDashboardTransactions,
} from './dashboard-api'
import {
  getDemoAdvisorDecisionJournal,
  getDemoAdvisorPostMortems,
  getDemoTradingLabHypotheses,
} from './learning-loop-demo-data'
import type { AuthMode } from './auth-types'
import {
  getDemoDashboardDerivedRecomputeStatus,
  getDemoDashboardNews,
  getDemoDashboardSummary,
} from './demo-data'
import type { DashboardRange } from './dashboard-types'

export type DemoTransactionsScenario =
  | 'default'
  | 'empty'
  | 'subscriptions'
  | 'parse_error'
  | 'student_budget'
  | 'freelancer_cashflow'
  | 'family_planning'
  | 'retiree_stability'

export const dashboardQueryKeys = {
  all: ['dashboard'] as const,
  summary: (range: DashboardRange) => [...dashboardQueryKeys.all, 'summary', range] as const,
  derivedRecomputeStatus: () => [...dashboardQueryKeys.all, 'derived-recompute'] as const,
  news: (params?: {
    topic?: string
    source?: string
    sourceType?: string
    domain?: string
    eventType?: string
    minSeverity?: number
    region?: string
    ticker?: string
    sector?: string
    direction?: 'risk' | 'opportunity' | 'mixed'
    from?: string
    to?: string
    limit?: number
  }) =>
    [
      ...dashboardQueryKeys.all,
      'news',
      params?.topic ?? null,
      params?.source ?? null,
      params?.sourceType ?? null,
      params?.domain ?? null,
      params?.eventType ?? null,
      params?.minSeverity ?? null,
      params?.region ?? null,
      params?.ticker ?? null,
      params?.sector ?? null,
      params?.direction ?? null,
      params?.from ?? null,
      params?.to ?? null,
      params?.limit ?? 20,
    ] as const,
  advisor: (range: DashboardRange) => [...dashboardQueryKeys.all, 'advisor', range] as const,
  transactions: (params: {
    range: DashboardRange
    limit: number
    demoScenario?: DemoTransactionsScenario
    demoProfile?: string
  }) =>
    [
      ...dashboardQueryKeys.all,
      'transactions',
      params.range,
      params.limit,
      params.demoScenario ?? null,
      params.demoProfile ?? null,
    ] as const,
  advisorRecommendations: (limit: number) =>
    [...dashboardQueryKeys.all, 'advisor-recommendations', limit] as const,
  advisorAssumptions: (limit: number) =>
    [...dashboardQueryKeys.all, 'advisor-assumptions', limit] as const,
  advisorSignals: (limit: number) => [...dashboardQueryKeys.all, 'advisor-signals', limit] as const,
  advisorSpend: () => [...dashboardQueryKeys.all, 'advisor-spend'] as const,
  advisorRuns: (limit: number) => [...dashboardQueryKeys.all, 'advisor-runs', limit] as const,
  advisorKnowledgeTopics: () => [...dashboardQueryKeys.all, 'advisor-knowledge-topics'] as const,
  advisorManualOperationLatest: () =>
    [...dashboardQueryKeys.all, 'advisor-manual-operation', 'latest'] as const,
  advisorManualOperation: (operationId: string) =>
    [...dashboardQueryKeys.all, 'advisor-manual-operation', operationId] as const,
  advisorChat: (threadKey: string) => [...dashboardQueryKeys.all, 'advisor-chat', threadKey] as const,
  advisorEvals: () => [...dashboardQueryKeys.all, 'advisor-evals'] as const,
  // PR9 — keep separate from advisorEvals so trends can be invalidated independently if needed.
  advisorEvalsTrends: (windowDays?: number) =>
    windowDays !== undefined
      ? ([...dashboardQueryKeys.all, 'advisor-evals-trends', windowDays] as const)
      : ([...dashboardQueryKeys.all, 'advisor-evals-trends'] as const),
  // PR15A — Advisor Behavior Analytics. Keyed per windowDays so different windows can coexist
  // in the cache.
  advisorBehaviorAnalytics: (windowDays?: number) =>
    windowDays !== undefined
      ? ([...dashboardQueryKeys.all, 'advisor-behavior-analytics', windowDays] as const)
      : ([...dashboardQueryKeys.all, 'advisor-behavior-analytics'] as const),
  investmentStrategy: () => [...dashboardQueryKeys.all, 'investment-strategy'] as const,
  investmentPlanLatest: () => [...dashboardQueryKeys.all, 'investment-plan-latest'] as const,
  investmentStatus: () => [...dashboardQueryKeys.all, 'investment-status'] as const,
  investmentHypotheses: () => [...dashboardQueryKeys.all, 'investment-hypotheses'] as const,
  investmentScorecard: () => [...dashboardQueryKeys.all, 'investment-scorecard'] as const,
  investmentLessons: () => [...dashboardQueryKeys.all, 'investment-lessons'] as const,
  advisorAssetsSearch: (query: string) =>
    [...dashboardQueryKeys.all, 'advisor-assets-search', query] as const,
  advisorAssetWatchlist: () => [...dashboardQueryKeys.all, 'advisor-asset-watchlist'] as const,
  manualAssets: () => [...dashboardQueryKeys.all, 'manual-assets'] as const,
  // PR5 — Learning Loop surface query keys.
  advisorJournal: (params?: {
    limit?: number
    recommendationId?: number
    runId?: number
    decision?: 'accepted' | 'rejected' | 'deferred' | 'ignored'
  }) =>
    [
      ...dashboardQueryKeys.all,
      'advisor-journal',
      params?.limit ?? null,
      params?.recommendationId ?? null,
      params?.runId ?? null,
      params?.decision ?? null,
    ] as const,
  advisorPostMortems: () => [...dashboardQueryKeys.all, 'advisor-post-mortems'] as const,
  advisorPostMortem: (postMortemId: number) =>
    [...dashboardQueryKeys.all, 'advisor-post-mortem', postMortemId] as const,
  tradingLabHypotheses: () => [...dashboardQueryKeys.all, 'trading-lab-hypotheses'] as const,
  // PR12 — Strategy scorecards. Keyed per strategy id so each card can be invalidated
  // individually (e.g. after a backtest run completes for that strategy).
  tradingLabStrategyScorecard: (strategyId: number) =>
    [...dashboardQueryKeys.all, 'trading-lab-strategy-scorecard', strategyId] as const,
  tradingLabHypothesis: (id: number) =>
    [...dashboardQueryKeys.all, 'trading-lab-hypothesis', id] as const,
}

export const dashboardSummaryQueryOptions = (range: DashboardRange) =>
  dashboardSummaryQueryOptionsWithMode({
    range,
    mode: 'admin',
  })

export const dashboardNewsQueryOptionsWithMode = ({
  mode,
  topic,
  source,
  sourceType,
  domain,
  eventType,
  minSeverity,
  region,
  ticker,
  sector,
  direction,
  from,
  to,
  limit = 20,
}: {
  mode?: AuthMode
  topic?: string
  source?: string
  sourceType?: string
  domain?: string
  eventType?: string
  minSeverity?: number
  region?: string
  ticker?: string
  sector?: string
  direction?: 'risk' | 'opportunity' | 'mixed'
  from?: string
  to?: string
  limit?: number
}) => {
  const keyParams = {
    ...(topic ? { topic } : {}),
    ...(source ? { source } : {}),
    ...(sourceType ? { sourceType } : {}),
    ...(domain ? { domain } : {}),
    ...(eventType ? { eventType } : {}),
    ...(minSeverity !== undefined ? { minSeverity } : {}),
    ...(region ? { region } : {}),
    ...(ticker ? { ticker } : {}),
    ...(sector ? { sector } : {}),
    ...(direction ? { direction } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    limit,
  }

  return queryOptions({
    queryKey: dashboardQueryKeys.news(keyParams),
    queryFn: () => {
      if (mode === 'demo') {
        return getDemoDashboardNews()
      }

      return fetchDashboardNews(keyParams)
    },
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 30_000,
  })
}

export const dashboardSummaryQueryOptionsWithMode = ({
  range,
  mode,
}: {
  range: DashboardRange
  mode?: AuthMode
}) =>
  queryOptions({
    queryKey: dashboardQueryKeys.summary(range),
    queryFn: () => {
      if (mode === 'demo') {
        return getDemoDashboardSummary(range)
      }

      return fetchDashboardSummary(range)
    },
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 30_000,
  })

export const dashboardDerivedRecomputeStatusQueryOptionsWithMode = ({
  mode,
}: {
  mode?: AuthMode
} = {}) =>
  queryOptions({
    queryKey: dashboardQueryKeys.derivedRecomputeStatus(),
    queryFn: () => {
      if (mode === 'demo') {
        return getDemoDashboardDerivedRecomputeStatus()
      }

      return fetchDashboardDerivedRecomputeStatus()
    },
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 5_000,
    refetchInterval: query =>
      mode === 'admin' && query.state.data?.state === 'running' ? 3_000 : false,
  })


export const dashboardAdvisorQueryOptionsWithMode = ({
  range,
  mode,
}: {
  range: DashboardRange
  mode?: AuthMode
}) =>
  queryOptions({
    queryKey: dashboardQueryKeys.advisor(range),
    queryFn: () => {
      if (mode === 'demo') {
        return getDemoDashboardAdvisor(range)
      }

      return fetchDashboardAdvisor(range)
    },
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 15_000,
  })

export const dashboardAdvisorRecommendationsQueryOptionsWithMode = ({
  mode,
  range = '30d',
  limit = 12,
}: {
  mode?: AuthMode
  range?: DashboardRange
  limit?: number
}) =>
  queryOptions({
    queryKey: dashboardQueryKeys.advisorRecommendations(limit),
    queryFn: () => {
      if (mode === 'demo') {
        return getDemoDashboardAdvisorRecommendations(range)
      }

      return fetchDashboardAdvisorRecommendations(limit)
    },
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 15_000,
  })

export const dashboardAdvisorAssumptionsQueryOptionsWithMode = ({
  mode,
  limit = 24,
}: {
  mode?: AuthMode
  limit?: number
}) =>
  queryOptions({
    queryKey: dashboardQueryKeys.advisorAssumptions(limit),
    queryFn: () => {
      if (mode === 'demo') {
        return getDemoDashboardAdvisorAssumptions()
      }

      return fetchDashboardAdvisorAssumptions(limit)
    },
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 15_000,
  })

export const dashboardAdvisorSignalsQueryOptionsWithMode = ({
  mode,
  limit = 24,
}: {
  mode?: AuthMode
  limit?: number
}) =>
  queryOptions({
    queryKey: dashboardQueryKeys.advisorSignals(limit),
    queryFn: () => {
      if (mode === 'demo') {
        return getDemoDashboardAdvisorSignals()
      }

      return fetchDashboardAdvisorSignals(limit)
    },
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 15_000,
  })

export const dashboardAdvisorSpendQueryOptionsWithMode = ({
  mode,
}: {
  mode?: AuthMode
}) =>
  queryOptions({
    queryKey: dashboardQueryKeys.advisorSpend(),
    queryFn: () => {
      if (mode === 'demo') {
        return getDemoDashboardAdvisorSpend()
      }

      return fetchDashboardAdvisorSpend()
    },
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 15_000,
  })

export const dashboardAdvisorRunsQueryOptionsWithMode = ({
  mode,
  limit = 12,
}: {
  mode?: AuthMode
  limit?: number
}) =>
  queryOptions({
    queryKey: dashboardQueryKeys.advisorRuns(limit),
    queryFn: () => {
      if (mode === 'demo') {
        return getDemoDashboardAdvisorRuns()
      }

      return fetchDashboardAdvisorRuns(limit)
    },
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 10_000,
  })

export const dashboardAdvisorKnowledgeTopicsQueryOptionsWithMode = ({
  mode,
}: {
  mode?: AuthMode
}) =>
  queryOptions({
    queryKey: dashboardQueryKeys.advisorKnowledgeTopics(),
    queryFn: () => {
      if (mode === 'demo') {
        return getDemoDashboardAdvisorKnowledgeTopics()
      }

      return fetchDashboardAdvisorKnowledgeTopics()
    },
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 30_000,
  })

export const dashboardAdvisorManualOperationLatestQueryOptionsWithMode = ({
  mode,
}: {
  mode?: AuthMode
}) =>
  queryOptions({
    queryKey: dashboardQueryKeys.advisorManualOperationLatest(),
    queryFn: () => {
      if (mode === 'demo') {
        return null
      }

      return fetchDashboardAdvisorLatestManualOperation()
    },
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 0,
  })

export const dashboardAdvisorManualOperationQueryOptionsWithMode = ({
  mode,
  operationId,
}: {
  mode?: AuthMode
  operationId: string
}) =>
  queryOptions({
    queryKey: dashboardQueryKeys.advisorManualOperation(operationId),
    queryFn: () => {
      if (mode === 'demo') {
        return null
      }

      return fetchDashboardAdvisorManualOperationById(operationId)
    },
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 0,
  })

export const dashboardAdvisorChatQueryOptionsWithMode = ({
  mode,
  threadKey = 'default',
}: {
  mode?: AuthMode
  threadKey?: string
}) =>
  queryOptions({
    queryKey: dashboardQueryKeys.advisorChat(threadKey),
    queryFn: () => {
      if (mode === 'demo') {
        return getDemoDashboardAdvisorChat(threadKey)
      }

      return fetchDashboardAdvisorChat(threadKey)
    },
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 5_000,
  })

export const dashboardAdvisorEvalsQueryOptionsWithMode = ({
  mode,
}: {
  mode?: AuthMode
}) =>
  queryOptions({
    queryKey: dashboardQueryKeys.advisorEvals(),
    queryFn: () => {
      if (mode === 'demo') {
        return getDemoDashboardAdvisorEvals()
      }

      return fetchDashboardAdvisorEvals()
    },
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 30_000,
  })

// PR9 — Advisor Eval Trends. Flag-gated: when learningLoopEnabled is false, the query NEVER
// fires (consumers also gate the component, but `enabled` here is the second line of defence).
// Demo path returns deterministic fixtures; admin path hits the read-only trends endpoint.
export const dashboardAdvisorEvalsTrendsQueryOptionsWithMode = ({
  mode,
  learningLoopEnabled,
  windowDays,
}: {
  mode?: AuthMode
  learningLoopEnabled: boolean
  windowDays?: number
}) =>
  queryOptions({
    queryKey: dashboardQueryKeys.advisorEvalsTrends(windowDays),
    queryFn: () => {
      if (mode === 'demo') {
        return getDemoDashboardAdvisorEvalsTrends(windowDays)
      }
      return fetchDashboardAdvisorEvalsTrends(windowDays)
    },
    enabled: mode !== undefined && learningLoopEnabled,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 30_000,
    // Trends are enrichment, not load-bearing. Keep a single retry — if it fails, the UI
    // surfaces a degraded badge rather than blocking the scorecard.
    retry: 1,
  })

// PR15A — Advisor Behavior Analytics. Flag-gated; same enrichment-only retry posture as PR9
// trends so a transient backend failure surfaces an inline degraded note rather than blocking
// the rest of `/ia`.
export const dashboardAdvisorBehaviorAnalyticsQueryOptionsWithMode = ({
  mode,
  learningLoopEnabled,
  windowDays,
}: {
  mode?: AuthMode
  learningLoopEnabled: boolean
  windowDays?: number
}) =>
  queryOptions({
    queryKey: dashboardQueryKeys.advisorBehaviorAnalytics(windowDays),
    queryFn: () => {
      if (mode === 'demo') {
        return getDemoDashboardAdvisorBehaviorAnalytics(windowDays)
      }
      return fetchDashboardAdvisorBehaviorAnalytics(windowDays)
    },
    enabled: mode !== undefined && learningLoopEnabled,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 30_000,
    retry: 1,
  })

export const dashboardInvestmentStrategyQueryOptionsWithMode = ({
  mode,
}: {
  mode?: AuthMode
}) =>
  queryOptions({
    queryKey: dashboardQueryKeys.investmentStrategy(),
    queryFn: fetchDashboardInvestmentStrategy,
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 30_000,
  })

export const dashboardAdvisorAssetsSearchQueryOptionsWithMode = ({
  mode,
  query,
}: {
  mode?: AuthMode
  query: string
}) =>
  queryOptions({
    queryKey: dashboardQueryKeys.advisorAssetsSearch(query),
    queryFn: () => fetchDashboardAdvisorAssetsSearch(query),
    enabled: mode !== undefined && query.trim().length > 0,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 20_000,
  })

export const dashboardAdvisorAssetWatchlistQueryOptionsWithMode = ({
  mode,
}: {
  mode?: AuthMode
}) =>
  queryOptions({
    queryKey: dashboardQueryKeys.advisorAssetWatchlist(),
    queryFn: fetchDashboardAdvisorAssetWatchlist,
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 15_000,
  })

export const dashboardInvestmentPlanLatestQueryOptionsWithMode = ({
  mode,
}: {
  mode?: AuthMode
}) =>
  queryOptions({
    queryKey: dashboardQueryKeys.investmentPlanLatest(),
    queryFn: fetchDashboardInvestmentPlanLatest,
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 15_000,
  })

export const dashboardInvestmentStatusQueryOptionsWithMode = ({
  mode,
}: {
  mode?: AuthMode
}) =>
  queryOptions({
    queryKey: dashboardQueryKeys.investmentStatus(),
    queryFn: fetchDashboardInvestmentStatus,
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 15_000,
  })

export const dashboardInvestmentHypothesesQueryOptionsWithMode = ({
  mode,
}: {
  mode?: AuthMode
}) =>
  queryOptions({
    queryKey: dashboardQueryKeys.investmentHypotheses(),
    queryFn: fetchDashboardInvestmentHypotheses,
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 30_000,
  })

export const dashboardInvestmentScorecardQueryOptionsWithMode = ({
  mode,
}: {
  mode?: AuthMode
}) =>
  queryOptions({
    queryKey: dashboardQueryKeys.investmentScorecard(),
    queryFn: fetchDashboardInvestmentScorecard,
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 30_000,
  })

export const dashboardInvestmentLessonsQueryOptionsWithMode = ({
  mode,
}: {
  mode?: AuthMode
}) =>
  queryOptions({
    queryKey: dashboardQueryKeys.investmentLessons(),
    queryFn: fetchDashboardInvestmentLessons,
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 30_000,
  })

export const dashboardManualAssetsQueryOptionsWithMode = ({
  mode,
}: {
  mode?: AuthMode
}) =>
  queryOptions({
    queryKey: dashboardQueryKeys.manualAssets(),
    queryFn: () => {
      if (mode === 'demo') {
        return getDemoDashboardManualAssets()
      }

      return fetchDashboardManualAssets()
    },
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 5_000,
  })

export const dashboardTransactionsInfiniteQueryOptions = (params: {
  range: DashboardRange
  limit: number
}) =>
  dashboardTransactionsInfiniteQueryOptionsWithMode({
    ...params,
    mode: 'admin',
  })

export const dashboardTransactionsInfiniteQueryOptionsWithMode = (params: {
  range: DashboardRange
  limit: number
  mode?: AuthMode
  demoScenario?: DemoTransactionsScenario
  demoProfile?: string
}) =>
  infiniteQueryOptions({
    queryKey: dashboardQueryKeys.transactions(params),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      const transactionParams = {
        range: params.range,
        limit: params.limit,
        ...(pageParam ? { cursor: pageParam } : {}),
      }

      return fetchDashboardTransactions({
        ...transactionParams,
        ...(params.mode === 'demo' && params.demoScenario
          ? { demoScenario: params.demoScenario }
          : {}),
        ...(params.mode === 'demo' && params.demoProfile ? { demoProfile: params.demoProfile } : {}),
      })
    },
    enabled: params.mode !== undefined,
    getNextPageParam: lastPage => lastPage.nextCursor ?? undefined,
    staleTime: params.mode === 'demo' ? Number.POSITIVE_INFINITY : 15_000,
  })

// ----------------------------------------------------------------------------------------------
// PR5 — Advisor Learning Loop query options.
//
// Mode-aware: demo branches use deterministic fixtures; admin branches hit the API. All read
// helpers stay short staleTime; mutations live in dashboard-api.ts and the components that call
// them invalidate via `LEARNING_LOOP_INVALIDATION_KEYS` below.
// ----------------------------------------------------------------------------------------------

export const dashboardAdvisorJournalQueryOptionsWithMode = ({
  mode,
  limit,
  recommendationId,
  runId,
  decision,
}: {
  mode?: AuthMode
  limit?: number
  recommendationId?: number
  runId?: number
  decision?: 'accepted' | 'rejected' | 'deferred' | 'ignored'
}) =>
  queryOptions({
    queryKey: dashboardQueryKeys.advisorJournal({
      ...(limit !== undefined ? { limit } : {}),
      ...(recommendationId !== undefined ? { recommendationId } : {}),
      ...(runId !== undefined ? { runId } : {}),
      ...(decision ? { decision } : {}),
    }),
    queryFn: () => {
      if (mode === 'demo') {
        return getDemoAdvisorDecisionJournal()
      }
      return fetchAdvisorDecisionJournal({
        ...(limit !== undefined ? { limit } : {}),
        ...(recommendationId !== undefined ? { recommendationId } : {}),
        ...(runId !== undefined ? { runId } : {}),
        ...(decision ? { decision } : {}),
      })
    },
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 10_000,
  })

export const dashboardAdvisorPostMortemsQueryOptionsWithMode = ({
  mode,
}: {
  mode?: AuthMode
}) =>
  queryOptions({
    queryKey: dashboardQueryKeys.advisorPostMortems(),
    queryFn: () => {
      if (mode === 'demo') {
        return getDemoAdvisorPostMortems()
      }
      return fetchAdvisorPostMortems()
    },
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 30_000,
  })

export const dashboardTradingLabHypothesesQueryOptionsWithMode = ({
  mode,
}: {
  mode?: AuthMode
}) =>
  queryOptions({
    queryKey: dashboardQueryKeys.tradingLabHypotheses(),
    queryFn: () => {
      if (mode === 'demo') {
        return getDemoTradingLabHypotheses()
      }
      return fetchTradingLabHypotheses()
    },
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 30_000,
  })

// PR12 — Strategy Scorecard query options. Flag-gated by the same Learning Loop UI flag as
// the rest of the train: when the flag is off, the query NEVER fires (`enabled: false`).
export const dashboardTradingLabStrategyScorecardQueryOptionsWithMode = ({
  mode,
  strategyId,
  learningLoopEnabled,
}: {
  mode?: AuthMode
  strategyId: number
  learningLoopEnabled: boolean
}) =>
  queryOptions({
    queryKey: dashboardQueryKeys.tradingLabStrategyScorecard(strategyId),
    queryFn: () => {
      if (mode === 'demo') {
        return getDemoTradingLabStrategyScorecard(strategyId)
      }
      return fetchTradingLabStrategyScorecard(strategyId)
    },
    enabled:
      mode !== undefined && learningLoopEnabled && Number.isFinite(strategyId) && strategyId > 0,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 30_000,
    // Scorecard is enrichment, not load-bearing. One retry only — on persistent failure the UI
    // surfaces an inline degraded note rather than blocking the hypothesis row.
    retry: 1,
  })

export const dashboardTradingLabHypothesisQueryOptionsWithMode = ({
  mode,
  id,
}: {
  mode?: AuthMode
  id: number
}) =>
  queryOptions({
    queryKey: dashboardQueryKeys.tradingLabHypothesis(id),
    queryFn: () => {
      if (mode === 'demo') {
        const fixture = getDemoTradingLabHypotheses()
        const found = fixture.hypotheses.find(h => h.id === id)
        if (!found) {
          throw new Error('Hypothesis not found in demo fixtures')
        }
        return { ok: true, hypothesis: found }
      }
      return fetchTradingLabHypothesisById(id)
    },
    enabled: mode !== undefined && Number.isFinite(id),
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 30_000,
  })

// Centralized list of partial query-key prefixes to invalidate after a learning-loop mutation.
// React Query's `invalidateQueries({ queryKey })` invalidates by prefix match, so these short
// arrays cover every variant (with or without filters) of the matching query.
export const LEARNING_LOOP_INVALIDATION_KEYS = {
  afterDecisionJournal: () => [
    [...dashboardQueryKeys.all, 'advisor-journal'] as const,
    [...dashboardQueryKeys.all, 'advisor-recommendations'] as const,
    // PR15A — new journal entries shift the analytics window aggregates.
    [...dashboardQueryKeys.all, 'advisor-behavior-analytics'] as const,
  ],
  afterDecisionOutcome: () => [
    [...dashboardQueryKeys.all, 'advisor-journal'] as const,
    // PR15A — outcome creation can change reason-code aggregation + outcome coverage.
    [...dashboardQueryKeys.all, 'advisor-behavior-analytics'] as const,
  ],
  afterHypothesisChange: () => [
    [...dashboardQueryKeys.all, 'trading-lab-hypotheses'] as const,
    [...dashboardQueryKeys.all, 'trading-lab-hypothesis'] as const,
    // PR12 — scorecards aggregate across hypothesis state; a new hypothesis or
    // archive transition can change the grade.
    [...dashboardQueryKeys.all, 'trading-lab-strategy-scorecard'] as const,
  ],
  afterPostMortemRun: () => [
    [...dashboardQueryKeys.all, 'advisor-post-mortems'] as const,
    [...dashboardQueryKeys.all, 'advisor-evals'] as const,
    [...dashboardQueryKeys.all, 'advisor-evals-trends'] as const,
  ],
  // PR9 — fire after a manual evals run completes so the trends scorecard refetches.
  afterAdvisorEvalsRun: () => [
    [...dashboardQueryKeys.all, 'advisor-evals'] as const,
    [...dashboardQueryKeys.all, 'advisor-evals-trends'] as const,
  ],
} as const
