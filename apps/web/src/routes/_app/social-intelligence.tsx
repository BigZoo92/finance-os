/**
 * Social Intelligence — who Finance-OS listens to.
 *
 * A premium source library: identity cards (rows on mobile), search,
 * canonical filters and a compact selected-source surface. Viewing is a
 * normal product destination; source management stays Admin-only and the
 * backend authorization is untouched.
 */
import { css } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
import {
  Button,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  Input,
  Status,
} from '@finance-os/ui/components'
import { SearchPixelIcon } from '@finance-os/ui/icons/pixel'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { AddSourceDialog } from '@/components/social/add-source-dialog'
import { SourceCard } from '@/components/social/source-card'
import { SourceDetail } from '@/components/social/source-detail'
import { SourceFilters } from '@/components/social/source-filters'
import { PageHeader } from '@/components/surfaces/page-header'
import { authMeQueryOptions } from '@/features/auth-query-options'
import { resolveAuthViewState } from '@/features/auth-view-state'
import { RADAR_EVENTS_QUERY } from '@/features/radar/view-model'
import { deleteSignalSource, updateSignalSource } from '@/features/signals-api'
import {
  signalItemsQueryOptions,
  signalSourcesQueryOptions,
} from '@/features/signals-query-options'
import {
  buildSocialFacets,
  buildSourceCards,
  countActiveFilters,
  countRelatedSignals,
  filterSourceCards,
  filtersFromSearch,
  parseSocialSearch,
  type SocialFilters,
  searchFromFilters,
} from '@/features/social/view-model'
import { pushToast } from '@/lib/toast-store'
import { useIsMobile } from '@/lib/use-is-mobile'

export const Route = createFileRoute('/_app/social-intelligence')({
  validateSearch: (raw: Record<string, unknown>) => parseSocialSearch(raw),
  loader: async ({ context }) => {
    await context.queryClient.fetchQuery(authMeQueryOptions())
    await Promise.allSettled([
      context.queryClient.ensureQueryData(signalSourcesQueryOptions()),
      context.queryClient.ensureQueryData(signalItemsQueryOptions(RADAR_EVENTS_QUERY)),
    ])
  },
  component: SocialIntelligencePage,
})

const SOURCES_QUERY_KEY = ['signal-sources'] as const

// Tailwind's `space-y-7` (margin under every child but the last), kept verbatim: the
// last child is often the `md:hidden` rows list, so the gallery keeps its trailing
// margin, which `spaceY` (margin above every child but the first) would drop.
const pageStack = css({ '& > :not(:last-child)': { marginBlockEnd: '7' } })

const searchIcon = css({
  pointerEvents: 'none',
  position: 'absolute',
  left: '3',
  top: '50%',
  translate: '0 -50%',
  color: 'foreground/40',
})

