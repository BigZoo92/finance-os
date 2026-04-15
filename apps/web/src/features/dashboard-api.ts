import { apiFetch, apiRequest, ApiRequestError } from '@/lib/api'
import { getDemoDashboardNews, getDemoDashboardSummary, getDemoDashboardTransactions } from './demo-data'
import type {
  DashboardAdvisorAssumptionsResponse,
  DashboardAdvisorChatPostResponse,
  DashboardAdvisorChatThreadResponse,
  DashboardAdvisorEvalsResponse,
  DashboardAdvisorManualOperationResponse,
  DashboardAdvisorManualRefreshAndRunPostResponse,
  DashboardAdvisorOverviewResponse,
  DashboardAdvisorRecommendationsResponse,
  DashboardAdvisorRunDailyResponse,
  DashboardAdvisorRunsResponse,
  DashboardAdvisorSignalsResponse,
  DashboardAdvisorSpendAnalyticsResponse,
  DashboardDerivedRecomputeActionError,
  DashboardManualAssetResponse,
  DashboardManualAssetsResponse,
  DashboardNewsResponse,
  DashboardRange,
  DashboardDerivedRecomputeStatusResponse,
  DashboardSummaryResponse,
  DashboardTransactionsResponse,
} from './dashboard-types'

const toSearchParams = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) {
      continue
    }

    search.set(key, String(value))
  }

  return search.toString()
}

export const fetchDashboardNews = async (params?: {
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
  const query = toSearchParams({
    topic: params?.topic,
    source: params?.source,
    sourceType: params?.sourceType,
    domain: params?.domain,
    eventType: params?.eventType,
    minSeverity: params?.minSeverity,
    region: params?.region,
    ticker: params?.ticker,
    sector: params?.sector,
    direction: params?.direction,
    from: params?.from,
    to: params?.to,
    limit: params?.limit,
  })

  try {
    return await apiFetch<DashboardNewsResponse>(
      `/dashboard/news${query.length > 0 ? `?${query}` : ''}`
    )
  } catch (error) {
    if (error instanceof ApiRequestError) {
      if (
        error.status === 'network_error' ||
        error.status === 401 ||
        error.status === 403 ||
        error.status === 404 ||
        error.status >= 500
      ) {
        return getDemoDashboardNews()
      }
    }

    return getDemoDashboardNews()
  }
}

export const postDashboardNewsIngest = async () => {
  return apiFetch<{
    ok: boolean
    requestId: string
    fetchedCount: number
    insertedCount: number
    mergedCount: number
    dedupeDropCount: number
  }>('/dashboard/news/ingest', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      trigger: 'manual',
    }),
  })
}

export const fetchDashboardSummary = async (range: DashboardRange) => {
  const query = toSearchParams({ range })

  try {
    return await apiFetch<DashboardSummaryResponse>(`/dashboard/summary?${query}`)
  } catch (error) {
    if (error instanceof ApiRequestError) {
      if (
        error.status === 'network_error' ||
        error.status === 401 ||
        error.status === 403 ||
        error.status === 404 ||
        error.status >= 500
      ) {
        return getDemoDashboardSummary(range)
      }
    }

    return getDemoDashboardSummary(range)
  }
}

export const fetchDashboardTransactions = async (params: {
  range: DashboardRange
  limit: number
  cursor?: string
  demoScenario?:
    | 'default'
    | 'empty'
    | 'subscriptions'
    | 'parse_error'
    | 'student_budget'
    | 'freelancer_cashflow'
    | 'family_planning'
    | 'retiree_stability'
  demoProfile?: string
}) => {
  const requestParams = {
    range: params.range,
    limit: params.limit,
    ...(params.cursor ? { cursor: params.cursor } : {}),
    ...(params.demoScenario ? { demoScenario: params.demoScenario } : {}),
    ...(params.demoProfile ? { demoProfile: params.demoProfile } : {}),
  }
  const query = toSearchParams(requestParams)

  try {
    return await apiFetch<DashboardTransactionsResponse>(`/dashboard/transactions?${query}`)
  } catch (error) {
    if (error instanceof ApiRequestError) {
      if (
        error.status === 'network_error' ||
        error.status === 401 ||
        error.status === 403 ||
        error.status === 404 ||
        error.status >= 500
      ) {
        return getDemoDashboardTransactions(requestParams)
      }
    }

    return getDemoDashboardTransactions(requestParams)
  }
}


const DEMO_ADVISOR_GENERATED_AT = '2026-04-14T08:00:00.000Z'

