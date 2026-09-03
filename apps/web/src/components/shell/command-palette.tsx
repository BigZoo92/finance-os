/**
 * CommandPalette — cmdk navigation palette, Command Pixel restyle.
 *
 * Rendered inside the canonical Dialog primitive so it inherits real
 * dialog semantics (focus trap, Escape, scroll lock, focus restoration).
 * The keyboard shortcut never fires while typing in an editable field.
 */
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@finance-os/ui/components'
import { SearchPixelIcon } from '@finance-os/ui/icons/pixel'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Store, useStore } from '@tanstack/react-store'
import { Command } from 'cmdk'
import { useEffect } from 'react'
import { authMeQueryOptions } from '@/features/auth-query-options'
import { resolveAuthViewState } from '@/features/auth-view-state'
import { getPaletteLinks, NAV_ENTRIES, SECONDARY_LINKS, type NavLink } from './nav-items'
import { NavIconTile } from './nav-icon-tile'

const paletteOpenStore = new Store(false)

export const openCommandPalette = () => paletteOpenStore.setState(() => true)
export const closeCommandPalette = () => paletteOpenStore.setState(() => false)
export const toggleCommandPalette = () => paletteOpenStore.setState(open => !open)

/** True when a keyboard event originates from an editable control. */
export const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  return target.closest('[contenteditable]:not([contenteditable="false"])') !== null
}

type PaletteSection = { id: string; label: string; links: NavLink[] }

const buildSections = (visible: NavLink[]): PaletteSection[] => {
  const visibleSet = new Set(visible.map(link => link.to))
  const sections: PaletteSection[] = []

  for (const entry of NAV_ENTRIES) {
    if (entry.kind === 'link') {
      const links = [entry.link, ...(entry.related ?? [])].filter(link => visibleSet.has(link.to))
      if (links.length > 0) {
        sections.push({ id: entry.link.to, label: entry.link.label, links })
      }
      continue
    }
    const links = entry.items.filter(item => visibleSet.has(item.to))
    if (links.length > 0) {
      sections.push({ id: entry.id, label: entry.label, links })
    }
  }

  const secondary = SECONDARY_LINKS.filter(link => visibleSet.has(link.to))
  if (secondary.length > 0) {
    sections.push({ id: 'autres', label: 'Autres pages', links: secondary })
  }

  return sections
}

export function CommandPalette() {
  const open = useStore(paletteOpenStore)
  const navigate = useNavigate()
  const authQuery = useQuery(authMeQueryOptions())
  const authViewState = resolveAuthViewState({
    isPending: authQuery.isPending,
    ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}),
  })
  const sections = buildSections(getPaletteLinks(authViewState))

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        if (!paletteOpenStore.state && isEditableTarget(event.target)) return
        event.preventDefault()
        toggleCommandPalette()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const handleSelect = (to: string) => {
    closeCommandPalette()
    navigate({ to })
  }

  return (
    <Dialog open={open} onOpenChange={next => paletteOpenStore.setState(() => next)}>
      <DialogContent className="top-[18%] max-w-[560px] translate-y-0 gap-0 p-0">
        <DialogTitle className="sr-only">Recherche</DialogTitle>
        <DialogDescription className="sr-only">
          Rechercher une page et naviguer au clavier
        </DialogDescription>
        <Command loop>
          <div className="flex items-center gap-3 border-b border-border/60 px-4">
            <span aria-hidden="true" className="flex items-center text-muted-foreground">
              <SearchPixelIcon size={14} />
            </span>
            <Command.Input
              placeholder="Rechercher une page"
              className="w-full bg-transparent py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
              autoFocus
            />
            <kbd className="rounded-tile border border-border/60 bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/70">
              esc
            </kbd>
          </div>

          <Command.List className="max-h-[340px] overflow-y-auto px-2 pb-2">
            <Command.Empty className="px-4 py-10 text-center text-sm text-muted-foreground">
              Aucune page trouvée.
            </Command.Empty>

            {sections.map(section => (
              <Command.Group
                key={section.id}
                heading={section.label}
                className="px-1 pt-3 pb-1 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground [&_[cmdk-group-items]]:mt-1.5 [&_[cmdk-group-items]]:space-y-0.5"
              >
                {section.links.map(link => (
                  <Command.Item
                    key={link.to}
                    value={`${link.label} ${link.keywords ?? ''}`}
                    onSelect={() => handleSelect(link.to)}
                    className="group/item flex cursor-pointer items-center gap-3 rounded-control px-2 py-2 font-sans text-sm normal-case tracking-normal text-foreground/80 transition-colors data-[selected=true]:bg-primary/12 data-[selected=true]:text-foreground"
                  >
                    <NavIconTile icon={link.icon} className="h-7 w-7" />
                    <span className="flex-1 font-medium">{link.label}</span>
                    <span
                      aria-hidden="true"
                      className="font-mono text-[11px] text-muted-foreground/50 opacity-0 transition-opacity group-data-[selected=true]/item:opacity-100"
                    >
                      ↵
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  )
}

export function CommandPaletteTrigger({ className = '' }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={openCommandPalette}
      className={`group flex items-center gap-2 rounded-control border border-border/60 bg-background px-3 py-1.5 font-mono text-xs text-muted-foreground/70 transition-colors duration-150 hover:border-primary/30 hover:text-foreground ${className}`}
    >
      <span aria-hidden="true" className="flex items-center">
        <SearchPixelIcon size={13} />
      </span>
      <span>Rechercher</span>
      <kbd className="ml-auto rounded-[4px] border border-foreground/16 px-1.5 py-px font-mono text-[10px] text-muted-foreground/60">
        ⌘K
      </kbd>
    </button>
  )
}
