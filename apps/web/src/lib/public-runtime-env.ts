import { env } from '@/env'

export type PublicRuntimeEnvKey =
  | 'VITE_APP_TITLE'
  | 'VITE_APP_ORIGIN'
  | 'VITE_API_BASE_URL'

export type PublicRuntimeEnv = Partial<Record<PublicRuntimeEnvKey, string>>

const PUBLIC_RUNTIME_ENV_KEYS: PublicRuntimeEnvKey[] = [
  'VITE_APP_TITLE',
  'VITE_APP_ORIGIN',
  'VITE_API_BASE_URL',
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
