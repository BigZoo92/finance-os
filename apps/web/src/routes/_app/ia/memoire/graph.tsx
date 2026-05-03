/**
 * Advisor Memory · 3D Knowledge Graph page (V2).
 *
 * Memory Atlas + Neural Constellation hybrid. Lens-driven exploration:
 *   - 7 curated lenses with French copy, suggested starter, accent tone;
 *   - guided tours that activate a lens + select a starter node;
 *   - pinning + lightweight BFS path between selected/pinned nodes;
 *   - quick filters (stale, contradictions, high-confidence, personal);
 *   - kind-specific side panel with quick actions;
 *   - performance mode + idle auto-orbit;
 *   - mobile-aware layout with collapsible details.
 *
 * Strictly enrichment: NOT a source-of-truth financial DB, NOT trading,
 * NOT a learning loop, NOT fiscality. Demo mode never calls providers.
 */
import { Badge, Input } from '@finance-os/ui/components'
import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AdvisorGraphEmptyDetails,
  AdvisorGraphLinkDetails,
  AdvisorGraphNodeDetails,
  type AdvisorGraphNeighbor,
} from '@/components/advisor/advisor-graph-details-panel'
import { KnowledgeGraph3D, type CameraApi } from '@/components/advisor/knowledge-graph-3d'
import { PageHeader } from '@/components/surfaces/page-header'
import { Panel } from '@/components/surfaces/panel'
import { StatusDot } from '@/components/surfaces/status-dot'
import {
  type AdvisorGraph,
  type AdvisorGraphLink,
  type AdvisorGraphLinkKind,
  type AdvisorGraphNode,
  type AdvisorGraphNodeKind,
  type AdvisorGraphPath,
  buildAdvisorDemoGraph,
  buildAdvisorGraphFromKnowledge,
  findShortestPath,
  getNeighborhood,
  LINK_KIND_COLOR,
  LINK_KIND_LABEL,
  NODE_KIND_COLOR,
  NODE_KIND_LABEL,
} from '@/features/advisor-graph-data'
import { mapAdvisorKnowledgeGraphDtoToViewModel } from '@/features/advisor-graph-dto'
import {
  ADVISOR_GRAPH_LENSES,
  ADVISOR_GRAPH_LENS_BY_ID,
  ADVISOR_GRAPH_QUICK_FILTERS,
  ADVISOR_GRAPH_TOURS,
  type AdvisorGraphLens,
  type AdvisorGraphLensId,
  type AdvisorGraphQuickFilterId,
} from '@/features/advisor-graph-lenses'
import { pickPinPathEndpoints } from '@/features/advisor-graph-pin-path'
import {
  buildPinStorageKey,
  clearPersistedPins,
  readPersistedPins,
  reconcilePinsAgainstGraph,
  writePersistedPins,
  type AdvisorGraphPinOrigin,
  type AdvisorGraphPinScope,
} from '@/features/advisor-graph-pins'
import { validateAdvisorGraphSearch } from '@/features/advisor-graph-search-params'
import { authMeQueryOptions } from '@/features/auth-query-options'
import type { AuthMode } from '@/features/auth-types'
import { resolveAuthViewState } from '@/features/auth-view-state'
import {
  knowledgeContextBundleQueryOptionsWithMode,
  knowledgeGraphQueryOptionsWithMode,
  knowledgeSchemaQueryOptionsWithMode,
  knowledgeSearchQueryOptionsWithMode,
  knowledgeStatsQueryOptionsWithMode,
} from '@/features/knowledge-query-options'
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion'

const DEFAULT_QUERY = 'cash drag inflation concentration risk'
const DEFAULT_LENS_ID: AdvisorGraphLensId = 'atlas'

// ─── route ────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/_app/ia/memoire/graph')({
  validateSearch: (raw: Record<string, unknown>) => validateAdvisorGraphSearch(raw),
  loader: async ({ context }) => {
    const auth = await context.queryClient.fetchQuery(authMeQueryOptions())
    const mode: AuthMode | undefined =
      auth.mode === 'admin' ? 'admin' : auth.mode === 'demo' ? 'demo' : undefined
    if (!mode) return
    await Promise.all([
      // New typed DTO endpoint — primary data source.
      context.queryClient.ensureQueryData(
        knowledgeGraphQueryOptionsWithMode({
          mode,
          scope: 'overview',
          includeExamples: false,
        })
      ),
      // Legacy endpoints kept warm for the heuristic fallback and for the
      // bundle-summary card in the right rail.
      context.queryClient.ensureQueryData(knowledgeStatsQueryOptionsWithMode({ mode })),
      context.queryClient.ensureQueryData(knowledgeSchemaQueryOptionsWithMode({ mode })),
      context.queryClient.ensureQueryData(
        knowledgeSearchQueryOptionsWithMode({
          mode,
          query: DEFAULT_QUERY,
          retrievalMode: 'hybrid',
        })
      ),
      context.queryClient.ensureQueryData(
        knowledgeContextBundleQueryOptionsWithMode({
          mode,
          query: DEFAULT_QUERY,
          retrievalMode: 'hybrid',
        })
      ),
    ])
  },
  component: AdvisorGraphPage,
})

// ─── constants ────────────────────────────────────────────────────────────

const ALL_NODE_KINDS: ReadonlyArray<AdvisorGraphNodeKind> = [
  'personal_snapshot',
  'financial_account',
  'transaction_cluster',
  'asset',
  'investment',
  'goal',
  'recommendation',
  'assumption',
  'market_signal',
  'news_signal',
  'social_signal',
  'concept',
  'formula',
  'risk',
  'contradiction',
  'source',
  'unknown',
]

const ALL_LINK_KINDS: ReadonlyArray<AdvisorGraphLinkKind> = [
  'supports',
  'explains',
  'contradicts',
  'weakens',
  'derived_from',
  'related_to',
  'affects',
  'mentions',
  'uses_assumption',
  'belongs_to',
]

const ORIGIN_LABEL: Record<'demo' | 'real' | 'mixed' | 'empty', string> = {
  demo: 'mémoire démo',
  real: 'mémoire réelle',
  mixed: 'aperçu enrichi · réel + exemples',
  empty: 'mémoire trop pauvre',
}

type RenderPreset = 'cinematic' | 'standard' | 'performance'

// ─── page ─────────────────────────────────────────────────────────────────

