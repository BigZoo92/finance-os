import { styled } from '@finance-os/styled-system/jsx'
import { Button } from '@finance-os/ui/components'
import { useEffect, useState } from 'react'
import {
  getPwaInstallPromptCooldownMs,
  readPwaInstallDismissedUntil,
  readPwaInstalledSnapshot,
  shouldShowPwaInstallPrompt,
  writePwaInstallDismissedUntil,
  writePwaInstalledSnapshot,
} from '@/features/pwa-install-prompt'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const isStandaloneDisplayMode = () => {
  if (typeof window === 'undefined') {
    return false
  }

  const navigatorWithStandalone = window.navigator as Navigator & {
    standalone?: boolean
  }

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    navigatorWithStandalone.standalone === true
  )
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (isStandaloneDisplayMode() || readPwaInstalledSnapshot()) {
      return
    }

    const onBeforeInstallPrompt = (event: Event) => {
      const installPromptEvent = event as BeforeInstallPromptEvent
      installPromptEvent.preventDefault()

      const canShowPrompt = shouldShowPwaInstallPrompt({
        now: Date.now(),
        dismissedUntil: readPwaInstallDismissedUntil(),
        isInstalled: false,
      })

      if (!canShowPrompt) {
        return
      }

      setDeferredPrompt(installPromptEvent)
      setIsVisible(true)
    }

    const onAppInstalled = () => {
      writePwaInstalledSnapshot()
      setDeferredPrompt(null)
      setIsVisible(false)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  if (!deferredPrompt || !isVisible) {
    return null
  }

  const dismissPrompt = () => {
    const dismissedUntil = Date.now() + getPwaInstallPromptCooldownMs()
    writePwaInstallDismissedUntil(dismissedUntil)
    setIsVisible(false)
    setDeferredPrompt(null)
  }

  const handleInstallClick = async () => {
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    if (choice.outcome === 'accepted') {
      writePwaInstalledSnapshot()
      setIsVisible(false)
      setDeferredPrompt(null)
      return
    }

    dismissPrompt()
  }

  return (
    <styled.div
      pointerEvents="none"
      position="fixed"
      insetX="0"
      bottom="24"
      zIndex="toast"
      display="flex"
      justifyContent="center"
      px="4"
      lg={{ bottom: '4' }}
    >
      <styled.div
        pointerEvents="auto"
        w="full"
        maxW="xl"
        rounded="xl"
        borderWidth="1px"
        borderColor="border"
        bg="card"
        p="4"
        color="card.foreground"
        shadow="lg"
      >
        <styled.p textStyle="sm" fontWeight="semibold">
          Installer Finance OS
        </styled.p>
        <styled.p mt="1" textStyle="xs" color="muted.foreground">
          Ajoute l’application à ton écran d’accueil pour un accès plus rapide.
        </styled.p>
        <styled.div mt="3" display="flex" alignItems="center" justifyContent="flex-end" gap="2">
          <Button type="button" variant="outline" onClick={dismissPrompt}>
            Plus tard
          </Button>
          <Button type="button" onClick={() => void handleInstallClick()}>
            Installer
          </Button>
        </styled.div>
      </styled.div>
    </styled.div>
  )
}
