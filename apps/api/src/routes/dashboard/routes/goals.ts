import { Elysia } from 'elysia'
import { getRequestMeta } from '../../../auth/context'
import { demoOrReal } from '../../../auth/demo-mode'
import { requireAdmin } from '../../../auth/guard'
import { getDashboardGoalsMock } from '../../../mocks/dashboardGoals.mock'
import { getDashboardRuntime } from '../context'
import { dashboardGoalBodySchema, dashboardGoalParamsSchema } from '../schemas'

const normalizeGoalCurrency = (currency: string) => currency.toUpperCase()

export const createGoalsRoute = () =>
  new Elysia()
    .get('/goals', async context => {
      return demoOrReal({
        context,
        demo: () => getDashboardGoalsMock(),
        real: async () => {
          const dashboard = getDashboardRuntime(context)
          return dashboard.useCases.getGoals()
        },
      })
    })
    .post(
      '/goals',
      async context => {
        const requestId = getRequestMeta(context).requestId

        return demoOrReal({
          context,
          demo: () => {
            context.set.status = 403
            return {
              ok: false,
              code: 'DEMO_MODE_FORBIDDEN' as const,
              message: 'Admin session required',
              requestId,
            }
          },
          real: async () => {
            requireAdmin(context)
            const dashboard = getDashboardRuntime(context)
            context.set.status = 201

            return dashboard.useCases.createGoal({
              name: context.body.name,
              goalType: context.body.goalType,
              currency: normalizeGoalCurrency(context.body.currency),
              targetAmount: context.body.targetAmount,
              currentAmount: context.body.currentAmount,
              targetDate: context.body.targetDate,
              note: context.body.note,
            })
          },
        })
      },
      {
        body: dashboardGoalBodySchema,
      }
    )
    .patch(
      '/goals/:goalId',
      async context => {
        const requestId = getRequestMeta(context).requestId

        return demoOrReal({
          context,
          demo: () => {
            context.set.status = 403
            return {
              ok: false,
              code: 'DEMO_MODE_FORBIDDEN' as const,
              message: 'Admin session required',
              requestId,
            }
          },
          real: async () => {
            requireAdmin(context)
            const dashboard = getDashboardRuntime(context)
            const updated = await dashboard.useCases.updateGoal(context.params.goalId, {
              name: context.body.name,
              goalType: context.body.goalType,
              currency: normalizeGoalCurrency(context.body.currency),
              targetAmount: context.body.targetAmount,
              currentAmount: context.body.currentAmount,
              targetDate: context.body.targetDate,
              note: context.body.note,
            })

            if (!updated) {
              context.set.status = 404
              return {
                ok: false,
                code: 'NOT_FOUND' as const,
                message: 'Goal not found',
                requestId,
              }
            }

            return updated
          },
        })
      },
      {
        params: dashboardGoalParamsSchema,
        body: dashboardGoalBodySchema,
      }
    )
    .post(
      '/goals/:goalId/archive',
      async context => {
        const requestId = getRequestMeta(context).requestId

        return demoOrReal({
          context,
          demo: () => {
            context.set.status = 403
            return {
              ok: false,
              code: 'DEMO_MODE_FORBIDDEN' as const,
              message: 'Admin session required',
              requestId,
            }
          },
          real: async () => {
            requireAdmin(context)
            const dashboard = getDashboardRuntime(context)
            const archived = await dashboard.useCases.archiveGoal(context.params.goalId)

            if (!archived) {
              context.set.status = 404
              return {
                ok: false,
                code: 'NOT_FOUND' as const,
                message: 'Goal not found',
                requestId,
              }
            }

            return archived
          },
        })
      },
      {
        params: dashboardGoalParamsSchema,
      }
    )
