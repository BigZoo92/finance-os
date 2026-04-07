import { describe, expect, it } from 'vitest'
import { getPwaInstallPromptCooldownMs, shouldShowPwaInstallPrompt } from './pwa-install-prompt'

describe('pwa install prompt helpers', () => {
  it('keeps a one-week cooldown window', () => {
    expect(getPwaInstallPromptCooldownMs()).toBe(7 * 24 * 60 * 60 * 1000)
  })

  it('never shows the prompt when already installed', () => {
    expect(
      shouldShowPwaInstallPrompt({
        now: 10,
        dismissedUntil: null,
        isInstalled: true,
      })
    ).toBe(false)
  })

  it('shows prompt when there is no active dismissal', () => {
    expect(
      shouldShowPwaInstallPrompt({
        now: 10,
        dismissedUntil: null,
        isInstalled: false,
      })
    ).toBe(true)
  })

  it('hides prompt during active cooldown and re-enables it after cooldown expires', () => {
    expect(
      shouldShowPwaInstallPrompt({
        now: 10,
        dismissedUntil: 100,
        isInstalled: false,
      })
    ).toBe(false)

    expect(
      shouldShowPwaInstallPrompt({
        now: 100,
        dismissedUntil: 100,
        isInstalled: false,
      })
    ).toBe(true)
  })
})
