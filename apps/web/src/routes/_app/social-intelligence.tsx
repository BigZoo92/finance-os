/**
 * Social Intelligence — who Finance-OS listens to.
 *
 * A premium source library: identity cards (rows on mobile), search,
 * canonical filters and a compact selected-source surface. Viewing is a
 * normal product destination; source management stays Admin-only and the
 * backend authorization is untouched.
 */
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
    <div className="space-y-7">
      <PageHeader
        title="Social Intelligence"
        status={
          <span className="font-mono text-xs text-foreground/55">
            {sourcesQuery.isPending ? 'Chargement' : countLabel}
          </span>
        }
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <div className="relative min-w-0 flex-1 sm:w-[200px] sm:flex-none">
              <SearchPixelIcon
                size={13}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40"
              />
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
            </div>
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
                className="min-h-9"
                onClick={() => setAddOpen(true)}
              >
                Ajouter une source
              </Button>
            ) : null}
          </div>
        }
      />

      {sourcesQuery.isPending ? (
        <output
          aria-label="Chargement des sources"
          className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
        >
          {[0, 1, 2].map(index => (
            <div
              key={index}
              className="h-40 animate-shimmer rounded-surface motion-reduce:animate-none"
            />
          ))}
        </output>
      ) : sourcesQuery.isError ? (
        <div className="flex flex-wrap items-center gap-4 border-y border-border/60 py-8">
          <Status tone="negative" label="Sources indisponibles" />
          <Button type="button" variant="outline" onClick={() => sourcesQuery.refetch()}>
            Réessayer
          </Button>
        </div>
      ) : cards.length === 0 ? (
        <div className="border-y border-border/60 py-10">
          <p className="text-sm text-foreground">Aucune source</p>
          {isAdmin ? (
            <Button
              type="button"
              variant="outline"
              className="mt-4 min-h-11"
              onClick={() => setAddOpen(true)}
            >
              Ajouter une source
            </Button>
          ) : null}
        </div>
      ) : visible.length === 0 ? (
        <div className="border-y border-border/60 py-10">
          <p className="text-sm text-foreground">Aucune source correspondante</p>
          <Button
            type="button"
            variant="outline"
            className="mt-4 min-h-11"
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
          <ul
            className="hidden gap-5 md:grid md:grid-cols-2 xl:grid-cols-3"
            aria-label="Sources suivies"
          >
            {visible.map(card => (
              <li key={card.id} className="min-w-0">
                <SourceCard
                  source={card}
                  selected={card.id === selected?.id}
                  variant="card"
                  onSelect={select}
                />
              </li>
            ))}
          </ul>
          <ul className="md:hidden" aria-label="Sources suivies">
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
            <p className="font-mono text-[11px] text-foreground/45">
              {visible.length}{' '}
              {visible.length === 1 ? 'source correspondante' : 'sources correspondantes'}
            </p>
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
          className={
            isMobile
              ? ''
              : 'top-[5.5rem] bottom-auto right-6 h-auto max-h-[calc(100dvh-7rem)] w-[340px] rounded-surface border border-primary/40'
          }
        >
          <DrawerTitle className="sr-only">{selected ? selected.name : 'Source'}</DrawerTitle>
          <DrawerDescription className="sr-only">
            Détail de la source sélectionnée
          </DrawerDescription>
          {selected ? (
            <div className="px-5 pb-4 pt-5">
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
            </div>
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
