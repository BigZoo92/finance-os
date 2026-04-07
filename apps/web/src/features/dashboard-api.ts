import { apiFetch, apiRequest, ApiRequestError } from '@/lib/api'
import { getDemoDashboardNews, getDemoDashboardSummary, getDemoDashboardTransactions } from './demo-data'
import type {
  DashboardDerivedRecomputeActionError,
  DashboardNewsResponse,
  DashboardRange,
  DashboardDerivedRecomputeStatusResponse,
  DashboardSummaryResponse,
  DashboardTransactionsResponse,
  DashboardAdvisorResponse,
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
  limit?: number
}) => {
  const query = toSearchParams({
    topic: params?.topic,
    source: params?.source,
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


export const getDemoDashboardAdvisor = (range: DashboardRange): DashboardAdvisorResponse => {
  const summary = getDemoDashboardSummary(range)
  const net = summary.totals.incomes - summary.totals.expenses

  return {
    mode: 'demo',
    source: 'local',
    fallback: false,
    fallbackReason: null,
    requestId: 'demo-advisor-request',
    generatedAt: '2026-04-06T09:00:00.000Z',
    dataStatus: {
      mode: 'sufficient',
      message: null,
    },
    metrics: {
      latencyMs: 4,
      fallbackRate: 0,
      errorRate: 0,
      insightAcceptedRate: 0,
    },
    insights: [
      {
        id: 'demo-cashflow',
        title: net >= 0 ? 'Cashflow positif' : 'Cashflow negatif',
        detail:
          net >= 0
            ? 'Le cockpit demo montre une marge positive sur la periode.'
            : 'Le cockpit demo montre un deficit temporaire sur la periode.',
        severity: net >= 0 ? 'info' : 'warning',
        citations: [
          { id: 'totals.incomes', label: 'Revenus periode', value: `${Math.round(summary.totals.incomes)}` },
          { id: 'totals.expenses', label: 'Depenses periode', value: `${Math.round(summary.totals.expenses)}` },
        ],
      },
      {
        id: 'demo-expense',
        title: 'Conseil generique',
        detail: 'Revoyez vos 3 principaux postes de depense avant tout arbitrage.',
        severity: 'info',
        citations: [{ id: 'topExpenseGroups', label: 'Top depenses detectees', value: `${summary.topExpenseGroups.length}` }],
      },
    ],
    actions: [
      {
        id: 'demo-action-cap-variable',
        title: 'Limiter un poste variable de 10%',
        detail: 'Choisissez un poste non essentiel et fixez un plafond hebdomadaire visible.',
        estimatedMonthlyImpact: 60,
        effort: 'medium',
        tracking: {
          status: 'suggested',
          metricLabel: 'Depense variable mensuelle',
          targetLabel: '-10% sur 30 jours',
          currentLabel: 'Baseline demo: 620',
        },
        citations: [
          { id: 'totals.expenses', label: 'Depenses mensuelles (baseline)', value: `${Math.round(summary.totals.expenses)}` },
        ],
      },
      {
        id: 'demo-action-safety-transfer',
        title: 'Activer un virement reserve hebdomadaire',
        detail: 'Automatisez un petit montant chaque semaine pour securiser la tresorerie.',
        estimatedMonthlyImpact: 40,
        effort: 'low',
        tracking: {
          status: 'suggested',
          metricLabel: 'Reserve de securite',
          targetLabel: '4 virements/mois',
          currentLabel: '0/4 effectue',
        },
        citations: [{ id: 'totals.netCashflow', label: 'Marge mensuelle estimee', value: `${Math.round(net)}` }],
      },
    ],
  }
}

export const fetchDashboardAdvisor = async (range: DashboardRange) => {
  const query = toSearchParams({ range })

  try {
    return await apiFetch<DashboardAdvisorResponse>(`/dashboard/advisor?${query}`)
  } catch {
    return getDemoDashboardAdvisor(range)
  }
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