export const getDemoDashboardAdvisor = (range: DashboardRange): DashboardAdvisorOverviewResponse => {
  const summary = getDemoDashboardSummary(range)
  const net = summary.totals.incomes - summary.totals.expenses

  return {
    mode: 'demo',
    source: 'demo_fixture',
    requestId: 'demo-advisor-request',
    generatedAt: DEMO_ADVISOR_GENERATED_AT,
    status: 'ready',
    degradedMessage: 'Mode demo: artefacts deterministes, aucune requete provider.',
    latestRun: null,
    brief: {
      id: 1,
      runId: 0,
      title: net >= 0 ? 'Cashflow positif en demo' : 'Cashflow sous tension en demo',
      summary:
        net >= 0
          ? 'Le jeu de donnees demo montre une marge positive et un besoin principal de mieux allouer le cash.'
          : 'Le jeu de donnees demo montre une marge contrainte: priorite a la reduction des depenses variables.',
      keyFacts: [
        `Cashflow net estime: ${Math.round(net)} EUR`,
        `Depenses periode: ${Math.round(summary.totals.expenses)} EUR`,
      ],
      opportunities: ['Automatiser une allocation mensuelle', 'Revoir le poste de depense principal'],
      risks: ['Cash drag si trop de liquidites', 'Marge insuffisante si les depenses remontent'],
      watchItems: ['Mettre a jour le snapshot admin pour artefacts reels'],
      recommendationNotes: [],
      provider: null,
      model: null,
      createdAt: DEMO_ADVISOR_GENERATED_AT,
    },
    topRecommendations: [
      {
        id: 1,
        runId: 0,
        recommendationKey: 'demo-cash-optimization',
        type: 'allocation',
        category: 'cash_optimization',
        title: 'Reduire le cash qui dort',
        description: 'Le mode demo suggere un arbitrage progressif du cash excedentaire.',
        whyNow: 'Le cash drag penalise le rendement reel sur longue duree.',
        evidence: [
          `Balance totale: ${Math.round(summary.totals.balance)} EUR`,
          `Cashflow net: ${Math.round(net)} EUR`,
        ],
        assumptions: ['Scenario demo uniquement', 'Pas de provider live'],
        confidence: 0.66,
        riskLevel: 'low',
        expectedImpact: {
          summary: 'Amelioration graduelle du rendement attendu',
          value: 1.1,
          unit: 'pct',
        },
        effort: 'low',
        reversibility: 'high',
        blockingFactors: [],
        alternatives: ['DCA mensuel', 'Renforcer le fonds d urgence'],
        deterministicMetricsUsed: ['totals.balance', 'totals.incomes', 'totals.expenses'],
        llmModelsUsed: [],
        challengerStatus: 'skipped',
        priorityScore: 72,
        expiresAt: null,
        createdAt: DEMO_ADVISOR_GENERATED_AT,
        challenge: null,
      },
      {
        id: 2,
        runId: 0,
        recommendationKey: 'demo-spend-review',
        type: 'spend_review',
        category: 'spend_reduction',
        title: 'Revoir le principal poste variable',
        description: 'Le mode demo conseille une baisse progressive du premier poste variable.',
        whyNow: 'C est l action la plus reversible si la marge se tend.',
        evidence: [`Top depenses detectees: ${summary.topExpenseGroups.length}`],
        assumptions: ['Pas de clustering marchand live'],
        confidence: 0.61,
        riskLevel: 'low',
        expectedImpact: {
          summary: 'Baisse potentielle des depenses mensuelles',
          value: 60,
          unit: 'eur_per_month',
        },
        effort: 'medium',
        reversibility: 'high',
        blockingFactors: [],
        alternatives: ['Renegocier les abonnements'],
        deterministicMetricsUsed: ['topExpenseGroups'],
        llmModelsUsed: [],
        challengerStatus: 'skipped',
        priorityScore: 64,
        expiresAt: null,
        createdAt: DEMO_ADVISOR_GENERATED_AT,
        challenge: null,
      },
    ],
    snapshot: {
      id: 1,
      runId: 0,
      asOfDate: DEMO_ADVISOR_GENERATED_AT.slice(0, 10),
      range,
      currency: 'EUR',
      riskProfile: 'balanced',
      metrics: {
        totalValue: summary.totals.balance,
        netMonthlyCashflow: net,
        cashAllocationPct: 24,
        expectedAnnualReturnPct: 5.2,
        diversificationScore: 63,
      },
      allocationBuckets: [],
      assetClassAllocations: [],
      driftSignals: [],
      scenarios: [],
      diagnostics: {},
    },
    spend: {
      dailyUsdSpent: 0,
      monthlyUsdSpent: 0,
      dailyBudgetUsd: 2,
      monthlyBudgetUsd: 40,
      challengerAllowed: true,
      deepAnalysisAllowed: true,
      blocked: false,
      reasons: [],
    },
    signalCounts: {
      macro: 0,
      news: 0,
    },
    assumptionCount: 2,
    chatEnabled: true,
  }
}