function AdvisorGraphPage() {
  const navigate = useNavigate({ from: Route.fullPath })
  const search = Route.useSearch()
  const reducedMotion = usePrefersReducedMotion()

  const authQuery = useQuery(authMeQueryOptions())
  const authViewState = resolveAuthViewState({
    isPending: authQuery.isPending,
    ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}),
  })
  const isDemo = authViewState === 'demo'
  const isAdmin = authViewState === 'admin'
  const authMode: AuthMode | undefined = isAdmin ? 'admin' : isDemo ? 'demo' : undefined
  const modeOptions = authMode ? { mode: authMode } : {}

  const statsQuery = useQuery(knowledgeStatsQueryOptionsWithMode(modeOptions))
  const bundleQuery = useQuery(
    knowledgeContextBundleQueryOptionsWithMode({
      ...modeOptions,
      query: DEFAULT_QUERY,
      retrievalMode: 'hybrid',
    })
  )
  const searchQueryResult = useQuery(
    knowledgeSearchQueryOptionsWithMode({
      ...modeOptions,
      query: DEFAULT_QUERY,
      retrievalMode: 'hybrid',
    })
  )

  // ─── trust state ──────────────────────────────────────────────────────
  const [previewExamples, setPreviewExamples] = useState(false)
  const [hideExamples, setHideExamples] = useState(false)

  // ─── primary DTO query (new typed backend endpoint) ──────────────────
  const dtoQuery = useQuery(
    knowledgeGraphQueryOptionsWithMode({
      ...modeOptions,
      scope: 'overview',
      includeExamples: previewExamples,
    })
  )

  // ─── core graph (DTO-first, heuristic fallback) ──────────────────────
  const graph: AdvisorGraph = useMemo(() => {
    if (dtoQuery.data) return mapAdvisorKnowledgeGraphDtoToViewModel(dtoQuery.data)
    if (isDemo || !authMode) return buildAdvisorDemoGraph()
    return buildAdvisorGraphFromKnowledge({
      bundle: bundleQuery.data,
      query: searchQueryResult.data,
      stats: statsQuery.data,
      preview: previewExamples,
    })
  }, [
    dtoQuery.data,
    isDemo,
    authMode,
    bundleQuery.data,
    searchQueryResult.data,
    statsQuery.data,
    previewExamples,
  ])

  // ─── exploration state ───────────────────────────────────────────────
  // Lens / selected node are URL-synced via TanStack search params.
  const lensId: AdvisorGraphLensId = search.lens ?? DEFAULT_LENS_ID
  const lens: AdvisorGraphLens = ADVISOR_GRAPH_LENS_BY_ID[lensId]
  const selectedNodeId: string | null = search.node ?? null

  const [selectedLink, setSelectedLink] = useState<AdvisorGraphLink | null>(null)
  const [isolationSeedId, setIsolationSeedId] = useState<string | null>(null)
  const [pathFromId, setPathFromId] = useState<string | null>(null)
  const [pathToId, setPathToId] = useState<string | null>(null)
  const [activeTour, setActiveTour] = useState<{ id: string; explainer: string } | null>(null)
  const [pendingNodeMissing, setPendingNodeMissing] = useState<string | null>(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  const [activeQuickFilters, setActiveQuickFilters] = useState<Set<AdvisorGraphQuickFilterId>>(
    new Set()
  )
  const [nodeKindOverride, setNodeKindOverride] = useState<Set<AdvisorGraphNodeKind> | null>(null)
  const [linkKindOverride, setLinkKindOverride] = useState<Set<AdvisorGraphLinkKind> | null>(null)

  const [paused, setPaused] = useState(false)
  const [preset, setPreset] = useState<RenderPreset>(reducedMotion ? 'performance' : 'standard')
  const [autoOrbit, setAutoOrbit] = useState(false)
  // Mobile detail collapsibility — defaults to collapsed below the
  // canvas on small screens, expanded by default on desktop.
  const [detailsCollapsed, setDetailsCollapsed] = useState(false)

  const cameraApiRef = useRef<CameraApi | null>(null)

  // ─── persistent pins (scoped per authMode/origin/scope) ─────────────
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set())
  const pinScope: AdvisorGraphPinScope =
    authMode === 'admin' ? 'admin' : authMode === 'demo' ? 'demo' : 'unknown'
  const pinOrigin: AdvisorGraphPinOrigin = graph.meta.origin
  const pinStorageKey = useMemo(
    () => buildPinStorageKey({ authMode: pinScope, origin: pinOrigin, scope: 'overview' }),
    [pinScope, pinOrigin]
  )
  // Hydrate on mount + on storage-key change. Reconcile against the
  // current node ids so stale pins don't survive into a different graph.
  useEffect(() => {
    const persisted = readPersistedPins(pinStorageKey)
    if (persisted.length === 0) {
      setPinnedIds(new Set())
      return
    }
    const knownIds = new Set(graph.nodes.map(n => n.id))
    const { kept } = reconcilePinsAgainstGraph(persisted, knownIds)
    setPinnedIds(new Set(kept))
    if (kept.length !== persisted.length) {
      writePersistedPins(pinStorageKey, kept)
    }
    // Only re-run when storage key or graph identity changes.
  }, [pinStorageKey, graph])

  // ─── derived: trimmed graph, kinds present, visible kinds ────────────
  const baseGraph: AdvisorGraph = useMemo(() => {
    if (!hideExamples || graph.meta.exampleNodeCount === 0) return graph
    const nodes = graph.nodes.filter(n => !n.isExample)
    const ids = new Set(nodes.map(n => n.id))
    const links = graph.links.filter(l => ids.has(l.source) && ids.has(l.target))
    return {
      nodes,
      links,
      meta: {
        ...graph.meta,
        nodeCount: nodes.length,
        linkCount: links.length,
        exampleNodeCount: 0,
      },
    }
  }, [graph, hideExamples])

  const lensVisibleKinds = useMemo(
    () => new Set<AdvisorGraphNodeKind>(lens.includedKinds),
    [lens]
  )
  const emphasizedKinds = useMemo(
    () => new Set<AdvisorGraphNodeKind>(lens.emphasizedKinds),
    [lens]
  )

  const visibleNodeKinds = useMemo(() => {
    const base = nodeKindOverride ?? lensVisibleKinds
    return new Set(base)
  }, [nodeKindOverride, lensVisibleKinds])

  const visibleLinkKinds = useMemo(
    () => linkKindOverride ?? new Set(ALL_LINK_KINDS),
    [linkKindOverride]
  )

  // Apply quick filters + isolation on top of the base graph (after lens kinds).
  const renderedGraph: AdvisorGraph = useMemo(() => {
    const quickPredicates = ADVISOR_GRAPH_QUICK_FILTERS.filter(qf =>
      activeQuickFilters.has(qf.id)
    )
    let nodes = baseGraph.nodes
    if (quickPredicates.length > 0) {
      nodes = nodes.filter(n => quickPredicates.every(qf => qf.predicate(n)))
    }
    if (isolationSeedId) {
      const reachable = getNeighborhood(baseGraph, isolationSeedId, 2)
      nodes = nodes.filter(n => reachable.has(n.id))
    }
    const ids = new Set(nodes.map(n => n.id))
    const links = baseGraph.links.filter(l => ids.has(l.source) && ids.has(l.target))
    return {
      nodes,
      links,
      meta: {
        ...baseGraph.meta,
        nodeCount: nodes.length,
        linkCount: links.length,
      },
    }
  }, [baseGraph, activeQuickFilters, isolationSeedId])

  const nodeKindsPresent = useMemo(() => {
    const set = new Set<AdvisorGraphNodeKind>()
    for (const n of renderedGraph.nodes) set.add(n.kind)
    return set
  }, [renderedGraph])
  const linkKindsPresent = useMemo(() => {
    const set = new Set<AdvisorGraphLinkKind>()
    for (const l of renderedGraph.links) set.add(l.kind)
    return set
  }, [renderedGraph])

  // ─── search ───────────────────────────────────────────────────────────
  const searchResults = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return [] as AdvisorGraphNode[]
    return renderedGraph.nodes
      .filter(node => {
        const haystack = [
          node.label,
          node.summary,
          node.kind,
          node.source,
          NODE_KIND_LABEL[node.kind],
        ]
          .filter((s): s is string => typeof s === 'string')
          .join(' ')
          .toLowerCase()
        return haystack.includes(term)
      })
      .slice(0, 30)
  }, [renderedGraph, searchTerm])
  const matchingNodeIds = useMemo(
    () => new Set(searchResults.map(n => n.id)),
    [searchResults]
  )

  // ─── path ─────────────────────────────────────────────────────────────
  const path: AdvisorGraphPath | null = useMemo(() => {
    if (!pathFromId || !pathToId) return null
    return findShortestPath(renderedGraph, pathFromId, pathToId)
  }, [renderedGraph, pathFromId, pathToId])

  // Auto-resolve pathToId once selection moves while pathFromId is set.
  useEffect(() => {
    if (pathFromId && !pathToId && selectedNodeId && selectedNodeId !== pathFromId) {
      setPathToId(selectedNodeId)
    }
  }, [pathFromId, pathToId, selectedNodeId])

  // ─── selected node + neighbors ────────────────────────────────────────
  const selectedNode = useMemo<AdvisorGraphNode | null>(
    () => renderedGraph.nodes.find(n => n.id === selectedNodeId) ?? null,
    [renderedGraph, selectedNodeId]
  )
  const selectedNeighbors = useMemo<AdvisorGraphNeighbor[]>(() => {
    if (!selectedNodeId) return []
    const byId = new Map(renderedGraph.nodes.map(n => [n.id, n] as const))
    const out: AdvisorGraphNeighbor[] = []
    for (const link of renderedGraph.links) {
      if (link.source === selectedNodeId) {
        const other = byId.get(link.target)
        if (other) out.push({ link, other })
      } else if (link.target === selectedNodeId) {
        const other = byId.get(link.source)
        if (other) out.push({ link, other })
      }
    }
    return out
  }, [renderedGraph, selectedNodeId])

  // ─── handlers ────────────────────────────────────────────────────────
  // URL-driven selection. `replace: true` keeps the back-button stack tidy
  // and prevents history loops when the user explores quickly.
  const setSelectedNodeIdNav = (id: string | null) => {
    void navigate({
      to: Route.fullPath,
      search: prev => {
        const next = { ...prev, node: id ?? undefined }
        if (next.node === prev.node) return prev
        return next
      },
      replace: true,
    })
  }
  const setLensIdNav = (id: AdvisorGraphLensId) => {
    void navigate({
      to: Route.fullPath,
      search: prev => {
        if (prev.lens === id) return prev
        return { ...prev, lens: id }
      },
      replace: true,
    })
  }

  const handleSelectNode = (id: string | null) => {
    setSelectedNodeIdNav(id)
    if (!id) {
      setSelectedLink(null)
      setActiveTour(null)
    }
  }
  const togglePin = (id: string) => {
    setPinnedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      writePersistedPins(pinStorageKey, Array.from(next))
      return next
    })
  }
  const clearAllPins = () => {
    setPinnedIds(new Set())
    clearPersistedPins(pinStorageKey)
  }
  const isolateNode = (id: string) => {
    setIsolationSeedId(id)
  }
  const clearIsolation = () => {
    setIsolationSeedId(null)
  }
  const tracePath = (fromId: string) => {
    setPathFromId(fromId)
    setPathToId(null)
  }
  const tracePathBetweenPins = () => {
    const pinList = Array.from(pinnedIds)
    const visibleIds = new Set(renderedGraph.nodes.map(n => n.id))
    const endpoints = pickPinPathEndpoints(pinList, visibleIds, selectedNodeId)
    if (!endpoints) return
    setPathFromId(endpoints.fromId)
    setPathToId(endpoints.toId)
  }
  const clearPath = () => {
    setPathFromId(null)
    setPathToId(null)
  }
  const copyLabel = (label: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(label).catch(() => {})
    }
  }

  const activateTour = (tourId: string) => {
    const tour = ADVISOR_GRAPH_TOURS.find(t => t.id === tourId)
    if (!tour) return
    setNodeKindOverride(null)
    setLinkKindOverride(null)
    setActiveQuickFilters(new Set())
    setIsolationSeedId(null)
    clearPath()
    const starter = tour.pickStarter(graph)
    void navigate({
      to: Route.fullPath,
      search: prev => ({
        ...prev,
        lens: tour.lensId,
        node: starter?.id ?? prev.node,
      }),
      replace: true,
    })
    if (starter) {
      // small delay so the lens swap doesn't fight the camera move
      window.setTimeout(() => cameraApiRef.current?.focusNode(starter.id), 150)
    }
    setActiveTour({ id: tour.id, explainer: tour.explainer })
  }

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const first = searchResults[0]
    if (first) {
      setSelectedNodeIdNav(first.id)
      cameraApiRef.current?.focusNode(first.id)
    }
  }

  const toggleQuickFilter = (id: AdvisorGraphQuickFilterId) => {
    setActiveQuickFilters(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Cmd/Ctrl+K to focus search.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
        setSearchOpen(true)
      }
      if (e.key === 'Escape') {
        setSearchOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Honor `?node=...` deep-links: when the URL targets a node that
  // exists in the rendered graph, focus the camera on it. When it
  // doesn't, surface a non-blocking notice so the user knows.
  useEffect(() => {
    if (!selectedNodeId) {
      setPendingNodeMissing(null)
      return
    }
    const exists = renderedGraph.nodes.some(n => n.id === selectedNodeId)
    if (exists) {
      setPendingNodeMissing(null)
      // Only refocus when ForceGraph is mounted; cameraApiRef is set after mount.
      const api = cameraApiRef.current
      if (api) {
        // Defer one tick so the scene has the node positioned before we move.
        window.setTimeout(() => api.focusNode(selectedNodeId), 80)
      }
    } else {
      setPendingNodeMissing(selectedNodeId)
    }
    // Run when selection changes or the visible graph identity changes.
  }, [selectedNodeId, renderedGraph])

  // Reduced motion → force-disable auto-orbit even if the user toggled
  // it before we hydrated. The user can still manually re-enable.
  const effectiveAutoOrbit = autoOrbit && !reducedMotion

  // ─── derived presentation ────────────────────────────────────────────
  const degraded =
    bundleQuery.data?.degraded ?? statsQuery.data?.degraded ?? graph.meta.degraded ?? false
  const originLabel = ORIGIN_LABEL[graph.meta.origin]
  const originPillTone =
    graph.meta.origin === 'mixed'
      ? 'mixed'
      : graph.meta.origin === 'empty'
        ? 'empty'
        : graph.meta.origin === 'real'
          ? 'real'
          : 'demo'

  const pathPeerLabel = useMemo(() => {
    if (!path) return null
    if (selectedNodeId === pathFromId && pathToId) {
      return renderedGraph.nodes.find(n => n.id === pathToId)?.label ?? null
    }
    if (selectedNodeId === pathToId && pathFromId) {
      return renderedGraph.nodes.find(n => n.id === pathFromId)?.label ?? null
    }
    return null
  }, [path, selectedNodeId, pathFromId, pathToId, renderedGraph])

  const tourBadge = activeTour
    ? ADVISOR_GRAPH_TOURS.find(t => t.id === activeTour.id)?.label
    : null

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${lens.eyebrow} · ${tourBadge ?? 'libre'}`}
        icon="◴"
        title={lens.label}
        description={lens.tagline}
        compact
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              to="/ia/memoire"
              className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-surface-1 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              ← Inspection texte
            </Link>
            <Link
              to="/ia/chat"
              className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
            >
              Demander à l’Advisor →
            </Link>
          </div>
        }
        status={
          <div className="flex flex-wrap items-center gap-2">
            <OriginPill origin={originPillTone} label={originLabel} />
            <output
              aria-label={`Statut: ${degraded ? 'fallback' : (authMode ?? 'inconnu')}`}
              className="flex items-center gap-2 rounded-md border border-border/60 bg-surface-1 px-2.5 py-1 text-[11px]"
            >
              <StatusDot tone={degraded ? 'warn' : 'ok'} size={7} pulse={degraded} />
              <span className="text-muted-foreground">
                {degraded ? 'fallback' : (authMode ?? '...')}
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="font-mono text-foreground">
                {renderedGraph.nodes.length}n / {renderedGraph.links.length}r
              </span>
            </output>
          </div>
        }
      />

      {/* Tours bar — single row of starters. */}
      <ToursBar
        activeTourId={activeTour?.id ?? null}
        onActivate={activateTour}
        onClear={() => setActiveTour(null)}
      />

      {activeTour ? (
        <Panel
          tone="brand"
          title="Visite guidée active"
          description={tourBadge ?? undefined}
          icon={<span aria-hidden="true">◐</span>}
          actions={
            <button
              type="button"
              onClick={() => setActiveTour(null)}
              className="rounded-md border border-border/60 bg-surface-1 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              Fermer la visite
            </button>
          }
        >
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">
            {activeTour.explainer}
          </p>
        </Panel>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)_320px]">
        {/* ── Left: lenses + search + filters + perf ─────────────────── */}
        <div className="flex flex-col gap-4">
          <Panel
            title="Lentilles"
            tone="brand"
            icon={<span aria-hidden="true">▦</span>}
            description="7 vues curatées de la mémoire."
          >
            <div className="flex flex-col gap-1.5">
              {ADVISOR_GRAPH_LENSES.map(l => (
                <LensButton
                  key={l.id}
                  lens={l}
                  active={l.id === lensId}
                  onSelect={() => {
                    setLensIdNav(l.id)
                    setNodeKindOverride(null)
                    setLinkKindOverride(null)
                    setIsolationSeedId(null)
                    clearPath()
                  }}
                />
              ))}
            </div>
          </Panel>

          <Panel
            title="Recherche"
            tone="violet"
            icon={<span aria-hidden="true">⌕</span>}
            description="⌘K · label, type, source"
          >
            <form onSubmit={handleSearchSubmit} className="space-y-2">
              <Input
                ref={searchInputRef}
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value)
                  setSearchOpen(true)
                }}
                onFocus={() => setSearchOpen(true)}
                placeholder="recommandation, risque, source..."
                aria-label="Rechercher dans la mémoire"
              />
              {searchOpen && searchTerm.trim().length > 0 ? (
                <SearchResultList
                  results={searchResults}
                  onSelect={node => {
                    setSelectedNodeIdNav(node.id)
                    cameraApiRef.current?.focusNode(node.id)
                    setSearchOpen(false)
                  }}
                />
              ) : (
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{matchingNodeIds.size} match</span>
                  <button type="submit" className="ml-auto text-primary hover:underline">
                    Focus 1er →
                  </button>
                </div>
              )}
            </form>
          </Panel>

          <Panel
            title="Filtres rapides"
            tone="warning"
            icon={<span aria-hidden="true">⚠</span>}
            description="Combinables — agissent dans la lentille active."
            actions={
              activeQuickFilters.size > 0 ? (
                <button
                  type="button"
                  onClick={() => setActiveQuickFilters(new Set())}
                  className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
                >
                  reset
                </button>
              ) : undefined
            }
          >
            <div className="flex flex-wrap gap-1.5">
              {ADVISOR_GRAPH_QUICK_FILTERS.map(qf => {
                const active = activeQuickFilters.has(qf.id)
                return (
                  <button
                    key={qf.id}
                    type="button"
                    onClick={() => toggleQuickFilter(qf.id)}
                    aria-pressed={active}
                    className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      active
                        ? 'border-warning/40 bg-warning/12 text-warning'
                        : 'border-border/60 bg-surface-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground'
                    }`}
                  >
                    {qf.label}
                  </button>
                )
              })}
            </div>
          </Panel>

          {isAdmin ? (
            <Panel
              title="Aperçu enrichi"
              tone="warning"
              icon={<span aria-hidden="true">◐</span>}
              description="Mélange volontaire d’exemples curés."
            >
              <button
                type="button"
                onClick={() => {
                  setPreviewExamples(v => !v)
                  setHideExamples(false)
                }}
                aria-pressed={previewExamples}
                className={`w-full rounded-lg border px-3 py-2 text-[11px] font-medium transition-colors ${
                  previewExamples
                    ? 'border-warning/40 bg-warning/12 text-warning'
                    : 'border-border/60 bg-surface-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground'
                }`}
              >
                {previewExamples ? '⚠ Aperçu actif — désactiver' : 'Activer l’aperçu enrichi'}
              </button>
              {previewExamples ? (
                <button
                  type="button"
                  onClick={() => setHideExamples(v => !v)}
                  aria-pressed={hideExamples}
                  className={`mt-1.5 w-full rounded-lg border px-3 py-2 text-[11px] font-medium transition-colors ${
                    hideExamples
                      ? 'border-primary/40 bg-primary/12 text-primary'
                      : 'border-border/60 bg-surface-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground'
                  }`}
                >
                  {hideExamples ? 'Afficher uniquement mes données ✓' : 'Masquer les exemples'}
                </button>
              ) : null}
            </Panel>
          ) : null}

          <Panel
            title="Caméra & rendu"
            tone="plain"
            icon={<span aria-hidden="true">◎</span>}
          >
            <div className="grid grid-cols-2 gap-1.5">
              <CameraButton onClick={() => cameraApiRef.current?.fitView()}>Ajuster</CameraButton>
              <CameraButton onClick={() => cameraApiRef.current?.resetView()}>Reset</CameraButton>
              <CameraButton
                onClick={() => selectedNodeId && cameraApiRef.current?.focusNode(selectedNodeId)}
                disabled={!selectedNodeId}
              >
                Focus
              </CameraButton>
              <CameraButton onClick={() => cameraApiRef.current?.reheat()}>Relancer</CameraButton>
              <button
                type="button"
                onClick={() => setPaused(p => !p)}
                aria-pressed={paused}
                className="col-span-2 rounded-lg border border-border/60 bg-surface-1 px-3 py-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                {paused ? '▶ Reprendre simulation' : '❙❙ Pause simulation'}
              </button>
              <PresetSelector
                value={preset}
                onChange={setPreset}
              />
              <button
                type="button"
                onClick={() => setAutoOrbit(v => !v)}
                aria-pressed={autoOrbit}
                className={`col-span-2 rounded-lg border px-3 py-2 text-[11px] font-medium transition-colors ${
                  autoOrbit
                    ? 'border-accent-2/40 bg-accent-2/12 text-accent-2'
                    : 'border-border/60 bg-surface-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground'
                }`}
              >
                {autoOrbit ? '◴ Orbite cinématique active' : 'Activer l’orbite cinématique'}
              </button>
            </div>
          </Panel>

          <KindFilters
            title="Types de nœuds"
            tone="positive"
            allKinds={ALL_NODE_KINDS}
            present={nodeKindsPresent}
            visible={visibleNodeKinds}
            colorMap={NODE_KIND_COLOR}
            labelMap={NODE_KIND_LABEL}
            onToggle={kind => {
              setNodeKindOverride(prev => {
                const base = prev ?? new Set(visibleNodeKinds)
                const next = new Set(base)
                if (next.has(kind)) next.delete(kind)
                else next.add(kind)
                return next
              })
            }}
            onReset={() => setNodeKindOverride(null)}
          />

          <KindFilters
            title="Types de relations"
            tone="violet"
            allKinds={ALL_LINK_KINDS}
            present={linkKindsPresent}
            visible={visibleLinkKinds}
            colorMap={LINK_KIND_COLOR}
            labelMap={LINK_KIND_LABEL}
            onToggle={kind => {
              setLinkKindOverride(prev => {
                const base = prev ?? new Set(ALL_LINK_KINDS)
                const next = new Set(base)
                if (next.has(kind)) next.delete(kind)
                else next.add(kind)
                return next
              })
            }}
            onReset={() => setLinkKindOverride(null)}
          />
        </div>

        {/* ── Center: pinned bar + banners + canvas + lens explainer ─── */}
        <div className="flex flex-col gap-4">
          <PinnedBar
            graph={renderedGraph}
            pinnedIds={pinnedIds}
            canTracePath={pinnedIds.size >= 2}
            onSelect={id => {
              setSelectedNodeIdNav(id)
              cameraApiRef.current?.focusNode(id)
            }}
            onUnpin={togglePin}
            onTracePath={tracePathBetweenPins}
            onClearAll={clearAllPins}
          />

          {pathFromId && !pathToId ? (
            <Panel
              tone="warning"
              title="Sélectionne un nœud d’arrivée"
              description="Le chemin BFS sera tracé sur les liens visibles."
              icon={<span aria-hidden="true">↳</span>}
              actions={
                <button
                  type="button"
                  onClick={clearPath}
                  className="rounded-md border border-border/60 bg-surface-1 px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                >
                  Annuler
                </button>
              }
            >
              <p className="text-[12.5px] text-muted-foreground">
                Source verrouillée :{' '}
                <span className="text-foreground">
                  {renderedGraph.nodes.find(n => n.id === pathFromId)?.label ?? pathFromId}
                </span>
                . Clique sur un autre nœud pour calculer le chemin le plus court.
              </p>
            </Panel>
          ) : null}

          {path ? <PathBanner path={path} onClear={clearPath} /> : null}

          {pathFromId && pathToId && !path ? (
            <Panel
              tone="warning"
              title="Aucun chemin visible"
              description="Aucun chemin trouvé sur les liens visibles entre ces deux nœuds."
              icon={<span aria-hidden="true">↯</span>}
              actions={
                <button
                  type="button"
                  onClick={clearPath}
                  className="rounded-md border border-border/60 bg-surface-1 px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                >
                  Effacer
                </button>
              }
            >
              <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                Élargis la lentille, désactive les filtres rapides ou
                quitte une isolation pour augmenter la connectivité visible.
              </p>
            </Panel>
          ) : null}

          {pendingNodeMissing !== null ? (
            <Panel
              tone="plain"
              title="Nœud du lien introuvable"
              description="L’URL pointe vers un nœud absent du graphe actuel."
              icon={<span aria-hidden="true">?</span>}
              actions={
                <button
                  type="button"
                  onClick={() => setSelectedNodeIdNav(null)}
                  className="rounded-md border border-border/60 bg-surface-1 px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                >
                  Effacer la sélection
                </button>
              }
            >
              <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                ID demandé : <span className="font-mono text-foreground">{pendingNodeMissing}</span>.
                Il a peut-être été filtré par la lentille active ou retiré
                depuis la dernière session.
              </p>
            </Panel>
          ) : null}

          {reducedMotion ? (
            <Panel
              tone="plain"
              title="Mode mouvement réduit"
              description="Les particules et l’orbite cinématique sont désactivées par défaut."
              icon={<span aria-hidden="true">≈</span>}
            >
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                Détecté via <code>prefers-reduced-motion</code>. Tu peux toujours
                forcer un autre préréglage ou activer manuellement l’orbite.
              </p>
            </Panel>
          ) : null}

          {graph.meta.origin === 'empty' && isAdmin ? (
            <SparseRealMemoryBanner
              summary={graph.meta.summary}
              onPreview={() => setPreviewExamples(true)}
            />
          ) : null}

          {graph.meta.origin === 'mixed' ? (
            <MixedPreviewBanner
              realCount={graph.meta.realNodeCount}
              exampleCount={graph.meta.exampleNodeCount}
              hideExamples={hideExamples}
              onToggleHide={() => setHideExamples(v => !v)}
              onDisablePreview={() => {
                setPreviewExamples(false)
                setHideExamples(false)
              }}
            />
          ) : null}

          <div className="relative h-[520px] min-h-[420px] overflow-hidden rounded-2xl border border-border/60 sm:h-[600px] lg:h-[720px]">
            <KnowledgeGraph3D
              graph={renderedGraph}
              selectedNodeId={selectedNodeId}
              onSelectNode={handleSelectNode}
              onSelectLink={setSelectedLink}
              highlightedNodeIds={matchingNodeIds}
              visibleNodeKinds={visibleNodeKinds}
              visibleLinkKinds={visibleLinkKinds}
              paused={paused}
              pinnedNodeIds={pinnedIds}
              emphasizedKinds={emphasizedKinds}
              preset={preset}
              autoOrbit={effectiveAutoOrbit}
              {...(path ? { pathLinkKeys: path.linkKeys, pathNodeIds: path.nodeIds } : {})}
              registerCameraApi={api => {
                cameraApiRef.current = api
              }}
            />

            <div className="pointer-events-none absolute left-4 top-4 flex max-w-[60%] flex-wrap items-center gap-1.5 rounded-md border border-white/10 bg-black/35 px-2.5 py-1 text-[11px] text-white/80 backdrop-blur-md">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/50">
                origine
              </span>
              <span className="text-white/95">{originLabel}</span>
              <span className="text-white/30">·</span>
              <span className="line-clamp-1">{lens.label}</span>
            </div>

            <Legend showExample={graph.meta.origin === 'mixed' && !hideExamples} />
          </div>

          <Panel
            title={lens.label}
            description={lens.tagline}
            tone={lens.tone === 'aurora' ? 'brand' : lens.tone}
            icon={<span aria-hidden="true">▦</span>}
          >
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">
              {lens.description}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Hint title="Couleur de nœud">
                Identifie le type. Les nœuds emphasés par la lentille sont plus saturés.
              </Hint>
              <Hint title="Halo">
                Profondeur visuelle proportionnelle à l’importance du nœud.
              </Hint>
              <Hint title="Particules">
                Flux d’evidence sur les liens « soutient » / « explique ». Désactivable en mode performance.
              </Hint>
              <Hint title="Liens courbes">
                Contradictions et affaiblissements — appelés à challenger les conclusions.
              </Hint>
            </div>
          </Panel>
        </div>

        {/* ── Right: details panel ───────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          {/* Mobile-only collapse button. The whole rail is sticky on
              desktop but stacked below the canvas on small screens; the
              button keeps the canvas in view when the user is exploring. */}
          <button
            type="button"
            onClick={() => setDetailsCollapsed(v => !v)}
            aria-expanded={!detailsCollapsed}
            className="flex items-center justify-between rounded-2xl border border-border/60 bg-surface-1 px-4 py-2 text-[12px] font-medium text-foreground transition-colors hover:bg-surface-2 lg:hidden"
          >
            <span className="flex items-center gap-2">
              <span aria-hidden="true">▤</span>
              <span>{detailsCollapsed ? 'Afficher les détails' : 'Masquer les détails'}</span>
            </span>
            <span aria-hidden="true" className="text-muted-foreground">
              {detailsCollapsed ? '▾' : '▴'}
            </span>
          </button>
          <div
            className={`flex flex-col gap-4 ${detailsCollapsed ? 'hidden lg:flex' : ''}`}
          >
          {selectedNode ? (
            <AdvisorGraphNodeDetails
              node={selectedNode}
              neighbors={selectedNeighbors}
              isPinned={pinnedIds.has(selectedNode.id)}
              isIsolated={isolationSeedId === selectedNode.id}
              pathPeerLabel={pathPeerLabel}
              onSelectNeighbor={id => {
                setSelectedNodeIdNav(id)
                cameraApiRef.current?.focusNode(id)
              }}
              onTogglePin={togglePin}
              onIsolate={isolateNode}
              onClearIsolation={clearIsolation}
              onCopyLabel={copyLabel}
              onTracePath={tracePath}
            />
          ) : selectedLink ? (
            <AdvisorGraphLinkDetails
              link={selectedLink}
              source={renderedGraph.nodes.find(n => n.id === selectedLink.source) ?? null}
              target={renderedGraph.nodes.find(n => n.id === selectedLink.target) ?? null}
            />
          ) : (
            <AdvisorGraphEmptyDetails hasGraph={renderedGraph.nodes.length > 0} />
          )}

          <Panel
            title="À propos de cette carte"
            tone="violet"
            icon={<span aria-hidden="true">[#]</span>}
          >
            <div className="space-y-2 text-[12.5px] leading-relaxed text-muted-foreground">
              <p>
                Cette visualisation est une <strong className="text-foreground">mémoire dérivée</strong>{' '}
                — pas une base financière de vérité, pas un système de trading, pas un conseil
                fiscal.
              </p>
              <div className="rounded-lg border border-border/40 bg-surface-1 p-3 text-[12px]">
                <p className="font-medium text-foreground">Origine du graphe</p>
                <ul className="mt-1.5 space-y-1 text-muted-foreground">
                  <li>
                    <span className="text-positive">réel</span> · uniquement ta mémoire Advisor.
                  </li>
                  <li>
                    <span className="text-accent-2">démo</span> · fixture déterministe en mode démo.
                  </li>
                  <li>
                    <span className="text-warning">aperçu</span> · réel + exemples curés après
                    opt-in. Les exemples sont marqués «&nbsp;exemple&nbsp;» et préfixés.
                  </li>
                  <li>
                    <span className="text-muted-foreground">vide</span> · mémoire trop pauvre,
                    aucun mélange automatique.
                  </li>
                </ul>
              </div>
              <p>
                <span className="text-foreground">Confiance</span> = probabilité que la mémoire
                soit correcte. <span className="text-foreground">Fraîcheur</span> = à quel point
                l’information est récente. Les contradictions sont surfacées pour challenger.
              </p>
            </div>
          </Panel>

          {bundleQuery.data ? (
            <Panel
              title="Contexte bundle"
              tone="positive"
              icon={<span aria-hidden="true">∑</span>}
            >
              <p className="line-clamp-4 text-[12.5px] leading-relaxed text-muted-foreground">
                {bundleQuery.data.summary}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge variant="outline">
                  {Math.round((bundleQuery.data.confidence ?? 0) * 100)}% confiance
                </Badge>
                <Badge variant="outline">
                  {Math.round((bundleQuery.data.recency ?? 0) * 100)}% fraîcheur
                </Badge>
                <Badge variant="outline">{bundleQuery.data.tokenEstimate} tokens</Badge>
              </div>
            </Panel>
          ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── ─── pieces ───────────────────────────────────────────────────────────

function ToursBar({
  activeTourId,
  onActivate,
  onClear,
}: {
  activeTourId: string | null
  onActivate: (id: string) => void
  onClear: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-surface-1 p-2.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        visites guidées
      </span>
      {ADVISOR_GRAPH_TOURS.map(tour => {
        const active = activeTourId === tour.id
        return (
          <button
            key={tour.id}
            type="button"
            onClick={() => onActivate(tour.id)}
            aria-pressed={active}
            title={tour.hint}
            className={`rounded-md border px-3 py-1.5 text-[11.5px] font-medium transition-colors ${
              active
                ? 'border-primary/40 bg-primary/12 text-primary'
                : 'border-border/60 bg-card text-foreground hover:bg-surface-2'
            }`}
          >
            {tour.label}
          </button>
        )
      })}
      {activeTourId ? (
        <button
          type="button"
          onClick={onClear}
          className="ml-auto rounded-md border border-border/60 bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-surface-2 hover:text-foreground"
        >
          Vue libre
        </button>
      ) : null}
    </div>
  )
}

function LensButton({
  lens,
  active,
  onSelect,
}: {
  lens: AdvisorGraphLens
  active: boolean
  onSelect: () => void
}) {
  const tone = TONE_TO_CLASS[lens.tone]
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`group rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
        active
          ? `${tone.activeBorder} ${tone.activeBg} ${tone.activeText}`
          : 'border-border/60 bg-surface-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground'
      }`}
    >
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] opacity-70">
          {lens.eyebrow.split(' · ')[0]}
        </span>
        <span className="font-medium">{lens.label}</span>
      </div>
      <p className="mt-0.5 text-[11px] leading-snug opacity-80">{lens.tagline}</p>
    </button>
  )
}

const TONE_TO_CLASS: Record<
  AdvisorGraphLens['tone'],
  { activeBorder: string; activeBg: string; activeText: string }
> = {
  aurora: {
    activeBorder: 'border-aurora/40',
    activeBg: 'bg-aurora/12',
    activeText: 'text-aurora',
  },
  brand: {
    activeBorder: 'border-primary/40',
    activeBg: 'bg-primary/12',
    activeText: 'text-primary',
  },
  positive: {
    activeBorder: 'border-positive/40',
    activeBg: 'bg-positive/12',
    activeText: 'text-positive',
  },
  warning: {
    activeBorder: 'border-warning/40',
    activeBg: 'bg-warning/12',
    activeText: 'text-warning',
  },
  violet: {
    activeBorder: 'border-accent-2/40',
    activeBg: 'bg-accent-2/12',
    activeText: 'text-accent-2',
  },
  plain: {
    activeBorder: 'border-border/80',
    activeBg: 'bg-surface-2',
    activeText: 'text-foreground',
  },
}

function PresetSelector({
  value,
  onChange,
}: {
  value: RenderPreset
  onChange: (next: RenderPreset) => void
}) {
  const PRESETS: ReadonlyArray<{ id: RenderPreset; label: string }> = [
    { id: 'cinematic', label: 'Ciné' },
    { id: 'standard', label: 'Standard' },
    { id: 'performance', label: 'Perf' },
  ]
  return (
    <fieldset className="col-span-2 flex gap-1 border-0 p-0">
      <legend className="sr-only">Préréglage de rendu</legend>
      {PRESETS.map(p => (
        <button
          key={p.id}
          type="button"
          onClick={() => onChange(p.id)}
          aria-pressed={value === p.id}
          className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors ${
            value === p.id
              ? 'border-primary/40 bg-primary/12 text-primary'
              : 'border-border/60 bg-surface-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground'
          }`}
        >
          {p.label}
        </button>
      ))}
    </fieldset>
  )
}

function CameraButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border border-border/60 bg-surface-1 px-3 py-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  )
}

function KindFilters<TKind extends string>({
  title,
  tone,
  allKinds,
  present,
  visible,
  colorMap,
  labelMap,
  onToggle,
  onReset,
}: {
  title: string
  tone: 'brand' | 'violet' | 'positive' | 'warning' | 'plain'
  allKinds: ReadonlyArray<TKind>
  present: Set<TKind>
  visible: Set<TKind>
  colorMap: Record<TKind, string>
  labelMap: Record<TKind, string>
  onToggle: (kind: TKind) => void
  onReset: () => void
}) {
  const visibleKinds = allKinds.filter(k => present.has(k))
  return (
    <Panel
      title={title}
      tone={tone}
      icon={<span aria-hidden="true">●</span>}
      actions={
        <button
          type="button"
          onClick={onReset}
          className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
        >
          reset
        </button>
      }
    >
      <div className="flex flex-col gap-1">
        {visibleKinds.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">Aucun type présent dans ce graphe.</p>
        ) : (
          visibleKinds.map(kind => {
            const isOn = visible.has(kind)
            return (
              <button
                key={kind}
                type="button"
                onClick={() => onToggle(kind)}
                aria-pressed={isOn}
                className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-[11px] transition-colors ${
                  isOn
                    ? 'border-border/60 bg-surface-1 text-foreground'
                    : 'border-border/40 bg-transparent text-muted-foreground/60 hover:bg-surface-1'
                }`}
              >
                <span
                  aria-hidden="true"
                  className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: colorMap[kind], opacity: isOn ? 1 : 0.35 }}
                />
                <span className="truncate">{labelMap[kind]}</span>
              </button>
            )
          })
        )}
      </div>
    </Panel>
  )
}

