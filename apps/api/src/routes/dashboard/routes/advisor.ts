import { Elysia } from 'elysia'
import { getAuth, getRequestMeta } from '../../../auth/context'
import { logApiEvent } from '../../../observability/logger'
import { buildAdvisorFinancialContext } from '../domain/build-advisor-financial-context'
import { createGetDashboardAdvisorUseCase, readDashboardAdvisorFlags } from '../domain/create-get-dashboard-advisor-use-case'
import { getDashboardRuntime } from '../context'
import { dashboardSummaryQuerySchema } from '../schemas'
import type {
  DashboardAdvisorAction,
  DashboardAdvisorInsight,
  DashboardAdvisorResponse,
  DashboardSummaryResponse,
} from '../types'

const buildLocalInsights = (summary: DashboardSummaryResponse): DashboardAdvisorInsight[] => {
  const financialContext = buildAdvisorFinancialContext(summary)
  const net = financialContext.totals.netCashflow
  const spendRatio = financialContext.totals.spendRatio

  const trendInsight: DashboardAdvisorInsight =
    net >= 0
      ? {
          id: 'local-cashflow-positive',
          title: 'Cashflow positif sur la periode',
          detail: `Vos revenus depassent les depenses de ${Math.round(net)}. Gardez ce rythme avec une epargne automatique.`,
          severity: 'info',
          citations: [
            { id: 'totals.incomes', label: 'Revenus periode', value: `${Math.round(summary.totals.incomes)}` },
            { id: 'totals.expenses', label: 'Depenses periode', value: `${Math.round(summary.totals.expenses)}` },
          ],
        }
      : {
          id: 'local-cashflow-negative',
          title: 'Cashflow negatif detecte',
          detail: `Les depenses depassent les revenus de ${Math.round(Math.abs(net))}. Reduisez une categorie variable cette semaine.`,
          severity: 'warning',
          citations: [
            { id: 'totals.incomes', label: 'Revenus periode', value: `${Math.round(summary.totals.incomes)}` },
            { id: 'totals.expenses', label: 'Depenses periode', value: `${Math.round(summary.totals.expenses)}` },
          ],
        }

  const ratioInsight: DashboardAdvisorInsight =
    spendRatio > 0.9
      ? {
          id: 'local-spend-ratio-high',
          title: 'Ratio depenses/revenus eleve',
          detail: 'Objectif indicatif: rester sous 85% pour absorber les imprévus.',
          severity: 'warning',
          citations: [
            { id: 'totals.spendRatio', label: 'Ratio depenses/revenus', value: `${Math.round(spendRatio * 100)}%` },
          ],
        }
      : {
          id: 'local-spend-ratio-healthy',
          title: 'Ratio depenses/revenus maitrise',
          detail: 'Votre marge actuelle laisse de la place pour une reserve de securite.',
          severity: 'info',
          citations: [
            { id: 'totals.spendRatio', label: 'Ratio depenses/revenus', value: `${Math.round(spendRatio * 100)}%` },
          ],
        }

  const expenseInsight: DashboardAdvisorInsight = financialContext.focus.topExpenseLabel
    ? {
        id: 'local-top-expense',
        title: `Focus depense: ${financialContext.focus.topExpenseLabel}`,
        detail: `Poste principal sur la periode: ${Math.round(financialContext.focus.topExpenseAmount ?? 0)} sur ${financialContext.focus.topExpenseCount ?? 0} transactions.`,
        severity: 'info',
        citations: [
          {
            id: 'topExpenseGroups[0].total',
            label: 'Montant poste principal',
            value: `${Math.round(financialContext.focus.topExpenseAmount ?? 0)}`,
          },
          {
            id: 'topExpenseGroups[0].count',
            label: 'Transactions poste principal',
            value: `${financialContext.focus.topExpenseCount ?? 0}`,
          },
        ],
      }
    : {
        id: 'local-empty-expenses',
        title: 'Aucune depense exploitable',
        detail: 'Aucune donnee depense n\'a ete detectee sur la periode selectionnee.',
        severity: 'warning',
        citations: [{ id: 'topExpenseGroups', label: 'Top depenses detectees', value: '0' }],
      }

  return [trendInsight, ratioInsight, expenseInsight]
}

const buildActionTracking = (params: {
  metricLabel: string
  targetLabel: string
  currentLabel: string
}): DashboardAdvisorAction['tracking'] => ({
  status: 'suggested',
  metricLabel: params.metricLabel,
  targetLabel: params.targetLabel,
  currentLabel: params.currentLabel,
})

const buildLocalActions = (summary: DashboardSummaryResponse): DashboardAdvisorAction[] => {
  const financialContext = buildAdvisorFinancialContext(summary)
  const net = financialContext.totals.netCashflow
  const topExpenseAmount = Math.max(0, Math.round(financialContext.focus.topExpenseAmount ?? 0))
  const monthlyExpenseBaseline = Math.max(0, Math.round(summary.totals.expenses))

  const trimTopExpense: DashboardAdvisorAction = {
    id: 'action-trim-top-expense-10pct',
    title: 'Reduire le principal poste variable de 10%',
    detail: financialContext.focus.topExpenseLabel
      ? `Commencez par ${financialContext.focus.topExpenseLabel} avec un plafond hebdomadaire explicite.`
      : 'Choisissez un poste variable non essentiel et fixez un plafond hebdomadaire explicite.',
    estimatedMonthlyImpact: Math.max(15, Math.round(topExpenseAmount * 0.1)),
    effort: 'medium',
    tracking: buildActionTracking({
      metricLabel: 'Depense variable mensuelle',
      targetLabel: '-10% sur 30 jours',
      currentLabel: `${monthlyExpenseBaseline}`,
    }),
    citations: [
      { id: 'totals.expenses', label: 'Depenses mensuelles (baseline)', value: `${monthlyExpenseBaseline}` },
      { id: 'topExpenseGroups[0].total', label: 'Poste principal estime', value: `${topExpenseAmount}` },
    ],
  }

  const cashflowBuffer: DashboardAdvisorAction = {
    id: 'action-cashflow-buffer',
    title: 'Programmer un transfert securite chaque semaine',
    detail:
      net >= 0
        ? 'Automatisez un virement vers votre reserve juste apres les revenus principaux.'
        : 'Demarrez avec un petit montant fixe pour recreer une reserve sans bloquer le budget.',
    estimatedMonthlyImpact: net >= 0 ? Math.max(20, Math.round(net * 0.25)) : 20,
    effort: 'low',
    tracking: buildActionTracking({
      metricLabel: 'Reserve de securite',
      targetLabel: '4 virements effectues ce mois',
      currentLabel: '0/4 effectue',
    }),
    citations: [{ id: 'totals.netCashflow', label: 'Marge mensuelle estimee', value: `${Math.round(net)}` }],
  }

  return [trimTopExpense, cashflowBuffer]
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
        dataStatus:
          result.summary.assets.length === 0 || result.summary.topExpenseGroups.length === 0
            ? {
                mode: 'insufficient',
                message: 'Donnees insuffisantes: recommandations affichees avec citations minimales.',
              }
            : {
                mode: 'sufficient',
                message: null,
              },
        metrics: {
          latencyMs: Date.now() - startedAt,
          fallbackRate: result.plan.fallback ? 1 : 0,
          errorRate: result.plan.fallbackReason === 'provider_unavailable' ? 1 : 0,
          insightAcceptedRate: 0,
        },
        insights: buildLocalInsights(result.summary),
        actions: buildLocalActions(result.summary),
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
