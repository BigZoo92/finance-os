import { createFileRoute, Outlet, useRouterState } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'
import { CommandPalette } from '@/components/shell/command-palette'
import { MobileNav, MobileTopBar } from '@/components/shell/mobile-nav'
import { TopNavbar } from '@/components/shell/top-navbar'
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion'

export const Route = createFileRoute('/_app')({
  component: AppLayout,
})

/**
 * AppShell — canonical Command Pixel shell.
 *
 * Desktop: contained floating navbar (1240px, detached from the viewport
 * edges) over the warm graphite canvas. Mobile: brand top row and the
 * five-tab bottom navigation. Page content is centered at the canonical
 * standard width.
 */
export function AppLayout() {
  const locationKey = useRouterState({ select: state => state.location.pathname })
  const prefersReducedMotion = usePrefersReducedMotion()

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <TopNavbar />
      <MobileTopBar />

      <main
        id="main-content"
        className="mx-auto w-full max-w-[calc(1240px+2.5rem)] px-5 pb-28 pt-5 lg:pt-9 lg:pb-14"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={locationKey}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            {...(prefersReducedMotion ? {} : { exit: { opacity: 0, y: -4 } })}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="w-full"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      <MobileNav />
      <CommandPalette />
    </div>
  )
}
