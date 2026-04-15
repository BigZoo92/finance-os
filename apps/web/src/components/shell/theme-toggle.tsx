import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  return (localStorage.getItem('finance-os-theme') as Theme) ?? 'dark'
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
    root.classList.remove('light')
  } else {
    root.classList.remove('dark')
    root.classList.add('light')
  }
  localStorage.setItem('finance-os-theme', theme)
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    const stored = getStoredTheme()
    setTheme(stored)
    applyTheme(stored)
  }, [])

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    applyTheme(next)
  }

  return { theme, toggle }
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const prefersReducedMotion = useReducedMotion()

  return (
    <button
      type="button"
      onClick={toggle}
      className="group relative inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg border border-transparent text-sm text-muted-foreground transition-all duration-200 hover:border-primary/20 hover:bg-accent/40 hover:text-primary"
      title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
      aria-label="Basculer le thème"
    >
      <AnimatePresence initial={false} mode="wait">
        {theme === 'dark' ? (
          <motion.span
            key="moon"
            initial={prefersReducedMotion ? false : { opacity: 0, rotate: -90, scale: 0.6 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            {...(prefersReducedMotion ? {} : { exit: { opacity: 0, rotate: 90, scale: 0.6 } })}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="text-base"
          >
            ☾
          </motion.span>
        ) : (
          <motion.span
            key="sun"
            initial={prefersReducedMotion ? false : { opacity: 0, rotate: 90, scale: 0.6 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            {...(prefersReducedMotion ? {} : { exit: { opacity: 0, rotate: -90, scale: 0.6 } })}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="text-base"
          >
            ☀
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  )
}
