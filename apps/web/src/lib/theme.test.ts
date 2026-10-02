// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyResolvedTheme,
  isThemePreference,
  readStoredThemePreference,
  resolveTheme,
  THEME_STORAGE_KEY,
  themeBootstrapScript,
} from './theme'

function mockMatchMedia(prefersDark: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)' ? prefersDark : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  )
}

function runBootstrapScript() {
  // oxlint-disable-next-line eslint/no-eval -- The test executes the inline <head> bootstrap exactly as the browser would.
  window.eval(themeBootstrapScript)
}

describe('theme', () => {
  beforeEach(() => {
    document.documentElement.className = 'dark'
    document.documentElement.style.colorScheme = ''
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('isThemePreference', () => {
    it('accepts dark, light and system', () => {
      expect(isThemePreference('dark')).toBe(true)
      expect(isThemePreference('light')).toBe(true)
      expect(isThemePreference('system')).toBe(true)
    })

    it('rejects unknown values', () => {
      expect(isThemePreference('aurora')).toBe(false)
      expect(isThemePreference(null)).toBe(false)
      expect(isThemePreference(undefined)).toBe(false)
    })
  })

  describe('resolveTheme', () => {
    it('keeps explicit preferences', () => {
      expect(resolveTheme('dark', false)).toBe('dark')
      expect(resolveTheme('light', true)).toBe('light')
    })

    it('resolves system from the media query', () => {
      expect(resolveTheme('system', true)).toBe('dark')
      expect(resolveTheme('system', false)).toBe('light')
    })
  })

  describe('readStoredThemePreference', () => {
    it('returns the persisted dark preference', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'dark')
      expect(readStoredThemePreference()).toBe('dark')
    })

    it('returns the persisted light preference', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'light')
      expect(readStoredThemePreference()).toBe('light')
    })

    it('falls back to system when nothing or garbage is stored', () => {
      expect(readStoredThemePreference()).toBe('system')
      localStorage.setItem(THEME_STORAGE_KEY, 'magenta')
      expect(readStoredThemePreference()).toBe('system')
    })
  })

  describe('applyResolvedTheme', () => {
    it('applies dark on the root element', () => {
      applyResolvedTheme('dark')
      expect(document.documentElement.classList.contains('dark')).toBe(true)
      expect(document.documentElement.style.colorScheme).toBe('dark')
    })

    it('applies light and removes the legacy light class', () => {
      document.documentElement.className = 'dark light'
      applyResolvedTheme('light')
      expect(document.documentElement.classList.contains('dark')).toBe(false)
      expect(document.documentElement.classList.contains('light')).toBe(false)
      expect(document.documentElement.style.colorScheme).toBe('light')
    })
  })

  describe('bootstrap script (pre-paint SSR correction)', () => {
    it('keeps dark for a persisted dark preference', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'dark')
      mockMatchMedia(false)
      runBootstrapScript()
      expect(document.documentElement.classList.contains('dark')).toBe(true)
      expect(document.documentElement.style.colorScheme).toBe('dark')
    })

    it('switches to light for a persisted light preference', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'light')
      mockMatchMedia(true)
      runBootstrapScript()
      expect(document.documentElement.classList.contains('dark')).toBe(false)
      expect(document.documentElement.style.colorScheme).toBe('light')
    })

    it('follows a light system preference when nothing is stored', () => {
      mockMatchMedia(false)
      runBootstrapScript()
      expect(document.documentElement.classList.contains('dark')).toBe(false)
      expect(document.documentElement.style.colorScheme).toBe('light')
    })

    it('follows a dark system preference when nothing is stored', () => {
      mockMatchMedia(true)
      runBootstrapScript()
      expect(document.documentElement.classList.contains('dark')).toBe(true)
      expect(document.documentElement.style.colorScheme).toBe('dark')
    })

    it('treats an unknown stored value as system', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'aurora')
      mockMatchMedia(false)
      runBootstrapScript()
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })

    it('removes the legacy light class written by the old implementation', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'dark')
      document.documentElement.className = 'light'
      mockMatchMedia(false)
      runBootstrapScript()
      expect(document.documentElement.classList.contains('light')).toBe(false)
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })

    it('never throws when storage is unavailable', () => {
      mockMatchMedia(true)
      const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('storage blocked')
      })
      expect(() => runBootstrapScript()).not.toThrow()
      getItem.mockRestore()
    })
  })
})
