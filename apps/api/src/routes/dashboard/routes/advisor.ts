import { Elysia } from 'elysia'
import { getAuth, getRequestMeta } from '../../../auth/context'
import { logApiEvent, toErrorLogFields } from '../../../observability/logger'
import { getDashboardSummaryMock } from '../../../mocks/dashboardSummary.mock'
import { getDashboardRuntime } from '../context'
import { dashboardSummaryQuerySchema } from '../schemas'
import type { DashboardAdvisorInsight, DashboardAdvisorResponse, DashboardSummaryResponse } from '../types'

const buildLocalInsights = (summary: DashboardSummaryResponse): DashboardAdvisorInsight[] => {
  const net = summary.totals.incomes - summary.totals.expenses
  const spendRatio = summary.totals.incomes > 0 ? summary.totals.expenses / summary.totals.incomes : 1

  const trendInsight: DashboardAdvisorInsight =
    net >= 0
      ? {
          id: 'local-cashflow-positive',
          title: 'Cashflow positif sur la periode',
          detail: `Vos revenus depassent les depenses de ${Math.round(net)}. Gardez ce rythme avec une epargne automatique.`,
          severity: 'info',
        }
      : {
          id: 'local-cashflow-negative',
          title: 'Cashflow negatif detecte',
          detail: `Les depenses depassent les revenus de ${Math.round(Math.abs(net))}. Reduisez une categorie variable cette semaine.`,
          severity: 'warning',
        }

  const ratioInsight: DashboardAdvisorInsight =
    spendRatio > 0.9
      ? {
          id: 'local-spend-ratio-high',
          title: 'Ratio depenses/revenus eleve',
          detail: 'Objectif indicatif: rester sous 85% pour absorber les imprévus.',
          severity: 'warning',
        }
      : {
          id: 'local-spend-ratio-healthy',
          title: 'Ratio depenses/revenus maitrise',
          detail: 'Votre marge actuelle laisse de la place pour une reserve de securite.',
          severity: 'info',
        }

  const topExpense = summary.topExpenseGroups[0]
  const expenseInsight: DashboardAdvisorInsight = topExpense
    ? {
        id: 'local-top-expense',
        title: `Focus depense: ${topExpense.label}`,
        detail: `Poste principal sur la periode: ${Math.round(topExpense.total)} sur ${topExpense.count} transactions.`,
        severity: 'info',
      }
    : {
        id: 'local-empty-expenses',
        title: 'Aucune depense exploitable',
        detail: 'Aucune donnee depense n\'a ete detectee sur la periode selectionnee.',
        severity: 'warning',
      }

  return [trendInsight, ratioInsight, expenseInsight]
}

const shouldDisableAdvisor = () => {
  const value = process.env.AI_ADVISOR_ENABLED
  return value === '0' || value === 'false'
}

const shouldRestrictToAdmin = () => {
  const value = process.env.AI_ADVISOR_ADMIN_ONLY
  return value === '1' || value === 'true'
}

const shouldForceLocalOnly = () => {
  const value = process.env.AI_ADVISOR_FORCE_LOCAL_ONLY
  return value === '1' || value === 'true'
}