function PinnedBar({
  graph,
  pinnedIds,
  canTracePath,
  onSelect,
  onUnpin,
  onTracePath,
  onClearAll,
}: {
  graph: AdvisorGraph
  pinnedIds: Set<string>
  canTracePath: boolean
  onSelect: (id: string) => void
  onUnpin: (id: string) => void
  onTracePath: () => void
  onClearAll: () => void
}) {
  const pinnedNodes = useMemo(
    () => graph.nodes.filter(n => pinnedIds.has(n.id)),
    [graph, pinnedIds]
  )
  if (pinnedNodes.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-surface-1 p-2.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        épinglés
      </span>
      {pinnedNodes.map(node => (
        <span
          key={node.id}
          className="group inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-card px-2.5 py-1 text-[11px]"
        >
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: NODE_KIND_COLOR[node.kind] }}
          />
          <button
            type="button"
            onClick={() => onSelect(node.id)}
            className="text-foreground hover:underline"
          >
            {node.label}
          </button>
          <button
            type="button"
            onClick={() => onUnpin(node.id)}
            aria-label={`Désépingler ${node.label}`}
            className="text-muted-foreground/70 hover:text-foreground"
          >
            ✕
          </button>
        </span>
      ))}
      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={onTracePath}
          disabled={!canTracePath}
          className="rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-40"
          title="BFS frontend sur les liens visibles"
        >
          ↳ Tracer entre les épinglés
        </button>
        <button
          type="button"
          onClick={onClearAll}
          className="rounded-md border border-border/60 bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-surface-2 hover:text-foreground"
        >
          Tout désépingler
        </button>
      </div>
    </div>
  )
}

