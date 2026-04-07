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

  return (
    <button
      type="button"
      onClick={toggle}
      className="relative flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-all duration-200 hover:bg-accent/50"
      title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
      aria-label="Basculer le thème"
    >
      {/* Sun */}
      <span
        className={`absolute transition-all duration-300 ${
          theme === 'dark'
            ? 'scale-0 rotate-90 opacity-0'
            : 'scale-100 rotate-0 opacity-100'
        }`}
      >
        ☀
      </span>
      {/* Moon */}
      <span
        className={`absolute transition-all duration-300 ${
          theme === 'dark'
            ? 'scale-100 rotate-0 opacity-100'
            : 'scale-0 -rotate-90 opacity-0'
        }`}
      >
        ☾
      </span>
    </button>
  )
}
