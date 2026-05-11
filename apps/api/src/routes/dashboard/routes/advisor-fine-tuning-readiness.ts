// Macro Prompt 6 — GET /dashboard/advisor/fine-tuning-readiness.
//
// Read-only deterministic gate. Admin-only.
// IMPORTANT: This is NOT fine-tuning. It does not call a fine-tuning API, does
// not export data, and does not call a model.

import { Elysia } from 'elysia'
import { getAuth, getInternalAuth, getRequestMeta } from '../../../auth/context'
import { getDashboardRuntime } from '../context'

const buildErr = ({
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
  const requestId = getRequestMeta(context).requestId
  context.set.status = status
  return { ok: false, code, message, requestId }
}

export const createAdvisorFineTuningReadinessRoute = () =>
  new Elysia().get('/advisor/fine-tuning-readiness', async context => {
    const auth = getAuth(context)
    const internalAuth = getInternalAuth(context)
    const requestMeta = getRequestMeta(context)
    const runtime = getDashboardRuntime(context)

    const isAdmin = auth.mode === 'admin' || internalAuth.hasValidToken
    if (!isAdmin) {
      return buildErr({
        context,
        status: 403,
        code: 'DEMO_MODE_FORBIDDEN',
        message: 'Fine-tuning readiness gate requires an admin session or internal token.',
      })
    }

    const useCase = runtime.useCases.getAdvisorFineTuningReadiness
    if (!useCase) {
      return buildErr({
        context,
        status: 503,
        code: 'FINE_TUNING_READINESS_NOT_AVAILABLE',
        message: 'Fine-tuning readiness gate is not wired in this runtime.',
      })
    }

    return useCase({ mode: 'admin', requestId: requestMeta.requestId })
  })
