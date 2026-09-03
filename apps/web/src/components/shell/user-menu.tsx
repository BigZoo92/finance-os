/**
 * UserMenu — canonical shell user entry (avatar trigger, floating menu).
 *
 * Reuses the existing auth/session data and relocates the topbar actions:
 * theme toggle, PWA install and login/logout. No invented account pages.
 */
import { Popover, PopoverContent, PopoverTrigger } from '@finance-os/ui/components'
import { MoonPixelIcon, SunPixelIcon } from '@finance-os/ui/icons/pixel'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { postAuthLogout } from '@/features/auth-api'
import { authMeQueryOptions, authQueryKeys } from '@/features/auth-query-options'
import { resolveAuthViewState } from '@/features/auth-view-state'
import { removeDashboardQueriesForAuthTransition } from '@/features/dashboard-query-options'
import { financialGoalsQueryKeys } from '@/features/goals/query-options'
import { removeKnowledgeQueriesForAuthTransition } from '@/features/knowledge-query-options'
import { powensQueryKeys } from '@/features/powens/query-options'
import { toErrorMessage } from '@/lib/format'
import { useTheme } from '@/lib/theme'
import { pushToast } from '@/lib/toast-store'
import { PwaInstallMenuItem } from './pwa-install'

const MENU_ITEM_CLASS =
  'flex w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-left text-[13px] text-foreground transition-colors duration-150 hover:bg-accent/60 outline-none focus-visible:ring-2 focus-visible:ring-ring/70 disabled:pointer-events-none disabled:opacity-40'

export function UserMenu() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { resolvedTheme, toggle } = useTheme()
  const authQuery = useQuery(authMeQueryOptions())
  const authViewState = resolveAuthViewState({
    isPending: authQuery.isPending,
    ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}),
  })
  const user = authQuery.data?.user ?? null
  const isAdmin = authViewState === 'admin'
  const isDemo = authViewState === 'demo'

  const logoutMutation = useMutation({
    mutationFn: postAuthLogout,
    onSuccess: async () => {
      removeKnowledgeQueriesForAuthTransition(queryClient)
      removeDashboardQueriesForAuthTransition(queryClient)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: authQueryKeys.me() }),
        queryClient.invalidateQueries({ queryKey: powensQueryKeys.status() }),
        queryClient.invalidateQueries({ queryKey: powensQueryKeys.syncRuns() }),
        queryClient.invalidateQueries({ queryKey: powensQueryKeys.syncBacklog() }),
        queryClient.invalidateQueries({ queryKey: powensQueryKeys.auditTrail() }),
        queryClient.invalidateQueries({ queryKey: powensQueryKeys.diagnostics() }),
        queryClient.invalidateQueries({ queryKey: financialGoalsQueryKeys.list() }),
      ])
      pushToast({ title: 'Session fermée', description: 'Retour en mode démo.', tone: 'info' })
    },
    onError: error => {
      pushToast({
        title: 'Déconnexion impossible',
        description: toErrorMessage(error),
        tone: 'error',
      })
    },
  })

  const initial = user?.displayName?.charAt(0)?.toUpperCase() ?? 'D'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="Menu utilisateur"
        className="grid size-7 shrink-0 place-items-center rounded-full border border-foreground/16 bg-secondary text-[11px] font-semibold text-foreground/80 transition-colors duration-150 hover:border-primary/40 outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
      >
        {initial}
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={14} className="w-64 p-2">
        <div className="px-2.5 pb-2 pt-1.5">
          {isAdmin && user ? (
            <>
              <p className="truncate text-[13px] font-medium text-foreground">
                {user.displayName}
              </p>
              <p className="truncate font-mono text-[11px] text-muted-foreground">{user.email}</p>
            </>
          ) : (
            <>
              <p className="text-[13px] font-medium text-foreground">Mode démo</p>
              <p className="text-[11px] text-muted-foreground">Données de démonstration</p>
            </>
          )}
        </div>

        <div className="my-1 h-px bg-border/60" />

        <button type="button" onClick={toggle} className={MENU_ITEM_CLASS}>
          <span aria-hidden="true" className="flex w-4 items-center justify-center">
            {resolvedTheme === 'dark' ? <SunPixelIcon size={14} /> : <MoonPixelIcon size={14} />}
          </span>
          {resolvedTheme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
        </button>

        <PwaInstallMenuItem
          mode={isAdmin ? 'admin' : 'demo'}
          className={MENU_ITEM_CLASS}
        />

        <div className="my-1 h-px bg-border/60" />

        {authViewState === 'pending' ? (
          <div className="mx-2.5 my-2 h-8 animate-shimmer rounded-control" />
        ) : isDemo ? (
          <button
            type="button"
            className={MENU_ITEM_CLASS}
            onClick={() => {
              setOpen(false)
              navigate({ to: '/login', search: { reason: undefined } })
            }}
          >
            Se connecter
          </button>
        ) : (
          <button
            type="button"
            className={MENU_ITEM_CLASS}
            disabled={logoutMutation.isPending}
            onClick={() => logoutMutation.mutate()}
          >
            {logoutMutation.isPending ? 'Déconnexion en cours' : 'Déconnexion'}
          </button>
        )}
      </PopoverContent>
    </Popover>
  )
}
