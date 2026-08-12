/**
 * Mobile shell navigation — canonical Command Pixel treatment.
 *
 * Top row: framed brand tile, product name, user menu.
 * Bottom nav: five equal tabs (Cockpit, Dépenses, Patrimoine, Advisor,
 * Plus) with framed icon tiles and Geist Mono uppercase labels. Plus is a
 * real fifth destination opening the More drawer.
 */
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from '@finance-os/ui/components'
import type { IconComponent } from '@finance-os/ui/icons/types'
import { EllipsesHorizontalPixelIcon } from '@finance-os/ui/icons/pixel'
import { useQuery } from '@tanstack/react-query'
import { Link, useRouterState } from '@tanstack/react-router'
import { useState } from 'react'
import { BrandMark } from '@/components/brand/brand-mark'
import { authMeQueryOptions } from '@/features/auth-query-options'
import { resolveAuthViewState } from '@/features/auth-view-state'
import { openCommandPalette } from './command-palette'
import { getVisibleDrawerSections, isRouteActive, MOBILE_TABS, type NavLink } from './nav-items'
import { NavIconTile } from './nav-icon-tile'
import { UserMenu } from './user-menu'

export function MobileTopBar() {
  return (
    <div className="flex items-center gap-2.5 px-5 pb-1 pt-5 safe-area-top lg:hidden">
      <Link to="/" className="flex items-center gap-2.5">
        <BrandMark size="sm" />
        <span className="text-[15px] font-semibold tracking-tight text-foreground">
          Finance-OS
        </span>
      </Link>
      <div className="ml-auto">
        <UserMenu />
      </div>
    </div>
  )
}

export function MobileNav() {
  const pathname = useRouterState({ select: state => state.location.pathname })
  const [moreOpen, setMoreOpen] = useState(false)
  const authQuery = useQuery(authMeQueryOptions())
  const authViewState = resolveAuthViewState({
    isPending: authQuery.isPending,
    ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}),
  })

  const tabActive = MOBILE_TABS.some(tab => isRouteActive(pathname, tab.to))
  const moreActive = !tabActive

  return (
    <>
      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-[var(--z-mobile-nav)] border-t border-border/60 bg-card px-1.5 pt-2.5 safe-area-bottom lg:hidden"
      >
        <div className="flex items-stretch">
          {MOBILE_TABS.map(tab => (
            <MobileTab key={tab.to} tab={tab} active={isRouteActive(pathname, tab.to)} />
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
            className="flex min-h-11 flex-1 flex-col items-center gap-1.5 rounded-control py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
          >
            <NavIconTile icon={EllipsesHorizontalPixelIcon} size="sm" active={moreActive} />
            <span
              className={`font-mono text-[9px] uppercase tracking-[0.08em] ${
                moreActive ? 'text-primary' : 'text-foreground/55'
              }`}
            >
              Plus
            </span>
          </button>
        </div>
      </nav>

      <MobileMoreDrawer
        open={moreOpen}
        onOpenChange={setMoreOpen}
        authViewState={authViewState}
        pathname={pathname}
      />
    </>
  )
}

function MobileTab({ tab, active }: { tab: NavLink; active: boolean }) {
  return (
    <Link
      to={tab.to}
      className="flex min-h-11 flex-1 flex-col items-center gap-1.5 rounded-control py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
      {...(active ? { 'aria-current': 'page' as const } : {})}
    >
      <NavIconTile icon={tab.icon} size="sm" active={active} />
      <span
        className={`truncate font-mono text-[9px] uppercase tracking-[0.08em] ${
          active ? 'text-primary' : 'text-foreground/55'
        }`}
      >
        {tab.label}
      </span>
    </Link>
  )
}

function MobileMoreDrawer({
  open,
  onOpenChange,
  authViewState,
  pathname,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  authViewState: 'pending' | 'demo' | 'admin'
  pathname: string
}) {
  const sections = getVisibleDrawerSections(authViewState)

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent side="bottom" className="lg:hidden">
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-muted-foreground/30" aria-hidden="true" />
        <div className="flex items-center justify-between px-5 pb-2 pt-3">
          <DrawerTitle className="text-[15px]">Plus</DrawerTitle>
          <DrawerDescription className="sr-only">Destinations secondaires</DrawerDescription>
          <button
            type="button"
            onClick={() => {
              onOpenChange(false)
              openCommandPalette()
            }}
            className="flex min-h-9 items-center gap-2 rounded-control border border-border/60 px-3 font-mono text-xs text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
          >
            Rechercher
          </button>
        </div>

        <nav aria-label="Navigation secondaire" className="px-3 pb-3">
          {sections.map(section => (
            <div key={section.id} className="mb-2">
              <p className="px-2 pb-1 pt-2 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                {section.label}
              </p>
              <ul>
                {section.items.map(item => {
                  const active = isRouteActive(pathname, item.to)
                  const Icon = item.icon as IconComponent
                  return (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        onClick={() => onOpenChange(false)}
                        {...(active ? { 'aria-current': 'page' as const } : {})}
                        className={`flex min-h-11 items-center gap-3 rounded-control px-2 py-2 transition-colors duration-150 ${
                          active ? 'bg-primary/12' : 'active:bg-accent/60'
                        }`}
                      >
                        <NavIconTile icon={Icon} active={active} />
                        <span className="min-w-0">
                          <span
                            className={`block truncate text-sm font-medium ${
                              active ? 'text-primary' : 'text-foreground'
                            }`}
                          >
                            {item.label}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {item.description}
                          </span>
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>
      </DrawerContent>
    </Drawer>
  )
}
