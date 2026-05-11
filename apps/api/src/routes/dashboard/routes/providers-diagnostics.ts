// Macro Prompt 3 — Provider diagnostics endpoint.
// Macro Prompt 4 — Refreshes health snapshots for sensitive provider wrappers
//   (powens / ibkr / binance) from local DB rows BEFORE computing diagnostics. The
//   refresh closure NEVER calls Powens / IBKR / Binance — it reads the
//   `powensConnection` and `externalInvestmentProviderHealth` tables only.
//
// `GET /dashboard/providers/diagnostics` is admin-only and read-only. It exposes the
// browser-safe diagnostics shape produced by `computeProviderDiagnostics()` over the
// internal provider registry built in [runtime.ts](../runtime.ts). Demo mode returns a
// deterministic fixture (no provider calls). Admin mode reads `getHealth()` snapshots
// only — no `Provider.call()` is performed and no external HTTP traffic is generated.
//
// Invariants:
//  - admin-only or internal-token; demo callers receive a deterministic empty fixture
//    so the endpoint stays useful in demo mode without exposing health surface.
//  - response carries no credentials, no raw config, no provider raw payloads.
//  - only closed-vocabulary fields (status, errorCode, capabilities, lastCheckedAt,
//    summary counts) leave this route — see `ProviderDiagnosticsResponse`.
//  - the optional `refreshProviderHealth` runtime hook is awaited only in admin mode
//    so demo callers never trigger a DB read.

import { computeProviderDiagnostics } from '@finance-os/provider-runtime'
import { Elysia } from 'elysia'
import { getAuth, getInternalAuth, getRequestMeta } from '../../../auth/context'
import { getDashboardRuntime } from '../context'

export const createProvidersDiagnosticsRoute = () =>
  new Elysia().get('/providers/diagnostics', async context => {
    const auth = getAuth(context)
    const internalAuth = getInternalAuth(context)
    const requestMeta = getRequestMeta(context)
    const runtime = getDashboardRuntime(context)

    const isAdmin = auth.mode === 'admin' || internalAuth.hasValidToken

    if (isAdmin && runtime.refreshProviderHealth) {
      await runtime.refreshProviderHealth()
    }

    return computeProviderDiagnostics({
      registry: runtime.providerRegistry,
      context: {
        mode: isAdmin ? 'admin' : 'demo',
        requestId: requestMeta.requestId,
        now: new Date(),
        reason: 'route:dashboard.providers.diagnostics',
      },
    })
  })
