// PR17C — Provider diagnostics use-case (no API endpoint).
//
// Pure function over a `ProviderRegistry` + a `ProviderCallContext`. Returns a
// browser-safe shape any future admin/diagnostics route can serve directly. Demo mode
// returns a deterministic fixture; admin mode reads `getHealth()` snapshots only — no
// `call()` is performed. Wiring this into an Elysia route is left to a focused PR.

import type {
  ProviderCallContext,
  ProviderCapability,
  ProviderHealth,
  ProviderHealthStatus,
  ProviderId,
} from '@finance-os/provider-contract'
import type { ProviderRegistry } from './registry'

export type ProviderDiagnosticsStatus = ProviderHealthStatus | 'unknown' | 'disabled'

export interface ProviderDiagnosticsEntry {
  readonly providerId: ProviderId
  readonly status: ProviderDiagnosticsStatus
  readonly capabilities: ReadonlyArray<ProviderCapability>
  readonly lastCheckedAt: string | null
  readonly degraded: boolean
  readonly freshnessMinutes: number | null
  readonly errorCode: string | null
  readonly caveats: ReadonlyArray<string>
}

export interface ProviderDiagnosticsSummary {
  readonly total: number
  readonly healthy: number
  readonly degraded: number
  readonly down: number
  readonly unknown: number
  readonly disabled: number
}

export interface ProviderDiagnosticsResponse {
  readonly generatedAt: string
  readonly mode: 'demo' | 'admin'
  readonly providers: ReadonlyArray<ProviderDiagnosticsEntry>
  readonly summary: ProviderDiagnosticsSummary
  readonly caveats: ReadonlyArray<string>
}

const FOUNDATION_CAVEAT = 'provider registry is foundation-only until provider migrations land'

const NO_PROVIDERS_CAVEAT = 'no providers are registered yet'

const emptySummary = (): ProviderDiagnosticsSummary => ({
  total: 0,
  healthy: 0,
  degraded: 0,
  down: 0,
  unknown: 0,
  disabled: 0,
})

const summarize = (
  entries: ReadonlyArray<ProviderDiagnosticsEntry>
): ProviderDiagnosticsSummary => {
  const out: {
    total: number
    healthy: number
    degraded: number
    down: number
    unknown: number
    disabled: number
  } = {
    total: entries.length,
    healthy: 0,
    degraded: 0,
    down: 0,
    unknown: 0,
    disabled: 0,
  }
  for (const entry of entries) {
    switch (entry.status) {
      case 'ok':
        out.healthy += 1
        break
      case 'degraded':
        out.degraded += 1
        break
      case 'down':
        out.down += 1
        break
      case 'unknown':
        out.unknown += 1
        break
      case 'disabled':
        out.disabled += 1
        break
      default: {
        const _exhaustive: never = entry.status
        return _exhaustive
      }
    }
  }
  return out
}

const healthToDiagnosticsStatus = (health: ProviderHealth): ProviderDiagnosticsStatus => {
  return health.status
}

export const computeDemoProviderDiagnostics = (
  generatedAt: string
): ProviderDiagnosticsResponse => {
  return {
    generatedAt,
    mode: 'demo',
    providers: [],
    summary: emptySummary(),
    caveats: [FOUNDATION_CAVEAT, 'demo mode never calls real providers'],
  }
}

export interface ComputeProviderDiagnosticsInput {
  readonly registry: ProviderRegistry
  readonly context: ProviderCallContext
}

export const computeProviderDiagnostics = (
  input: ComputeProviderDiagnosticsInput
): ProviderDiagnosticsResponse => {
  const generatedAt = input.context.now.toISOString()
  if (input.context.mode === 'demo') {
    return computeDemoProviderDiagnostics(generatedAt)
  }

  const providers = input.registry.listProviders()
  if (providers.length === 0) {
    return {
      generatedAt,
      mode: 'admin',
      providers: [],
      summary: emptySummary(),
      caveats: [FOUNDATION_CAVEAT, NO_PROVIDERS_CAVEAT],
    }
  }

  const entries: ProviderDiagnosticsEntry[] = providers
    // Macro Prompt 5 — stable ordering: alphabetize by `providerId` so the
    // diagnostics response shape is deterministic regardless of registry
    // construction order. Existing tests look up entries by `providerId`, so
    // this is non-breaking.
    .slice()
    .sort((a, b) => (a.id as unknown as string).localeCompare(b.id as unknown as string))
    .map(provider => {
      const health = provider.getHealth()
      // Macro Prompt 5 — caveat normalization. `unconfigured` and
      // `disabled_by_flag` MUST surface explicit reasons in `caveats` and MUST
      // NOT be reported as `down`. Local health helpers already map those
      // states to `degraded` with the appropriate `lastErrorCode`; this caveat
      // normalization makes the semantics visible to downstream consumers
      // without changing the closed `status` vocabulary.
      const caveats: string[] = []
      if (health.lastErrorCode === 'unconfigured') {
        caveats.push('provider unconfigured — not a runtime failure')
      }
      if (health.lastErrorCode === 'disabled_by_flag') {
        caveats.push('provider disabled by feature flag — not a runtime failure')
      }
      if (health.note) {
        caveats.push(health.note)
      }
      return {
        providerId: provider.id,
        status: healthToDiagnosticsStatus(health),
        capabilities: [provider.capability],
        lastCheckedAt: health.lastSuccessAt,
        degraded: health.status === 'degraded',
        freshnessMinutes: null,
        errorCode: health.lastErrorCode,
        caveats,
      }
    })

  return {
    generatedAt,
    mode: 'admin',
    providers: entries,
    summary: summarize(entries),
    caveats: [FOUNDATION_CAVEAT],
  }
}