const sourceGrid = css({
  display: 'grid',
  gap: '5',
  md: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
  xl: { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' },
})

// The gallery only exists from `md` up; the rows take over below.
const desktopGallery = css({
  display: 'none',
  gap: '5',
  md: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
  xl: { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' },
})

const mobileRows = css({ md: { display: 'none' } })

// Former unlayered `.animate-shimmer`, stopped under reduced motion.
const skeleton = css({
  h: '40',
  rounded: 'surface',
  bgImage:
    'linear-gradient(90deg, {colors.muted} 0%, oklch(from {colors.muted} calc(l + 0.05) c h) 50%, {colors.muted} 100%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.8s ease-in-out infinite',
  _motionReduce: { animation: 'none' },
})

const emptyState = css({ borderYWidth: '1px', borderColor: 'border/60', py: '10' })

const emptyTitle = css({ textStyle: 'sm', color: 'foreground' })

// Desktop detail: a floating card under the navbar instead of a full-height sheet.
const floatingDetail = css.raw({
  top: '5.5rem',
  bottom: 'auto',
  right: '6',
  h: 'auto',
  maxH: 'calc(100dvh - 7rem)',
  w: '340px',
  rounded: 'surface',
  borderWidth: '1px',
  borderColor: 'primary/40',
})

function SocialIntelligencePage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const isMobile = useIsMobile()
  const queryClient = useQueryClient()
  const triggerRef = useRef<HTMLElement | null>(null)
  const [query, setQuery] = useState(search.q ?? '')
  const [addOpen, setAddOpen] = useState(false)

  const authQuery = useQuery(authMeQueryOptions())
  const authViewState = resolveAuthViewState({
    isPending: authQuery.isPending,
    ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}),
  })
  const isAdmin = authViewState === 'admin'

  const sourcesQuery = useQuery(signalSourcesQueryOptions())
  const itemsQuery = useQuery(signalItemsQueryOptions(RADAR_EVENTS_QUERY))

  const filters = filtersFromSearch(search)
  const cards = buildSourceCards(sourcesQuery.data?.items ?? [])
  const facets = buildSocialFacets(cards)
  const visible = filterSourceCards(cards, filters)
  const activeFilters = countActiveFilters(filters)
  const filtering = activeFilters > 0 || filters.q.trim().length > 0
  const selected = cards.find(card => card.id === search.selected) ?? null
  const relatedSignals = selected ? countRelatedSignals(selected, itemsQuery.data?.items ?? []) : 0

  const updateSearch = (next: SocialFilters, selectedId: number | undefined) => {
    void navigate({ search: searchFromFilters(next, selectedId), replace: true })
  }

  const select = (id: number | undefined, trigger?: HTMLElement) => {
    if (trigger) triggerRef.current = trigger
    updateSearch(filters, id)
  }

  /** Radix modal dialogs focus their trigger on close; ours is the selected card. */
  const restoreTriggerFocus = () => {
    const element = triggerRef.current
    if (element?.isConnected) element.focus()
    triggerRef.current = null
  }

  const invalidateSources = () => queryClient.invalidateQueries({ queryKey: SOURCES_QUERY_KEY })

  const toggleMutation = useMutation({
    mutationFn: (input: { id: number; enabled: boolean }) =>
      updateSignalSource(input.id, { enabled: input.enabled }),
    onSuccess: async (_data, input) => {
      await invalidateSources()
      pushToast({
        title: input.enabled ? 'Source activée' : 'Source mise en pause',
        tone: 'success',
      })
    },
    onError: () => pushToast({ title: 'Modification impossible pour le moment', tone: 'error' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteSignalSource(id),
    onSuccess: async () => {
      await invalidateSources()
      select(undefined)
      pushToast({ title: 'Source supprimée', tone: 'success' })
    },
    onError: () => pushToast({ title: 'Suppression impossible pour le moment', tone: 'error' }),
  })

  useEffect(() => {
    setQuery(search.q ?? '')
  }, [search.q])

  const total = cards.length
  const countLabel = `${total} ${total === 1 ? 'source' : 'sources'}`

  return (
    <div className={pageStack}>
      <PageHeader
        title="Social Intelligence"
        status={
          <styled.span fontFamily="mono" textStyle="xs" color="foreground/55">
            {sourcesQuery.isPending ? 'Chargement' : countLabel}
          </styled.span>
        }
        actions={
          <styled.div
            display="flex"
            w="full"
            flexWrap="wrap"
            alignItems="center"
            gap="2"
            sm={{ w: 'auto' }}
          >
            <styled.div position="relative" minW="0" flex="1" sm={{ w: '200px', flex: 'none' }}>
              <SearchPixelIcon size={13} aria-hidden="true" className={searchIcon} />
              <Input
                type="search"
                value={query}
                aria-label="Rechercher une source"
                placeholder="Rechercher"
                autoComplete="off"
                h="9"
                pl="8"
                onChange={event => {
                  setQuery(event.target.value)
                  updateSearch({ ...filters, q: event.target.value }, search.selected)
                }}
              />
            </styled.div>
            <SourceFilters
              filters={filters}
              facets={facets}
              matchCount={visible.length}
              isMobile={isMobile}
              onApply={next => updateSearch({ ...next, q: filters.q }, undefined)}
            />
            {isAdmin ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                minH="9"
                onClick={() => setAddOpen(true)}
              >
                Ajouter une source
              </Button>
            ) : null}
          </styled.div>
        }
      />

      {sourcesQuery.isPending ? (
        <output aria-label="Chargement des sources" className={sourceGrid}>
          {[0, 1, 2].map(index => (
            <div key={index} className={skeleton} />
          ))}
        </output>
      ) : sourcesQuery.isError ? (
        <styled.div
          display="flex"
          flexWrap="wrap"
          alignItems="center"
          gap="4"
          borderYWidth="1px"
          borderColor="border/60"
          py="8"
        >
          <Status tone="negative" label="Sources indisponibles" />
          <Button type="button" variant="outline" onClick={() => sourcesQuery.refetch()}>
            Réessayer
          </Button>
        </styled.div>
      ) : cards.length === 0 ? (
        <div className={emptyState}>
          <p className={emptyTitle}>Aucune source</p>
          {isAdmin ? (
            <Button
              type="button"
              variant="outline"
              mt="4"
              minH="11"
              onClick={() => setAddOpen(true)}
            >
              Ajouter une source
            </Button>
          ) : null}
        </div>
      ) : visible.length === 0 ? (
        <div className={emptyState}>
          <p className={emptyTitle}>Aucune source correspondante</p>
          <Button
            type="button"
            variant="outline"
            mt="4"
            minH="11"
            onClick={() => {
              setQuery('')
              updateSearch(
                { q: '', platform: null, tag: null, status: null, group: null },
                undefined
              )
            }}
          >
            Réinitialiser
          </Button>
        </div>
      ) : (
        <>
          <ul className={desktopGallery} aria-label="Sources suivies">
            {visible.map(card => (
              <styled.li key={card.id} minW="0">
                <SourceCard
                  source={card}
                  selected={card.id === selected?.id}
                  variant="card"
                  onSelect={select}
                />
              </styled.li>
            ))}
          </ul>
          <ul className={mobileRows} aria-label="Sources suivies">
            {visible.map(card => (
              <li key={card.id}>
                <SourceCard
                  source={card}
                  selected={card.id === selected?.id}
                  variant="row"
                  onSelect={select}
                />
              </li>
            ))}
          </ul>
          {filtering ? (
            <styled.p fontFamily="mono" fontSize="11px" color="foreground/45">
              {visible.length}{' '}
              {visible.length === 1 ? 'source correspondante' : 'sources correspondantes'}
            </styled.p>
          ) : null}
        </>
      )}

      <Drawer open={selected !== null} onOpenChange={open => !open && select(undefined)}>
        <DrawerContent
          side={isMobile ? 'bottom' : 'right'}
          onCloseAutoFocus={event => {
            event.preventDefault()
            restoreTriggerFocus()
          }}
          {...(isMobile ? {} : { css: floatingDetail })}
        >
          <DrawerTitle srOnly>{selected ? selected.name : 'Source'}</DrawerTitle>
          <DrawerDescription srOnly>Détail de la source sélectionnée</DrawerDescription>
          {selected ? (
            <styled.div px="5" pb="4" pt="5">
              <SourceDetail
                source={selected}
                relatedSignals={relatedSignals}
                isAdmin={isAdmin}
                togglePending={toggleMutation.isPending}
                deletePending={deleteMutation.isPending}
                showEscapeHint={!isMobile}
                onToggle={() =>
                  toggleMutation.mutate({ id: selected.id, enabled: !selected.enabled })
                }
                onDelete={() => deleteMutation.mutate(selected.id)}
              />
            </styled.div>
          ) : null}
        </DrawerContent>
      </Drawer>

      {isAdmin && addOpen ? (
        <AddSourceDialog
          open
          onOpenChange={setAddOpen}
          defaultGroup={filters.group ?? 'finance'}
          onCreated={() => void invalidateSources()}
        />
      ) : null}
    </div>
  )
}