function PathBanner({
  path,
  onClear,
}: {
  path: AdvisorGraphPath
  onClear: () => void
}) {
  return (
    <Panel
      tone="brand"
      title="Chemin actif"
      description={`${path.nodes.length} étapes · ${path.links.length} liens`}
      icon={<span aria-hidden="true">↳</span>}
      actions={
        <button
          type="button"
          onClick={onClear}
          className="rounded-md border border-border/60 bg-surface-1 px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-surface-2 hover:text-foreground"
        >
          Effacer le chemin
        </button>
      }
    >
      <ol className="space-y-1.5 text-[12.5px] text-foreground">
        {path.nodes.map((node, idx) => {
          const linkBefore = idx > 0 ? path.links[idx - 1] : null
          return (
            <li key={node.id} className="flex flex-col gap-0.5">
              {linkBefore ? (
                <span
                  className="ml-2 text-[11px] text-muted-foreground"
                  style={{ color: LINK_KIND_COLOR[linkBefore.kind] }}
                >
                  ↓ {LINK_KIND_LABEL[linkBefore.kind]}
                </span>
              ) : null}
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: NODE_KIND_COLOR[node.kind] }}
                />
                <span className="font-medium">{node.label}</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {NODE_KIND_LABEL[node.kind]}
                </span>
              </span>
            </li>
          )
        })}
      </ol>
    </Panel>
  )
}

