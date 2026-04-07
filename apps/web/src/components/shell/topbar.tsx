import { Badge, Button } from '@finance-os/ui/components'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { postAuthLogout } from '@/features/auth-api'
import { authMeQueryOptions, authQueryKeys } from '@/features/auth-query-options'
import { resolveAuthViewState } from '@/features/auth-view-state'
import { dashboardQueryKeys } from '@/features/dashboard-query-options'
import { financialGoalsQueryKeys } from '@/features/goals/query-options'
import { powensQueryKeys } from '@/features/powens/query-options'
import { pushToast } from '@/lib/toast-store'
import { toErrorMessage } from '@/lib/format'
import { ThemeToggle } from './theme-toggle'
import { CommandPaletteTrigger } from './command-palette'

export function Topbar() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const authQuery = useQuery(authMeQueryOptions())
  const authViewState = resolveAuthViewState({
    isPending: authQuery.isPending,
    ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}),
  })
  const isDemo = authViewState === 'demo'
  const isPending = authViewState === 'pending'

  const logoutMutation = useMutation({
    mutationFn: postAuthLogout,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: authQueryKeys.me() }),
        queryClient.invalidateQueries({ queryKey: powensQueryKeys.status() }),
        queryClient.invalidateQueries({ queryKey: powensQueryKeys.syncRuns() }),
        queryClient.invalidateQueries({ queryKey: powensQueryKeys.syncBacklog() }),
        queryClient.invalidateQueries({ queryKey: powensQueryKeys.auditTrail() }),
        queryClient.invalidateQueries({ queryKey: powensQueryKeys.diagnostics() }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: financialGoalsQueryKeys.list() }),
      ])
      pushToast({ title: 'Session fermée', description: 'Retour en mode démo.', tone: 'info' })
    },
    onError: error => {
      pushToast({ title: 'Déconnexion impossible', description: toErrorMessage(error), tone: 'error' })
    },
  })

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/50 bg-background/80 px-4 backdrop-blur-xl lg:px-6">
      <div className="flex items-center gap-3">
        {/* Mobile brand */}
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold shadow-sm lg:hidden">
          ◈
        </div>

        <CommandPaletteTrigger />
      </div>

      <div className="flex items-center gap-1.5">
        <PwaInstallButton />
        <ThemeToggle />

        {isDemo && (
          <Badge variant="warning" className="text-xs">
            DÉMO
          </Badge>
        )}

        {isPending ? (
          <div className="h-8 w-20 animate-pulse rounded-lg bg-muted" />
        ) : isDemo ? (
          <Button
            type="button"
            size="sm"
            variant="default"
            onClick={() => navigate({ to: '/login', search: { reason: undefined } })}
          >
            Se connecter
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            {logoutMutation.isPending ? 'Déconnexion…' : 'Déconnexion'}
          </Button>
        )}
      </div>
    </header>
  )
}

/**
 * PWA install CTA — shows only when the browser supports installation
 * and the app isn't already installed.
 */
function PwaInstallButton() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Check if already installed
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

  if (isInstalled || !installPrompt) return null

  const handleInstall = async () => {
    await installPrompt.prompt()
    const result = await installPrompt.userChoice
    if (result.outcome === 'accepted') {
      setIsInstalled(true)
      setInstallPrompt(null)
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={handleInstall}
      className="hidden sm:inline-flex gap-1.5 border-accent-2/30 text-accent-2 hover:bg-accent-2/10 hover:border-accent-2/50"
    >
      <span aria-hidden="true">↓</span>
      Installer
    </Button>
  )
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
