import type { PushPermissionState, PushSettingsResponse, RedisClient } from '../types'

const PUSH_SETTINGS_KEY = 'notifications:push:settings'
const PUSH_SUBSCRIPTION_KEY = 'notifications:push:subscription'

const toBoolean = (value: string | null, fallback: boolean) => {
  if (!value) {
    return fallback
  }

  const normalized = value.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes'
}

const toPermission = (value: string | null): PushPermissionState => {
  if (value === 'granted' || value === 'denied' || value === 'unknown') {
    return value
  }

  return 'unknown'
}

const nowIso = () => new Date().toISOString()

export const getStoredPushSettings = async ({
  redis,
  mode,
  featureEnabled,
  criticalEnabled,
  providerAvailable,
}: {
  redis: RedisClient
  mode: 'demo' | 'admin'
  featureEnabled: boolean
  criticalEnabled: boolean
  providerAvailable: boolean
}): Promise<PushSettingsResponse> => {
  if (mode === 'demo') {
    return {
      enabled: true,
      mode: 'demo',
      featureEnabled,
      criticalEnabled,
      providerAvailable,
      providerStatus: providerAvailable ? 'available' : 'unavailable',
      optIn: true,
      permission: 'granted',
      subscriptionStale: false,
    }
  }

  const [settingsRaw, subscriptionRaw] = await Promise.all([
    redis.hGetAll(PUSH_SETTINGS_KEY),
    redis.hGetAll(PUSH_SUBSCRIPTION_KEY),
  ])

  const permission = toPermission(settingsRaw.permission ?? null)
  const subscriptionExpiredAt = subscriptionRaw.expiresAt?.trim()
  const subscriptionStale =
    subscriptionExpiredAt !== undefined && subscriptionExpiredAt.length > 0
      ? Date.parse(subscriptionExpiredAt) < Date.now()
      : false

  return {
    enabled: featureEnabled,
    mode: 'admin',
    featureEnabled,
    criticalEnabled,
    providerAvailable,
    providerStatus: providerAvailable ? 'available' : 'unavailable',
    optIn: toBoolean(settingsRaw.optIn ?? null, false),
    permission,
    subscriptionStale,
    ...(!featureEnabled
      ? { unavailableReason: 'feature_disabled' as const }
      : !criticalEnabled
        ? { unavailableReason: 'critical_disabled' as const }
        : !providerAvailable
          ? { unavailableReason: 'provider_unavailable' as const }
          : {}),
  }
}

export const setStoredPushOptIn = async ({
  redis,
  optIn,
  permission,
}: {
  redis: RedisClient
  optIn: boolean
  permission: PushPermissionState
}) => {
  await redis.hSet(PUSH_SETTINGS_KEY, {
    optIn: String(optIn),
    permission,
    updatedAt: nowIso(),
  })
}

export const setStoredPushSubscription = async ({
  redis,
  endpoint,
  auth,
  p256dh,
  expiresAt,
}: {
  redis: RedisClient
  endpoint: string
  auth: string
  p256dh: string
  expiresAt?: string
}) => {
  await redis.hSet(PUSH_SUBSCRIPTION_KEY, {
    endpoint,
    auth,
    p256dh,
    ...(expiresAt ? { expiresAt } : {}),
    updatedAt: nowIso(),
  })
}

export const getStoredPushSubscription = async (redis: RedisClient) => {
  const raw = await redis.hGetAll(PUSH_SUBSCRIPTION_KEY)
  if (!raw.endpoint || !raw.auth || !raw.p256dh) {
    return null
  }

  return {
    endpoint: raw.endpoint,
    auth: raw.auth,
    p256dh: raw.p256dh,
    ...(raw.expiresAt ? { expiresAt: raw.expiresAt } : {}),
  }
}
