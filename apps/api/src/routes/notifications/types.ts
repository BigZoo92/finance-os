import type { getApiEnv } from '@finance-os/env'
import type { createRedisClient } from '@finance-os/redis'

export type ApiEnv = ReturnType<typeof getApiEnv>
export type RedisClient = ReturnType<typeof createRedisClient>['client']

export type PushPermissionState = 'unknown' | 'denied' | 'granted'

export type PushSettingsResponse = {
  enabled: boolean
  mode: 'demo' | 'admin'
  featureEnabled: boolean
  criticalEnabled: boolean
  providerAvailable: boolean
  providerStatus: 'available' | 'unavailable'
  optIn: boolean
  permission: PushPermissionState
  subscriptionStale: boolean
  unavailableReason?: 'feature_disabled' | 'critical_disabled' | 'provider_unavailable'
}

export type PushDeliveryErrorCode =
  | 'permission_denied'
  | 'subscription_expired'
  | 'provider_unavailable'

export type PushDeliveryResult =
  | {
      ok: true
      requestId: string
      mode: 'demo' | 'admin'
      delivery: 'mocked' | 'sent'
      providerStatus: 'available' | 'unavailable'
    }
  | {
      ok: false
      requestId: string
      code: PushDeliveryErrorCode
      message: string
      mode: 'demo' | 'admin'
      providerStatus: 'available' | 'unavailable'
    }
