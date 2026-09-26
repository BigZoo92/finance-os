/**
 * TopNavbar — canonical contained floating desktop navbar.
 *
 * 1240px max width, centered, detached from the viewport edges, low
 * radius, Geist Sans labels. Dropdowns are detached floating surfaces
 * with framed icon tiles. Hover and persistent active states stay
 * visually distinct (active = inset signal orange underline).
 */
import { css, cva, cx } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
import { Popover, PopoverContent, PopoverTrigger } from '@finance-os/ui/components'
import { useQuery } from '@tanstack/react-query'
import { Link, useRouterState } from '@tanstack/react-router'
import { useState } from 'react'
import { BrandMark } from '@/components/brand/brand-mark'
import { authMeQueryOptions } from '@/features/auth-query-options'
import { resolveAuthViewState } from '@/features/auth-view-state'
import { CommandPaletteTrigger } from './command-palette'
import { NavIconTile } from './nav-icon-tile'
import {
  getVisibleNavEntries,
  isGroupActive,
  isNavLinkActive,
  isRouteActive,
  type NavEntry,
  type NavLink,
} from './nav-items'
import { UserMenu } from './user-menu'

const navItem = cva({
  base: {
    position: 'relative',
    display: 'flex',
    h: 'full',
    alignItems: 'center',
    gap: '1.5',
    px: '0.5',
    textStyle: 'sm',
    transitionProperty: 'colors',
    transitionDuration: '150ms',
    transitionTimingFunction: 'default',
    outlineStyle: 'none',
    _focusVisible: {
      boxShadow:
        '0 0 0 2px {colors.card}, 0 0 0 4px color-mix(in srgb, {colors.ring} 70%, transparent)',
    },
  },
  variants: {
    active: {
      true: {
        fontWeight: 'medium',
        color: 'foreground',
        boxShadow: 'inset 0 -2px 0 {colors.primary}',
        _focusVisible: {
          boxShadow:
            '0 0 0 2px {colors.card}, 0 0 0 4px color-mix(in srgb, {colors.ring} 70%, transparent), inset 0 -2px 0 {colors.primary}',
        },
      },
      false: {
        color: 'foreground/55',
        _hover: { color: 'foreground' },
      },
    },
  },
})

const brandLink = css({
  display: 'flex',
  flexShrink: '0',
  alignItems: 'center',
  gap: '2.5',
  outlineStyle: 'none',
  _focusVisible: {
    boxShadow:
      '0 0 0 2px {colors.card}, 0 0 0 4px color-mix(in srgb, {colors.ring} 70%, transparent)',
  },
})

