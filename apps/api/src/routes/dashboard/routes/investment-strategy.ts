import { Elysia } from 'elysia'
import { getAuth, getInternalAuth, getRequestMeta } from '../../../auth/context'
import { requireAdminOrInternalToken } from '../../../auth/guard'
import { getDashboardRuntime } from '../context'
import {
  dashboardInvestmentActionPlanGenerateBodySchema,
  dashboardInvestmentAssetParamsSchema,
  dashboardInvestmentAssetSearchQuerySchema,
  dashboardInvestmentHypothesesReviewBodySchema,
  dashboardInvestmentLessonParamsSchema,
  dashboardInvestmentStrategyBodySchema,
  dashboardInvestmentWatchlistBodySchema,
  dashboardInvestmentWatchlistParamsSchema,
  dashboardInvestmentWatchlistPatchBodySchema,
} from '../schemas'

const routeError = ({
  context,
  status,
  code,
  message,
}: {
  context: object & { set: { status?: number | string } }
  status: number
  code: string
  message: string
}) => {
  context.set.status = status
  return {
    ok: false,
    code,
    message,
    requestId: getRequestMeta(context).requestId,
  }
}

const ensureEnabled = ({
  context,
  advisorEnabled,
}: {
  context: object & { set: { status?: number | string } }
  advisorEnabled: boolean
}) =>
  advisorEnabled
    ? null
    : routeError({
        context,
        status: 503,
        code: 'ADVISOR_DISABLED',
        message: 'AI advisor is disabled by feature flag.',
      })

const readMode = (context: object): 'demo' | 'admin' => {
  const auth = getAuth(context)
  const internalAuth = getInternalAuth(context)
  return auth.mode === 'admin' || internalAuth.hasValidToken ? 'admin' : 'demo'
}

const ensureMutationAccess = (context: object & { set: { status?: number | string } }) => {
  try {
    requireAdminOrInternalToken(context)
    return null
  } catch {
    return routeError({
      context,
      status: 403,
      code: 'DEMO_MODE_FORBIDDEN',
      message: 'Admin session or internal token required for investment advisor mutations.',
    })
  }
}

const getUseCase = <TValue>(
  context: object & { set: { status?: number | string } },
  value: TValue | undefined,
  name: string
): TValue | ReturnType<typeof routeError> => {
  if (value) return value
  return routeError({
    context,
    status: 503,
    code: 'INVESTMENT_ADVISOR_RUNTIME_UNAVAILABLE',
    message: `${name} runtime is unavailable.`,
  })
}

