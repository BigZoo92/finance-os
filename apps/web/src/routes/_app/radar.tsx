/**
 * Radar — canonical observation surface.
 *
 * Converges the former Signaux hub and Marchés dashboard: monitored markets,
 * deterministic market signals, dated events and freshness, around the D3
 * Signal Field. Radar observes, Advisor recommends: nothing here buys or
 * sells. Viewing is open to demo and admin; only the manual market refresh
 * stays an Admin action.
 */
import {
  Badge,
  Button,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  Freshness,
  SegmentedControl,
  Status,
} from '@finance-os/ui/components'
import { RefreshPixelIcon } from '@finance-os/ui/icons/pixel'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useId, useRef, useState } from 'react'
import { RadarEvents } from '@/components/radar/radar-events'
import { RadarFocusDetail } from '@/components/radar/radar-focus-detail'
import { RadarMarketStrip } from '@/components/radar/radar-market-strip'
import { RadarSignalList } from '@/components/radar/radar-signal-list'
import { SignalField } from '@/components/radar/signal-field'
import { authMeQueryOptions } from '@/features/auth-query-options'
import { resolveAuthViewState } from '@/features/auth-view-state'
import { postMarketsRefresh } from '@/features/markets/api'
import { marketQueryKeys, marketsOverviewQueryOptions } from '@/features/markets/query-options'
import {
  type FieldMarkerInput,
  type FieldSeries,
  toFieldSeries,
} from '@/features/radar/field-layout'
import {
  applyRadarFilter,
  buildRadarViewModel,
  computeMarketImportance,
  focusedMacroIds,
  focusedMarketIds,
  formatDayMonth,
  formatUpdateMoment,
  parseRadarSearch,
  RADAR_EVENTS_QUERY,
  RADAR_FILTER_LABEL,
  type RadarFilter,
  type RadarFocus,
  type RadarViewModel,
  resolveRadarFilter,
  resolveRadarFocus,
  serializeRadarFocus,
  signalsForMarket,
} from '@/features/radar/view-model'
import { signalItemsQueryOptions } from '@/features/signals-query-options'
import { pushToast } from '@/lib/toast-store'
import { useIsMobile } from '@/lib/use-is-mobile'
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion'

export const Route = createFileRoute('/_app/radar')({
  validateSearch: (raw: Record<string, unknown>) => parseRadarSearch(raw),
  loader: async ({ context }) => {
    await context.queryClient.fetchQuery(authMeQueryOptions())
    await Promise.allSettled([
      context.queryClient.ensureQueryData(marketsOverviewQueryOptions()),
      context.queryClient.ensureQueryData(signalItemsQueryOptions(RADAR_EVENTS_QUERY)),
    ])
  },
  component: RadarPage,
})

const SECTION_TITLE = 'font-mono text-[11px] uppercase tracking-[0.16em] text-foreground/55'

const parseDay = (value: string | null): number | null => {
  if (!value) return null
  const time = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value)
  return Number.isFinite(time) ? time : null
}

const buildMarkers = (vm: RadarViewModel): FieldMarkerInput[] => {
  const macro = vm.macro.flatMap(series => {
    const t = parseDay(series.observationDate)
    return t === null
      ? []
      : [
          {
            id: `macro:${series.id}`,
            kind: 'macro' as const,
            label: `${series.label} ${series.displayValue}`,
            t,
            relatedIds: [],
            attention: false,
          },
        ]
  })
  const events = vm.events.flatMap(event => {
    const t = parseDay(event.publishedAt)
    return t === null
      ? []
      : [
          {
            id: `event:${event.id}`,
            kind: 'event' as const,
            label: `${event.sourceLabel} ${formatDayMonth(t)}`,
            t,
            relatedIds: event.relatedMarketIds,
            attention: event.requiresAttention,
          },
        ]
  })
  return [...macro, ...events]
}

/** Return keyboard focus to the element that opened the detail, once. */
const restoreTriggerFocus = (ref: React.RefObject<Element | null>) => {
  const element = ref.current
  if (element instanceof HTMLElement && element.isConnected) element.focus()
  ref.current = null
}

