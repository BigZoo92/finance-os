import { createFileRoute, Outlet, useRouterState } from '@tanstack/react-router'
import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed(prev => !prev)} />

      <div
        className={`flex min-h-screen flex-col transition-[margin-left] ${
          collapsed ? 'lg:ml-[68px]' : 'lg:ml-[240px]'
        }`}
        style={{ transitionDuration: 'var(--duration-slow)', transitionTimingFunction: 'var(--ease-out-expo)' }}
      >
        <Topbar />

        <main id="main-content" className="flex-1 px-4 py-6 pb-24 lg:px-8 lg:pb-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={locationKey}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
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
