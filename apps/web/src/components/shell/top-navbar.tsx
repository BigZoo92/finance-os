/**
 * TopNavbar — canonical contained floating desktop navbar.
 *
 * 1240px max width, centered, detached from the viewport edges, low
 * radius, Geist Sans labels. Dropdowns are detached floating surfaces
 * with framed icon tiles. Hover and persistent active states stay
 * visually distinct (active = inset signal orange underline).
 */
import { Popover, PopoverContent, PopoverTrigger } from '@finance-os/ui/components'
import { useQuery } from '@tanstack/react-query'
import { Link, useRouterState } from '@tanstack/react-router'
import { useState } from 'react'
import { BrandMark } from '@/components/brand/brand-mark'
import { authMeQueryOptions } from '@/features/auth-query-options'
import { resolveAuthViewState } from '@/features/auth-view-state'
import { CommandPaletteTrigger } from './command-palette'
import {
  getVisibleNavEntries,
  isGroupActive,
  isNavLinkActive,
  isRouteActive,
  type NavEntry,
  type NavLink,
} from './nav-items'
import { NavIconTile } from './nav-icon-tile'
import { UserMenu } from './user-menu'

const NAV_ITEM_BASE =
  'relative flex h-full items-center gap-1.5 px-0.5 text-sm transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-card'

const navItemClass = (active: boolean) =>
  `${NAV_ITEM_BASE} ${
    active
      ? 'font-medium text-foreground shadow-[inset_0_-2px_0_var(--primary)]'
      : 'text-foreground/55 hover:text-foreground'
  }`

export function TopNavbar() {
  const pathname = useRouterState({ select: state => state.location.pathname })
  const authQuery = useQuery(authMeQueryOptions())
  const authViewState = resolveAuthViewState({
    isPending: authQuery.isPending,
    ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}),
  })
  const entries = getVisibleNavEntries(authViewState)

  return (
    <header className="sticky top-4 z-[var(--z-navbar)] mx-auto mt-4 hidden w-[min(1240px,calc(100%-2.5rem))] lg:block">
      <div className="flex h-[58px] items-center gap-7 rounded-dropdown border border-border/60 bg-card px-5 shadow-floating">
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        >
          <BrandMark size="md" />
          <span className="text-[15px] font-semibold tracking-tight text-foreground">
            Finance-OS
          </span>
        </Link>

        <nav aria-label="Navigation principale" className="flex h-full items-center gap-6">
          {entries.map(entry =>
            entry.kind === 'link' ? (
              <Link
                key={entry.link.to}
                to={entry.link.to}
                className={navItemClass(isNavLinkActive(pathname, entry.link))}
              >
                {entry.link.label}
              </Link>
            ) : (
              <NavDropdown key={entry.id} entry={entry} pathname={pathname} />
            )
          )}
        </nav>

        <div className="ml-auto flex items-center gap-3.5">
          <CommandPaletteTrigger className="w-[180px]" />
          <ModeBadge authViewState={authViewState} />
          <UserMenu />
        </div>
      </div>
    </header>
  )
}

function NavDropdown({
  entry,
  pathname,
}: {
  entry: Extract<NavEntry, { kind: 'group' }>
  pathname: string
}) {
  const [open, setOpen] = useState(false)
  const active = isGroupActive(pathname, entry)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={navItemClass(active)}>
        {entry.label}
        <span aria-hidden="true" className="text-[10px] leading-none text-foreground/45">
          {open ? '▴' : '▾'}
        </span>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={18} className="w-[560px] rounded-dropdown p-2.5">
        <div className="flex items-center justify-between border-b border-border/60 px-3 pb-2.5 pt-1.5">
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            {entry.label}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground/60">
            {entry.items.length} modules
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 pt-2">
          {entry.items.map(item => (
            <NavDropdownItem
              key={item.to}
              item={item}
              active={isRouteActive(pathname, item.to)}
              onNavigate={() => setOpen(false)}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function NavDropdownItem({
  item,
  active,
  onNavigate,
}: {
  item: NavLink
  active: boolean
  onNavigate: () => void
}) {
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      className={`flex items-center gap-3 rounded-control border p-3 transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/70 ${
        active ? 'border-foreground/16 bg-primary/12' : 'border-transparent hover:bg-accent/50'
      }`}
    >
      <NavIconTile icon={item.icon} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-foreground">{item.label}</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {item.description}
        </span>
      </span>
    </Link>
  )
}

function ModeBadge({ authViewState }: { authViewState: 'pending' | 'demo' | 'admin' }) {
  if (authViewState === 'pending') {
    return <div aria-hidden="true" className="h-[26px] w-14 animate-shimmer rounded-tile" />
  }
  if (authViewState === 'admin') {
    return (
      <span className="rounded-tile border border-primary/40 px-2 py-1 font-mono text-[11px] font-medium tracking-[0.08em] text-primary">
        ADMIN
      </span>
    )
  }
  return (
    <span className="rounded-tile border border-foreground/16 px-2 py-1 font-mono text-[11px] tracking-[0.08em] text-foreground/55">
      DÉMO
    </span>
  )
}
