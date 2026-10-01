/**
 * UserMenu — canonical shell user entry (avatar trigger, floating menu).
 *
 * Reuses the existing auth/session data and relocates the topbar actions:
 * theme toggle, PWA install and login/logout. No invented account pages.
 */
import { css, cx } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
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

const MENU_ITEM_CLASS = css({
  display: 'flex',
  w: 'full',
  alignItems: 'center',
  gap: '2.5',
  rounded: 'control',
  px: '2.5',
  py: '2',
  textAlign: 'left',
  fontSize: '13px',
  color: 'foreground',
  transitionProperty: 'colors',
  transitionDuration: '150ms',
  transitionTimingFunction: 'default',
  outlineStyle: 'none',
  _hover: { bg: 'accent/60' },
  _focusVisible: { boxShadow: '0 0 0 2px color-mix(in srgb, {colors.ring} 70%, transparent)' },
  _disabled: { pointerEvents: 'none', opacity: '0.4' },
})

const menuTrigger = css({
  display: 'grid',
  boxSize: '7',
  flexShrink: '0',
  placeItems: 'center',
  rounded: 'full',
  borderWidth: '1px',
  borderColor: 'foreground/16',
  bg: 'secondary',
  fontSize: '11px',
  fontWeight: 'semibold',
  color: 'foreground/80',
  transitionProperty: 'colors',
  transitionDuration: '150ms',
  transitionTimingFunction: 'default',
  outlineStyle: 'none',
  _hover: { borderColor: 'primary/40' },
  _focusVisible: { boxShadow: '0 0 0 2px color-mix(in srgb, {colors.ring} 70%, transparent)' },
})

const shimmer = css({
  bgImage:
    'linear-gradient(90deg, {colors.muted} 0%, oklch(from {colors.muted} calc(l + 0.05) c h) 50%, {colors.muted} 100%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.8s ease-in-out infinite',
})

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
      <PopoverTrigger aria-label="Menu utilisateur" className={menuTrigger}>
        {initial}
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={14} w="64" p="2">
        <styled.div px="2.5" pb="2" pt="1.5">
          {isAdmin && user ? (
            <>
              <styled.p truncate fontSize="13px" fontWeight="medium" color="foreground">
                {user.displayName}
              </styled.p>
              <styled.p truncate fontFamily="mono" fontSize="11px" color="muted.foreground">
                {user.email}
              </styled.p>
            </>
          ) : (
            <>
              <styled.p fontSize="13px" fontWeight="medium" color="foreground">
                Mode démo
              </styled.p>
              <styled.p fontSize="11px" color="muted.foreground">
                Données de démonstration
              </styled.p>
            </>
          )}
        </styled.div>

        <styled.div my="1" h="1px" bg="border/60" />

        <button type="button" onClick={toggle} className={MENU_ITEM_CLASS}>
          <styled.span
            aria-hidden="true"
            display="flex"
            w="4"
            alignItems="center"
            justifyContent="center"
          >
            {resolvedTheme === 'dark' ? <SunPixelIcon size={14} /> : <MoonPixelIcon size={14} />}
          </styled.span>
          {resolvedTheme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
        </button>

        <PwaInstallMenuItem mode={isAdmin ? 'admin' : 'demo'} className={MENU_ITEM_CLASS} />

        <styled.div my="1" h="1px" bg="border/60" />

        {authViewState === 'pending' ? (
          <div className={cx(shimmer, css({ mx: '2.5', my: '2', h: '8', rounded: 'control' }))} />
        ) : isDemo ? (
          <button
            type="button"
            className={MENU_ITEM_CLASS}
            onClick={() => {
              setOpen(false)
              void navigate({ to: '/login', search: { reason: undefined } })
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