export const createAdvisorRoute = () =>
  new Elysia().get(
    '/advisor',
    async context => {
      const auth = getAuth(context)
      const requestMeta = getRequestMeta(context)
      const range = context.query.range ?? '30d'
      const startedAt = Date.now()

      logApiEvent({
        level: 'info',
        msg: 'advisor_request',
        requestId: requestMeta.requestId,
        auth_mode: auth.mode,
        range,
      })

      if (shouldDisableAdvisor()) {
        context.set.status = 503
        return {
          code: 'ADVISOR_DISABLED',
          message: 'AI advisor is disabled by feature flag.',
          requestId: requestMeta.requestId,
        }
      }

      if (shouldRestrictToAdmin() && auth.mode !== 'admin') {
        context.set.status = 403
        return {
          code: 'ADVISOR_ADMIN_ONLY',
          message: 'AI advisor is restricted to admin sessions.',
          requestId: requestMeta.requestId,
        }
      }

      if (auth.mode === 'demo') {
        const summary = getDashboardSummaryMock(range)
        const response: DashboardAdvisorResponse = {
          mode: 'demo',
          source: 'local',
          fallback: false,
          fallbackReason: null,
          requestId: requestMeta.requestId,
          generatedAt: new Date().toISOString(),
          metrics: {
            latencyMs: Date.now() - startedAt,
            fallbackRate: 0,
            errorRate: 0,
            insightAcceptedRate: 0,
          },
          insights: buildLocalInsights(summary),
        }

        logApiEvent({
          level: 'info',
          msg: 'advisor_response',
          requestId: requestMeta.requestId,
          auth_mode: auth.mode,
          advisor_source: response.source,
          fallback_rate: response.metrics.fallbackRate,
          error_rate: response.metrics.errorRate,
          insight_accepted_rate: response.metrics.insightAcceptedRate,
          latency_ms: response.metrics.latencyMs,
        })
        return response
      }

      const dashboard = getDashboardRuntime(context)

      try {
        const summary = await dashboard.useCases.getSummary(range)
        let source: DashboardAdvisorResponse['source'] = 'provider'
        let fallback = false
        let fallbackReason: string | null = null

        if (shouldForceLocalOnly()) {
          source = 'local'
          fallback = true
          fallbackReason = 'force_local_only'
        }

        const response: DashboardAdvisorResponse = {
          mode: 'admin',
          source,
          fallback,
          fallbackReason,
          requestId: requestMeta.requestId,
          generatedAt: new Date().toISOString(),
          degradedMessage: fallback ? 'Conseils limites, source externe indisponible' : null,
          emptyMessage: summary.assets.length === 0 ? 'Aucune donnee exploitable' : null,
          metrics: {
            latencyMs: Date.now() - startedAt,
            fallbackRate: fallback ? 1 : 0,
            errorRate: 0,
            insightAcceptedRate: 0,
          },
          insights: buildLocalInsights(summary),
        }

        if (response.fallback) {
          logApiEvent({
            level: 'warn',
            msg: 'advisor_fallback',
            requestId: requestMeta.requestId,
            auth_mode: auth.mode,
            fallback_reason: response.fallbackReason,
            latency_ms: response.metrics.latencyMs,
          })
        }

        logApiEvent({
          level: 'info',
          msg: 'advisor_response',
          requestId: requestMeta.requestId,
          auth_mode: auth.mode,
          advisor_source: response.source,
          fallback_rate: response.metrics.fallbackRate,
          error_rate: response.metrics.errorRate,
          insight_accepted_rate: response.metrics.insightAcceptedRate,
          latency_ms: response.metrics.latencyMs,
        })

        return response
      } catch (error) {
        const summary = getDashboardSummaryMock(range)
        const fallbackResponse: DashboardAdvisorResponse = {
          mode: 'admin',
          source: 'local',
          fallback: true,
          fallbackReason: 'provider_unavailable',
          requestId: requestMeta.requestId,
          generatedAt: new Date().toISOString(),
          degradedMessage: 'Conseils limites, source externe indisponible',
          emptyMessage: summary.assets.length === 0 ? 'Aucune donnee exploitable' : null,
          metrics: {
            latencyMs: Date.now() - startedAt,
            fallbackRate: 1,
            errorRate: 1,
            insightAcceptedRate: 0,
          },
          insights: buildLocalInsights(summary),
        }

        logApiEvent({
          level: 'error',
          msg: 'advisor_error',
          requestId: requestMeta.requestId,
          auth_mode: auth.mode,
          latency_ms: fallbackResponse.metrics.latencyMs,
          ...toErrorLogFields({
            error,
            includeStack: false,
          }),
        })

        logApiEvent({
          level: 'warn',
          msg: 'advisor_fallback',
          requestId: requestMeta.requestId,
          auth_mode: auth.mode,
          fallback_reason: fallbackResponse.fallbackReason,
          latency_ms: fallbackResponse.metrics.latencyMs,
        })

        return fallbackResponse
      }
    },
    {
      query: dashboardSummaryQuerySchema,
    }
  )
