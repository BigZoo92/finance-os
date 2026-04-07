import { Link, useRouterState } from '@tanstack/react-router'
import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { NAV_ITEMS, type NavItem } from './nav-items'

export function AppSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname

  const isActive = (to: string) => {
    if (to === '/') return currentPath === '/'
    return currentPath.startsWith(to)
  }

  const mainItems = NAV_ITEMS.filter(i => i.section === 'main')
  const systemItems = NAV_ITEMS.filter(i => i.section === 'system')

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 hidden flex-col bg-sidebar transition-[width] lg:flex ${
        collapsed ? 'w-[68px]' : 'w-[260px]'
      }`}
      style={{ transitionDuration: 'var(--duration-slow)', transitionTimingFunction: 'var(--ease-out-expo)' }}
    >
      {/* Brand */}
      <div className="flex h-16 items-center px-5">
        <Link to="/" className="flex items-center gap-3 overflow-hidden">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground text-sm font-bold shadow-[0_2px_8px_oklch(from_var(--primary)_l_c_h/30%)]">
            ◈
          </div>
          {!collapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-bold tracking-tight text-sidebar-foreground">Finance OS</span>
              <span className="font-mono text-xs text-primary/50">cockpit financier</span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 pt-2 pb-4">
        {!collapsed && (
          <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/30">
            Finances
          </p>
        )}
        <ul className="space-y-px">
          {mainItems.map(item => (
            <SidebarItem key={item.to} item={item} active={isActive(item.to)} collapsed={collapsed} />
          ))}
        </ul>

        <div className="my-4 mx-3 h-px bg-sidebar-border/50" />

        {!collapsed && (
          <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-accent-2/50">
            Système
          </p>
        )}
        <ul className="space-y-px">
          {systemItems.map(item => (
            <SidebarItem key={item.to} item={item} active={isActive(item.to)} collapsed={collapsed} />
          ))}
        </ul>
      </nav>

      {/* Footer — ASCII art + collapse */}
      <div className="px-3 pb-3">
        {!collapsed && <SidebarFooterBlock />}
        <button
          type="button"
          onClick={onToggle}
          className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-sidebar-foreground/40 transition-all duration-200 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground/70"
        >
          <motion.span
            className="text-lg"
            animate={{ rotateY: collapsed ? 180 : 0 }}
            transition={{ type: 'spring', bounce: 0.4, duration: 0.5 }}
          >
            ◂
          </motion.span>
          {!collapsed && <span className="text-xs">Réduire le panneau</span>}
        </button>
      </div>
    </aside>
  )
}

function SidebarFooterBlock() {
  return (
    <div className="space-y-3">
      {/* ASCII brand block — integrated into sidebar style */}
      <div className="mx-1 overflow-hidden rounded-xl border border-primary/10 bg-gradient-to-b from-primary/5 to-transparent p-3">
        <pre className="font-mono text-xs leading-[1.5] text-primary/50 whitespace-pre select-none" aria-hidden="true">
{`╔═╗ ╦ ╔╗╔
╠╣  ║ ║║║  OS
╚   ╩ ╝╚╝`}
        </pre>
        <p className="mt-1.5 font-mono text-xs text-muted-foreground/50">
          cockpit · personnel · premium
        </p>
      </div>
    </div>
  )
}

function SidebarItem({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  return (
    <li>
      <Link
        to={item.to}
        className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition-all duration-150 ${
          active
            ? 'text-primary font-semibold'
            : 'text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/30'
        }`}
        title={collapsed ? item.label : undefined}
      >
        {active && (
          <motion.div
            layoutId="sidebar-active"
            className="absolute inset-0 rounded-xl bg-primary/8 border border-primary/15"
            style={{ zIndex: -1 }}
            transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
          />
        )}
        {/* Active indicator bar */}
        {active && (
          <motion.div
            layoutId="sidebar-bar"
            className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-primary shadow-[0_0_6px_oklch(from_var(--primary)_l_c_h/40%)]"
            transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
          />
        )}
        <span
          className={`flex h-6 w-6 flex-shrink-0 items-center justify-center text-[17px] leading-none transition-all duration-200 ${
            active ? 'text-primary scale-110' : 'opacity-60 group-hover:opacity-80 group-hover:scale-105'
          }`}
          aria-hidden="true"
        >
          {item.icon}
        </span>
        {!collapsed && <span className="truncate">{item.label}</span>}
      </Link>
    </li>
  )
}

export function MobileNav() {
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname
  const [isOpen, setIsOpen] = useState(false)

  const isActive = (to: string) => {
    if (to === '/') return currentPath === '/'
    return currentPath.startsWith(to)
  }

  const MOBILE_TAB_ITEMS = NAV_ITEMS.filter(i => i.section === 'main').slice(0, 5)

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/40 bg-background/95 backdrop-blur-xl lg:hidden safe-area-bottom">
        <div className="flex items-stretch justify-around">
          {MOBILE_TAB_ITEMS.map(item => {
            const active = isActive(item.to)
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`relative flex flex-1 flex-col items-center gap-0.5 px-1 py-2.5 text-xs transition-all duration-150 ${
                  active ? 'text-primary font-semibold' : 'text-muted-foreground active:scale-95'
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="mobile-tab"
                    className="absolute -top-px left-3 right-3 h-[2px] rounded-full bg-primary shadow-[0_0_8px_oklch(from_var(--primary)_l_c_h/50%)]"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                  />
                )}
                <motion.span
                  className="text-lg leading-none"
                  animate={active ? { scale: 1.2, y: -1 } : { scale: 1, y: 0 }}
                  transition={{ type: 'spring', bounce: 0.5, duration: 0.3 }}
                  aria-hidden="true"
                >
                  {item.icon}
                </motion.span>
                <span className="truncate">{item.label}</span>
              </Link>
            )
          })}
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="flex flex-1 flex-col items-center gap-0.5 px-1 py-2.5 text-xs text-muted-foreground active:scale-95"
          >
            <span className="text-lg leading-none" aria-hidden="true">⋯</span>
            <span>Plus</span>
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-50 bg-background/70 backdrop-blur-md lg:hidden"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', bounce: 0.08, duration: 0.4 }}
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-border/40 bg-card shadow-2xl px-5 pb-8 pt-3 lg:hidden"
            >
              <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-muted/40" />
              <nav>
                <ul className="space-y-0.5">
                  {NAV_ITEMS.map((item, i) => {
                    const active = isActive(item.to)
                    return (
                      <motion.li
                        key={item.to}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03, duration: 0.2 }}
                      >
                        <Link
                          to={item.to}
                          onClick={() => setIsOpen(false)}
                          className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition-all duration-150 active:scale-[0.98] ${
                            active
                              ? 'bg-primary/10 text-primary font-semibold'
                              : 'text-foreground/70 hover:bg-accent/40'
                          }`}
                        >
                          <span className="text-lg" aria-hidden="true">{item.icon}</span>
                          <div>
                            <p>{item.label}</p>
                            <p className="text-xs text-muted-foreground/70">{item.description}</p>
                          </div>
                        </Link>
                      </motion.li>
                    )
                  })}
                </ul>
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
