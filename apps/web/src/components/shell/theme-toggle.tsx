import { MoonPixelIcon, SunPixelIcon } from '@finance-os/ui/icons/pixel'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useTheme } from '@/lib/theme'

export function ThemeToggle() {
  const { resolvedTheme, toggle } = useTheme()
  const prefersReducedMotion = useReducedMotion()

  return (
    <button
      type="button"
      onClick={toggle}
      className="group relative inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg border border-transparent text-sm text-muted-foreground transition-all duration-200 hover:border-primary/20 hover:bg-accent/40 hover:text-primary"
      title={resolvedTheme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
      aria-label="Basculer le thème"
    >
      <AnimatePresence initial={false} mode="wait">
        {resolvedTheme === 'dark' ? (
          <motion.span
            key="moon"
            initial={prefersReducedMotion ? false : { opacity: 0, rotate: -90, scale: 0.6 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            {...(prefersReducedMotion ? {} : { exit: { opacity: 0, rotate: 90, scale: 0.6 } })}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center"
          >
            <MoonPixelIcon size={16} />
          </motion.span>
        ) : (
          <motion.span
            key="sun"
            initial={prefersReducedMotion ? false : { opacity: 0, rotate: 90, scale: 0.6 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            {...(prefersReducedMotion ? {} : { exit: { opacity: 0, rotate: -90, scale: 0.6 } })}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center"
          >
            <SunPixelIcon size={16} />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  )
}
