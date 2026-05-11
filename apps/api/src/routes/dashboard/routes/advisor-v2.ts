// Macro Prompt 6 — Advisor v2 routes (skeleton, default-off).
//
// Two endpoints:
//   GET  /dashboard/advisor/v2/capabilities  — closed-vocabulary capability listing
//   POST /dashboard/advisor/v2/preview       — admin-only deterministic preview
//
// Invariants:
//  - When `AI_ADVISOR_V2_ENABLED` is false, the preview short-circuits with
//    `status: "skipped_disabled"` rather than 503-ing the route. The caller
//    UI is expected to render an "advisor v2 not active" state.
//  - The preview is admin-only. Demo callers without an internal token receive
//    403 `DEMO_MODE_FORBIDDEN`.
//  - The preview is deterministic. There is NO LLM call, NO provider call, NO
//    graph call, NO DB write, and NO recommendation persistence in this route.
//  - The existing `runAdvisorDaily` daily run is NOT replaced by Advisor v2.
//  - Capabilities is read-only and admin-or-internal. Demo gets the public
//    closed-vocabulary capability snapshot with `previewAvailable: false`.

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

export const createAdvisorV2Route = ({ v2Enabled }: { v2Enabled: boolean }) =>
  new Elysia()
    .get('/advisor/v2/capabilities', async context => {
      const auth = getAuth(context)
      const internalAuth = getInternalAuth(context)
      const requestMeta = getRequestMeta(context)
      const runtime = getDashboardRuntime(context)

      const isAdmin = auth.mode === 'admin' || internalAuth.hasValidToken
      const mode: 'demo' | 'admin' = isAdmin ? 'admin' : 'demo'

      const useCase = runtime.useCases.getAdvisorV2Capabilities
      if (!useCase) {
        return buildErr({
          context,
          status: 503,
          code: 'ADVISOR_V2_NOT_AVAILABLE',
          message: 'Advisor v2 capabilities endpoint is not wired in this runtime.',
        })
      }
      return useCase({ mode, requestId: requestMeta.requestId })
    })
    .post('/advisor/v2/preview', async context => {
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
          message: 'Advisor v2 preview requires an admin session or internal token.',
        })
      }

      // Even when admin, if the flag is off the use-case returns
      // `status: "skipped_disabled"` deterministically. We surface the
      // `v2Enabled` flag value in the response for transparency.
      const useCase = runtime.useCases.buildAdvisorV2Preview
      if (!useCase) {
        return buildErr({
          context,
          status: 503,
          code: 'ADVISOR_V2_NOT_AVAILABLE',
          message: 'Advisor v2 preview use-case is not wired in this runtime.',
        })
      }

      const result = await useCase({ mode: 'admin', requestId: requestMeta.requestId })

      // Defensive: if v2 is disabled at the runtime level, ensure the response
      // reflects the configuration even if a future caller wires this oddly.
      if (!v2Enabled && result.status !== 'skipped_disabled') {
        return {
          ...result,
          status: 'skipped_disabled' as const,
          v2Enabled: false,
        }
      }
      return result
    })