export function TopNavbar() {
  const pathname = useRouterState({ select: state => state.location.pathname })
  const authQuery = useQuery(authMeQueryOptions())
  const authViewState = resolveAuthViewState({
    isPending: authQuery.isPending,
    ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}),
  })
  const entries = getVisibleNavEntries(authViewState)

  return (
    <styled.header
      position="sticky"
      top="4"
      zIndex="navbar"
      mx="auto"
      mt="4"
      display="none"
      w="min(1240px, calc(100% - 2.5rem))"
      lg={{ display: 'block' }}
    >
      <styled.div
        display="flex"
        h="58px"
        alignItems="center"
        gap="7"
        rounded="dropdown"
        borderWidth="1px"
        borderColor="border/60"
        bg="card"
        px="5"
        shadow="floating"
      >
        <Link to="/" className={brandLink}>
          <BrandMark size="md" />
          <styled.span
            fontSize="15px"
            fontWeight="semibold"
            letterSpacing="tight"
            color="foreground"
          >
            Finance-OS
          </styled.span>
        </Link>

        <styled.nav
          aria-label="Navigation principale"
          display="flex"
          h="full"
          alignItems="center"
          gap="6"
        >
          {entries.map(entry => {
            if (entry.kind === 'link') {
              const active = isNavLinkActive(pathname, entry.link)
              return (
                <Link
                  key={entry.link.to}
                  to={entry.link.to}
                  className={navItem({ active })}
                  data-active={active ? 'true' : undefined}
                  {...(active ? { 'aria-current': 'page' as const } : {})}
                >
                  {entry.link.label}
                </Link>
              )
            }
            return <NavDropdown key={entry.id} entry={entry} pathname={pathname} />
          })}
        </styled.nav>

        <styled.div ml="auto" display="flex" alignItems="center" gap="3.5">
          <CommandPaletteTrigger className={css({ w: '180px' })} />
          <ModeBadge authViewState={authViewState} />
          <UserMenu />
        </styled.div>
      </styled.div>
    </styled.header>
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
      <PopoverTrigger className={navItem({ active })} data-active={active ? 'true' : undefined}>
        {entry.label}
        <styled.span aria-hidden="true" fontSize="10px" lineHeight="none" color="foreground/45">
          {open ? '▴' : '▾'}
        </styled.span>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={18} w="560px" p="2.5">
        <styled.div
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          borderBottomWidth="1px"
          borderBottomColor="border/60"
          px="3"
          pb="2.5"
          pt="1.5"
        >
          <styled.span
            fontFamily="mono"
            fontSize="10px"
            fontWeight="medium"
            textTransform="uppercase"
            letterSpacing="0.16em"
            color="muted.foreground"
          >
            {entry.label}
          </styled.span>
          <styled.span
            fontFamily="mono"
            fontSize="10px"
            textTransform="uppercase"
            letterSpacing="0.08em"
            color="muted.foreground/60"
          >
            {entry.items.length} modules
          </styled.span>
        </styled.div>
        <styled.div display="grid" gridTemplateColumns="repeat(2, minmax(0, 1fr))" gap="1.5" pt="2">
          {entry.items.map(item => (
            <NavDropdownItem
              key={item.to}
              item={item}
              active={isRouteActive(pathname, item.to)}
              onNavigate={() => setOpen(false)}
            />
          ))}
        </styled.div>
      </PopoverContent>
    </Popover>
  )
}

const dropdownItem = cva({
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '3',
    rounded: 'control',
    borderWidth: '1px',
    p: '3',
    transitionProperty: 'colors',
    transitionDuration: '150ms',
    transitionTimingFunction: 'default',
    outlineStyle: 'none',
    _focusVisible: { boxShadow: '0 0 0 2px color-mix(in srgb, {colors.ring} 70%, transparent)' },
  },
  variants: {
    active: {
      true: { borderColor: 'foreground/16', bg: 'primary/12' },
      false: { borderColor: 'transparent', _hover: { bg: 'accent/50' } },
    },
  },
})

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
    <Link to={item.to} onClick={onNavigate} className={dropdownItem({ active })}>
      <NavIconTile icon={item.icon} />
      <styled.span minW="0">
        <styled.span display="block" truncate textStyle="sm" fontWeight="medium" color="foreground">
          {item.label}
        </styled.span>
        <styled.span mt="0.5" display="block" truncate textStyle="xs" color="muted.foreground">
          {item.description}
        </styled.span>
      </styled.span>
    </Link>
  )
}

const shimmer = css({
  bgImage:
    'linear-gradient(90deg, {colors.muted} 0%, oklch(from {colors.muted} calc(l + 0.05) c h) 50%, {colors.muted} 100%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.8s ease-in-out infinite',
})

const modeBadge = cva({
  base: {
    rounded: 'tile',
    borderWidth: '1px',
    px: '2',
    py: '1',
    fontFamily: 'mono',
    fontSize: '11px',
    letterSpacing: '0.08em',
  },
  variants: {
    mode: {
      admin: { borderColor: 'primary/40', fontWeight: 'medium', color: 'primary' },
      demo: { borderColor: 'foreground/16', color: 'foreground/55' },
    },
  },
})

function ModeBadge({ authViewState }: { authViewState: 'pending' | 'demo' | 'admin' }) {
  if (authViewState === 'pending') {
    return (
      <div
        aria-hidden="true"
        className={cx(shimmer, css({ h: '26px', w: '14', rounded: 'tile' }))}
      />
    )
  }
  if (authViewState === 'admin') {
    return <span className={modeBadge({ mode: 'admin' })}>ADMIN</span>
  }
  return <span className={modeBadge({ mode: 'demo' })}>DÉMO</span>
}
