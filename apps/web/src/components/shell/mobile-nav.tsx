/**
 * Mobile shell navigation — canonical Command Pixel treatment.
 *
 * Top row: framed brand tile, product name, user menu.
 * Bottom nav: five equal tabs (Cockpit, Dépenses, Patrimoine, Advisor,
 * Plus) with framed icon tiles and Geist Mono uppercase labels. Plus is a
 * real fifth destination opening the More drawer.
 */
import { css, cva, cx } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@finance-os/ui/components'
import { EllipsesHorizontalPixelIcon } from '@finance-os/ui/icons/pixel'
import { useQuery } from '@tanstack/react-query'
import { Link, useRouterState } from '@tanstack/react-router'
import { useState } from 'react'
import { BrandMark } from '@/components/brand/brand-mark'
import { authMeQueryOptions } from '@/features/auth-query-options'
import { resolveAuthViewState } from '@/features/auth-view-state'
import { openCommandPalette } from './command-palette'
import { NavIconTile } from './nav-icon-tile'
import { getVisibleDrawerSections, isRouteActive, MOBILE_TABS, type NavLink } from './nav-items'
import { UserMenu } from './user-menu'

export function MobileTopBar() {
  return (
    // The former unlayered `.safe-area-top` rule owned the top padding
    // (it beat the `pt-5` utility), so the safe-area expression is the value.
    <styled.div
      display="flex"
      alignItems="center"
      gap="2.5"
      px="5"
      pb="1"
      pt="max(0.5rem, env(safe-area-inset-top))"
      lg={{ display: 'none' }}
    >
      <Link to="/" className={css({ display: 'flex', alignItems: 'center', gap: '2.5' })}>
        <BrandMark size="sm" />
        <styled.span fontSize="15px" fontWeight="semibold" letterSpacing="tight" color="foreground">
          Finance-OS
        </styled.span>
      </Link>
      <styled.div ml="auto">
        <UserMenu />
      </styled.div>
    </styled.div>
  )
}

const mobileTab = css({
  display: 'flex',
  minH: '11',
  flex: '1',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '1.5',
  rounded: 'control',
  py: '1',
  outlineStyle: 'none',
  _focusVisible: { boxShadow: '0 0 0 2px color-mix(in srgb, {colors.ring} 70%, transparent)' },
})

const tabLabel = cva({
  base: {
    fontFamily: 'mono',
    fontSize: '9px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  variants: {
    active: {
      true: { color: 'primary' },
      false: { color: 'foreground/55' },
    },
  },
})

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
      <styled.nav
        aria-label="Navigation principale"
        position="fixed"
        insetX="0"
        bottom="0"
        zIndex="mobileNav"
        borderTopWidth="1px"
        borderTopColor="border/60"
        bg="card"
        px="1.5"
        pt="2.5"
        pb="env(safe-area-inset-bottom, 0px)"
        lg={{ display: 'none' }}
      >
        <styled.div display="flex" alignItems="stretch">
          {MOBILE_TABS.map(tab => (
            <MobileTab key={tab.to} tab={tab} active={isRouteActive(pathname, tab.to)} />
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
            className={mobileTab}
          >
            <NavIconTile icon={EllipsesHorizontalPixelIcon} size="sm" active={moreActive} />
            <span className={tabLabel({ active: moreActive })}>Plus</span>
          </button>
        </styled.div>
      </styled.nav>

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
      className={mobileTab}
      {...(active ? { 'aria-current': 'page' as const } : {})}
    >
      <NavIconTile icon={tab.icon} size="sm" active={active} />
      <span className={cx(tabLabel({ active }), css({ truncate: true }))}>{tab.label}</span>
    </Link>
  )
}

const drawerSearchButton = css({
  display: 'flex',
  minH: '9',
  alignItems: 'center',
  gap: '2',
  rounded: 'control',
  borderWidth: '1px',
  borderColor: 'border/60',
  px: '3',
  fontFamily: 'mono',
  textStyle: 'xs',
  color: 'muted.foreground',
  outlineStyle: 'none',
  _focusVisible: { boxShadow: '0 0 0 2px color-mix(in srgb, {colors.ring} 70%, transparent)' },
})

const drawerRow = cva({
  base: {
    display: 'flex',
    minH: '11',
    alignItems: 'center',
    gap: '3',
    rounded: 'control',
    px: '2',
    py: '2',
    transitionProperty: 'colors',
    transitionDuration: '150ms',
    transitionTimingFunction: 'default',
  },
  variants: {
    active: {
      true: { bg: 'primary/12' },
      false: { _active: { bg: 'accent/60' } },
    },
  },
})

const drawerRowLabel = cva({
  base: { display: 'block', truncate: true, textStyle: 'sm', fontWeight: 'medium' },
  variants: {
    active: {
      true: { color: 'primary' },
      false: { color: 'foreground' },
    },
  },
})

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
      <DrawerContent side="bottom" lg={{ display: 'none' }}>
        <styled.div
          mx="auto"
          mt="2.5"
          h="1"
          w="10"
          rounded="full"
          bg="muted.foreground/30"
          aria-hidden="true"
        />
        <styled.div
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          px="5"
          pb="2"
          pt="3"
        >
          <DrawerTitle fontSize="15px" lineHeight="inherit">
            Plus
          </DrawerTitle>
          <DrawerDescription srOnly>Destinations secondaires</DrawerDescription>
          <button
            type="button"
            onClick={() => {
              onOpenChange(false)
              openCommandPalette()
            }}
            className={drawerSearchButton}
          >
            Rechercher
          </button>
        </styled.div>

        <styled.nav aria-label="Navigation secondaire" px="3" pb="3">
          {sections.map(section => (
            <styled.div key={section.id} mb="2">
              <styled.p
                px="2"
                pb="1"
                pt="2"
                fontFamily="mono"
                fontSize="10px"
                fontWeight="medium"
                textTransform="uppercase"
                letterSpacing="0.16em"
                color="muted.foreground"
              >
                {section.label}
              </styled.p>
              <ul>
                {section.items.map(item => {
                  const active = isRouteActive(pathname, item.to)
                  const Icon = item.icon
                  return (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        onClick={() => onOpenChange(false)}
                        {...(active ? { 'aria-current': 'page' as const } : {})}
                        className={drawerRow({ active })}
                      >
                        <NavIconTile icon={Icon} active={active} />
                        <styled.span minW="0">
                          <span className={drawerRowLabel({ active })}>{item.label}</span>
                          <styled.span
                            display="block"
                            truncate
                            textStyle="xs"
                            color="muted.foreground"
                          >
                            {item.description}
                          </styled.span>
                        </styled.span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </styled.div>
          ))}
        </styled.nav>
      </DrawerContent>
    </Drawer>
  )
}
