import { useCallback, useEffect, useState } from 'react'

export type ThemePreference = 'dark' | 'light' | 'system'
export type ResolvedTheme = 'dark' | 'light'

export const THEME_STORAGE_KEY = 'finance-os-theme'

const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)'

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'dark' || value === 'light' || value === 'system'
}

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean
): ResolvedTheme {
  if (preference === 'system') {
    return systemPrefersDark ? 'dark' : 'light'
  }

  return preference
}

export function readStoredThemePreference(): ThemePreference {
  if (typeof window === 'undefined') {
    return 'system'
  }

  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isThemePreference(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

function writeStoredThemePreference(preference: ThemePreference) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // Storage unavailable (private mode, blocked): theme stays session-only.
  }
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(DARK_SCHEME_QUERY).matches
}

export function applyResolvedTheme(
  theme: ResolvedTheme,
  root: HTMLElement = document.documentElement
) {
  root.classList.toggle('dark', theme === 'dark')
  // Legacy class written by the previous theme implementation.
  root.classList.remove('light')
  root.style.colorScheme = theme
}

/**
 * Inline bootstrap executed in <head> before first paint. It corrects the
 * SSR default (dark) to the persisted or system preference so light users
 * never flash dark. Must stay dependency-free and synchronous.
 */
export const themeBootstrapScript = `(function () {
  try {
    var stored = localStorage.getItem('${THEME_STORAGE_KEY}')
    var preference = stored === 'dark' || stored === 'light' ? stored : 'system'
    var dark =
      preference === 'system'
        ? window.matchMedia('${DARK_SCHEME_QUERY}').matches
        : preference === 'dark'
    var root = document.documentElement
    root.classList.toggle('dark', dark)
    root.classList.remove('light')
    root.style.colorScheme = dark ? 'dark' : 'light'
  } catch (_error) {}
})()`

export function useTheme() {
  const [preference, setPreferenceState] = useState<ThemePreference>('system')
  // SSR renders dark; the bootstrap script may have resolved light before
  // hydration, so the real value is read from the DOM after mount.
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('dark')

  useEffect(() => {
    setPreferenceState(readStoredThemePreference())
    setResolvedTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light')
  }, [])

  useEffect(() => {
    if (preference !== 'system') {
      return
    }

    const media = window.matchMedia(DARK_SCHEME_QUERY)
    const sync = () => {
      const next: ResolvedTheme = media.matches ? 'dark' : 'light'
      setResolvedTheme(next)
      applyResolvedTheme(next)
    }

    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [preference])

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next)
    writeStoredThemePreference(next)
    const nextResolved = resolveTheme(next, systemPrefersDark())
    setResolvedTheme(nextResolved)
    applyResolvedTheme(nextResolved)
  }, [])

  const toggle = useCallback(() => {
    setPreference(resolvedTheme === 'dark' ? 'light' : 'dark')
  }, [resolvedTheme, setPreference])

  return { preference, resolvedTheme, setPreference, toggle }
}
