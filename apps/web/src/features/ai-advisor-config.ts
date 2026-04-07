import { readPublicRuntimeEnv } from '@/lib/public-runtime-env'

const toBooleanFlag = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) {
    return fallback
  }

  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false
  }
  return fallback
}

export const getAiAdvisorUiFlags = () => {
  const enabled = toBooleanFlag(readPublicRuntimeEnv('VITE_AI_ADVISOR_ENABLED'), true)
  const adminOnly = toBooleanFlag(readPublicRuntimeEnv('VITE_AI_ADVISOR_ADMIN_ONLY'), false)

  return {
    enabled,
    adminOnly,
  }
}