export const getDemoDashboardAdvisorRecommendations = (
  range: DashboardRange
): DashboardAdvisorRecommendationsResponse => ({
  items: getDemoDashboardAdvisor(range).topRecommendations,
})

export const getDemoDashboardAdvisorAssumptions = (): DashboardAdvisorAssumptionsResponse => ({
  items: [
    {
      id: 1,
      runId: 0,
      assumptionKey: 'demo_inflation',
      source: 'default',
      value: 2.5,
      justification: 'Hypothese demo prudente pour les projections reelles.',
      createdAt: DEMO_ADVISOR_GENERATED_AT,
    },
    {
      id: 2,
      runId: 0,
      assumptionKey: 'demo_cash_rate',
      source: 'default',
      value: 1.75,
      justification: 'Reference demo pour illustrer le cash drag.',
      createdAt: DEMO_ADVISOR_GENERATED_AT,
    },
  ],
})

export const getDemoDashboardAdvisorSignals = (): DashboardAdvisorSignalsResponse => ({
  macroSignals: [],
  newsSignals: [],
})

export const getDemoDashboardAdvisorSpend = (): DashboardAdvisorSpendAnalyticsResponse => ({
  summary: getDemoDashboardAdvisor('30d').spend,
  daily: [],
  byFeature: [],
  byModel: [],
  anomalies: [],
})

export const getDemoDashboardAdvisorRuns = (): DashboardAdvisorRunsResponse => ({
  items: [],
})

export const getDemoDashboardAdvisorChat = (
  threadKey = 'demo-thread'
): DashboardAdvisorChatThreadResponse => ({
  threadId: threadKey,
  title: 'Finance Assistant',
  messages: [],
})

export const getDemoDashboardAdvisorEvals = (): DashboardAdvisorEvalsResponse => ({
  cases: [],
  latestRun: null,
})

export const getDemoDashboardManualAssets = (): DashboardManualAssetsResponse => {
  const summary = getDemoDashboardSummary('30d')
  return {
    items: summary.assets
      .filter(asset => asset.origin === 'manual')
      .map(asset => ({
        assetId: asset.assetId,
        type: asset.type,
        origin: asset.origin,
        source: asset.source,
        name: asset.name,
        currency: asset.currency,
        valuation: asset.valuation,
        valuationAsOf: asset.valuationAsOf,
        enabled: asset.enabled,
        note:
          asset.metadata && typeof asset.metadata.note === 'string' ? asset.metadata.note : null,
        category:
          asset.metadata && typeof asset.metadata.category === 'string'
            ? asset.metadata.category
            : null,
        metadata: asset.metadata,
        createdAt: DEMO_ADVISOR_GENERATED_AT,
        updatedAt: DEMO_ADVISOR_GENERATED_AT,
      })),
  }
}

export const fetchDashboardAdvisor = async (range: DashboardRange) => {
  const query = toSearchParams({ range })
  return apiFetch<DashboardAdvisorOverviewResponse>(`/dashboard/advisor?${query}`)
}

export const fetchDashboardAdvisorRecommendations = async (limit = 12) => {
  const query = toSearchParams({ limit })
  return apiFetch<DashboardAdvisorRecommendationsResponse>(
    `/dashboard/advisor/recommendations?${query}`
  )
}

export const fetchDashboardAdvisorAssumptions = async (limit = 24) => {
  const query = toSearchParams({ limit })
  return apiFetch<DashboardAdvisorAssumptionsResponse>(`/dashboard/advisor/assumptions?${query}`)
}

export const fetchDashboardAdvisorSignals = async (limit = 24) => {
  const query = toSearchParams({ limit })
  return apiFetch<DashboardAdvisorSignalsResponse>(`/dashboard/advisor/signals?${query}`)
}

export const fetchDashboardAdvisorSpend = async () => {
  return apiFetch<DashboardAdvisorSpendAnalyticsResponse>('/dashboard/advisor/spend')
}

export const fetchDashboardAdvisorRuns = async (limit = 12) => {
  const query = toSearchParams({ limit })
  return apiFetch<DashboardAdvisorRunsResponse>(`/dashboard/advisor/runs?${query}`)
}

export const fetchDashboardAdvisorLatestManualOperation = async () => {
  return apiFetch<DashboardAdvisorManualOperationResponse | null>(
    '/dashboard/advisor/manual-refresh-and-run'
  )
}

export const fetchDashboardAdvisorManualOperationById = async (operationId: string) => {
  return apiFetch<DashboardAdvisorManualOperationResponse>(
    `/dashboard/advisor/manual-refresh-and-run/${operationId}`
  )
}

