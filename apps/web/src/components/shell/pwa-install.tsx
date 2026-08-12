/**
 * PWA install action — CTA-policy governed install entry, relocated from
 * the legacy topbar into the UserMenu. Shows only when the browser
 * supports installation and the app is not already installed.
 */
import { DownloadPixelIcon } from '@finance-os/ui/icons/pixel'
import { useEffect, useState } from 'react'
import type { AuthMode } from '@/features/auth-types'
import {
  computeCtaOrchestrationMetrics,
  logCtaPolicyEvent,
  orchestrateCtas,
  readCtaPolicyRuntime,
} from '@/features/cta-policy/policy-registry'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PwaInstallMenuItem({ mode, className }: { mode: AuthMode; className: string }) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const policyContext = readCtaPolicyRuntime(mode, `web-cta-pwa-${mode}`)
  const [decision] = orchestrateCtas({
    policies: [
      {
        id: 'pwa_install',
        priority: 100,
        visibleIn: 'both',
        cooldownMs: 0,
        dedupeKey: () => 'pwa_install',
        telemetryContract: { version: 'v1' },
        evaluateEligibility: () => {
          if (isInstalled) {
            return { eligible: false, state: 'hidden', resolutionReason: 'ineligible' }
          }

          if (!installPrompt) {
            if (mode === 'demo') {
              return {
                eligible: false,
                state: 'hidden',
                resolutionReason: 'dependency_failed',
              }
            }

            return {
              eligible: false,
              state: 'disabled',
              disabledReason: 'Installation indisponible pour le moment sur cet appareil.',
              resolutionReason: 'dependency_failed',
            }
          }

          return { eligible: true }
        },
      },
    ],
    context: policyContext,
    cooldownSnapshot: new Map(),
  })

  if (decision) {
    logCtaPolicyEvent({
      event: 'cta_evaluated',
      context: policyContext,
      ctaId: decision.id,
      resolutionReason: decision.resolutionReason,
      state: decision.state,
    })
  }

  if (!decision || decision.state === 'hidden') {
    return null
  }

  const metrics = computeCtaOrchestrationMetrics([decision])
  logCtaPolicyEvent({
    event: metrics.conflicts > 0 ? 'cta_conflict_resolved' : 'cta_rendered',
    context: policyContext,
    ctaId: decision.id,
    resolutionReason: decision.resolutionReason,
    state: decision.state,
  })

  const handleInstall = async () => {
    if (!installPrompt || !decision.enabled) {
      logCtaPolicyEvent({
        event: 'cta_blocked',
        context: policyContext,
        ctaId: decision.id,
        resolutionReason: decision.resolutionReason,
        state: decision.state,
      })
      return
    }

    logCtaPolicyEvent({
      event: 'cta_clicked',
      context: policyContext,
      ctaId: decision.id,
      resolutionReason: decision.resolutionReason,
      state: decision.state,
    })
    await installPrompt.prompt()
    const result = await installPrompt.userChoice
    if (result.outcome === 'accepted') {
      setIsInstalled(true)
      setInstallPrompt(null)
    }
  }

  return (
    <button
      type="button"
      onClick={handleInstall}
      disabled={!decision.enabled}
      title={decision.disabledReason}
      className={className}
    >
      <span aria-hidden="true" className="flex w-4 items-center justify-center">
        <DownloadPixelIcon size={14} />
      </span>
      {decision.state === 'disabled' ? 'Installation indisponible' : "Installer l'application"}
    </button>
  )
}
