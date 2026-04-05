import { Elysia } from 'elysia'
import { getAuth, getRequestMeta } from '../../../../auth/context'
import { getPowensRuntime } from '../context'

export const createDiagnosticsRoute = () => {
  return new Elysia().get('/diagnostics', async context => {
    const runtime = getPowensRuntime(context)
    const requestMeta = getRequestMeta(context)
    const auth = getAuth(context)

    const diagnostics = await runtime.services.diagnostics.run({
      requestId: requestMeta.requestId,
      mode: auth.mode,
    })

    return diagnostics
  })
}
