// Macro Prompt 6 — GET /dashboard/advisor/replay.
//
// Read-only deterministic review of recent advisor activity. Admin-only.
// Demo callers receive a deterministic fixture with the same response shape.
//
// Invariants:
//  - No DB writes. No provider call. No LLM. No graph call.
//  - `windowDays` query parameter is clamped to [1, 90]. Invalid values fall
//    back to the default window (30) instead of returning 400.
//  - The response never carries `freeNote` — the use-case projects only the
//    closed fields. See the route test for the sentinel sweep.

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

const parseWindowDays = (raw: string | null | undefined): number | null => {
  if (raw === null || raw === undefined) return null
  const parsed = Number.parseInt(raw, 10)
  if (Number.isNaN(parsed)) return null
  return parsed
}

export const createAdvisorReplayRoute = () =>
  new Elysia().get('/advisor/replay', async context => {
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
        message: 'Advisor replay requires an admin session or internal token.',
      })
    }

    const useCase = runtime.useCases.getAdvisorReplay
    if (!useCase) {
      return buildErr({
        context,
        status: 503,
        code: 'ADVISOR_REPLAY_NOT_AVAILABLE',
        message: 'Advisor replay endpoint is not wired in this runtime.',
      })
    }

    const url = new URL((context as unknown as { request: Request }).request.url)
    const windowDays = parseWindowDays(url.searchParams.get('windowDays'))

    return useCase({
      mode: 'admin',
      requestId: requestMeta.requestId,
      windowDays,
    })
  })