export const fetchDashboardAdvisorChat = async (threadKey = 'default') => {
  const query = toSearchParams({ threadKey })
  return apiFetch<DashboardAdvisorChatThreadResponse>(`/dashboard/advisor/chat?${query}`)
}

export const fetchDashboardAdvisorEvals = async () => {
  return apiFetch<DashboardAdvisorEvalsResponse>('/dashboard/advisor/evals')
}

export const postDashboardAdvisorRunDaily = async () => {
  return apiFetch<DashboardAdvisorRunDailyResponse>('/dashboard/advisor/run-daily', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      trigger: 'manual',
    }),
  })
}

export const postDashboardAdvisorManualRefreshAndRun = async () => {
  return apiFetch<DashboardAdvisorManualRefreshAndRunPostResponse>(
    '/dashboard/advisor/manual-refresh-and-run',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
    }
  )
}

export const postDashboardAdvisorChat = async (params: {
  threadKey?: string
  message: string
}) => {
  return apiFetch<DashboardAdvisorChatPostResponse>('/dashboard/advisor/chat', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      ...(params.threadKey ? { threadKey: params.threadKey } : {}),
      message: params.message,
    }),
  })
}

export const fetchDashboardManualAssets = async () => {
  return apiFetch<DashboardManualAssetsResponse>('/dashboard/manual-assets')
}

export const postDashboardManualAsset = async (input: {
  assetType: 'cash' | 'investment' | 'manual'
  name: string
  currency: string
  valuation: number
  valuationAsOf: string | null
  note: string | null
  category: string | null
  enabled: boolean
}) => {
  return apiFetch<DashboardManualAssetResponse>('/dashboard/manual-assets', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(input),
  })
}

export const patchDashboardManualAsset = async (params: {
  assetId: number
  assetType: 'cash' | 'investment' | 'manual'
  name: string
  currency: string
  valuation: number
  valuationAsOf: string | null
  note: string | null
  category: string | null
  enabled: boolean
}) => {
  return apiFetch<DashboardManualAssetResponse>(`/dashboard/manual-assets/${params.assetId}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      assetType: params.assetType,
      name: params.name,
      currency: params.currency,
      valuation: params.valuation,
      valuationAsOf: params.valuationAsOf,
      note: params.note,
      category: params.category,
      enabled: params.enabled,
    }),
  })
}

export const deleteDashboardManualAsset = async (assetId: number) => {
  return apiFetch<{ ok: boolean; requestId: string; assetId: number }>(
    `/dashboard/manual-assets/${assetId}`,
    {
      method: 'DELETE',
    }
  )
}

export const patchTransactionClassification = async (params: {
  transactionId: number
  category: string | null
  subcategory: string | null
  incomeType: 'salary' | 'recurring' | 'exceptional' | null
  tags: string[]
}) => {
  return apiFetch<DashboardTransactionsResponse['items'][number]>(
    `/dashboard/transactions/${params.transactionId}/classification`,
    {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        category: params.category,
        subcategory: params.subcategory,
        incomeType: params.incomeType,
        tags: params.tags,
      }),
    }
  )
}

const readOnlineState = () => {
  if (typeof navigator === 'undefined') {
    return true
  }

  return typeof navigator.onLine === 'boolean' ? navigator.onLine : true
}

export const normalizeDashboardDerivedRecomputeActionError = (
  value: unknown
): DashboardDerivedRecomputeActionError => {
  const offline = !readOnlineState()

  if (value instanceof ApiRequestError) {
    const retryable =
      value.status === 'network_error' ||
      value.status === 408 ||
      value.status === 409 ||
      value.status === 429 ||
      (typeof value.status === 'number' && value.status >= 500)

    return {
      message: value.message,
      ...(value.code ? { code: value.code } : {}),
      ...(value.requestId ? { requestId: value.requestId } : {}),
      retryable,
      offline: offline || value.status === 'network_error',
    }
  }

  if (value instanceof Error) {
    return {
      message: value.message,
      retryable: false,
      offline,
    }
  }

  return {
    message: String(value),
    retryable: false,
    offline,
  }
}

const createDashboardDerivedRecomputeRequestId = () => {
  return `derived-recompute-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export const fetchDashboardDerivedRecomputeStatus = async () => {
  return apiFetch<DashboardDerivedRecomputeStatusResponse>('/dashboard/derived-recompute')
}

export const postDashboardDerivedRecompute = async () => {
  const requestId = createDashboardDerivedRecomputeRequestId()
  const result = await apiRequest<DashboardDerivedRecomputeStatusResponse>(
    '/dashboard/derived-recompute',
    {
      method: 'POST',
      headers: {
        'x-request-id': requestId,
      },
    }
  )

  if (!result.ok) {
    throw result.error
  }

  return result.data
}
