import { Elysia } from 'elysia'
import { getRequestMeta } from '../../../../auth/context'
import { demoOrReal } from '../../../../auth/demo-mode'
import { getExternalInvestmentsStatusMock } from '../../../../mocks/externalInvestments.mock'
import { getExternalInvestmentsRuntime } from '../context'

export const createExternalInvestmentsStatusRoute = () =>
  new Elysia().get('/status', async context => {
    const requestId = getRequestMeta(context).requestId

    return demoOrReal({
      context,
      demo: () => getExternalInvestmentsStatusMock(requestId),
      real: async () => {
        const runtime = getExternalInvestmentsRuntime(context)
        const [status, backlogCount] = await Promise.all([
          runtime.repository.getStatus(),
          runtime.jobs.getSyncBacklogCount(),
        ])

        return {
          requestId,
          mode: 'admin' as const,
          source: 'db' as const,
          enabled: runtime.config.enabled,
          safeModeActive: runtime.config.safeModeActive,
          providerEnabled: runtime.config.providerEnabled,
          backlogCount,
          ...status,
        }
      },
    })
  })
