const DISMISS_STORAGE_KEY = 'finance-os:pwa-install-dismissed-until:v1'
const INSTALLED_STORAGE_KEY = 'finance-os:pwa-installed:v1'
const PROMPT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

const parseTimestamp = (value: string | null) => {
  if (!value) {
    return null
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

export const getPwaInstallPromptCooldownMs = () => PROMPT_COOLDOWN_MS

export const readPwaInstallDismissedUntil = () => {
  if (typeof window === 'undefined') {
    return null
  }

  return parseTimestamp(window.localStorage.getItem(DISMISS_STORAGE_KEY))
}

export const writePwaInstallDismissedUntil = (timestamp: number) => {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(DISMISS_STORAGE_KEY, String(timestamp))
}

export const readPwaInstalledSnapshot = () => {
  if (typeof window === 'undefined') {
    return false
  }

  return window.localStorage.getItem(INSTALLED_STORAGE_KEY) === '1'
}

export const writePwaInstalledSnapshot = () => {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(INSTALLED_STORAGE_KEY, '1')
}

export const shouldShowPwaInstallPrompt = ({
  now,
  dismissedUntil,
  isInstalled,
}: {
  now: number
  dismissedUntil: number | null
  isInstalled: boolean
}) => {
  if (isInstalled) {
    return false
  }

  if (dismissedUntil === null) {
    return true
  }

  return dismissedUntil <= now
}
