import { Elysia, t } from 'elysia'
import { getAuth, getRequestMeta } from '../../../auth/context'
import { requireAdmin } from '../../../auth/guard'
import { logApiEvent } from '../../../observability/logger'
import { deliverCriticalNotification } from '../services/delivery-worker'
import {
  getStoredPushSettings,
  getStoredPushSubscription,
  setStoredPushOptIn,
  setStoredPushSubscription,
} from '../services/push-store'
import type { ApiEnv, PushPermissionState, RedisClient } from '../types'

const permissionSchema = t.Union([
  t.Literal('unknown'),
  t.Literal('denied'),
  t.Literal('granted'),
])

export const createPushNotificationsRoute = ({
  redis,
  env,
}: {
  redis: RedisClient
  env: ApiEnv
}) => {
  const providerAvailable = Boolean(
    env.PUSH_VAPID_PUBLIC_KEY && env.PUSH_VAPID_PRIVATE_KEY && env.PUSH_DELIVERY_PROVIDER_URL
  )

  return new Elysia({ prefix: '/push' })
    .get('/settings', async context => {
      const requestId = getRequestMeta(context).requestId
      const mode = getAuth(context).mode

      const settings = await getStoredPushSettings({
        redis,
        mode,
        featureEnabled: env.PWA_NOTIFICATIONS_ENABLED,
        criticalEnabled: env.PWA_CRITICAL_ENABLED,
        providerAvailable,
      })

      return {
        ...settings,
        requestId,
      }
    })
    .post(
      '/opt-in',
      async context => {
        const requestId = getRequestMeta(context).requestId
        const mode = getAuth(context).mode

        if (mode === 'demo') {
          logApiEvent({
            level: 'info',
            msg: 'push_opt_in_changed',
            requestId,
            mode,
            optIn: context.body.optIn,
            permission: context.body.permission,
            delivery: 'demo_mock',
          })

          return {
            ok: true,
            mode,
            requestId,
          }
        }

        requireAdmin(context)

        await setStoredPushOptIn({
          redis,
          optIn: context.body.optIn,
          permission: context.body.permission as PushPermissionState,
        })

        logApiEvent({
          level: 'info',
          msg: 'push_opt_in_changed',
          requestId,
          mode,
          optIn: context.body.optIn,
          permission: context.body.permission,
        })

        return {
          ok: true,
          mode,
          requestId,
        }
      },
      {
        body: t.Object({
          optIn: t.Boolean(),
          permission: permissionSchema,
        }),
      }
    )
    .post(
      '/subscription',
      async context => {
        const requestId = getRequestMeta(context).requestId
        const mode = getAuth(context).mode

        if (mode === 'demo') {
          return {
            ok: true,
            mode,
            requestId,
          }
        }

        requireAdmin(context)

        await setStoredPushSubscription({
          redis,
          endpoint: context.body.endpoint,
          auth: context.body.keys.auth,
          p256dh: context.body.keys.p256dh,
          ...(context.body.expiresAt ? { expiresAt: context.body.expiresAt } : {}),
        })

        logApiEvent({
          level: 'info',
          msg: 'push_subscription_registered',
          requestId,
          mode,
        })

        return {
          ok: true,
          mode,
          requestId,
        }
      },
      {
        body: t.Object({
          endpoint: t.String({ minLength: 1 }),
          expiresAt: t.Optional(t.String({ minLength: 1 })),
          keys: t.Object({
            auth: t.String({ minLength: 1 }),
            p256dh: t.String({ minLength: 1 }),
          }),
        }),
      }
    )
    .post('/send-preview', async context => {
      const requestId = getRequestMeta(context).requestId
      const mode = getAuth(context).mode

      if (!env.PWA_NOTIFICATIONS_ENABLED || !env.PWA_CRITICAL_ENABLED) {
        context.set.status = 503
        return {
          ok: false,
          code: 'provider_unavailable' as const,
          message: 'Notifications are temporarily unavailable.',
          requestId,
          mode,
          providerStatus: providerAvailable ? 'available' : 'unavailable',
        }
      }

      const settings = await getStoredPushSettings({
        redis,
        mode,
        featureEnabled: env.PWA_NOTIFICATIONS_ENABLED,
        criticalEnabled: env.PWA_CRITICAL_ENABLED,
        providerAvailable,
      })
      const subscription = mode === 'demo' ? { endpoint: 'demo://push' } : await getStoredPushSubscription(redis)

      const result = await deliverCriticalNotification({
        mode,
        requestId,
        providerAvailable,
        subscription,
        permission: settings.permission,
        optIn: settings.optIn,
      })

      if (!result.ok) {
        context.set.status = result.code === 'provider_unavailable' ? 503 : 409
      }

      return result
    })
}
