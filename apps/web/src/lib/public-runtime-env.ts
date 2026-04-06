import { env } from '@/env'

export type PublicRuntimeEnvKey =
  | 'VITE_APP_TITLE'
  | 'VITE_APP_ORIGIN'
  | 'VITE_API_BASE_URL'
  | 'VITE_POWENS_SYNC_COOLDOWN_UI_ENABLED'
  | 'VITE_POWENS_SYNC_COOLDOWN_UI_SECONDS'
  | 'VITE_DASHBOARD_HEALTH_SIGNALS_ENABLED'
  | 'VITE_DASHBOARD_HEALTH_GLOBAL_INDICATOR_ENABLED'
  | 'VITE_DASHBOARD_HEALTH_WIDGET_BADGES_ENABLED'
  | 'VITE_UI_RECONNECT_BANNER_ENABLED'
  | 'VITE_PWA_NOTIFICATIONS_ENABLED'
  | 'VITE_PWA_CRITICAL_ENABLED'

export type PublicRuntimeEnv = Partial<Record<PublicRuntimeEnvKey, string>>

const PUBLIC_RUNTIME_ENV_KEYS: PublicRuntimeEnvKey[] = [
  'VITE_APP_TITLE',
  'VITE_APP_ORIGIN',
  'VITE_API_BASE_URL',
  'VITE_POWENS_SYNC_COOLDOWN_UI_ENABLED',
  'VITE_POWENS_SYNC_COOLDOWN_UI_SECONDS',
  'VITE_DASHBOARD_HEALTH_SIGNALS_ENABLED',
  'VITE_DASHBOARD_HEALTH_GLOBAL_INDICATOR_ENABLED',
  'VITE_DASHBOARD_HEALTH_WIDGET_BADGES_ENABLED',
  'VITE_UI_RECONNECT_BANNER_ENABLED',
  'VITE_PWA_NOTIFICATIONS_ENABLED',
  'VITE_PWA_CRITICAL_ENABLED',
]

const toOptionalEnv = (value: string | undefined) => {
  if (!value) {
    return undefined
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

const withDefined = <TKey extends PublicRuntimeEnvKey>(key: TKey, value: string | undefined) => {
  if (value === undefined) {
    return {}
  }

  return {
    [key]: value,
  } as { [K in TKey]?: string }
}

declare global {
  interface Window {
    __FINANCE_OS_PUBLIC_RUNTIME_ENV__?: PublicRuntimeEnv
  }
}

const getStaticPublicEnv = (): PublicRuntimeEnv => ({
  ...withDefined('VITE_APP_TITLE', toOptionalEnv(env.VITE_APP_TITLE)),
  ...withDefined('VITE_APP_ORIGIN', toOptionalEnv(env.VITE_APP_ORIGIN)),
  ...withDefined('VITE_API_BASE_URL', toOptionalEnv(env.VITE_API_BASE_URL)),
  ...withDefined(
    'VITE_POWENS_SYNC_COOLDOWN_UI_ENABLED',
    toOptionalEnv(env.VITE_POWENS_SYNC_COOLDOWN_UI_ENABLED)
  ),
  ...withDefined(
    'VITE_POWENS_SYNC_COOLDOWN_UI_SECONDS',
    toOptionalEnv(env.VITE_POWENS_SYNC_COOLDOWN_UI_SECONDS)
  ),
  ...withDefined(
    'VITE_DASHBOARD_HEALTH_SIGNALS_ENABLED',
    toOptionalEnv(env.VITE_DASHBOARD_HEALTH_SIGNALS_ENABLED)
  ),
  ...withDefined(
    'VITE_DASHBOARD_HEALTH_GLOBAL_INDICATOR_ENABLED',
    toOptionalEnv(env.VITE_DASHBOARD_HEALTH_GLOBAL_INDICATOR_ENABLED)
  ),
  ...withDefined(
    'VITE_DASHBOARD_HEALTH_WIDGET_BADGES_ENABLED',
    toOptionalEnv(env.VITE_DASHBOARD_HEALTH_WIDGET_BADGES_ENABLED)
  ),
  ...withDefined(
    'VITE_UI_RECONNECT_BANNER_ENABLED',
    toOptionalEnv(env.VITE_UI_RECONNECT_BANNER_ENABLED)
  ),
  ...withDefined(
    'VITE_PWA_NOTIFICATIONS_ENABLED',
    toOptionalEnv(env.VITE_PWA_NOTIFICATIONS_ENABLED)
  ),
  ...withDefined('VITE_PWA_CRITICAL_ENABLED', toOptionalEnv(env.VITE_PWA_CRITICAL_ENABLED)),
})

const getWindowPublicEnv = (): PublicRuntimeEnv => {
  if (typeof window === 'undefined') {
    return {}
  }

  return window.__FINANCE_OS_PUBLIC_RUNTIME_ENV__ ?? {}
}

const readServerPublicEnv = (key: PublicRuntimeEnvKey) => {
  if (typeof process === 'undefined') {
    return undefined
  }

  return toOptionalEnv(process.env[key])
}

export const getPublicRuntimeEnv = (): PublicRuntimeEnv => ({
  ...getStaticPublicEnv(),
  ...getWindowPublicEnv(),
  ...(typeof window === 'undefined'
    ? (Object.fromEntries(
        PUBLIC_RUNTIME_ENV_KEYS.flatMap(key => {
          const value = readServerPublicEnv(key)
          return value ? [[key, value]] : []
        })
      ) as PublicRuntimeEnv)
    : {}),
})

export const readPublicRuntimeEnv = (key: PublicRuntimeEnvKey) => {
  return getPublicRuntimeEnv()[key]
}

const escapeScriptContent = (value: string) =>
  value.replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')

export const getPublicRuntimeEnvScript = () => {
  return `window.__FINANCE_OS_PUBLIC_RUNTIME_ENV__=${escapeScriptContent(
    JSON.stringify(getPublicRuntimeEnv())
  )};`
}
