import { readPublicRuntimeEnv } from '@/lib/public-runtime-env'

const toOptionalEnv = (value: string | undefined) => {
  if (!value) {
    return undefined
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

const toBoolean = (value: string | undefined, fallback: boolean) => {
  const normalized = toOptionalEnv(value)?.toLowerCase()
  if (!normalized) {
    return fallback
  }

  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false
  }

  return fallback
}

export const getPushUiConfig = () => {
  const enabled = toBoolean(readPublicRuntimeEnv('VITE_PWA_NOTIFICATIONS_ENABLED'), true)
  const criticalEnabled = toBoolean(readPublicRuntimeEnv('VITE_PWA_CRITICAL_ENABLED'), true)

  return {
    enabled,
    criticalEnabled,
  }
}
