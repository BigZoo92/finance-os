import { useEffect, useState } from 'react'
import { Command } from 'cmdk'
import { useNavigate } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'

const PAGES = [
  { to: '/', label: 'Cockpit', glyph: '◈', keywords: 'accueil home dashboard vue ensemble' },
  { to: '/depenses', label: 'Dépenses', glyph: '↔', keywords: 'transactions budgets projections' },
  { to: '/patrimoine', label: 'Patrimoine', glyph: '◊', keywords: 'actifs soldes assets wealth' },
  { to: '/investissements', label: 'Investissements', glyph: '△', keywords: 'positions portfolio bourse' },
  { to: '/marches', label: 'Marchés', glyph: '≈', keywords: 'macro watchlist regime taux inflation fred eodhd' },
  { to: '/objectifs', label: 'Objectifs', glyph: '◎', keywords: 'goals épargne cibles' },
  { to: '/actualites', label: 'Actualités', glyph: '▣', keywords: 'news feed IA advisor' },
  { to: '/integrations', label: 'Intégrations', glyph: '⊞', keywords: 'powens sync banque connexion' },
  { to: '/sante', label: 'Santé', glyph: '♡', keywords: 'health diagnostics système' },
  { to: '/parametres', label: 'Paramètres', glyph: '⚙', keywords: 'settings notifications export config' },
] as const

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const handleSelect = (to: string) => {
    setOpen(false)
    navigate({ to })
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[100] bg-background/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ type: 'spring', bounce: 0.15, duration: 0.35 }}
            className="fixed left-1/2 top-[20%] z-[101] w-[90vw] max-w-[520px] -translate-x-1/2"
          >
            <Command
              className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl"
              loop
            >
              <div className="border-b border-border/40 px-4 pt-3 pb-1">
                <span className="select-none font-mono text-xs text-primary/40" aria-hidden="true">
                  ┌─ FINANCE OS ── Navigation rapide ─────────────────┐
                </span>
              </div>

              <Command.Input
                placeholder="Rechercher une page..."
                className="w-full bg-transparent px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
                autoFocus
              />

              <Command.List className="max-h-[300px] overflow-y-auto px-2 pb-2">
                <Command.Empty className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Aucune page trouvée.
                </Command.Empty>

                <Command.Group
                  heading="Pages"
                  className="px-2 pt-2 pb-1 text-xs font-medium uppercase tracking-widest text-muted-foreground/50"
                >
                  {PAGES.map(page => (
                    <Command.Item
                      key={page.to}
                      value={`${page.label} ${page.keywords}`}
                      onSelect={() => handleSelect(page.to)}
                      className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors data-[selected=true]:bg-accent/60 data-[selected=true]:text-accent-foreground"
                    >
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-1 text-sm"
                        aria-hidden="true"
                      >
                        {page.glyph}
                      </span>
                      <span className="font-medium">{page.label}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              </Command.List>

              <div className="flex items-center justify-between border-t border-border/40 px-4 py-2">
                <span className="select-none font-mono text-xs text-muted-foreground/40" aria-hidden="true">
                  └──────────────────────────────────────────────────┘
                </span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground/50">
                  <kbd className="rounded border border-border/60 bg-surface-1 px-1.5 py-0.5 font-mono text-xs">↵</kbd>
                  <span>ouvrir</span>
                  <kbd className="rounded border border-border/60 bg-surface-1 px-1.5 py-0.5 font-mono text-xs">esc</kbd>
                  <span>fermer</span>
                </div>
              </div>
            </Command>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export function CommandPaletteTrigger() {
  return (
    <button
      type="button"
      onClick={() =>
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
      }
      className="hidden items-center gap-2 rounded-lg border border-border/60 bg-surface-1 px-3 py-1.5 text-xs text-muted-foreground transition-all duration-150 hover:bg-surface-2 hover:text-foreground md:inline-flex"
    >
      <span>Rechercher</span>
      <kbd className="rounded border border-border/60 bg-background px-1.5 py-0.5 font-mono text-xs">⌘K</kbd>
    </button>
  )
}
