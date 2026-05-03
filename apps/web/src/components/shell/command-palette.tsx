import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Command } from 'cmdk'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { authMeQueryOptions } from '@/features/auth-query-options'
import { resolveAuthViewState } from '@/features/auth-view-state'
import { NAV_GROUPS, NAV_ITEMS, isNavItemVisible } from './nav-items'

const KEYWORDS: Record<string, string> = {
  '/': 'accueil home dashboard vue ensemble quotidien',
  '/depenses': 'transactions budgets projections quotidien',
  '/patrimoine': 'actifs soldes assets wealth',
  '/investissements': 'positions portfolio bourse invest',
  '/objectifs': 'goals épargne cibles progression',
  '/integrations': 'powens sync banque connexion provider admin expert',
  '/sante': 'health diagnostics système admin expert',
  '/parametres': 'settings notifications export config admin',
  '/ia': 'advisor IA briefing recommandations intelligence artificielle conseils vue ia',
  '/ia/chat': 'chat conversation question reponse advisor dialogue',
  '/ia/memoire': 'graphe connaissances graphrag memoire knowledge neo4j qdrant',
  '/ia/trading-lab': 'trading lab papier paper backtest recherche strategies expert',
  '/ia/couts': 'tokens couts budget modeles llm depenses ia usage admin expert',
  '/signaux': 'news actualites feed flux macro signal briefing donnees brutes expert',
  '/signaux/marches': 'macro watchlist regime taux inflation fred eodhd marches bourse expert',
  '/signaux/social': 'social x bluesky comptes surveilles imports expert',
  '/signaux/sources': 'sources api fraicheur qualite donnees providers admin expert',
}

const PAGES = NAV_ITEMS.map(item => ({
  to: item.to,
  label: item.label,
  glyph: item.icon,
  group: item.group,
  adminOnly: item.adminOnly ?? false,
  keywords: KEYWORDS[item.to] ?? '',
}))

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const authQuery = useQuery(authMeQueryOptions())
  const authViewState = resolveAuthViewState({
    isPending: authQuery.isPending,
    ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}),
  })
  const visiblePages = PAGES.filter(page =>
    isNavItemVisible(
      {
        to: page.to,
        label: page.label,
        icon: page.glyph,
        description: '',
        group: page.group,
        ...(page.adminOnly ? { adminOnly: true } : {}),
      },
      authViewState
    )
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        setOpen(prev => !prev)
      }
      if (event.key === 'Escape') {
        setOpen(false)
      }
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
                <div
                  className="relative flex items-center gap-3 border-b border-border/40 px-4 py-3"
                  style={{
                    background:
                      'linear-gradient(180deg, oklch(from var(--primary) l c h / 5%) 0%, transparent 100%)',
                  }}
                >
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary/65">
                    ◈ Finance OS
                  </span>
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

                  {NAV_GROUPS.map(group => {
                    const groupPages = visiblePages.filter(p => p.group === group.id)
                    if (groupPages.length === 0) return null
                    return (
                      <Command.Group
                        key={group.id}
                        heading={group.label}
                        className={`px-2 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${group.color}`}
                      >
                        {groupPages.map(page => (
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
                            <span className="flex-1 font-medium">{page.label}</span>
                            <span
                              aria-hidden="true"
                              className="font-mono text-[11px] text-muted-foreground/40 opacity-0 transition-opacity group-data-[selected=true]/item:opacity-100"
                            >
                              ↵
                            </span>
                          </Command.Item>
                        ))}
                      </Command.Group>
                    )
                  })}
                </Command.List>

                <div className="flex items-center justify-between border-t border-border/40 bg-surface-1/50 px-4 py-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/50">
                    navigation rapide
                  </span>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground/55">
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
      <span aria-hidden="true" className="text-primary/70">
        ⌕
      </span>
      <span>Rechercher</span>
      <kbd className="rounded border border-border/60 bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/60 transition-colors group-hover:text-primary/70">
        ⌘K
      </kbd>
    </button>
  )
}
