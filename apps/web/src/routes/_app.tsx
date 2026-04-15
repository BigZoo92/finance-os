import { createFileRoute, Outlet, useRouterState } from '@tanstack/react-router'
import { useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { AppSidebar, MobileNav } from '@/components/shell/app-sidebar'
import { Topbar } from '@/components/shell/topbar'
import { CommandPalette } from '@/components/shell/command-palette'

export const Route = createFileRoute('/_app')({
  component: AppLayout,
})

function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const routerState = useRouterState()
  const locationKey = routerState.location.pathname
  const prefersReducedMotion = useReducedMotion()

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      {/* Ambient aurora wash — extremely subtle, behind everything */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 bg-aurora-mesh-soft opacity-90"
      />

      <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed(prev => !prev)} />

      <div
        className={`flex min-h-screen flex-col transition-[margin-left] ${
          collapsed ? 'lg:ml-[72px]' : 'lg:ml-[248px]'
        }`}
        style={{
          transitionDuration: 'var(--duration-slow)',
          transitionTimingFunction: 'var(--ease-out-expo)',
        }}
      >
        <Topbar />

        <main id="main-content" className="flex-1 px-4 py-6 pb-28 lg:px-8 lg:pb-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={locationKey}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              {...(prefersReducedMotion ? {} : { exit: { opacity: 0, y: -4 } })}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="mx-auto w-full max-w-7xl"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <MobileNav />
      <CommandPalette />
    </div>
  )
}
