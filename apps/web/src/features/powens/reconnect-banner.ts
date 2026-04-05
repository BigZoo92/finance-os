import type { AuthMode } from '@/features/auth-types'
import type { PowensStatusResponse } from '@/features/powens/types'
import { readPublicRuntimeEnv } from '@/lib/public-runtime-env'

const RECONNECT_BANNER_EVENT_SCOPE = '[web:powens-reconnect-banner]'
const RECONNECT_BANNER_DEFER_STORAGE_KEY = 'finance-os:powens-reconnect-banner-deferred:v1'

export type PowensReconnectBannerUiState =
  | 'loading'
  | 'required'
  | 'in_progress'
  | 'success'
  | 'error_retryable'
  | 'deferred'

export type PowensReconnectBannerDeferredSnapshot = {
  fingerprint: string
  deferredAt: string
}

export const createPowensRequestId = (action: 'status' | 'reconnect') => {
  const randomPart =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

  return `powens-${action}-${randomPart}`
}

const parseBooleanUiFlag = (value: string | undefined) => {
  const normalized = value?.trim().toLowerCase()

  if (!normalized) {
    return undefined
  }

  if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') {
    return true
  }

  if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') {
    return false
  }

  return undefined
}

export const getPowensReconnectBannerUiEnabled = () => {
  return parseBooleanUiFlag(readPublicRuntimeEnv('VITE_UI_RECONNECT_BANNER_ENABLED')) ?? true
}

export const getReconnectRequiredConnectionIds = (status: PowensStatusResponse | undefined) => {
  if (!status) {
    return []
  }

  return status.connections
    .filter(connection => connection.status === 'reconnect_required')
    .map(connection => connection.powensConnectionId)
    .sort((left, right) => left.localeCompare(right))
}

export const createReconnectRequiredFingerprint = (connectionIds: string[]) => {
  return connectionIds.length > 0 ? connectionIds.join('|') : 'none'
}

const canUseLocalStorage = () => {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export const readReconnectBannerDeferredSnapshot = (): PowensReconnectBannerDeferredSnapshot | null => {
  if (!canUseLocalStorage()) {
    return null
  }

  try {
    const value = window.localStorage.getItem(RECONNECT_BANNER_DEFER_STORAGE_KEY)

    if (!value) {
      return null
    }

    const parsed = JSON.parse(value) as Partial<PowensReconnectBannerDeferredSnapshot>

    if (typeof parsed.fingerprint !== 'string' || typeof parsed.deferredAt !== 'string') {
      return null
    }

    return {
      fingerprint: parsed.fingerprint,
      deferredAt: parsed.deferredAt,
    }
  } catch {
    return null
  }
}

export const writeReconnectBannerDeferredSnapshot = (
  snapshot: PowensReconnectBannerDeferredSnapshot
) => {
  if (!canUseLocalStorage()) {
    return
  }

  try {
    window.localStorage.setItem(RECONNECT_BANNER_DEFER_STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    // Ignore localStorage quota/privacy errors.
  }
}

export const clearReconnectBannerDeferredSnapshot = () => {
  if (!canUseLocalStorage()) {
    return
  }

  try {
    window.localStorage.removeItem(RECONNECT_BANNER_DEFER_STORAGE_KEY)
  } catch {
    // Ignore localStorage quota/privacy errors.
  }
}

export const logReconnectBannerShown = ({
  mode,
  state,
  fingerprint,
  requestId,
  fallback,
}: {
  mode: AuthMode
  state: PowensReconnectBannerUiState
  fingerprint: string
  requestId: string | null
  fallback: 'status_unavailable' | null
}) => {
  console.info(RECONNECT_BANNER_EVENT_SCOPE, {
    event: 'reconnect_banner_shown',
    mode,
    state,
    fingerprint,
    requestId,
    fallback,
    timestamp: new Date().toISOString(),
  })
}

export const logReconnectBannerCtaClicked = ({
  mode,
  cta,
  state,
  fingerprint,
  requestId,
}: {
  mode: AuthMode
  cta: 'reconnect' | 'later'
  state: PowensReconnectBannerUiState
  fingerprint: string
  requestId: string | null
}) => {
  console.info(RECONNECT_BANNER_EVENT_SCOPE, {
    event: 'reconnect_cta_clicked',
    mode,
    cta,
    state,
    fingerprint,
    requestId,
    timestamp: new Date().toISOString(),
  })
}

export const logReconnectBannerDismissed = ({
  mode,
  state,
  fingerprint,
  requestId,
}: {
  mode: AuthMode
  state: PowensReconnectBannerUiState
  fingerprint: string
  requestId: string | null
}) => {
  console.info(RECONNECT_BANNER_EVENT_SCOPE, {
    event: 'reconnect_dismissed',
    mode,
    state,
    fingerprint,
    requestId,
    timestamp: new Date().toISOString(),
  })
}
