import { Link, useRouterState } from '@tanstack/react-router'
import { useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { BrandMark } from '@/components/brand/brand-mark'
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
      className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-sidebar-border bg-sidebar lg:flex ${
        collapsed ? 'w-[72px]' : 'w-[248px]'
      }`}
      style={{
        transitionProperty: 'width',
        transitionDuration: 'var(--duration-slow)',
        transitionTimingFunction: 'var(--ease-out-expo)',
      }}
    >
      {/* Subtle aurora gradient flourish behind the brand */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-40"
        style={{
          background:
            'radial-gradient(60% 90% at 50% 0%, oklch(from var(--primary) l c h / 12%) 0%, transparent 75%)',
        }}
      />

      {/* Brand */}
      <div className={`relative flex h-16 items-center ${collapsed ? 'justify-center px-3' : 'px-5'}`}>
        <Link to="/" className="flex items-center gap-3 overflow-hidden">
          <BrandMark size="md" halo={!collapsed} />
          {!collapsed && (
            <div className="flex flex-col overflow-hidden leading-tight">
              <span className="text-[13px] font-semibold tracking-tight text-sidebar-foreground">Finance OS</span>
              <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-primary/55">cockpit</span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 pt-1 pb-4">
        {!collapsed && (
          <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/45">
            Finances
          </p>
        )}
        <ul className="space-y-px">
          {mainItems.map(item => (
            <SidebarItem key={item.to} item={item} active={isActive(item.to)} collapsed={collapsed} />
          ))}
        </ul>

        <div className="my-4 hair-rule" />

        {!collapsed && (
          <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-accent-2/55">
            Système
          </p>
        )}
        <ul className="space-y-px">
          {systemItems.map(item => (
            <SidebarItem key={item.to} item={item} active={isActive(item.to)} collapsed={collapsed} />
          ))}
        </ul>
      </nav>

      {/* Footer — brand block + collapse */}
      <div className="relative px-3 pb-3">
        {!collapsed && <SidebarFooterBlock />}
        <button
          type="button"
          onClick={onToggle}
          className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs text-sidebar-foreground/50 transition-all duration-200 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          aria-label={collapsed ? 'Déployer la navigation' : 'Réduire la navigation'}
        >
          <motion.span
            className="text-base"
            animate={{ rotate: collapsed ? 180 : 0 }}
            transition={{ type: 'spring', bounce: 0.35, duration: 0.45 }}
            aria-hidden="true"
          >
            ◂
          </motion.span>
          {!collapsed && <span>Réduire</span>}
        </button>
      </div>
    </aside>
  )
}

function SidebarFooterBlock() {
  return (
    <div
      className="relative mx-1 overflow-hidden rounded-xl border border-primary/12 p-3"
      style={{
        background:
          'linear-gradient(160deg, oklch(from var(--primary) l c h / 10%) 0%, oklch(from var(--accent-2) l c h / 8%) 55%, transparent 100%)',
      }}
    >
      <pre
        className="font-mono text-[10px] leading-[1.35] text-aurora whitespace-pre select-none"
        aria-hidden="true"
      >
{`╔═╗ ╦ ╔╗╔
╠╣  ║ ║║║  OS
╚   ╩ ╝╚╝`}
      </pre>
      <p className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground/55">
        cockpit · personnel · premium
      </p>
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
            ? 'text-primary-foreground'
            : 'text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-sidebar-accent/40'
        }`}
        title={collapsed ? item.label : undefined}
      >
        {active && (
          <motion.div
            layoutId="sidebar-active"
            className="absolute inset-0 rounded-xl"
            style={{
              background:
                'linear-gradient(112deg, oklch(from var(--primary) l c h / 95%) 0%, oklch(from var(--accent-2) l c h / 88%) 100%)',
              boxShadow:
                '0 8px 24px -10px oklch(from var(--primary) l c h / 55%), inset 0 1px 0 oklch(1 0 0 / 22%)',
              zIndex: -1,
            }}
            transition={{ type: 'spring', bounce: 0.18, duration: 0.5 }}
          />
        )}

        <span
          className={`flex h-6 w-6 flex-shrink-0 items-center justify-center text-[17px] leading-none transition-all duration-200 ${
            active
              ? 'scale-110 drop-shadow-[0_0_6px_oklch(1_0_0/45%)]'
              : 'opacity-60 group-hover:opacity-90 group-hover:scale-105'
          }`}
          aria-hidden="true"
        >
          {item.icon}
        </span>
        {!collapsed && (
          <span className={`truncate font-medium ${active ? '' : 'tracking-tight'}`}>{item.label}</span>
        )}
      </Link>
    </li>
  )
}

export function MobileNav() {
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname
  const prefersReducedMotion = useReducedMotion()
  const [isOpen, setIsOpen] = useState(false)

  const isActive = (to: string) => {
    if (to === '/') return currentPath === '/'
    return currentPath.startsWith(to)
  }

  const MOBILE_TAB_ITEMS = NAV_ITEMS.filter(i => i.section === 'main').slice(0, 5)

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 lg:hidden safe-area-bottom"
        aria-label="Navigation principale"
      >
        <div className="mx-3 mb-3 rounded-2xl border border-border/60 glass-surface shadow-lg">
          <div className="relative flex items-stretch justify-around px-1">
            {MOBILE_TAB_ITEMS.map(item => {
              const active = isActive(item.to)
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`relative flex flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[10.5px] transition-all duration-150 ${
                    active ? 'text-primary-foreground' : 'text-muted-foreground active:scale-[0.96]'
                  }`}
                >
                  {active && (
                    <motion.div
                      layoutId="mobile-tab-bg"
                      className="absolute inset-x-1 inset-y-0.5 rounded-xl -z-10"
                      style={{
                        background:
                          'linear-gradient(112deg, oklch(from var(--primary) l c h / 90%) 0%, oklch(from var(--accent-2) l c h / 88%) 100%)',
                        boxShadow:
                          '0 8px 24px -8px oklch(from var(--primary) l c h / 55%), inset 0 1px 0 oklch(1 0 0 / 22%)',
                      }}
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                    />
                  )}
                  <motion.span
                    className="text-[17px] leading-none"
                    animate={active && !prefersReducedMotion ? { scale: 1.15, y: -1 } : { scale: 1, y: 0 }}
                    transition={{ type: 'spring', bounce: 0.45, duration: 0.3 }}
                    aria-hidden="true"
                  >
                    {item.icon}
                  </motion.span>
                  <span className="truncate font-medium">{item.label}</span>
                </Link>
              )
            })}
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="flex flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[10.5px] text-muted-foreground active:scale-[0.96]"
              aria-label="Plus d'options"
            >
              <span className="text-[17px] leading-none" aria-hidden="true">⋯</span>
              <span className="font-medium">Plus</span>
            </button>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-background/60 backdrop-blur-md lg:hidden"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', bounce: 0.1, duration: 0.45 }}
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-border/50 bg-card shadow-2xl px-5 pb-8 pt-3 lg:hidden"
            >
              <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-muted-foreground/30" />
              <nav>
                <ul className="space-y-0.5">
                  {NAV_ITEMS.map((item, i) => {
                    const active = isActive(item.to)
                    return (
                      <motion.li
                        key={item.to}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: prefersReducedMotion ? 0 : i * 0.03, duration: 0.2 }}
                      >
                        <Link
                          to={item.to}
                          onClick={() => setIsOpen(false)}
                          className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition-all duration-150 active:scale-[0.98] ${
                            active
                              ? 'bg-primary/12 text-primary font-semibold border border-primary/20'
                              : 'text-foreground/75 hover:bg-accent/50'
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
