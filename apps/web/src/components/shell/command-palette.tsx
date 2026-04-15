import { useEffect, useState } from 'react'
import { Command } from 'cmdk'
import { useNavigate } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'

const PAGES = [
  { to: '/', label: 'Cockpit', glyph: '◈', section: 'Finances', keywords: 'accueil home dashboard vue ensemble' },
  { to: '/depenses', label: 'Dépenses', glyph: '↔', section: 'Finances', keywords: 'transactions budgets projections' },
  { to: '/patrimoine', label: 'Patrimoine', glyph: '◊', section: 'Finances', keywords: 'actifs soldes assets wealth' },
  { to: '/investissements', label: 'Investissements', glyph: '△', section: 'Finances', keywords: 'positions portfolio bourse' },
  { to: '/marches', label: 'Marchés', glyph: '≈', section: 'Finances', keywords: 'macro watchlist regime taux inflation fred eodhd' },
  { to: '/objectifs', label: 'Objectifs', glyph: '◎', section: 'Finances', keywords: 'goals épargne cibles' },
  { to: '/actualites', label: 'Actualités', glyph: '▣', section: 'Finances', keywords: 'news feed IA advisor' },
  { to: '/integrations', label: 'Intégrations', glyph: '⊞', section: 'Système', keywords: 'powens sync banque connexion' },
  { to: '/sante', label: 'Santé', glyph: '♡', section: 'Système', keywords: 'health diagnostics système' },
  { to: '/parametres', label: 'Paramètres', glyph: '⚙', section: 'Système', keywords: 'settings notifications export config' },
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

  const financesPages = PAGES.filter(p => p.section === 'Finances')
  const systemPages = PAGES.filter(p => p.section === 'Système')

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[100] bg-background/65 backdrop-blur-md"
            onClick={() => setOpen(false)}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ type: 'spring', bounce: 0.15, duration: 0.38 }}
            className="fixed left-1/2 top-[18%] z-[101] w-[92vw] max-w-[560px] -translate-x-1/2"
          >
            {/* Aurora rim — subtle rose→violet gradient frame */}
            <div
              className="relative overflow-hidden rounded-[22px] p-[1px]"
              style={{
                background:
                  'linear-gradient(135deg, oklch(from var(--primary) l c h / 55%) 0%, oklch(from var(--accent-2) l c h / 45%) 100%)',
                boxShadow:
                  '0 30px 60px -20px oklch(0 0 0 / 45%), 0 0 0 1px oklch(from var(--primary) l c h / 18%)',
              }}
            >
              <Command className="overflow-hidden rounded-[21px] bg-card" loop>
                {/* Header rail */}
                <div
                  className="relative flex items-center gap-3 border-b border-border/40 px-4 py-3"
                  style={{
                    background:
                      'linear-gradient(180deg, oklch(from var(--primary) l c h / 5%) 0%, transparent 100%)',
                  }}
                >
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary/65">◈ Finance OS</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">
                    · navigation
                  </span>
                </div>

                <Command.Input
                  placeholder="Rechercher une page…"
                  className="w-full bg-transparent px-4 py-3 text-[14px] text-foreground outline-none placeholder:text-muted-foreground/55"
                  autoFocus
                />

                <Command.List className="max-h-[340px] overflow-y-auto px-2 pb-2">
                  <Command.Empty className="px-4 py-10 text-center text-sm text-muted-foreground">
                    Aucune page trouvée.
                  </Command.Empty>

                  {[
                    { heading: 'Finances', color: 'text-primary/55', pages: financesPages },
                    { heading: 'Système', color: 'text-accent-2/55', pages: systemPages },
                  ].map(group => (
                    <Command.Group
                      key={group.heading}
                      heading={group.heading}
                      className={`px-2 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${group.color}`}
                    >
                      {group.pages.map(page => (
                        <Command.Item
                          key={page.to}
                          value={`${page.label} ${page.keywords}`}
                          onSelect={() => handleSelect(page.to)}
                          className="group/item flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm transition-colors data-[selected=true]:bg-primary/12 data-[selected=true]:text-foreground"
                        >
                          <span
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-1 text-sm transition-colors group-data-[selected=true]/item:bg-primary/15 group-data-[selected=true]/item:text-primary"
                            aria-hidden="true"
                          >
                            {page.glyph}
                          </span>
                          <span className="font-medium flex-1">{page.label}</span>
                          <span
                            aria-hidden="true"
                            className="text-[11px] font-mono text-muted-foreground/40 opacity-0 transition-opacity group-data-[selected=true]/item:opacity-100"
                          >
                            ↵
                          </span>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  ))}
                </Command.List>

                <div className="flex items-center justify-between border-t border-border/40 bg-surface-1/50 px-4 py-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/50">
                    navigation rapide
                  </span>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground/55">
                    <kbd className="rounded border border-border/60 bg-background px-1.5 py-0.5 font-mono text-[10px]">
                      ↵
                    </kbd>
                    <span>ouvrir</span>
                    <kbd className="rounded border border-border/60 bg-background px-1.5 py-0.5 font-mono text-[10px]">
                      esc
                    </kbd>
                    <span>fermer</span>
                  </div>
                </div>
              </Command>
            </div>
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
      className="group hidden items-center gap-2 rounded-lg border border-border/60 bg-surface-1 px-3 py-1.5 text-xs text-muted-foreground transition-all duration-150 hover:border-primary/30 hover:bg-surface-2 hover:text-foreground md:inline-flex"
    >
      <span aria-hidden="true" className="text-primary/70">⌕</span>
      <span>Rechercher</span>
      <kbd className="rounded border border-border/60 bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/60 transition-colors group-hover:text-primary/70">
        ⌘K
      </kbd>
    </button>
  )
}
