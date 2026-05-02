import { Elysia } from 'elysia'
import { getRequestMeta } from '../../../../auth/context'
import { demoOrReal } from '../../../../auth/demo-mode'
import { getExternalInvestmentsDiagnosticsMock } from '../../../../mocks/externalInvestments.mock'
import { getExternalInvestmentsRuntime } from '../context'

export const createExternalInvestmentsDiagnosticsRoute = () =>
  new Elysia().get('/diagnostics', async context => {
    const requestId = getRequestMeta(context).requestId

    return demoOrReal({
      context,
      demo: () => getExternalInvestmentsDiagnosticsMock(requestId),
      real: async () => {
        const runtime = getExternalInvestmentsRuntime(context)
        return {
          requestId,
          mode: 'admin' as const,
          source: 'db' as const,
          enabled: runtime.config.enabled,
          safeModeActive: runtime.config.safeModeActive,
          providerEnabled: runtime.config.providerEnabled,
          ...(await runtime.repository.getDiagnostics()),
        }
      },
    })
  })
