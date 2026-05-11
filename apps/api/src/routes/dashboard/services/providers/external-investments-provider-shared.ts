// Macro Prompt 4 — Sensitive providers foundation: shared health-mapping helpers
// for IBKR Flex and Binance read-only wrappers. Both providers consume the same
// underlying tables (`externalInvestmentProviderHealth` + `externalInvestmentConnection`)
// so health derivation is centralized here. The wrappers themselves stay separate so
// that each retains a distinct `Provider.id` + capability surface.
//
// Strict invariants:
//   - This helper performs NO IO and imports nothing from the external-investments
//     adapters or the upstream HTTP clients.
//   - Inputs MUST be the closed-vocabulary snapshot defined by
//     `ExternalInvestmentsProviderSnapshot`. Tokens, raw payloads, and account ids
//     are not accepted.

import type { ProviderHealth } from '@finance-os/provider-contract'

/**
 * Closed-vocabulary external-investments provider snapshot consumed by the IBKR /
 * Binance wrappers. The shape mirrors the safe columns surfaced by the underlying
 * `externalInvestmentProviderHealth` + `externalInvestmentConnection` tables and
 * intentionally excludes any field that could carry credentials, raw payloads, or
 * account identifiers.
 */
export interface ExternalInvestmentsProviderSnapshot {
  /** From `externalInvestmentProviderHealth.enabled`. Whether the provider is wired in. */
  readonly enabled: boolean
  /**
   * From `externalInvestmentProviderHealth.status` ('healthy' | 'degraded' | 'failing'
   * | 'idle'). 'idle' is the default state for a configured-but-never-synced provider.
   */
  readonly status: 'healthy' | 'degraded' | 'failing' | 'idle'
  readonly lastSuccessAt: string | null
  readonly lastFailureAt: string | null
  /**
   * Whether a credential record is configured for this provider (per
   * `externalInvestmentConnection.credentialStatus === 'configured'`). When `false`
   * the snapshot is treated as unconfigured regardless of `enabled`.
   */
  readonly credentialConfigured: boolean
  readonly successCount: number
  readonly failureCount: number
}

export interface ExternalInvestmentsHealthState {
  status: ProviderHealth['status']
  lastSuccessAt: string | null
  lastErrorCode: ProviderHealth['lastErrorCode']
  note?: string
}

/**
 * Map an external-investments provider snapshot to a ProviderHealth state, applying
 * the Macro Prompt 4 health-status rules:
 *   - missing snapshot / unconfigured / disabled → degraded with a caveat (NOT `down`).
 *   - configured but in `failing` repeated state → `down`.
 *   - mixed `degraded` / partial → `degraded`.
 *   - `healthy` → `ok`.
 */
export const computeExternalInvestmentsHealth = (
  snapshot: ExternalInvestmentsProviderSnapshot | null,
  providerLabel: string
): ExternalInvestmentsHealthState => {
  if (snapshot === null) {
    return {
      status: 'degraded',
      lastSuccessAt: null,
      lastErrorCode: 'unconfigured',
      note: `no ${providerLabel} provider health row recorded yet`,
    }
  }

  if (!snapshot.credentialConfigured) {
    return {
      status: 'degraded',
      lastSuccessAt: snapshot.lastSuccessAt,
      lastErrorCode: 'unconfigured',
      note: `${providerLabel} credentials not configured`,
    }
  }

  if (!snapshot.enabled) {
    return {
      status: 'degraded',
      lastSuccessAt: snapshot.lastSuccessAt,
      lastErrorCode: 'disabled_by_flag',
      note: `${providerLabel} disabled by feature flag`,
    }
  }

  switch (snapshot.status) {
    case 'healthy':
      return {
        status: 'ok',
        lastSuccessAt: snapshot.lastSuccessAt,
        lastErrorCode: null,
      }
    case 'failing':
      // Configured + enabled + provider in hard failure → `down`.
      return {
        status: 'down',
        lastSuccessAt: snapshot.lastSuccessAt,
        lastErrorCode: 'provider_unavailable',
        note: `${providerLabel} reporting failing status`,
      }
    case 'degraded':
      return {
        status: 'degraded',
        lastSuccessAt: snapshot.lastSuccessAt,
        lastErrorCode: 'transient',
        note: `${providerLabel} reporting degraded status`,
      }
    case 'idle':
      // Configured + enabled + never-synced → soft caveat, not `down`.
      return {
        status: 'degraded',
        lastSuccessAt: snapshot.lastSuccessAt,
        lastErrorCode: 'unconfigured',
        note: `${providerLabel} provider configured but no successful sync recorded`,
      }
    default: {
      const _exhaustive: never = snapshot.status
      return _exhaustive
    }
  }
}
