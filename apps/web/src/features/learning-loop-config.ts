// PR5 — Advisor Learning Loop UI feature flag.
//
// Off by default. Read at runtime so SSR and CSR resolve consistently. The flag is the only
// gate the UI honours — backend gating (AI_POST_MORTEM_ENABLED, budget guards, demo/admin)
// remains enforced server-side and is the authoritative source of truth.

import { readPublicRuntimeEnv } from '@/lib/public-runtime-env'

const toBooleanFlag = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) return fallback
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return fallback
}

export const getLearningLoopUiFlags = () => {
  const enabled = toBooleanFlag(readPublicRuntimeEnv('VITE_LEARNING_LOOP_UI_ENABLED'), false)
  return { enabled }
}
