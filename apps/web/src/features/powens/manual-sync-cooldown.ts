import { Store } from '@tanstack/store'
import type { AuthMode } from '@/features/auth-types'
import { readPublicRuntimeEnv } from '@/lib/public-runtime-env'

const DEFAULT_POWENS_MANUAL_SYNC_COOLDOWN_UI_SECONDS = 300
const COOLDOWN_TICK_MS = 1_000

type PowensManualSyncCooldownStoreState = {
  activeUntilMs: number | null
  lastActivatedAtMs: number | null
  nowMs: number
}

export type PowensManualSyncCooldownSnapshot = {
  isActive: boolean
  remainingMs: number
  remainingSeconds: number
  lastActivatedAtMs: number | null
}

export type PowensManualSyncUiPhase = 'idle' | 'syncing' | 'cooldown' | 'ready'

export type PowensManualSyncUiBlockReason = 'admin_only' | 'safe_mode' | 'syncing' | 'cooldown'

export type PowensManualSyncUiState = {
  blocked: boolean
  blockReason: PowensManualSyncUiBlockReason | null
  blockMessage: string | null
  cooldownRemainingSeconds: number
  phase: PowensManualSyncUiPhase
  statusLabel: string
  statusMessage: string
}

const createInitialCooldownStoreState = (): PowensManualSyncCooldownStoreState => ({
  activeUntilMs: null,
  lastActivatedAtMs: null,
  nowMs: Date.now(),
})

export const powensManualSyncCooldownStore = new Store<PowensManualSyncCooldownStoreState>(
  createInitialCooldownStoreState()
)

let cooldownTickTimer: ReturnType<typeof setInterval> | null = null