export const createInvestmentStrategyRoute = ({
  advisorEnabled = true,
}: {
  advisorEnabled?: boolean
} = {}) =>
  new Elysia()
    .get('/advisor/investment-strategy', async context => {
      const enabledError = ensureEnabled({ context, advisorEnabled })
      if (enabledError) return enabledError

      const runtime = getDashboardRuntime(context)
      const useCase = getUseCase(context, runtime.useCases.getInvestmentStrategy, 'Investment strategy')
      if (typeof useCase !== 'function') return useCase

      return useCase({
        mode: readMode(context),
        requestId: getRequestMeta(context).requestId,
      })
    })
    .put(
      '/advisor/investment-strategy',
      async context => {
        const enabledError = ensureEnabled({ context, advisorEnabled })
        if (enabledError) return enabledError

        const authError = ensureMutationAccess(context)
        if (authError) return authError

        const runtime = getDashboardRuntime(context)
        const useCase = getUseCase(
          context,
          runtime.useCases.updateInvestmentStrategy,
          'Investment strategy update'
        )
        if (typeof useCase !== 'function') return useCase

        return useCase({
          mode: 'admin',
          requestId: getRequestMeta(context).requestId,
          input: context.body,
        })
      },
      { body: dashboardInvestmentStrategyBodySchema }
    )
    .get(
      '/advisor/assets/search',
      async context => {
        const enabledError = ensureEnabled({ context, advisorEnabled })
        if (enabledError) return enabledError

        const runtime = getDashboardRuntime(context)
        const useCase = getUseCase(context, runtime.useCases.searchAdvisorAssets, 'Asset search')
        if (typeof useCase !== 'function') return useCase

        return useCase({
          mode: readMode(context),
          requestId: getRequestMeta(context).requestId,
          query: context.query.q ?? '',
        })
      },
      { query: dashboardInvestmentAssetSearchQuerySchema }
    )
    .get('/advisor/assets/watchlist', async context => {
      const enabledError = ensureEnabled({ context, advisorEnabled })
      if (enabledError) return enabledError

      const runtime = getDashboardRuntime(context)
      const useCase = getUseCase(
        context,
        runtime.useCases.listAdvisorAssetWatchlist,
        'Asset watchlist'
      )
      if (typeof useCase !== 'function') return useCase

      return useCase({
        mode: readMode(context),
        requestId: getRequestMeta(context).requestId,
      })
    })
    .post(
      '/advisor/assets/watchlist',
      async context => {
        const enabledError = ensureEnabled({ context, advisorEnabled })
        if (enabledError) return enabledError

        const authError = ensureMutationAccess(context)
        if (authError) return authError

        const runtime = getDashboardRuntime(context)
        const useCase = getUseCase(
          context,
          runtime.useCases.addAdvisorAssetToWatchlist,
          'Asset watchlist add'
        )
        if (typeof useCase !== 'function') return useCase

        return useCase({
          mode: 'admin',
          requestId: getRequestMeta(context).requestId,
          input: context.body,
        })
      },
      { body: dashboardInvestmentWatchlistBodySchema }
    )
    .patch(
      '/advisor/assets/watchlist/:id',
      async context => {
        const enabledError = ensureEnabled({ context, advisorEnabled })
        if (enabledError) return enabledError

        const authError = ensureMutationAccess(context)
        if (authError) return authError

        const runtime = getDashboardRuntime(context)
        const useCase = getUseCase(
          context,
          runtime.useCases.updateAdvisorAssetWatchlist,
          'Asset watchlist update'
        )
        if (typeof useCase !== 'function') return useCase

        return useCase({
          mode: 'admin',
          requestId: getRequestMeta(context).requestId,
          watchlistId: context.params.id,
          input: context.body,
        })
      },
      {
        params: dashboardInvestmentWatchlistParamsSchema,
        body: dashboardInvestmentWatchlistPatchBodySchema,
      }
    )
    .delete(
      '/advisor/assets/watchlist/:id',
      async context => {
        const enabledError = ensureEnabled({ context, advisorEnabled })
        if (enabledError) return enabledError

        const authError = ensureMutationAccess(context)
        if (authError) return authError

        const runtime = getDashboardRuntime(context)
        const useCase = getUseCase(
          context,
          runtime.useCases.removeAdvisorAssetFromWatchlist,
          'Asset watchlist remove'
        )
        if (typeof useCase !== 'function') return useCase

        return useCase({
          mode: 'admin',
          requestId: getRequestMeta(context).requestId,
          watchlistId: context.params.id,
        })
      },
      { params: dashboardInvestmentWatchlistParamsSchema }
    )
    .get(
      '/advisor/assets/:assetId',
      async context => {
        const enabledError = ensureEnabled({ context, advisorEnabled })
        if (enabledError) return enabledError

        const runtime = getDashboardRuntime(context)
        const useCase = getUseCase(context, runtime.useCases.getAdvisorAssetDetails, 'Asset details')
        if (typeof useCase !== 'function') return useCase

        return useCase({
          mode: readMode(context),
          requestId: getRequestMeta(context).requestId,
          assetId: context.params.assetId,
        })
      },
      { params: dashboardInvestmentAssetParamsSchema }
    )
    .get('/advisor/investment-plan', async context => {
      const enabledError = ensureEnabled({ context, advisorEnabled })
      if (enabledError) return enabledError

      const runtime = getDashboardRuntime(context)
      const useCase = getUseCase(context, runtime.useCases.latestInvestmentPlan, 'Investment plan')
      if (typeof useCase !== 'function') return useCase

      return useCase({
        mode: readMode(context),
        requestId: getRequestMeta(context).requestId,
      })
    })
    .get('/advisor/investment-plan/latest', async context => {
      const enabledError = ensureEnabled({ context, advisorEnabled })
      if (enabledError) return enabledError

      const runtime = getDashboardRuntime(context)
      const useCase = getUseCase(
        context,
        runtime.useCases.latestInvestmentPlan,
        'Latest investment plan'
      )
      if (typeof useCase !== 'function') return useCase

      return useCase({
        mode: readMode(context),
        requestId: getRequestMeta(context).requestId,
      })
    })
    .post(
      '/advisor/investment-plan/generate',
      async context => {
        const enabledError = ensureEnabled({ context, advisorEnabled })
        if (enabledError) return enabledError

        const authError = ensureMutationAccess(context)
        if (authError) return authError

        const runtime = getDashboardRuntime(context)
        const useCase = getUseCase(
          context,
          runtime.useCases.generateInvestmentPlan,
          'Investment plan generation'
        )
        if (typeof useCase !== 'function') return useCase

        return useCase({
          mode: 'admin',
          requestId: getRequestMeta(context).requestId,
          triggerSource: context.body.trigger ?? 'manual',
          ...(context.body.dryRun !== undefined ? { dryRun: context.body.dryRun } : {}),
        })
      },
      { body: dashboardInvestmentActionPlanGenerateBodySchema }
    )
    .get('/advisor/investment-hypotheses', async context => {
      const enabledError = ensureEnabled({ context, advisorEnabled })
      if (enabledError) return enabledError

      const runtime = getDashboardRuntime(context)
      const useCase = getUseCase(
        context,
        runtime.useCases.listInvestmentHypotheses,
        'Investment hypotheses'
      )
      if (typeof useCase !== 'function') return useCase

      return useCase({
        mode: readMode(context),
        requestId: getRequestMeta(context).requestId,
      })
    })
    .get('/advisor/investment-hypotheses/due', async context => {
      const enabledError = ensureEnabled({ context, advisorEnabled })
      if (enabledError) return enabledError

      const runtime = getDashboardRuntime(context)
      const useCase = getUseCase(
        context,
        runtime.useCases.listDueInvestmentHypotheses,
        'Due investment hypotheses'
      )
      if (typeof useCase !== 'function') return useCase

      return useCase({
        mode: readMode(context),
        requestId: getRequestMeta(context).requestId,
      })
    })
    .post(
      '/advisor/investment-hypotheses/review-due',
      async context => {
        const enabledError = ensureEnabled({ context, advisorEnabled })
        if (enabledError) return enabledError

        const authError = ensureMutationAccess(context)
        if (authError) return authError

        const runtime = getDashboardRuntime(context)
        const useCase = getUseCase(
          context,
          runtime.useCases.reviewDueInvestmentHypotheses,
          'Investment hypothesis review'
        )
        if (typeof useCase !== 'function') return useCase

        return useCase({
          mode: 'admin',
          requestId: getRequestMeta(context).requestId,
          triggerSource: context.body.trigger ?? 'manual',
          ...(context.body.dryRun !== undefined ? { dryRun: context.body.dryRun } : {}),
          ...(context.body.limit !== undefined ? { limit: context.body.limit } : {}),
        })
      },
      { body: dashboardInvestmentHypothesesReviewBodySchema }
    )
    .get('/advisor/investment-learning/scorecard', async context => {
      const enabledError = ensureEnabled({ context, advisorEnabled })
      if (enabledError) return enabledError

      const runtime = getDashboardRuntime(context)
      const useCase = getUseCase(
        context,
        runtime.useCases.getInvestmentLearningScorecard,
        'Investment learning scorecard'
      )
      if (typeof useCase !== 'function') return useCase

      return useCase({
        mode: readMode(context),
        requestId: getRequestMeta(context).requestId,
      })
    })
    .get('/advisor/investment-learning/lessons', async context => {
      const enabledError = ensureEnabled({ context, advisorEnabled })
      if (enabledError) return enabledError

      const runtime = getDashboardRuntime(context)
      const useCase = getUseCase(
        context,
        runtime.useCases.listInvestmentStrategyLessons,
        'Investment lessons'
      )
      if (typeof useCase !== 'function') return useCase

      return useCase({
        mode: readMode(context),
        requestId: getRequestMeta(context).requestId,
      })
    })
    .post(
      '/advisor/investment-learning/lessons/:lessonId/approve',
      async context => {
        const enabledError = ensureEnabled({ context, advisorEnabled })
        if (enabledError) return enabledError

        const authError = ensureMutationAccess(context)
        if (authError) return authError

        const runtime = getDashboardRuntime(context)
        const useCase = getUseCase(
          context,
          runtime.useCases.updateInvestmentStrategyLessonStatus,
          'Investment lesson approval'
        )
        if (typeof useCase !== 'function') return useCase

        return useCase({
          mode: 'admin',
          requestId: getRequestMeta(context).requestId,
          lessonId: context.params.lessonId,
          status: 'approved',
        })
      },
      { params: dashboardInvestmentLessonParamsSchema }
    )
    .post(
      '/advisor/investment-learning/lessons/:lessonId/reject',
      async context => {
        const enabledError = ensureEnabled({ context, advisorEnabled })
        if (enabledError) return enabledError

        const authError = ensureMutationAccess(context)
        if (authError) return authError

        const runtime = getDashboardRuntime(context)
        const useCase = getUseCase(
          context,
          runtime.useCases.updateInvestmentStrategyLessonStatus,
          'Investment lesson rejection'
        )
        if (typeof useCase !== 'function') return useCase

        return useCase({
          mode: 'admin',
          requestId: getRequestMeta(context).requestId,
          lessonId: context.params.lessonId,
          status: 'rejected',
        })
      },
      { params: dashboardInvestmentLessonParamsSchema }
    )
    .get('/advisor/investment-status', async context => {
      const enabledError = ensureEnabled({ context, advisorEnabled })
      if (enabledError) return enabledError

      const runtime = getDashboardRuntime(context)
      const useCase = getUseCase(context, runtime.useCases.getInvestmentStatus, 'Investment status')
      if (typeof useCase !== 'function') return useCase

      return useCase({
        mode: readMode(context),
        requestId: getRequestMeta(context).requestId,
      })
    })
