// Macro Prompt 5 — GET /dashboard/data-quality.
//
// Read-only, deterministic data quality + advisor readiness scoring endpoint.
//
// Invariants:
//  - Demo callers receive a deterministic fixture; no DB read, no provider IO.
//  - Admin callers (admin auth OR internal token) receive scores derived from
//    already-cached local rows (Powens connection statuses, external-investments
//    provider health, market/news cache state, latest eval run, latest
//    post-mortem) plus the already-computed provider diagnostics health
//    snapshots. The route NEVER triggers a sync, NEVER calls a provider, NEVER
//    invokes `provider.call()`, NEVER calls a knowledge-graph or LLM.
//  - The response carries no credentials, tokens, account ids, raw payloads,
//    or upstream error message bodies. See the dedicated test file for the
//    sentinel sweep.

import { Elysia } from 'elysia'
import { getAuth, getInternalAuth, getRequestMeta } from '../../../auth/context'
import { getDashboardRuntime } from '../context'

const DATA_QUALITY_NOT_AVAILABLE = {
  ok: false as const,
  code: 'DATA_QUALITY_NOT_AVAILABLE',
  message: 'Data quality endpoint is not wired in this runtime.',
}

export const createDataQualityRoute = () =>
  new Elysia().get('/data-quality', async context => {
    const auth = getAuth(context)
    const internalAuth = getInternalAuth(context)
    const requestMeta = getRequestMeta(context)
    const runtime = getDashboardRuntime(context)

    const isAdmin = auth.mode === 'admin' || internalAuth.hasValidToken
    const mode: 'demo' | 'admin' = isAdmin ? 'admin' : 'demo'

    const useCase = runtime.useCases.getDataQuality
    if (!useCase) {
      ;(context as unknown as { set: { status: number } }).set.status = 503
      return { ...DATA_QUALITY_NOT_AVAILABLE, requestId: requestMeta.requestId }
    }

    return useCase({ mode, requestId: requestMeta.requestId })
  })