const toOptionalEnv = (value: string | undefined) => {
  if (!value) {
    return undefined
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

const parseBooleanUiFlag = (value: string | undefined) => {
  const normalized = toOptionalEnv(value)?.toLowerCase()

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

const parsePositiveInteger = (value: string | undefined) => {
  const normalized = toOptionalEnv(value)

  if (!normalized) {
    return undefined
  }

  const parsed = Number(normalized)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return undefined
  }

  return parsed
}

const stopCooldownTicker = () => {
  if (!cooldownTickTimer) {
    return
  }

  clearInterval(cooldownTickTimer)
  cooldownTickTimer = null
}

const syncCooldownClock = () => {
  const nowMs = Date.now()

  powensManualSyncCooldownStore.setState(current => {
    const activeUntilMs =
      current.activeUntilMs !== null && current.activeUntilMs > nowMs ? current.activeUntilMs : null

    return {
      ...current,
      activeUntilMs,
      nowMs,
    }
  })

  if (powensManualSyncCooldownStore.state.activeUntilMs === null) {
    stopCooldownTicker()
  }
}

const ensureCooldownTicker = () => {
  if (typeof window === 'undefined' || cooldownTickTimer) {
    return
  }

  cooldownTickTimer = setInterval(() => {
    syncCooldownClock()
  }, COOLDOWN_TICK_MS)
}

const normalizeDurationSeconds = (value: number) => {
  return Number.isInteger(value) && value > 0
    ? value
    : DEFAULT_POWENS_MANUAL_SYNC_COOLDOWN_UI_SECONDS
}

export const getPowensManualSyncCooldownUiConfig = () => {
  const enabled =
    parseBooleanUiFlag(readPublicRuntimeEnv('VITE_POWENS_SYNC_COOLDOWN_UI_ENABLED')) ?? true
  const durationSeconds =
    parsePositiveInteger(readPublicRuntimeEnv('VITE_POWENS_SYNC_COOLDOWN_UI_SECONDS')) ??
    DEFAULT_POWENS_MANUAL_SYNC_COOLDOWN_UI_SECONDS

  return {
    enabled,
    durationSeconds,
  }
}

export const resetPowensManualSyncCooldown = () => {
  stopCooldownTicker()
  powensManualSyncCooldownStore.setState(() => createInitialCooldownStoreState())
}

export const startPowensManualSyncCooldown = (durationSeconds: number) => {
  const nowMs = Date.now()
  const normalizedDurationSeconds = normalizeDurationSeconds(durationSeconds)

  powensManualSyncCooldownStore.setState(current => ({
    ...current,
    activeUntilMs: nowMs + normalizedDurationSeconds * 1_000,
    lastActivatedAtMs: nowMs,
    nowMs,
  }))

  ensureCooldownTicker()
}

export const getPowensManualSyncCooldownSnapshot = (
  state: PowensManualSyncCooldownStoreState = powensManualSyncCooldownStore.state
): PowensManualSyncCooldownSnapshot => {
  const activeUntilMs =
    state.activeUntilMs !== null && state.activeUntilMs > state.nowMs ? state.activeUntilMs : null
  const remainingMs = activeUntilMs === null ? 0 : Math.max(activeUntilMs - state.nowMs, 0)

  return {
    isActive: activeUntilMs !== null,
    remainingMs,
    remainingSeconds: remainingMs === 0 ? 0 : Math.ceil(remainingMs / 1_000),
    lastActivatedAtMs: state.lastActivatedAtMs,
  }
}

export const formatPowensManualSyncCountdown = (remainingSeconds: number) => {
  const normalizedSeconds = Math.max(remainingSeconds, 0)

  if (normalizedSeconds < 60) {
    return `${normalizedSeconds}s`
  }

  const minutes = Math.floor(normalizedSeconds / 60)
  const seconds = normalizedSeconds % 60

  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`
}

const getPowensManualSyncBlockMessage = ({
  blockReason,
  remainingSeconds,
}: {
  blockReason: PowensManualSyncUiBlockReason | null
  remainingSeconds: number
}) => {
  switch (blockReason) {
    case 'admin_only':
      return 'Mode demo: la sync Powens reste reservee a la session admin.'
    case 'safe_mode':
      return 'Safe mode actif: les integrations externes restent temporairement desactivees.'
    case 'syncing':
      return 'Sync en cours: attendez la reponse avant une nouvelle tentative locale.'
    case 'cooldown':
      return `Cooldown UI actif: nouvelle tentative locale dans ${formatPowensManualSyncCountdown(
        remainingSeconds
      )}.`
    default:
      return null
  }
}

export const getPowensManualSyncUiState = ({
  cooldownUiEnabled,
  cooldownSnapshot,
  isIntegrationsSafeMode,
  isSyncPending,
  mode,
}: {
  cooldownUiEnabled: boolean
  cooldownSnapshot: PowensManualSyncCooldownSnapshot
  isIntegrationsSafeMode: boolean
  isSyncPending: boolean
  mode?: AuthMode | undefined
}): PowensManualSyncUiState => {
  const cooldownRemainingSeconds =
    cooldownUiEnabled && cooldownSnapshot.isActive ? cooldownSnapshot.remainingSeconds : 0
  const phase: PowensManualSyncUiPhase = isSyncPending
    ? 'syncing'
    : cooldownUiEnabled && cooldownSnapshot.isActive
      ? 'cooldown'
      : cooldownSnapshot.lastActivatedAtMs === null
        ? 'idle'
        : 'ready'

  let blockReason: PowensManualSyncUiBlockReason | null = null

  if (mode !== 'admin') {
    blockReason = 'admin_only'
  } else if (isIntegrationsSafeMode) {
    blockReason = 'safe_mode'
  } else if (isSyncPending) {
    blockReason = 'syncing'
  } else if (cooldownUiEnabled && cooldownSnapshot.isActive) {
    blockReason = 'cooldown'
  }

  const statusLabel =
    phase === 'cooldown'
      ? `Cooldown ${formatPowensManualSyncCountdown(cooldownRemainingSeconds)}`
      : phase === 'syncing'
        ? 'Syncing'
        : phase === 'ready'
          ? 'Ready'
          : 'Idle'
  const statusMessage =
    phase === 'cooldown'
      ? `${formatPowensManualSyncCountdown(cooldownRemainingSeconds)} restantes avant la prochaine sync locale.`
      : phase === 'syncing'
        ? 'Le cooldown UI demarrera apres une sync reussie.'
        : phase === 'ready'
          ? 'Pret pour une nouvelle sync locale.'
          : mode === 'demo'
            ? 'Demo: comportement de cooldown local et sans dependance API.'
            : 'Aucune sync locale recente.'

  return {
    blocked: blockReason !== null,
    blockReason,
    blockMessage: getPowensManualSyncBlockMessage({
      blockReason,
      remainingSeconds: cooldownRemainingSeconds,
    }),
    cooldownRemainingSeconds,
    phase,
    statusLabel,
    statusMessage,
  }
}

export const logPowensManualSyncBlockedUiEvent = ({
  blockReason,
  connectionId,
  cooldownRemainingSeconds,
  mode,
}: {
  blockReason: PowensManualSyncUiBlockReason
  connectionId?: string | undefined
  cooldownRemainingSeconds: number
  mode?: AuthMode | undefined
}) => {
  console.info('[web:powens-sync-ui]', {
    event: 'manual_sync_click_blocked_ui',
    reason: blockReason,
    mode: mode ?? 'unknown',
    connectionId: connectionId ?? null,
    cooldown_remaining_s: cooldownRemainingSeconds,
    timestamp: new Date().toISOString(),
  })
}
