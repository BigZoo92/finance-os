// Macro Prompt 4 — Sensitive providers foundation: Powens (open banking) wrapper.
//
// Health-only `Provider<C>` wrapper for Powens. Registers `banking.accounts.read` so
// the provider appears in `/dashboard/providers/diagnostics` with a local-snapshot
// health status. `call()` returns `unsupported_capability` with a deferred-read-routing
// reason — production routes still consume the existing Powens repositories directly
// until a follow-up macro prompt rewires reads through `provider.call()`.
//
// Strict invariants (per Macro Prompt 4 hard constraints):
//   - NEVER calls Powens upstream from this wrapper (no live probes from diagnostics).
//   - NEVER reads, returns, logs, or persists access tokens, callback codes, raw
//     provider payloads, account ids, or `lastError` strings.
//   - NEVER touches connect-url generation, token exchange, encryption, or sync jobs.
//   - Health is sourced from the local `powensConnection` table snapshot via the
//     injected `listConnectionStatuses()` closure (already strips encrypted tokens at
//     the SELECT layer).
//   - Health snapshot is refreshed asynchronously via `refreshHealth()`; `getHealth()`
//     itself never performs IO.
//   - The wrapper declares only `banking.accounts.read`. `banking.transactions.read`
//     remains unwrapped in this batch — there is one Powens read surface today; adding
//     a second wrapper before its read is routed would be empty surface area.

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

const PROVIDER_ID = asProviderId('powens')
const CAPABILITY = 'banking.accounts.read' as const

/**
 * Closed-vocabulary Powens connection status snapshot consumed by the wrapper. Keeps
 * the wrapper unaware of the Powens repository's row shape and of any token/credential
 * field — only the columns relevant to a health snapshot are passed in.
 */
export interface PowensProviderConnectionSnapshot {
  readonly status: 'connected' | 'syncing' | 'error' | 'reconnect_required'
  readonly lastSyncStatus: 'OK' | 'KO' | null
  readonly lastSuccessAt: Date | null
  readonly lastFailedAt: Date | null
}

export interface PowensProviderDeps {
  /**
   * Reads the local connection status snapshot. MUST NOT call Powens; MUST NOT include
   * tokens, secrets, account numbers, or `lastError` body strings.
   */
  readonly listConnectionStatuses: () => Promise<ReadonlyArray<PowensProviderConnectionSnapshot>>
  readonly logTarget: ProviderLogTarget
  readonly now?: () => Date
}

export interface PowensProviderHandle {
  readonly provider: Provider<typeof CAPABILITY>
  /**
   * Refreshes the in-memory health snapshot from the local connection status repository.
   * The dashboard runtime calls this from the diagnostics route before reading
   * `getHealth()`. Idempotent and safe to call concurrently — exceptions are swallowed
   * and downgrade the snapshot to `degraded`.
   */
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

const computeHealthFromSnapshots = (
  connections: ReadonlyArray<PowensProviderConnectionSnapshot>
): HealthState => {
  if (connections.length === 0) {
    return {
      status: 'degraded',
      lastSuccessAt: null,
      lastErrorCode: 'unconfigured',
      note: 'no Powens connections configured',
    }
  }

  let lastSuccessMs: number | null = null
  let errorCount = 0
  let reconnectCount = 0
  let koCount = 0
  let okCount = 0

  for (const connection of connections) {
    if (connection.lastSuccessAt) {
      const ms = connection.lastSuccessAt.getTime()
      if (lastSuccessMs === null || ms > lastSuccessMs) {
        lastSuccessMs = ms
      }
    }
    if (connection.status === 'error') {
      errorCount += 1
    } else if (connection.status === 'reconnect_required') {
      reconnectCount += 1
    }
    if (connection.lastSyncStatus === 'KO') {
      koCount += 1
    } else if (connection.lastSyncStatus === 'OK') {
      okCount += 1
    }
  }

  const lastSuccessAt = lastSuccessMs !== null ? new Date(lastSuccessMs).toISOString() : null

  // All configured connections are in a hard-error state with no recent success → down.
  if (errorCount === connections.length && lastSuccessMs === null) {
    return {
      status: 'down',
      lastSuccessAt,
      lastErrorCode: 'provider_unavailable',
      note: `${errorCount} of ${connections.length} connection(s) in error state`,
    }
  }

  // Auth-style failure: any connection asks for reconnect.
  if (reconnectCount > 0) {
    return {
      status: 'degraded',
      lastSuccessAt,
      lastErrorCode: 'auth_failed',
      note: `${reconnectCount} connection(s) require reconnect`,
    }
  }

  // Soft-fail: any connection in error or any last sync KO, but at least one success.
  if (errorCount > 0 || koCount > 0) {
    return {
      status: 'degraded',
      lastSuccessAt,
      lastErrorCode: 'transient',
      note: `${errorCount + koCount} connection(s) reporting last-sync issues`,
    }
  }

  if (okCount > 0 || lastSuccessMs !== null) {
    return {
      status: 'ok',
      lastSuccessAt,
      lastErrorCode: null,
    }
  }

  // Connections exist but none have ever synced successfully and none are in error —
  // treat as degraded/unconfigured rather than `down`, per Macro Prompt 4 health rules.
  return {
    status: 'degraded',
    lastSuccessAt,
    lastErrorCode: 'unconfigured',
    note: 'connections present but no successful sync recorded',
  }
}

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

export const createPowensProvider = (deps: PowensProviderDeps): PowensProviderHandle => {
  const { listConnectionStatuses, logTarget } = deps
  const now = deps.now ?? (() => new Date())

  let health: HealthState = { ...INITIAL_HEALTH }

  const refreshHealth = async (): Promise<void> => {
    try {
      const snapshots = await listConnectionStatuses()
      health = computeHealthFromSnapshots(snapshots)
      logProviderEvent(logTarget, {
        name: 'provider.health.checked',
        fields: {
          providerId: PROVIDER_ID,
          capability: CAPABILITY,
          status: health.status,
          ...(health.lastErrorCode ? { errorCode: health.lastErrorCode } : {}),
          itemCount: snapshots.length,
        },
      })
    } catch {
      // The injected closure should never throw, but be defensive: any unexpected
      // exception (DB unavailable, etc.) downgrades the snapshot. The exception
      // object is intentionally dropped — it could carry connection ids or
      // `lastError` strings.
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

      // Macro Prompt 4 ships the wrapper as a health-only foundation. Read routing
      // through `provider.call()` is deferred to a follow-up macro prompt; the existing
      // Powens routes/repositories continue to serve reads unchanged. We surface this
      // explicitly so callers cannot silently treat the wrapper as a real read path.
      const error = createProviderError({
        code: 'unsupported_capability',
        providerId: PROVIDER_ID,
        capability: CAPABILITY,
        requestId: ctx.requestId,
        message: 'powens read routing is deferred (health-only wrapper)',
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

      // `now()` is invoked so the closure honors the injected clock; the value is not
      // exposed in the response (closed-vocab error path).
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
