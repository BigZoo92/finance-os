import { logApiEvent } from '../../../observability/logger'
import type { PushDeliveryResult } from '../types'

const isSubscriptionExpired = (expiresAt?: string) => {
  if (!expiresAt) {
    return false
  }

  return Date.parse(expiresAt) < Date.now()
}

export const deliverCriticalNotification = async ({
  mode,
  requestId,
  providerAvailable,
  subscription,
  permission,
  optIn,
}: {
  mode: 'demo' | 'admin'
  requestId: string
  providerAvailable: boolean
  subscription: { endpoint: string; expiresAt?: string } | null
  permission: 'unknown' | 'denied' | 'granted'
  optIn: boolean
}): Promise<PushDeliveryResult> => {
  logApiEvent({
    level: 'info',
    msg: 'push_delivery_attempted',
    requestId,
    mode,
    providerAvailable,
  })

  if (!optIn || permission === 'denied') {
    const result: PushDeliveryResult = {
      ok: false,
      requestId,
      code: 'permission_denied',
      message: 'Push permission denied or opt-in disabled.',
      mode,
      providerStatus: providerAvailable ? 'available' : 'unavailable',
    }

    logApiEvent({
      level: 'warn',
      msg: 'push_delivery_result',
      requestId,
      mode,
      ok: false,
      code: result.code,
    })

    return result
  }

  if (!subscription || isSubscriptionExpired(subscription.expiresAt)) {
    const result: PushDeliveryResult = {
      ok: false,
      requestId,
      code: 'subscription_expired',
      message: 'Push subscription missing or expired.',
      mode,
      providerStatus: providerAvailable ? 'available' : 'unavailable',
    }

    logApiEvent({
      level: 'warn',
      msg: 'push_delivery_result',
      requestId,
      mode,
      ok: false,
      code: result.code,
    })

    return result
  }

  if (!providerAvailable && mode === 'admin') {
    const result: PushDeliveryResult = {
      ok: false,
      requestId,
      code: 'provider_unavailable',
      message: 'Push delivery provider unavailable.',
      mode,
      providerStatus: 'unavailable',
    }

    logApiEvent({
      level: 'warn',
      msg: 'push_delivery_result',
      requestId,
      mode,
      ok: false,
      code: result.code,
    })

    return result
  }

  const result: PushDeliveryResult = {
    ok: true,
    requestId,
    mode,
    delivery: mode === 'demo' ? 'mocked' : 'sent',
    providerStatus: providerAvailable ? 'available' : 'unavailable',
  }

  logApiEvent({
    level: 'info',
    msg: 'push_delivery_result',
    requestId,
    mode,
    ok: true,
    delivery: result.delivery,
  })

  return result
}
