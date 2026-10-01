/**
 * CommandPalette — cmdk navigation palette, Command Pixel restyle.
 *
 * Rendered inside the canonical Dialog primitive so it inherits real
 * dialog semantics (focus trap, Escape, scroll lock, focus restoration).
 * The keyboard shortcut never fires while typing in an editable field.
 */
import { css, cx } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@finance-os/ui/components'
import { SearchPixelIcon } from '@finance-os/ui/icons/pixel'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Store, useStore } from '@tanstack/react-store'
import { Command } from 'cmdk'
import { useEffect } from 'react'
import { authMeQueryOptions } from '@/features/auth-query-options'
import { resolveAuthViewState } from '@/features/auth-view-state'
import { NavIconTile } from './nav-icon-tile'
import { getPaletteLinks, NAV_ENTRIES, type NavLink, SECONDARY_LINKS } from './nav-items'

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

const paletteInput = css({
  w: 'full',
  bg: 'transparent',
  py: '3',
  textStyle: 'sm',
  color: 'foreground',
  outlineStyle: 'none',
  _placeholder: { color: 'muted.foreground/60' },
})

const paletteList = css({ maxH: '340px', overflowY: 'auto', px: '2', pb: '2' })

const paletteEmpty = css({
  px: '4',
  py: '10',
  textAlign: 'center',
  textStyle: 'sm',
  color: 'muted.foreground',
})

const paletteGroup = css({
  px: '1',
  pt: '3',
  pb: '1',
  fontFamily: 'mono',
  fontSize: '10px',
  fontWeight: 'medium',
  textTransform: 'uppercase',
  letterSpacing: '0.16em',
  color: 'muted.foreground',
  '& [cmdk-group-items]': { mt: '1.5', spaceY: '0.5' },
})

const paletteItem = css({
  display: 'flex',
  cursor: 'pointer',
  alignItems: 'center',
  gap: '3',
  rounded: 'control',
  px: '2',
  py: '2',
  fontFamily: 'sans',
  textStyle: 'sm',
  textTransform: 'none',
  letterSpacing: 'normal',
  color: 'foreground/80',
  transitionProperty: 'colors',
  transitionDuration: '150ms',
  transitionTimingFunction: 'default',
  '&[data-selected=true]': { bg: 'primary/12', color: 'foreground' },
})

const enterHint = css({
  fontFamily: 'mono',
  fontSize: '11px',
  color: 'muted.foreground/50',
  opacity: '0',
  transitionProperty: 'opacity',
  transitionDuration: '150ms',
  transitionTimingFunction: 'default',
  '[data-group=palette-item][data-selected=true] &': { opacity: '1' },
})

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
    void navigate({ to })
  }

  return (
    <Dialog open={open} onOpenChange={next => paletteOpenStore.setState(() => next)}>
      <DialogContent top="18%" maxW="560px" translate="-50% 0" gap="0" p="0">
        <DialogTitle srOnly>Recherche</DialogTitle>
        <DialogDescription srOnly>Rechercher une page et naviguer au clavier</DialogDescription>
        <Command loop>
          <styled.div
            display="flex"
            alignItems="center"
            gap="3"
            borderBottomWidth="1px"
            borderBottomColor="border/60"
            px="4"
          >
            <styled.span
              aria-hidden="true"
              display="flex"
              alignItems="center"
              color="muted.foreground"
            >
              <SearchPixelIcon size={14} />
            </styled.span>
            <Command.Input
              placeholder="Rechercher une page"
              className={paletteInput}
              // oxlint-disable-next-line jsx-a11y/no-autofocus -- focus moves into the palette dialog that just opened.
              autoFocus
            />
            <styled.kbd
              rounded="tile"
              borderWidth="1px"
              borderColor="border/60"
              bg="background"
              px="1.5"
              py="0.5"
              fontFamily="mono"
              fontSize="10px"
              color="muted.foreground/70"
            >
              esc
            </styled.kbd>
          </styled.div>

          <Command.List className={paletteList}>
            <Command.Empty className={paletteEmpty}>Aucune page trouvée.</Command.Empty>

            {sections.map(section => (
              <Command.Group key={section.id} heading={section.label} className={paletteGroup}>
                {section.links.map(link => (
                  <Command.Item
                    key={link.to}
                    value={`${link.label} ${link.keywords ?? ''}`}
                    onSelect={() => handleSelect(link.to)}
                    data-group="palette-item"
                    className={paletteItem}
                  >
                    <NavIconTile icon={link.icon} />
                    <styled.span flex="1" fontWeight="medium">
                      {link.label}
                    </styled.span>
                    <span aria-hidden="true" className={enterHint}>
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

const paletteTrigger = css({
  display: 'flex',
  alignItems: 'center',
  gap: '2',
  rounded: 'control',
  borderWidth: '1px',
  borderColor: 'border/60',
  bg: 'background',
  px: '3',
  py: '1.5',
  fontFamily: 'mono',
  textStyle: 'xs',
  color: 'muted.foreground/70',
  transitionProperty: 'colors',
  transitionDuration: '150ms',
  transitionTimingFunction: 'default',
  _hover: { borderColor: 'primary/30', color: 'foreground' },
})

export function CommandPaletteTrigger({ className }: { className?: string }) {
  return (
    <button type="button" onClick={openCommandPalette} className={cx(paletteTrigger, className)}>
      <styled.span aria-hidden="true" display="flex" alignItems="center">
        <SearchPixelIcon size={13} />
      </styled.span>
      <span>Rechercher</span>
      <styled.kbd
        ml="auto"
        rounded="4px"
        borderWidth="1px"
        borderColor="foreground/16"
        px="1.5"
        py="1px"
        fontFamily="mono"
        fontSize="10px"
        color="muted.foreground/60"
      >
        ⌘K
      </styled.kbd>
    </button>
  )
}
