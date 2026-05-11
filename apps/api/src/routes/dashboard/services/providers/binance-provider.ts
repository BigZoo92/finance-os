// Macro Prompt 4 — Sensitive providers foundation: Binance Spot (crypto) wrapper.
//
// Health-only `Provider<C>` wrapper for Binance Spot. Registers `crypto.wallet.read`
// so the provider appears in `/dashboard/providers/diagnostics` with a local-snapshot
// health status. `call()` returns `unsupported_capability` with a deferred-read-routing
// reason — production routes still consume the existing external-investments
// repository directly until a follow-up macro prompt rewires reads.
//
// Capability rationale: Binance balances surface as wallet-shaped data (free / locked
// quantity per asset), so `crypto.wallet.read` is the closest closed-vocabulary fit
// and keeps the wrapper distinct from IBKR's `external_investments.positions.read`
// surface in the registry. Trade history routing is deferred along with the wallet
// read routing.
//
// Strict invariants (per Macro Prompt 4 hard constraints):
//   - NEVER calls Binance from this wrapper (no live probes from diagnostics).
//   - NEVER reads, returns, or logs API keys, secrets, signatures, query strings, or
//     raw JSON payloads.
//   - NEVER touches credential storage, encryption, sync jobs, or worker schedules.
//   - Health is sourced from local `externalInvestmentProviderHealth` rows via the
//     injected closure (already strips `encryptedPayload` at the SELECT layer).
//   - Health snapshot is refreshed asynchronously via `refreshHealth()`; `getHealth()`
//     itself never performs IO.

import {
  asProviderId,
  type Provider,
  type ProviderCallContext,
  type ProviderHealth,
  type ProviderResult,
} from '@finance-os/provider-contract'
import {
  createProviderError,
  logProviderEvent,
  type ProviderLogTarget,
  providerErr,
} from '@finance-os/provider-runtime'
import {
  computeExternalInvestmentsHealth,
  type ExternalInvestmentsProviderSnapshot,
} from './external-investments-provider-shared'

const PROVIDER_ID = asProviderId('binance')
const CAPABILITY = 'crypto.wallet.read' as const

export interface BinanceProviderDeps {
  /**
   * Reads the local Binance provider/connection status snapshot. MUST NOT call
   * Binance; MUST NOT include API keys, secrets, signatures, or raw JSON bodies.
   */
  readonly getProviderSnapshot: () => Promise<ExternalInvestmentsProviderSnapshot | null>
  readonly logTarget: ProviderLogTarget
  readonly now?: () => Date
}

export interface BinanceProviderHandle {
  readonly provider: Provider<typeof CAPABILITY>
  readonly refreshHealth: () => Promise<void>
}

interface HealthState {
  status: ProviderHealth['status']
  lastSuccessAt: string | null
  lastErrorCode: ProviderHealth['lastErrorCode']
  note?: string
}

const SOURCE_META = {
  providerId: PROVIDER_ID,
  capability: CAPABILITY,
  freshnessMinutes: null,
  fromCache: true,
} as const

const INITIAL_HEALTH: HealthState = {
  status: 'degraded',
  lastSuccessAt: null,
  lastErrorCode: 'unconfigured',
  note: 'snapshot pending — refreshHealth() not yet invoked',
}

const REFRESH_FAILED_HEALTH: HealthState = {
  status: 'degraded',
  lastSuccessAt: null,
  lastErrorCode: 'transient',
  note: 'health snapshot refresh failed',
}

export const createBinanceProvider = (deps: BinanceProviderDeps): BinanceProviderHandle => {
  const { getProviderSnapshot, logTarget } = deps
  const now = deps.now ?? (() => new Date())

  let health: HealthState = { ...INITIAL_HEALTH }

  const refreshHealth = async (): Promise<void> => {
    try {
      const snapshot = await getProviderSnapshot()
      health = computeExternalInvestmentsHealth(snapshot, 'Binance')
      logProviderEvent(logTarget, {
        name: 'provider.health.checked',
        fields: {
          providerId: PROVIDER_ID,
          capability: CAPABILITY,
          status: health.status,
          ...(health.lastErrorCode ? { errorCode: health.lastErrorCode } : {}),
        },
      })
    } catch {
      health = { ...REFRESH_FAILED_HEALTH }
      logProviderEvent(logTarget, {
        name: 'provider.health.checked',
        fields: {
          providerId: PROVIDER_ID,
          capability: CAPABILITY,
          status: health.status,
          errorCode: 'transient',
        },
      })
    }
  }

  const provider: Provider<typeof CAPABILITY> = {
    id: PROVIDER_ID,
    capability: CAPABILITY,
    call: async (_input: unknown, ctx: ProviderCallContext): Promise<ProviderResult<unknown>> => {
      const startedAt = Date.now()
      const meta = (durationMs: number) => ({
        requestId: ctx.requestId,
        durationMs,
        sources: [SOURCE_META],
      })

      logProviderEvent(logTarget, {
        name: 'provider.call.started',
        fields: {
          providerId: PROVIDER_ID,
          capability: CAPABILITY,
          requestId: ctx.requestId,
          mode: ctx.mode,
        },
      })

      const error = createProviderError({
        code: 'unsupported_capability',
        providerId: PROVIDER_ID,
        capability: CAPABILITY,
        requestId: ctx.requestId,
        message: 'binance read routing is deferred (health-only wrapper)',
        safeDetails: { reason: 'deferred_read_routing' },
      })

      logProviderEvent(logTarget, {
        name: 'provider.call.skipped',
        fields: {
          providerId: PROVIDER_ID,
          capability: CAPABILITY,
          requestId: ctx.requestId,
          mode: ctx.mode,
          errorCode: error.code,
          retryable: error.retryable,
          durationMs: Date.now() - startedAt,
        },
      })

      void now()

      return providerErr(error, meta(Date.now() - startedAt))
    },
    getHealth: () => ({
      status: health.status,
      lastSuccessAt: health.lastSuccessAt,
      lastErrorCode: health.lastErrorCode,
      ...(health.note !== undefined ? { note: health.note } : {}),
    }),
  }

  return { provider, refreshHealth }
}
