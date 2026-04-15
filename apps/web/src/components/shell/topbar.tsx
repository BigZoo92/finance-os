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
import { BrandMark } from '@/components/brand/brand-mark'
import { StatusDot } from '@/components/surfaces/status-dot'
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
  const isAdmin = authViewState === 'admin'
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
    <header className="sticky top-0 z-30 h-14 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="flex h-full items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <div className="lg:hidden">
            <BrandMark size="sm" halo={false} />
          </div>
          <CommandPaletteTrigger />
        </div>

        <div className="flex items-center gap-1.5">
          {isDemo && (
            <Badge variant="warning" className="hidden h-6 items-center gap-1.5 sm:inline-flex">
              <StatusDot tone="warn" pulse size={6} />
              <span className="font-mono text-[10px] tracking-[0.14em]">DÉMO</span>
            </Badge>
          )}
          {isAdmin && (
            <Badge variant="violet" className="hidden h-6 items-center gap-1.5 sm:inline-flex">
              <StatusDot tone="violet" size={6} />
              <span className="font-mono text-[10px] tracking-[0.14em]">ADMIN</span>
            </Badge>
          )}

          <PwaInstallButton />
          <ThemeToggle />

          {isPending ? (
            <div className="h-8 w-20 animate-shimmer rounded-lg" />
          ) : isDemo ? (
            <Button
              type="button"
              size="sm"
              variant="soft"
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
      </div>
      {/* Hair brand rule — subtle rose-violet shimmer at the very bottom */}
      <div
        aria-hidden="true"
        className="h-px bg-[linear-gradient(90deg,transparent,oklch(from_var(--primary)_l_c_h/35%)_35%,oklch(from_var(--accent-2)_l_c_h/30%)_65%,transparent)]"
      />
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
      className="hidden sm:inline-flex gap-1.5 border-accent-2/35 text-accent-2 hover:bg-accent-2/10 hover:border-accent-2/55 hover:text-accent-2"
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