const useOffline = (): boolean => {
  const [offline, setOffline] = useState(false)
  useEffect(() => {
    if (typeof navigator === 'undefined') return
    const update = () => setOffline(navigator.onLine === false)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  return offline
}

function RadarPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const isMobile = useIsMobile()
  const reducedMotion = usePrefersReducedMotion()
  const offline = useOffline()
  const queryClient = useQueryClient()
  const detailHeadingId = useId()
  const panelRef = useRef<HTMLElement>(null)
  const triggerRef = useRef<Element | null>(null)

  const authQuery = useQuery(authMeQueryOptions())
  const authViewState = resolveAuthViewState({
    isPending: authQuery.isPending,
    ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}),
  })
  const isAdmin = authViewState === 'admin'
  const isDemo = authViewState === 'demo'

  const overviewQuery = useQuery(marketsOverviewQueryOptions())
  const eventsQuery = useQuery(signalItemsQueryOptions(RADAR_EVENTS_QUERY))

  const refreshMutation = useMutation({
    mutationFn: postMarketsRefresh,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: marketQueryKeys.overview() })
      pushToast({ title: 'Marchés actualisés', tone: 'success' })
    },
    onError: () => {
      pushToast({ title: 'Actualisation impossible pour le moment', tone: 'error' })
    },
  })

  const vm = overviewQuery.data
    ? buildRadarViewModel({
        overview: overviewQuery.data,
        signalItems: eventsQuery.data?.items ?? [],
      })
    : null
  const filter = resolveRadarFilter(search.filter, vm?.filters ?? [])
  const scope = vm ? applyRadarFilter(vm, filter) : null
  const focus = vm ? resolveRadarFocus(vm, search.focus) : null
  const focusKey = focus ? (search.focus ?? null) : null

  const setFocus = (next: RadarFocus | null, trigger?: Element) => {
    if (trigger) triggerRef.current = trigger
    void navigate({
      search: previous => {
        const { focus: _previousFocus, ...rest } = previous
        return next ? { ...rest, focus: serializeRadarFocus(next) } : rest
      },
      replace: true,
    })
    // The mobile drawer restores focus itself once its focus trap unmounts.
    if (!next && !isMobile) restoreTriggerFocus(triggerRef)
  }

  const toggleFocus = (next: RadarFocus, trigger: Element) => {
    const current = focus ? serializeRadarFocus(currentFocusOf(focus)) : null
    setFocus(current === serializeRadarFocus(next) ? null : next, trigger)
  }

  const setFilter = (next: RadarFilter) => {
    void navigate({
      search: previous => {
        const { filter: _previousFilter, ...rest } = previous
        return next === 'all' ? rest : { ...rest, filter: next }
      },
      replace: true,
    })
  }

  useEffect(() => {
    if (!focusKey || isMobile) return
    panelRef.current?.focus({ preventScroll: true })
  }, [focusKey, isMobile])

  useEffect(() => {
    if (!focusKey || isMobile) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setFocus(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  if (!vm || !scope) {
    if (overviewQuery.isError) {
      return (
        <RadarFrame>
          <div className="flex flex-wrap items-center gap-4 py-10">
            <Status tone="negative" label="Marchés indisponibles" />
            <Button type="button" variant="outline" onClick={() => overviewQuery.refetch()}>
              Réessayer
            </Button>
          </div>
        </RadarFrame>
      )
    }
    return (
      <RadarFrame>
        <output aria-label="Chargement du radar" className="block space-y-5">
          <div className="h-6 w-full animate-shimmer rounded-tile motion-reduce:animate-none" />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_330px] lg:gap-9">
            <div className="h-[250px] animate-shimmer rounded-surface motion-reduce:animate-none lg:h-[520px]" />
            <div className="space-y-2">
              <div className="h-20 animate-shimmer rounded-[11px] motion-reduce:animate-none" />
              <div className="h-16 animate-shimmer rounded-[11px] motion-reduce:animate-none" />
              <div className="h-16 animate-shimmer rounded-[11px] motion-reduce:animate-none" />
            </div>
          </div>
        </output>
      </RadarFrame>
    )
  }

  const importance = computeMarketImportance(vm)
  const series = scope.markets
    .map(market => toFieldSeries(market, importance.get(market.id) ?? 0))
    .filter((item): item is FieldSeries => item !== null)
  const periodChangeById = new Map(series.map(item => [item.id, item.endPct]))
  const marketLabelById = new Map(vm.markets.map(market => [market.id, market.label]))
  const sublabelById = new Map(
    vm.markets.flatMap(market => {
      const observation = signalsForMarket(vm, market.id)[0]?.observation
      return observation ? [[market.id, observation] as const] : []
    })
  )
  const markers = buildMarkers(vm)
  const focusMarketIds = focusedMarketIds(focus)
  const focusMarkerIds = new Set<string>([
    ...[...focusedMacroIds(focus)].map(id => `macro:${id}`),
    ...(focus?.kind === 'event' ? [`event:${focus.event.id}`] : []),
  ])
  const focusedMarketId = focus?.kind === 'market' ? focus.market.id : null
  const focusedSignalId = focus?.kind === 'signal' ? focus.signal.id : null
  const focusedEventId = focus?.kind === 'event' ? focus.event.id : null
  const updateMoment = formatUpdateMoment(vm.freshness.asOf)
  const fieldMarketCount = series.length

  const selectMarker = (markerId: string, trigger: Element) => {
    const [kind, id] = markerId.split(':', 2)
    if (kind === 'event' && id) {
      toggleFocus({ kind: 'event', id }, trigger)
      return
    }
    if (kind === 'macro' && id) {
      const signal = vm.signals.find(item => item.relatedMacroIds.includes(id))
      if (signal) toggleFocus({ kind: 'signal', id: signal.id }, trigger)
    }
  }

  const detail = focus ? (
    <RadarFocusDetail
      focus={focus}
      freshness={vm.freshness}
      marketSignals={focus.kind === 'market' ? signalsForMarket(vm, focus.market.id) : []}
      periodChangePct={
        focus.kind === 'market' ? (periodChangeById.get(focus.market.id) ?? null) : null
      }
      marketLabelById={marketLabelById}
      isAdmin={isAdmin}
      showEscapeHint={!isMobile}
      headingId={detailHeadingId}
      onClose={() => setFocus(null)}
    />
  ) : null

  return (
    <RadarFrame>
      <div className="flex items-center gap-3 lg:block">
        <h1 className="text-[15px] font-semibold text-foreground lg:sr-only">Radar</h1>
        <span className="ml-auto flex items-center gap-2 font-mono text-[10px] text-foreground/55 lg:hidden">
          <Freshness
            asOf={vm.freshness.asOf}
            staleAfterMinutes={vm.freshness.staleAfterMinutes}
            className="text-[10px] leading-[inherit]"
          />
          {updateMoment && vm.freshness.asOf ? (
            <time dateTime={vm.freshness.asOf}>{updateMoment}</time>
          ) : null}
        </span>
      </div>

      <div className="mt-4 space-y-3.5 lg:mt-0">
        <RadarMarketStrip
          items={scope.strip}
          focusedId={focusedMarketId}
          onSelect={(id, trigger) => {
            const market = vm.markets.find(item => item.id === id)
            if (market) {
              toggleFocus({ kind: 'market', id }, trigger)
              return
            }
            const signal = vm.signals.find(item => item.relatedMacroIds.includes(id))
            if (signal) toggleFocus({ kind: 'signal', id: signal.id }, trigger)
          }}
        />

        <div className="flex flex-wrap items-center justify-end gap-x-3.5 gap-y-2">
          {offline ? <Status tone="attention" label="Hors ligne" /> : null}
          {isDemo ? <Badge variant="outline">Mode démo</Badge> : null}
          {isAdmin && vm.isDemoData ? (
            <Badge variant="warning">Données de démonstration</Badge>
          ) : null}
          <span className="hidden items-center gap-2 font-mono text-[11px] text-foreground/55 lg:flex">
            <Freshness
              asOf={vm.freshness.asOf}
              staleAfterMinutes={vm.freshness.staleAfterMinutes}
              className="font-mono text-[11px] leading-[inherit]"
            />
            {updateMoment && vm.freshness.asOf ? (
              <time dateTime={vm.freshness.asOf}>{updateMoment}</time>
            ) : null}
          </span>
          {vm.filters.length > 1 ? (
            <SegmentedControl
              size="sm"
              aria-label="Filtrer le radar"
              options={vm.filters.map(value => ({ value, label: RADAR_FILTER_LABEL[value] }))}
              value={filter}
              onChange={setFilter}
            />
          ) : null}
          {isAdmin ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Actualiser les marchés"
              disabled={refreshMutation.isPending}
              onClick={() => refreshMutation.mutate()}
            >
              <RefreshPixelIcon size={14} />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-7 lg:mt-5 lg:grid-cols-[minmax(0,1fr)_330px] lg:gap-9">
        <section aria-label="Champ des signaux" className="relative">
          <SignalField
            series={series}
            markers={markers}
            focusIds={focusMarketIds}
            focusMarkerIds={focusMarkerIds}
            dimSeries={scope.dimMarkets || (focus !== null && focusMarketIds.size === 0)}
            sublabelById={sublabelById}
            reducedMotion={reducedMotion}
            title="Champ des signaux"
            description={`${fieldMarketCount} marchés suivis sur la période observée, ${scope.signals.length} signaux. Les listes Signaux et Événements donnent le même contenu.`}
            onSelectSeries={(id, trigger) => toggleFocus({ kind: 'market', id }, trigger)}
            onSelectMarker={selectMarker}
          >
            {vm.quiet ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-9 text-center">
                <p className="text-[15px] text-foreground/65">Rien de notable</p>
                <p className="mt-1.5 font-mono text-[11px] text-foreground/35">
                  {fieldMarketCount} marchés suivis
                </p>
              </div>
            ) : null}
            {detail && !isMobile ? (
              <section
                ref={panelRef}
                tabIndex={-1}
                aria-labelledby={detailHeadingId}
                className="absolute right-3 top-3 z-[1] max-h-[calc(100%-1.5rem)] w-[290px] max-w-[calc(100%-1.5rem)] overflow-y-auto rounded-dropdown border border-border bg-popover p-[18px] text-popover-foreground shadow-overlay outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
              >
                {detail}
              </section>
            ) : null}
          </SignalField>
          {!vm.quiet ? (
            <p className="mt-2 hidden items-center gap-3.5 font-mono text-[11px] tracking-[0.1em] text-foreground/45 lg:flex">
              <span>{fieldMarketCount} marchés suivis</span>
              <span aria-hidden="true" className="size-[3px] bg-foreground/30" />
              <span>{scope.signals.length} signaux</span>
            </p>
          ) : null}
        </section>

        <aside className="space-y-7 lg:pt-1.5">
          {scope.signals.length > 0 ? (
            <section aria-labelledby="radar-signals-title">
              <h2 id="radar-signals-title" className={SECTION_TITLE}>
                Signaux
              </h2>
              <div className="mt-3">
                <RadarSignalList
                  signals={scope.signals}
                  focusedId={focusedSignalId}
                  onSelect={(signal, trigger) =>
                    toggleFocus({ kind: 'signal', id: signal.id }, trigger)
                  }
                />
              </div>
            </section>
          ) : vm.quiet ? null : (
            <section aria-labelledby="radar-signals-title">
              <h2 id="radar-signals-title" className={SECTION_TITLE}>
                Signaux
              </h2>
              <p className="mt-3 text-sm text-foreground/55">Aucun signal sur cette sélection</p>
            </section>
          )}

          <section aria-labelledby="radar-events-title">
            <h2 id="radar-events-title" className={SECTION_TITLE}>
              Événements
            </h2>
            <div className="mt-2.5">
              {eventsQuery.isError && vm.events.length === 0 ? (
                <p className="text-sm text-foreground/55">Événements indisponibles</p>
              ) : vm.events.length > 0 ? (
                <RadarEvents
                  events={vm.events}
                  focusedId={focusedEventId}
                  limit={5}
                  mobileLimit={3}
                  onSelect={(event, trigger) =>
                    toggleFocus({ kind: 'event', id: event.id }, trigger)
                  }
                />
              ) : (
                <p className="text-sm text-foreground/55">Aucun événement récent</p>
              )}
            </div>
          </section>

          <Link
            to="/social-intelligence"
            className="inline-flex min-h-9 items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-foreground/55 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/70"
          >
            Sources suivies
            <span aria-hidden="true">→</span>
          </Link>
        </aside>
      </div>

      {isMobile ? (
        <Drawer open={Boolean(detail)} onOpenChange={open => !open && setFocus(null)}>
          <DrawerContent
            side="bottom"
            onCloseAutoFocus={event => {
              event.preventDefault()
              restoreTriggerFocus(triggerRef)
            }}
          >
            <DrawerTitle className="sr-only">Détail du signal</DrawerTitle>
            <DrawerDescription className="sr-only">
              Détail de la sélection du Radar
            </DrawerDescription>
            <div className="px-5 pb-3 pt-5">{detail}</div>
          </DrawerContent>
        </Drawer>
      ) : null}
    </RadarFrame>
  )
}

const currentFocusOf = (focus: NonNullable<ReturnType<typeof resolveRadarFocus>>): RadarFocus =>
  focus.kind === 'signal'
    ? { kind: 'signal', id: focus.signal.id }
    : focus.kind === 'market'
      ? { kind: 'market', id: focus.market.id }
      : { kind: 'event', id: focus.event.id }

/** Immersive frame: the signature canvas wash behind the page content. */
function RadarFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 bg-radar-canvas" />
      {children}
    </div>
  )
}