function SearchResultList({
  results,
  onSelect,
}: {
  results: ReadonlyArray<AdvisorGraphNode>
  onSelect: (node: AdvisorGraphNode) => void
}) {
  if (results.length === 0) {
    return (
      <p className="rounded-md border border-border/40 bg-surface-1 px-2.5 py-2 text-[11px] text-muted-foreground">
        Aucun nœud ne correspond. Essaie un autre terme.
      </p>
    )
  }
  // Group by kind for readability.
  const groups = new Map<AdvisorGraphNodeKind, AdvisorGraphNode[]>()
  for (const node of results) {
    const list = groups.get(node.kind)
    if (list) list.push(node)
    else groups.set(node.kind, [node])
  }
  return (
    <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border border-border/40 bg-surface-1 p-2">
      {Array.from(groups.entries()).map(([kind, nodes]) => (
        <div key={kind}>
          <p className="mb-1 font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground">
            {NODE_KIND_LABEL[kind]}
          </p>
          <ul className="space-y-0.5">
            {nodes.map(node => (
              <li key={node.id}>
                <button
                  type="button"
                  onClick={() => onSelect(node)}
                  className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-[12px] text-foreground hover:bg-surface-2"
                >
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor: NODE_KIND_COLOR[node.kind],
                      opacity: node.isExample ? 0.5 : 1,
                    }}
                  />
                  <span className="truncate">{node.label}</span>
                  {node.isExample ? (
                    <span className="rounded bg-warning/15 px-1 py-0.5 text-[9px] uppercase tracking-wider text-warning">
                      ex
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function Hint({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/60 bg-surface-1 p-3">
      <p className="text-[11px] font-medium text-foreground">{title}</p>
      <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">{children}</p>
    </div>
  )
}

function SparseRealMemoryBanner({
  summary,
  onPreview,
}: {
  summary: string
  onPreview: () => void
}) {
  return (
    <Panel
      title="Mémoire réelle trop pauvre"
      tone="warning"
      icon={<span aria-hidden="true">◐</span>}
      actions={
        <button
          type="button"
          onClick={onPreview}
          className="inline-flex items-center gap-1.5 rounded-md border border-warning/40 bg-warning/12 px-3 py-1.5 text-[11px] font-medium text-warning transition-colors hover:bg-warning/18"
        >
          Prévisualiser avec une démo enrichie →
        </button>
      }
    >
      <p className="text-[12.5px] leading-relaxed text-muted-foreground">{summary}</p>
      <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
        Aucun exemple n&apos;est ajouté tant que tu ne l&apos;as pas demandé. Active la
        prévisualisation pour voir à quoi ressemblera ta carte une fois la mémoire enrichie —
        les nœuds ajoutés seront marqués «&nbsp;exemple&nbsp;» et clairement distincts.
      </p>
    </Panel>
  )
}

function MixedPreviewBanner({
  realCount,
  exampleCount,
  hideExamples,
  onToggleHide,
  onDisablePreview,
}: {
  realCount: number
  exampleCount: number
  hideExamples: boolean
  onToggleHide: () => void
  onDisablePreview: () => void
}) {
  return (
    <Panel
      title="Aperçu enrichi · des exemples sont mélangés"
      description="Certaines entités affichées sont des exemples curés, pas ta mémoire Advisor."
      tone="warning"
      icon={<span aria-hidden="true">⚠</span>}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleHide}
            aria-pressed={hideExamples}
            className={`rounded-md border px-3 py-1.5 text-[11px] font-medium transition-colors ${
              hideExamples
                ? 'border-primary/40 bg-primary/12 text-primary'
                : 'border-border/60 bg-surface-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground'
            }`}
          >
            {hideExamples ? 'Afficher les exemples' : 'Masquer les exemples'}
          </button>
          <button
            type="button"
            onClick={onDisablePreview}
            className="rounded-md border border-border/60 bg-surface-1 px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            Quitter l&apos;aperçu
          </button>
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
        <Badge variant="outline" className="text-foreground">
          {realCount} réels
        </Badge>
        <Badge variant="secondary">{exampleCount} exemples</Badge>
        <span className="text-[11.5px]">
          Les nœuds exemples sont désaturés, marqués «&nbsp;exemple&nbsp;» dans le tooltip et
          dans le panneau, et leurs IDs sont préfixés par «&nbsp;example:&nbsp;».
        </span>
      </div>
    </Panel>
  )
}

function OriginPill({
  origin,
  label,
}: {
  origin: 'demo' | 'real' | 'mixed' | 'empty'
  label: string
}) {
  const styles: Record<typeof origin, string> = {
    demo: 'border-accent-2/30 bg-accent-2/10 text-accent-2',
    real: 'border-positive/30 bg-positive/10 text-positive',
    mixed: 'border-warning/40 bg-warning/12 text-warning',
    empty: 'border-border/60 bg-surface-1 text-muted-foreground',
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium ${styles[origin]}`}
    >
      <span
        aria-hidden="true"
        className="font-mono text-[9.5px] uppercase tracking-[0.16em] opacity-70"
      >
        origine
      </span>
      <span>{label}</span>
    </span>
  )
}

function Legend({ showExample }: { showExample: boolean }) {
  const groups: Array<{ title: string; items: Array<{ color: string; label: string }> }> = [
    {
      title: 'Personnel',
      items: [
        { color: NODE_KIND_COLOR.personal_snapshot, label: 'Snapshot' },
        { color: NODE_KIND_COLOR.financial_account, label: 'Comptes' },
        { color: NODE_KIND_COLOR.investment, label: 'Investissements' },
        { color: NODE_KIND_COLOR.goal, label: 'Objectifs' },
      ],
    },
    {
      title: 'Mémoire',
      items: [
        { color: NODE_KIND_COLOR.recommendation, label: 'Recommandations' },
        { color: NODE_KIND_COLOR.concept, label: 'Concepts' },
        { color: NODE_KIND_COLOR.assumption, label: 'Hypothèses' },
        { color: NODE_KIND_COLOR.source, label: 'Sources' },
      ],
    },
    {
      title: 'Signaux & risques',
      items: [
        { color: NODE_KIND_COLOR.market_signal, label: 'Marché' },
        { color: NODE_KIND_COLOR.news_signal, label: 'Actu' },
        { color: NODE_KIND_COLOR.risk, label: 'Risque' },
        { color: NODE_KIND_COLOR.contradiction, label: 'Contradiction' },
      ],
    },
  ]
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 right-3 hidden flex-wrap gap-3 rounded-md border border-white/10 bg-black/35 p-2.5 text-[11px] text-white/80 backdrop-blur-md sm:flex">
      {groups.map(group => (
        <div key={group.title} className="flex min-w-0 flex-col gap-1">
          <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-white/45">
            {group.title}
          </span>
          <div className="flex flex-wrap gap-2.5">
            {group.items.map(item => (
              <span key={item.label} className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: item.color, boxShadow: `0 0 6px ${item.color}aa` }}
                />
                <span>{item.label}</span>
              </span>
            ))}
          </div>
        </div>
      ))}
      <div className="flex min-w-0 flex-col gap-1">
        <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-white/45">
          Liens
        </span>
        <div className="flex flex-wrap gap-2.5">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-[3px] w-5 rounded-full"
              style={{ backgroundColor: LINK_KIND_COLOR.supports }}
            />
            <span>soutient (particules)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-[3px] w-5 rounded-full"
              style={{ backgroundColor: LINK_KIND_COLOR.contradicts }}
            />
            <span>contredit (courbe)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-[3px] w-5 rounded-full"
              style={{ backgroundColor: LINK_KIND_COLOR.derived_from }}
            />
            <span>dérivé de</span>
          </span>
        </div>
      </div>
      {showExample ? (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-white/45">
            Exemple
          </span>
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 rounded-full border border-dashed border-amber-300/80"
              style={{ backgroundColor: 'rgba(148,163,184,0.55)' }}
            />
            <span>nœuds illustratifs · pas ta mémoire</span>
          </span>
        </div>
      ) : null}
    </div>
  )
}

