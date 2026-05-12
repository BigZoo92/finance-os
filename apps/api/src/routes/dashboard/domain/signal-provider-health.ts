/**
 * Compute social signal provider health from API runtime env without ever
 * leaking secret values. Each provider returns a fine-grained `reason` that
 * the admin UI can use to distinguish:
 *   - the API env is silently missing (compose drift)
 *   - the bearer token is empty
 *   - the provider is disabled by flag
 *   - the worker schedules polling but the API can't actually run the provider
 *   - the worker polling itself is disabled
 *   - the advisor mode is off
 */

export type XTwitterHealthReason =
  | 'API_ENV_MISSING'
  | 'TOKEN_MISSING'
  | 'PROVIDER_DISABLED'
  | 'RUNTIME_MISMATCH'
  | 'WORKER_POLLING_DISABLED'
  | 'MODE_OFF'
  | null

export type XTwitterProviderHealth = {
  configured: boolean
  enabled: boolean
  tokenPresent: boolean
  queryPresent: boolean
  mode: 'off' | 'shadow' | 'enforced'
  workerPollingEnabled: boolean
  apiRuntimeConfigured: boolean
  reason: XTwitterHealthReason
}

export type BlueskyHealthReason = 'PROVIDER_DISABLED' | 'NOT_CONFIGURED' | null

export type BlueskyProviderHealth = {
  configured: boolean
  enabled: boolean
  tokenPresent: boolean
  reason: BlueskyHealthReason
}

type EnvSource = NodeJS.ProcessEnv

export const computeXTwitterProviderHealth = (
  env: EnvSource = process.env
): XTwitterProviderHealth => {
  const rawEnabled = env.NEWS_PROVIDER_X_TWITTER_ENABLED
  const enabled = rawEnabled === 'true'
  const bearerToken = env.NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN
  const tokenPresent = !!bearerToken && bearerToken.length > 0
  const query = env.NEWS_PROVIDER_X_TWITTER_QUERY
  const queryPresent = !!query && query.length > 0
  const rawMode = env.ADVISOR_X_SIGNALS_MODE
  const mode: XTwitterProviderHealth['mode'] =
    rawMode === 'off' || rawMode === 'enforced' ? rawMode : 'shadow'
  const workerPollingEnabled = env.SIGNALS_SOCIAL_POLLING_ENABLED === 'true'
  const apiRuntimeConfigured = enabled && tokenPresent && queryPresent

  let reason: XTwitterHealthReason = null
  if (rawEnabled === undefined) {
    reason = 'API_ENV_MISSING'
  } else if (!tokenPresent) {
    reason = 'TOKEN_MISSING'
  } else if (!enabled) {
    reason = 'PROVIDER_DISABLED'
  } else if (workerPollingEnabled && !apiRuntimeConfigured) {
    reason = 'RUNTIME_MISMATCH'
  } else if (!workerPollingEnabled && apiRuntimeConfigured) {
    reason = 'WORKER_POLLING_DISABLED'
  } else if (mode === 'off') {
    reason = 'MODE_OFF'
  }

  return {
    configured: tokenPresent,
    enabled,
    tokenPresent,
    queryPresent,
    mode,
    workerPollingEnabled,
    apiRuntimeConfigured,
    reason,
  }
}

export const computeBlueskyProviderHealth = (
  env: EnvSource = process.env
): BlueskyProviderHealth => {
  const enabled = env.BLUESKY_ENABLED === 'true'
  const passwordPresent = !!env.BLUESKY_APP_PASSWORD && env.BLUESKY_APP_PASSWORD.length > 0
  const handlePresent = !!env.BLUESKY_HANDLE && env.BLUESKY_HANDLE.length > 0
  let reason: BlueskyHealthReason = null
  if (!enabled) reason = 'PROVIDER_DISABLED'
  else if (!handlePresent || !passwordPresent) reason = 'NOT_CONFIGURED'
  return { configured: passwordPresent, enabled, tokenPresent: passwordPresent, reason }
}
