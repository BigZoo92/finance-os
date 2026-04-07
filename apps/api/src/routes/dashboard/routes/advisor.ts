import { Elysia } from 'elysia'
import { getAuth, getRequestMeta } from '../../../auth/context'
import { logApiEvent } from '../../../observability/logger'
import { createGetDashboardAdvisorUseCase, readDashboardAdvisorFlags } from '../domain/create-get-dashboard-advisor-use-case'
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

export const createAdvisorRoute = () =>
  new Elysia().get(
    '/advisor',
    async context => {
      const auth = getAuth(context)
      const requestMeta = getRequestMeta(context)
      const range = context.query.range ?? '30d'
      const startedAt = Date.now()
      const flags = readDashboardAdvisorFlags()

      logApiEvent({
        level: 'info',
        msg: 'advisor_request',
        requestId: requestMeta.requestId,
        auth_mode: auth.mode,
        range,
      })

      if (!flags.advisorEnabled) {
        context.set.status = 503
        return {
          code: 'ADVISOR_DISABLED',
          message: 'AI advisor is disabled by feature flag.',
          requestId: requestMeta.requestId,
        }
      }

      if (flags.adminOnly && auth.mode !== 'admin') {
        context.set.status = 403
        return {
          code: 'ADVISOR_ADMIN_ONLY',
          message: 'AI advisor is restricted to admin sessions.',
          requestId: requestMeta.requestId,
        }
      }

      const dashboard = getDashboardRuntime(context)
      const getAdvisor = createGetDashboardAdvisorUseCase({ getSummary: dashboard.useCases.getSummary })
      const result = await getAdvisor({ mode: auth.mode, range })

      const response: DashboardAdvisorResponse = {
        mode: result.plan.mode,
        source: result.plan.source,
        fallback: result.plan.fallback,
        fallbackReason: result.plan.fallbackReason,
        requestId: requestMeta.requestId,
        generatedAt: new Date().toISOString(),
        ...(result.plan.degradedMessage ? { degradedMessage: result.plan.degradedMessage } : {}),
        ...(result.summary.assets.length === 0 ? { emptyMessage: 'Aucune donnee exploitable' } : {}),
        metrics: {
          latencyMs: Date.now() - startedAt,
          fallbackRate: result.plan.fallback ? 1 : 0,
          errorRate: result.plan.fallbackReason === 'provider_unavailable' ? 1 : 0,
          insightAcceptedRate: 0,
        },
        insights: buildLocalInsights(result.summary),
      }

      if (response.fallbackReason === 'provider_unavailable') {
        logApiEvent({
          level: 'error',
          msg: 'advisor_error',
          requestId: requestMeta.requestId,
          auth_mode: auth.mode,
          safe_error_code: response.fallbackReason,
          summary_source: result.plan.summarySource,
          latency_ms: response.metrics.latencyMs,
        })
      }

      if (response.fallback) {
        logApiEvent({
          level: 'warn',
          msg: 'advisor_fallback',
          requestId: requestMeta.requestId,
          auth_mode: auth.mode,
          fallback_reason: response.fallbackReason,
          summary_source: result.plan.summarySource,
          latency_ms: response.metrics.latencyMs,
        })
      }

      logApiEvent({
        level: 'info',
        msg: 'advisor_response',
        requestId: requestMeta.requestId,
        auth_mode: auth.mode,
        advisor_source: response.source,
        summary_source: result.plan.summarySource,
        fallback_rate: response.metrics.fallbackRate,
        error_rate: response.metrics.errorRate,
        insight_accepted_rate: response.metrics.insightAcceptedRate,
        latency_ms: response.metrics.latencyMs,
      })

      return response
    },
    {
      query: dashboardSummaryQuerySchema,
    }
  )
