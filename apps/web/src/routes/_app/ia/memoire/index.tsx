import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  Input,
} from '@finance-os/ui/components'
import {
  BranchPixelIcon,
  ChartNetworkPixelIcon,
  FilterPixelIcon,
  GridPixelIcon,
  RefreshPixelIcon,
  SearchPixelIcon,
  TablePixelIcon,
  TimesPixelIcon,
} from '@finance-os/ui/icons/pixel'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  Component,
  lazy,
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  AdvisorGraphLinkDetails,
  type AdvisorGraphNeighbor,
  AdvisorGraphNodeDetails,
} from '@/components/advisor/advisor-graph-details-panel'
import { AdvisorMemoryList } from '@/components/advisor/advisor-memory-list'
import type { CameraApi } from '@/components/advisor/knowledge-graph-3d'
import {
  type AdvisorGraph,
  type AdvisorGraphLink,
  type AdvisorGraphLinkKind,
  type AdvisorGraphNode,
  type AdvisorGraphNodeKind,
  type AdvisorGraphPath,
  findShortestPath,
  getNeighborhood,
  LINK_KIND_LABEL,
  NODE_KIND_LABEL,
} from '@/features/advisor-graph-data'
import { mapAdvisorKnowledgeGraphDtoToViewModel } from '@/features/advisor-graph-dto'
import {
  ADVISOR_GRAPH_LENS_BY_ID,
  ADVISOR_GRAPH_LENSES,
  ADVISOR_GRAPH_QUICK_FILTERS,
  ADVISOR_GRAPH_TOURS,
  type AdvisorGraphLensId,
  type AdvisorGraphQuickFilterId,
} from '@/features/advisor-graph-lenses'
import { pickPinPathEndpoints } from '@/features/advisor-graph-pin-path'
import {
  type AdvisorGraphPinOrigin,
  type AdvisorGraphPinScope,
  buildPinStorageKey,
  clearPersistedPins,
  readPersistedPins,
  reconcilePinsAgainstGraph,
  writePersistedPins,
} from '@/features/advisor-graph-pins'
import { validateAdvisorGraphSearch } from '@/features/advisor-graph-search-params'
import {
  deriveVisibleAdvisorGraph,
  searchVisibleAdvisorGraph,
} from '@/features/advisor-graph-visibility'
import { MEMORY_ORIGIN_COPY } from '@/features/advisor-memory-view-model'
import { authMeQueryOptions } from '@/features/auth-query-options'
import type { AuthMode } from '@/features/auth-types'
import { resolveAuthViewState } from '@/features/auth-view-state'
import { knowledgeGraphQueryOptionsWithMode } from '@/features/knowledge-query-options'
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion'

const LazyKnowledgeGraph3D = lazy(async () => {
  const module = await import('@/components/advisor/knowledge-graph-3d')
  return { default: module.KnowledgeGraph3D }
})

const DEFAULT_LENS_ID: AdvisorGraphLensId = 'atlas'
const GRAPH_LIMIT = 300

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

const PRIMARY_LENSES: ReadonlyArray<{ id: AdvisorGraphLensId; label: string }> = [
  { id: 'atlas', label: 'Tout' },
  { id: 'personal', label: 'Profil' },
  { id: 'decision', label: 'Décisions' },
  { id: 'market', label: 'Marchés' },
  { id: 'risk', label: 'Risques' },
]

const QUICK_FILTER_LABELS: Readonly<Record<AdvisorGraphQuickFilterId, string>> = {
  stale_only: 'À actualiser',
  contradictions_only: 'Points à vérifier',
  high_confidence_only: 'Fiabilité élevée',
  personal_only: 'Souvenirs personnels',
}

type RenderPreset = 'cinematic' | 'standard' | 'performance'
export type GraphRenderState = 'idle' | 'loading' | 'ready' | 'error'
export type MemoryView = 'graph' | 'list'

export function resolveMemoryViewAfterRenderState(
  currentView: MemoryView,
  renderState: GraphRenderState
): MemoryView {
  return renderState === 'error' ? 'list' : currentView
}

export function reconcileMemorySelectedLink(
  selectedLink: AdvisorGraphLink | null,
  visibleLinks: ReadonlyArray<AdvisorGraphLink>
): AdvisorGraphLink | null {
  if (!selectedLink) return null

  const remainsVisible = visibleLinks.some(
    link =>
      link.source === selectedLink.source &&
      link.target === selectedLink.target &&
      link.kind === selectedLink.kind
  )
  return remainsVisible ? selectedLink : null
}

export function getMemoryControlsDrawerSide(isMobile: boolean): 'bottom' | 'right' {
  return isMobile ? 'bottom' : 'right'
}

export function useMemoryCameraRegistration(selectedNodeId: string | null) {
  const cameraApiRef = useRef<CameraApi | null>(null)
  const selectedNodeIdRef = useRef<string | null>(selectedNodeId)
  selectedNodeIdRef.current = selectedNodeId

  const focusCameraNode = useCallback((nodeId: string) => {
    cameraApiRef.current?.focusNode(nodeId)
  }, [])

  const registerCameraApi = useCallback((api: CameraApi | null) => {
    cameraApiRef.current = api
    const pendingNodeId = selectedNodeIdRef.current
    if (api && pendingNodeId) api.focusNode(pendingNodeId)
  }, [])

  return { cameraApiRef, focusCameraNode, registerCameraApi }
}

export function selectMemorySearchResult({
  node,
  cameraApi,
  onSelectNode,
  onCloseSearch,
}: {
  node: AdvisorGraphNode
  cameraApi: CameraApi | null
  onSelectNode: (id: string) => void
  onCloseSearch: () => void
}) {
  onSelectNode(node.id)
  cameraApi?.focusNode(node.id)
  onCloseSearch()
}

export function useMemoryKeyboardShortcuts({
  isImmersive,
  searchOpen,
  searchInputRef,
  onExitImmersive,
  onSearchOpenChange,
}: {
  isImmersive: boolean
  searchOpen: boolean
  searchInputRef: React.RefObject<HTMLInputElement | null>
  onExitImmersive: () => void
  onSearchOpenChange: (open: boolean) => void
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isImmersive) {
        event.preventDefault()
        onExitImmersive()
        return
      }
      if (event.key === 'Escape' && searchOpen) {
        onSearchOpenChange(false)
        return
      }
      if (event.key === '/' && !isEditableTarget(event.target)) {
        event.preventDefault()
        searchInputRef.current?.focus()
        onSearchOpenChange(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isImmersive, onExitImmersive, onSearchOpenChange, searchInputRef, searchOpen])
}

export const Route = createFileRoute('/_app/ia/memoire/')({
  validateSearch: (raw: Record<string, unknown>) => validateAdvisorGraphSearch(raw),
  loader: async ({ context }) => {
    const auth = await context.queryClient.fetchQuery(authMeQueryOptions())
    const mode: AuthMode | undefined =
      auth.mode === 'admin' ? 'admin' : auth.mode === 'demo' ? 'demo' : undefined
    if (!mode) return

    await Promise.allSettled([
      context.queryClient.ensureQueryData(
        knowledgeGraphQueryOptionsWithMode({
          mode,
          scope: 'overview',
          includeExamples: false,
          limit: GRAPH_LIMIT,
        })
      ),
    ])
  },
  component: AdvisorMemoryPage,
})

function createEmptyGraph(summary: string, degraded = false): AdvisorGraph {
  return {
    nodes: [],
    links: [],
    meta: {
      origin: 'empty',
      summary,
      nodeCount: 0,
      linkCount: 0,
      realNodeCount: 0,
      exampleNodeCount: 0,
      ...(degraded ? { degraded: true } : {}),
    },
  }
}

function AdvisorMemoryPage() {
  const navigate = useNavigate({ from: Route.fullPath })
  const search = Route.useSearch()
  const reducedMotion = usePrefersReducedMotion()
  const isMobile = useIsMobile()

  const authQuery = useQuery(authMeQueryOptions())
  const authViewState = resolveAuthViewState({
    isPending: authQuery.isPending,
    ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}),
  })
  const isDemo = authViewState === 'demo'
  const isAdmin = authViewState === 'admin'
  const authMode: AuthMode | undefined = isAdmin ? 'admin' : isDemo ? 'demo' : undefined

  const [previewExamples, setPreviewExamples] = useState(false)
  const [hideExamples, setHideExamples] = useState(false)
  const graphQuery = useQuery(
    knowledgeGraphQueryOptionsWithMode({
      ...(authMode ? { mode: authMode } : {}),
      scope: 'overview',
      includeExamples: isAdmin && previewExamples,
      limit: GRAPH_LIMIT,
    })
  )

  const graph = useMemo<AdvisorGraph>(() => {
    if (graphQuery.data && graphQuery.data.meta.degraded !== true) {
      return mapAdvisorKnowledgeGraphDtoToViewModel(graphQuery.data)
    }
    if (graphQuery.data?.meta.reason) {
      return createEmptyGraph('La mémoire est momentanément indisponible.', true)
    }
    if (graphQuery.isError) {
      return createEmptyGraph('La mémoire est momentanément indisponible.', true)
    }
    return createEmptyGraph('Chargement de la mémoire.')
  }, [graphQuery.data, graphQuery.isError])

  const lensId = search.lens ?? DEFAULT_LENS_ID
  const lens = ADVISOR_GRAPH_LENS_BY_ID[lensId]
  const selectedNodeId = search.node ?? null

  const [selectedLink, setSelectedLink] = useState<AdvisorGraphLink | null>(null)
  const [isolationSeedId, setIsolationSeedId] = useState<string | null>(null)
  const [pathFromId, setPathFromId] = useState<string | null>(null)
  const [pathToId, setPathToId] = useState<string | null>(null)
  const [activeTourId, setActiveTourId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeQuickFilters, setActiveQuickFilters] = useState<Set<AdvisorGraphQuickFilterId>>(
    new Set()
  )
  const [nodeKindOverride, setNodeKindOverride] = useState<Set<AdvisorGraphNodeKind> | null>(null)
  const [linkKindOverride, setLinkKindOverride] = useState<Set<AdvisorGraphLinkKind> | null>(null)
  const [controlsOpen, setControlsOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [isImmersive, setIsImmersive] = useState(false)
  const [view, setView] = useState<MemoryView>('graph')
  const [renderState, setRenderState] = useState<GraphRenderState>('idle')
  const [preset, setPreset] = useState<RenderPreset>('standard')
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set())

  const { cameraApiRef, focusCameraNode, registerCameraApi } =
    useMemoryCameraRegistration(selectedNodeId)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const immersiveTriggerRef = useRef<HTMLButtonElement | null>(null)

  const setSelectedNode = useCallback(
    (id: string | null) => {
      void navigate({
        to: '/ia/memoire',
        search: previous => {
          if (id) return { ...previous, node: id }
          return { ...previous, node: undefined }
        },
        replace: true,
      })
    },
    [navigate]
  )

  const setLens = useCallback(
    (id: AdvisorGraphLensId) => {
      void navigate({
        to: '/ia/memoire',
        search: previous => ({ ...previous, lens: id }),
        replace: true,
      })
      setNodeKindOverride(null)
      setLinkKindOverride(null)
      setActiveQuickFilters(new Set())
      setIsolationSeedId(null)
      setPathFromId(null)
      setPathToId(null)
      setActiveTourId(null)
    },
    [navigate]
  )

  const graphWithoutHiddenExamples = useMemo(() => {
    if (!hideExamples || graph.meta.exampleNodeCount === 0) return graph
    const nodes = graph.nodes.filter(node => !node.isExample)
    const nodeIds = new Set(nodes.map(node => node.id))
    const links = graph.links.filter(link => nodeIds.has(link.source) && nodeIds.has(link.target))
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

  const filteredGraph = useMemo<AdvisorGraph>(() => {
    const predicates = ADVISOR_GRAPH_QUICK_FILTERS.filter(filter =>
      activeQuickFilters.has(filter.id)
    )
    let nodes = graphWithoutHiddenExamples.nodes
    if (predicates.length > 0) {
      nodes = nodes.filter(node => predicates.every(filter => filter.predicate(node)))
    }
    if (isolationSeedId) {
      const neighborhood = getNeighborhood(graphWithoutHiddenExamples, isolationSeedId, 2)
      nodes = nodes.filter(node => neighborhood.has(node.id))
    }
    const nodeIds = new Set(nodes.map(node => node.id))
    const links = graphWithoutHiddenExamples.links.filter(
      link => nodeIds.has(link.source) && nodeIds.has(link.target)
    )
    return {
      nodes,
      links,
      meta: {
        ...graphWithoutHiddenExamples.meta,
        nodeCount: nodes.length,
        linkCount: links.length,
      },
    }
  }, [activeQuickFilters, graphWithoutHiddenExamples, isolationSeedId])

  const lensNodeKinds = useMemo(
    () => new Set<AdvisorGraphNodeKind>(lens.includedKinds),
    [lens.includedKinds]
  )
  const emphasizedKinds = useMemo(
    () => new Set<AdvisorGraphNodeKind>(lens.emphasizedKinds),
    [lens.emphasizedKinds]
  )
  const visibleNodeKinds = useMemo(
    () => nodeKindOverride ?? lensNodeKinds,
    [lensNodeKinds, nodeKindOverride]
  )
  const visibleLinkKinds = useMemo(
    () => linkKindOverride ?? new Set<AdvisorGraphLinkKind>(ALL_LINK_KINDS),
    [linkKindOverride]
  )
  const visibleGraph = useMemo(
    () =>
      deriveVisibleAdvisorGraph({
        graph: filteredGraph,
        visibleNodeKinds,
        visibleLinkKinds,
      }),
    [filteredGraph, visibleLinkKinds, visibleNodeKinds]
  )

  const nodeKindsPresent = useMemo(
    () => new Set(graphWithoutHiddenExamples.nodes.map(node => node.kind)),
    [graphWithoutHiddenExamples.nodes]
  )
  const linkKindsPresent = useMemo(
    () => new Set(graphWithoutHiddenExamples.links.map(link => link.kind)),
    [graphWithoutHiddenExamples.links]
  )
  const searchResults = useMemo(
    () => searchVisibleAdvisorGraph(visibleGraph, searchTerm),
    [searchTerm, visibleGraph]
  )
  const matchingNodeIds = useMemo(
    () => new Set(searchResults.map(node => node.id)),
    [searchResults]
  )
  const selectedNode = useMemo(
    () => visibleGraph.nodes.find(node => node.id === selectedNodeId) ?? null,
    [selectedNodeId, visibleGraph.nodes]
  )
  const selectedNeighbors = useMemo<AdvisorGraphNeighbor[]>(() => {
    if (!selectedNode) return []
    const nodesById = new Map(visibleGraph.nodes.map(node => [node.id, node] as const))
    const neighbors: AdvisorGraphNeighbor[] = []
    for (const link of visibleGraph.links) {
      if (link.source === selectedNode.id) {
        const other = nodesById.get(link.target)
        if (other) neighbors.push({ link, other })
      } else if (link.target === selectedNode.id) {
        const other = nodesById.get(link.source)
        if (other) neighbors.push({ link, other })
      }
    }
    return neighbors
  }, [selectedNode, visibleGraph.links, visibleGraph.nodes])

  const path = useMemo<AdvisorGraphPath | null>(() => {
    if (!pathFromId || !pathToId) return null
    return findShortestPath(visibleGraph, pathFromId, pathToId)
  }, [pathFromId, pathToId, visibleGraph])

  const pinScope: AdvisorGraphPinScope =
    authMode === 'admin' ? 'admin' : authMode === 'demo' ? 'demo' : 'unknown'
  const pinOrigin: AdvisorGraphPinOrigin = graph.meta.origin
  const pinStorageKey = useMemo(
    () => buildPinStorageKey({ authMode: pinScope, origin: pinOrigin, scope: 'overview' }),
    [pinOrigin, pinScope]
  )

  useEffect(() => {
    const persisted = readPersistedPins(pinStorageKey)
    const nodeIds = new Set(graph.nodes.map(node => node.id))
    const { kept } = reconcilePinsAgainstGraph(persisted, nodeIds)
    setPinnedIds(new Set(kept))
    if (kept.length !== persisted.length) writePersistedPins(pinStorageKey, kept)
  }, [graph.nodes, pinStorageKey])

  useEffect(() => {
    if (pathFromId && !pathToId && selectedNodeId && selectedNodeId !== pathFromId) {
      setPathToId(selectedNodeId)
    }
  }, [pathFromId, pathToId, selectedNodeId])

  useEffect(() => {
    if (!selectedNodeId || !selectedNode) return
    focusCameraNode(selectedNodeId)
  }, [focusCameraNode, selectedNode, selectedNodeId])

  useEffect(() => {
    setSelectedLink(current => reconcileMemorySelectedLink(current, visibleGraph.links))
  }, [visibleGraph.links])

  const exitImmersive = useCallback(() => {
    setIsImmersive(false)
    requestAnimationFrame(() => immersiveTriggerRef.current?.focus())
  }, [])

  useMemoryKeyboardShortcuts({
    isImmersive,
    searchOpen,
    searchInputRef,
    onExitImmersive: exitImmersive,
    onSearchOpenChange: setSearchOpen,
  })

  useEffect(() => {
    if (!isImmersive) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isImmersive])

  const handleSelectNode = (id: string | null) => {
    setSelectedNode(id)
    setSelectedLink(null)
    if (id) setDetailsOpen(true)
    else setDetailsOpen(false)
  }

  const handleSelectLink = (link: AdvisorGraphLink | null) => {
    setSelectedLink(link)
    if (link) {
      setSelectedNode(null)
      setDetailsOpen(true)
    }
  }

  const handleSearchSelection = (node: AdvisorGraphNode) => {
    selectMemorySearchResult({
      node,
      cameraApi: cameraApiRef.current,
      onSelectNode: handleSelectNode,
      onCloseSearch: () => setSearchOpen(false),
    })
  }

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const firstResult = searchResults[0]
    if (firstResult) handleSearchSelection(firstResult)
  }

  const togglePin = (id: string) => {
    setPinnedIds(previous => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      writePersistedPins(pinStorageKey, [...next])
      return next
    })
  }

  const clearPins = () => {
    setPinnedIds(new Set())
    clearPersistedPins(pinStorageKey)
  }

  const tracePathBetweenPins = () => {
    const visibleIds = new Set(visibleGraph.nodes.map(node => node.id))
    const endpoints = pickPinPathEndpoints([...pinnedIds], visibleIds, selectedNodeId)
    if (!endpoints) return
    setPathFromId(endpoints.fromId)
    setPathToId(endpoints.toId)
  }

  const clearPath = () => {
    setPathFromId(null)
    setPathToId(null)
  }

  const activateTour = (tourId: string) => {
    const tour = ADVISOR_GRAPH_TOURS.find(candidate => candidate.id === tourId)
    if (!tour) return
    const starter = tour.pickStarter(graph)
    setLens(tour.lensId)
    setActiveTourId(tour.id)
    if (starter) setSelectedNode(starter.id)
    setControlsOpen(false)
  }

  const resetExploration = () => {
    setLens(DEFAULT_LENS_ID)
    setSelectedNode(null)
    setSelectedLink(null)
    setIsolationSeedId(null)
    setActiveTourId(null)
    setSearchTerm('')
    setSearchOpen(false)
    clearPath()
    cameraApiRef.current?.resetView()
  }

  const handleRenderStateChange = useCallback((state: GraphRenderState) => {
    setRenderState(state)
    setView(current => resolveMemoryViewAfterRenderState(current, state))
  }, [])

  const originCopy = MEMORY_ORIGIN_COPY[graph.meta.origin]
  const hasSelection = selectedNode !== null || selectedLink !== null
  const missingSelection =
    !graphQuery.isPending &&
    graph.nodes.length > 0 &&
    selectedNodeId !== null &&
    selectedNode === null
  const effectivePreset: RenderPreset = reducedMotion || isMobile ? 'performance' : preset
  const pathPeerLabel = useMemo(() => {
    if (!path) return null
    const peerId = selectedNodeId === pathFromId ? pathToId : pathFromId
    return visibleGraph.nodes.find(node => node.id === peerId)?.label ?? null
  }, [path, pathFromId, pathToId, selectedNodeId, visibleGraph.nodes])

  const selectionContent = (
    <MemorySelection
      selectedNode={selectedNode}
      selectedLink={selectedLink}
      graph={visibleGraph}
      neighbors={selectedNeighbors}
      pinnedIds={pinnedIds}
      isolationSeedId={isolationSeedId}
      pathPeerLabel={pathPeerLabel}
      onSelectNode={id => {
        handleSelectNode(id)
        cameraApiRef.current?.focusNode(id)
      }}
      onTogglePin={togglePin}
      onIsolate={setIsolationSeedId}
      onClearIsolation={() => setIsolationSeedId(null)}
      onTracePath={id => {
        setPathFromId(id)
        setPathToId(null)
      }}
    />
  )

  return (
    <>
      <section
        aria-label="Mémoire"
        className={`overflow-hidden bg-background text-foreground ${
          isImmersive
            ? 'fixed inset-0 z-[55]'
            : '-mx-5 -mt-5 h-[calc(100dvh-6.5rem)] min-h-[34rem] lg:-mt-9 lg:h-[calc(100dvh-7.25rem)] lg:min-h-[44rem] lg:rounded-frame lg:border lg:border-border/60'
        }`}
      >
        <div className="relative h-full min-h-0 w-full overflow-hidden">
          {view === 'list' ? (
            <div className="absolute inset-0 overflow-y-auto bg-background px-3 pb-20 pt-32 sm:px-5 lg:px-[5.5rem] lg:pb-16 lg:pt-24">
              <div className="mx-auto max-w-3xl overflow-hidden rounded-frame border border-border/60 bg-card">
                {renderState === 'error' ? (
                  <output className="border-b border-border/60 px-4 py-3 text-sm text-warning">
                    La vue 3D est indisponible. La liste reste entièrement utilisable.
                  </output>
                ) : null}
                <AdvisorMemoryList
                  nodes={visibleGraph.nodes}
                  selectedNodeId={selectedNodeId}
                  onSelectNode={handleSelectNode}
                />
              </div>
            </div>
          ) : visibleGraph.nodes.length === 0 ? (
            <MemoryEmptyState
              pending={graphQuery.isPending}
              message={graph.meta.summary}
              onOpenList={() => setView('list')}
            />
          ) : (
            <GraphErrorBoundary onFailure={() => handleRenderStateChange('error')}>
              <Suspense fallback={<MemoryGraphLoading />}>
                <LazyKnowledgeGraph3D
                  graph={visibleGraph}
                  selectedNodeId={selectedNodeId}
                  onSelectNode={handleSelectNode}
                  onSelectLink={handleSelectLink}
                  highlightedNodeIds={matchingNodeIds}
                  visibleNodeKinds={visibleNodeKinds}
                  visibleLinkKinds={visibleLinkKinds}
                  paused={false}
                  pinnedNodeIds={pinnedIds}
                  emphasizedKinds={emphasizedKinds}
                  preset={effectivePreset}
                  autoOrbit={false}
                  {...(path ? { pathLinkKeys: path.linkKeys, pathNodeIds: path.nodeIds } : {})}
                  registerCameraApi={registerCameraApi}
                  onRenderStateChange={handleRenderStateChange}
                  onWebGlFailure={() => setView('list')}
                />
              </Suspense>
            </GraphErrorBoundary>
          )}

          <MemoryTopControls
            lensId={lensId}
            isImmersive={isImmersive}
            searchTerm={searchTerm}
            searchOpen={searchOpen}
            searchResults={searchResults}
            searchInputRef={searchInputRef}
            visibleCount={visibleGraph.nodes.length}
            onSearchTermChange={value => {
              setSearchTerm(value)
              setSearchOpen(true)
            }}
            onSearchFocus={() => setSearchOpen(true)}
            onSearchSubmit={handleSearchSubmit}
            onSearchSelection={handleSearchSelection}
            onLensChange={setLens}
            onOpenControls={() => setControlsOpen(true)}
            onExitImmersive={exitImmersive}
          />

          {missingSelection ? (
            <output className="absolute left-1/2 top-32 z-20 flex -translate-x-1/2 items-center gap-3 rounded-control border border-warning/35 bg-card/95 px-3 py-2 text-xs text-warning shadow-floating backdrop-blur lg:top-20">
              <span>Ce souvenir n’est pas visible dans cette vue.</span>
              <button type="button" className="underline" onClick={resetExploration}>
                Tout afficher
              </button>
            </output>
          ) : null}

          <MemoryPathStatus
            path={path}
            pathFromId={pathFromId}
            pathToId={pathToId}
            onClear={clearPath}
          />

          {hasSelection && detailsOpen ? (
            <aside
              aria-label="Souvenir sélectionné"
              className="absolute right-5 top-20 z-20 hidden max-h-[calc(100%-8.5rem)] w-[320px] overflow-y-auto rounded-frame bg-card/96 shadow-overlay backdrop-blur lg:block"
            >
              <button
                type="button"
                aria-label="Fermer les détails"
                onClick={() => {
                  setSelectedNode(null)
                  setSelectedLink(null)
                  setDetailsOpen(false)
                }}
                className="absolute right-3 top-3 z-10 grid size-8 place-items-center rounded-control text-muted-foreground hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
              >
                <TimesPixelIcon size={13} />
              </button>
              {selectionContent}
            </aside>
          ) : null}

          <MemoryBottomControls
            view={view}
            renderState={renderState}
            isImmersive={isImmersive}
            originLabel={originCopy.label}
            originDescription={originCopy.description}
            visibleCount={visibleGraph.nodes.length}
            pinnedIds={pinnedIds}
            graph={visibleGraph}
            immersiveTriggerRef={immersiveTriggerRef}
            onSelectPin={id => {
              handleSelectNode(id)
              cameraApiRef.current?.focusNode(id)
            }}
            onClearPins={clearPins}
            onTracePins={tracePathBetweenPins}
            onToggleView={() => setView(previous => (previous === 'graph' ? 'list' : 'graph'))}
            onResetView={() => cameraApiRef.current?.fitView()}
            onEnterImmersive={() => setIsImmersive(true)}
          />
        </div>
      </section>

      <MemoryControlsDrawer
        open={controlsOpen}
        onOpenChange={setControlsOpen}
        isMobile={isMobile}
        isAdmin={isAdmin}
        lensId={lensId}
        activeTourId={activeTourId}
        activeQuickFilters={activeQuickFilters}
        nodeKindsPresent={nodeKindsPresent}
        visibleNodeKinds={visibleNodeKinds}
        linkKindsPresent={linkKindsPresent}
        visibleLinkKinds={visibleLinkKinds}
        previewExamples={previewExamples}
        hideExamples={hideExamples}
        preset={preset}
        reducedMotion={reducedMotion}
        pinnedIds={pinnedIds}
        graph={visibleGraph}
        onLensChange={setLens}
        onActivateTour={activateTour}
        onToggleQuickFilter={id => {
          setActiveQuickFilters(previous => {
            const next = new Set(previous)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
          })
        }}
        onToggleNodeKind={kind => {
          setNodeKindOverride(previous => {
            const next = new Set(previous ?? visibleNodeKinds)
            if (next.has(kind)) next.delete(kind)
            else next.add(kind)
            return next
          })
        }}
        onToggleLinkKind={kind => {
          setLinkKindOverride(previous => {
            const next = new Set(previous ?? visibleLinkKinds)
            if (next.has(kind)) next.delete(kind)
            else next.add(kind)
            return next
          })
        }}
        onTogglePreview={() => {
          setPreviewExamples(previous => !previous)
          setHideExamples(false)
        }}
        onToggleHideExamples={() => setHideExamples(previous => !previous)}
        onPresetChange={setPreset}
        onFit={() => cameraApiRef.current?.fitView()}
        onReheat={() => cameraApiRef.current?.reheat()}
        onReset={resetExploration}
        onSelectPin={id => {
          handleSelectNode(id)
          cameraApiRef.current?.focusNode(id)
          setControlsOpen(false)
        }}
        onClearPins={clearPins}
        onTracePins={tracePathBetweenPins}
      />

      <Drawer
        open={isMobile && detailsOpen && hasSelection}
        onOpenChange={open => {
          setDetailsOpen(open)
          if (!open) {
            setSelectedNode(null)
            setSelectedLink(null)
          }
        }}
      >
        <DrawerContent side="bottom" className="lg:hidden">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Souvenir sélectionné</DrawerTitle>
            <DrawerDescription>Détails et relations du souvenir.</DrawerDescription>
          </DrawerHeader>
          <div className="max-h-[72dvh] overflow-y-auto px-3 pb-3">{selectionContent}</div>
        </DrawerContent>
      </Drawer>
    </>
  )
}

export function MemoryTopControls({
  lensId,
  isImmersive,
  searchTerm,
  searchOpen,
  searchResults,
  searchInputRef,
  visibleCount,
  onSearchTermChange,
  onSearchFocus,
  onSearchSubmit,
  onSearchSelection,
  onLensChange,
  onOpenControls,
  onExitImmersive,
}: {
  lensId: AdvisorGraphLensId
  isImmersive: boolean
  searchTerm: string
  searchOpen: boolean
  searchResults: ReadonlyArray<AdvisorGraphNode>
  searchInputRef: React.RefObject<HTMLInputElement | null>
  visibleCount: number
  onSearchTermChange: (value: string) => void
  onSearchFocus: () => void
  onSearchSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onSearchSelection: (node: AdvisorGraphNode) => void
  onLensChange: (id: AdvisorGraphLensId) => void
  onOpenControls: () => void
  onExitImmersive: () => void
}) {
  return (
    <div className="pointer-events-none absolute inset-x-3 top-3 z-30 lg:inset-x-5 lg:top-5">
      <div className="flex items-center gap-2 lg:hidden">
        {!isImmersive ? (
          <div className="pointer-events-auto inline-flex min-h-10 items-center gap-2 rounded-control border border-border/60 bg-card/88 px-3 shadow-floating backdrop-blur">
            <ChartNetworkPixelIcon size={14} className="text-primary" />
            <span className="text-sm font-semibold">Mémoire</span>
            <span className="font-mono text-[10px] text-muted-foreground">{visibleCount}</span>
          </div>
        ) : null}
        {isImmersive ? (
          <button
            type="button"
            onClick={onExitImmersive}
            className="pointer-events-auto ml-auto inline-flex min-h-11 items-center rounded-control border border-border/60 bg-card/88 px-3 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground shadow-floating backdrop-blur hover:text-foreground"
          >
            Échap pour quitter
          </button>
        ) : (
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={false}
            onClick={onOpenControls}
            className="pointer-events-auto ml-auto inline-flex min-h-11 items-center gap-2 rounded-control border border-border/60 bg-card/88 px-3 text-xs text-muted-foreground shadow-floating backdrop-blur hover:text-foreground"
          >
            <FilterPixelIcon size={13} />
            Filtres
          </button>
        )}
      </div>

      <div className="mt-2 flex items-start gap-3 lg:mt-0 lg:justify-between">
        <form
          onSubmit={onSearchSubmit}
          className="pointer-events-auto relative w-full sm:w-[320px]"
        >
          <SearchPixelIcon
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            ref={searchInputRef}
            value={searchTerm}
            onChange={event => onSearchTermChange(event.target.value)}
            onFocus={onSearchFocus}
            placeholder="Rechercher dans la mémoire"
            aria-label="Rechercher dans la mémoire"
            aria-expanded={searchOpen && searchTerm.trim().length > 0}
            aria-controls="memory-search-results"
            role="combobox"
            className="h-11 bg-card/90 pl-9 pr-9 shadow-floating backdrop-blur"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-border/60 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground sm:block">
            /
          </kbd>
          {searchOpen && searchTerm.trim() ? (
            <MemorySearchResults results={searchResults} onSelect={onSearchSelection} />
          ) : null}
        </form>

        <div className="pointer-events-auto hidden items-center gap-1.5 lg:flex">
          {!isImmersive ? (
            <>
              {PRIMARY_LENSES.map(item => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={item.id === lensId}
                  onClick={() => onLensChange(item.id)}
                  className={`min-h-9 rounded-control border px-3 text-xs transition-colors ${
                    item.id === lensId
                      ? 'border-primary/45 bg-primary/14 text-primary'
                      : 'border-border/60 bg-card/82 text-muted-foreground backdrop-blur hover:text-foreground'
                  }`}
                >
                  {item.label}
                </button>
              ))}
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={onOpenControls}
                className="min-h-9 rounded-control border border-border/60 bg-card/82 px-3 text-xs text-muted-foreground backdrop-blur hover:text-foreground"
              >
                Plus
              </button>
            </>
          ) : null}
          {isImmersive ? (
            <button
              type="button"
              onClick={onExitImmersive}
              className="fixed right-3 top-3 min-h-11 rounded-control border border-border/60 bg-card/88 px-3 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground shadow-floating backdrop-blur hover:text-foreground lg:static lg:ml-2 lg:min-h-9 lg:bg-card/82"
            >
              Échap pour quitter
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function MemorySearchResults({
  results,
  onSelect,
}: {
  results: ReadonlyArray<AdvisorGraphNode>
  onSelect: (node: AdvisorGraphNode) => void
}) {
  return (
    <div
      id="memory-search-results"
      className="absolute left-0 right-0 top-[calc(100%+0.4rem)] max-h-72 overflow-y-auto rounded-frame border border-border/60 bg-card p-1.5 shadow-overlay"
    >
      {results.length === 0 ? (
        <p className="px-3 py-4 text-center text-xs text-muted-foreground">
          Aucun souvenir trouvé.
        </p>
      ) : (
        <div role="listbox" aria-label="Résultats de la recherche">
          {results.slice(0, 8).map((node, index) => (
            <button
              key={node.id}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => onSelect(node)}
              className="flex min-h-11 w-full items-center gap-3 rounded-control px-3 py-2 text-left hover:bg-surface-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
            >
              <span
                aria-hidden="true"
                className={`size-1.5 shrink-0 rounded-full ${index === 0 ? 'bg-primary' : 'bg-muted-foreground/45'}`}
              />
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">{node.label}</span>
              <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                {NODE_KIND_LABEL[node.kind]}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function MemoryBottomControls({
  view,
  renderState,
  isImmersive,
  originLabel,
  originDescription,
  visibleCount,
  pinnedIds,
  graph,
  immersiveTriggerRef,
  onSelectPin,
  onClearPins,
  onTracePins,
  onToggleView,
  onResetView,
  onEnterImmersive,
}: {
  view: MemoryView
  renderState: GraphRenderState
  isImmersive: boolean
  originLabel: string
  originDescription: string
  visibleCount: number
  pinnedIds: ReadonlySet<string>
  graph: AdvisorGraph
  immersiveTriggerRef: React.RefObject<HTMLButtonElement | null>
  onSelectPin: (id: string) => void
  onClearPins: () => void
  onTracePins: () => void
  onToggleView: () => void
  onResetView: () => void
  onEnterImmersive: () => void
}) {
  const pinnedNodes = graph.nodes.filter(node => pinnedIds.has(node.id))

  return (
    <>
      {pinnedNodes.length > 0 ? (
        <div className="absolute bottom-16 left-3 z-20 hidden max-w-[60%] items-center gap-1.5 rounded-control border border-border/60 bg-card/88 p-1.5 shadow-floating backdrop-blur lg:flex">
          {pinnedNodes.slice(0, 3).map(node => (
            <button
              key={node.id}
              type="button"
              onClick={() => onSelectPin(node.id)}
              className="max-w-40 truncate rounded-control px-2 py-1 text-xs text-muted-foreground hover:bg-surface-2 hover:text-foreground"
            >
              {node.label}
            </button>
          ))}
          {pinnedNodes.length >= 2 ? (
            <button
              type="button"
              onClick={onTracePins}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-control bg-primary/12 px-2 text-xs text-primary"
            >
              <BranchPixelIcon size={11} />
              Relier
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Effacer les épingles"
            onClick={onClearPins}
            className="grid size-8 place-items-center rounded-control text-muted-foreground hover:bg-surface-2 hover:text-foreground"
          >
            <TimesPixelIcon size={11} />
          </button>
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-x-3 bottom-3 z-20 flex items-end justify-between gap-3 lg:inset-x-5 lg:bottom-5">
        <div
          className="pointer-events-auto rounded-control border border-border/50 bg-card/80 px-2.5 py-1.5 shadow-floating backdrop-blur"
          title={originDescription}
        >
          <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
            {visibleCount} {visibleCount === 1 ? 'souvenir' : 'souvenirs'}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">{originLabel}</p>
        </div>

        <div
          className={`pointer-events-auto items-center gap-1.5 ${isImmersive ? 'hidden' : 'flex'}`}
        >
          <button
            type="button"
            onClick={onToggleView}
            disabled={view === 'list' && renderState === 'error'}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-control border border-border/60 bg-card/84 px-3 text-xs text-muted-foreground shadow-floating backdrop-blur hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {view === 'graph' ? <TablePixelIcon size={12} /> : <ChartNetworkPixelIcon size={12} />}
            {view === 'graph' ? 'Liste' : 'Carte 3D'}
          </button>
          {view === 'graph' ? (
            <button
              type="button"
              onClick={onResetView}
              className="hidden min-h-10 rounded-control border border-border/60 bg-card/84 px-3 text-xs text-muted-foreground shadow-floating backdrop-blur hover:text-foreground sm:block"
            >
              Ajuster la vue
            </button>
          ) : null}
          {!isImmersive ? (
            <button
              ref={immersiveTriggerRef}
              type="button"
              onClick={onEnterImmersive}
              className="hidden min-h-10 rounded-control border border-border/60 bg-card/84 px-3 text-xs text-muted-foreground shadow-floating backdrop-blur hover:text-foreground lg:block"
            >
              Immersif
            </button>
          ) : null}
        </div>
      </div>
    </>
  )
}

function MemoryPathStatus({
  path,
  pathFromId,
  pathToId,
  onClear,
}: {
  path: AdvisorGraphPath | null
  pathFromId: string | null
  pathToId: string | null
  onClear: () => void
}) {
  if (!pathFromId) return null

  const message = !pathToId
    ? 'Sélectionne un second souvenir.'
    : path
      ? `Chemin trouvé avec ${path.nodeIds.size} souvenirs.`
      : 'Aucun chemin dans cette vue.'

  return (
    <output className="absolute bottom-16 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-control border border-primary/30 bg-card/90 px-3 py-2 text-xs text-foreground shadow-floating backdrop-blur">
      <BranchPixelIcon size={12} className="text-primary" />
      <span>{message}</span>
      <button
        type="button"
        onClick={onClear}
        className="text-muted-foreground hover:text-foreground"
      >
        Effacer
      </button>
    </output>
  )
}

function MemorySelection({
  selectedNode,
  selectedLink,
  graph,
  neighbors,
  pinnedIds,
  isolationSeedId,
  pathPeerLabel,
  onSelectNode,
  onTogglePin,
  onIsolate,
  onClearIsolation,
  onTracePath,
}: {
  selectedNode: AdvisorGraphNode | null
  selectedLink: AdvisorGraphLink | null
  graph: AdvisorGraph
  neighbors: ReadonlyArray<AdvisorGraphNeighbor>
  pinnedIds: ReadonlySet<string>
  isolationSeedId: string | null
  pathPeerLabel: string | null
  onSelectNode: (id: string) => void
  onTogglePin: (id: string) => void
  onIsolate: (id: string) => void
  onClearIsolation: () => void
  onTracePath: (id: string) => void
}) {
  if (selectedNode) {
    return (
      <AdvisorGraphNodeDetails
        node={selectedNode}
        neighbors={neighbors}
        isPinned={pinnedIds.has(selectedNode.id)}
        isIsolated={isolationSeedId === selectedNode.id}
        pathPeerLabel={pathPeerLabel}
        onSelectNeighbor={onSelectNode}
        onTogglePin={onTogglePin}
        onIsolate={onIsolate}
        onClearIsolation={onClearIsolation}
        onCopyLabel={label => {
          if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(label)
        }}
        onTracePath={onTracePath}
      />
    )
  }

  if (selectedLink) {
    return (
      <AdvisorGraphLinkDetails
        link={selectedLink}
        source={graph.nodes.find(node => node.id === selectedLink.source) ?? null}
        target={graph.nodes.find(node => node.id === selectedLink.target) ?? null}
      />
    )
  }

  return null
}

function MemoryControlsDrawer({
  open,
  onOpenChange,
  isMobile,
  isAdmin,
  lensId,
  activeTourId,
  activeQuickFilters,
  nodeKindsPresent,
  visibleNodeKinds,
  linkKindsPresent,
  visibleLinkKinds,
  previewExamples,
  hideExamples,
  preset,
  reducedMotion,
  pinnedIds,
  graph,
  onLensChange,
  onActivateTour,
  onToggleQuickFilter,
  onToggleNodeKind,
  onToggleLinkKind,
  onTogglePreview,
  onToggleHideExamples,
  onPresetChange,
  onFit,
  onReheat,
  onReset,
  onSelectPin,
  onClearPins,
  onTracePins,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  isMobile: boolean
  isAdmin: boolean
  lensId: AdvisorGraphLensId
  activeTourId: string | null
  activeQuickFilters: ReadonlySet<AdvisorGraphQuickFilterId>
  nodeKindsPresent: ReadonlySet<AdvisorGraphNodeKind>
  visibleNodeKinds: ReadonlySet<AdvisorGraphNodeKind>
  linkKindsPresent: ReadonlySet<AdvisorGraphLinkKind>
  visibleLinkKinds: ReadonlySet<AdvisorGraphLinkKind>
  previewExamples: boolean
  hideExamples: boolean
  preset: RenderPreset
  reducedMotion: boolean
  pinnedIds: ReadonlySet<string>
  graph: AdvisorGraph
  onLensChange: (id: AdvisorGraphLensId) => void
  onActivateTour: (id: string) => void
  onToggleQuickFilter: (id: AdvisorGraphQuickFilterId) => void
  onToggleNodeKind: (kind: AdvisorGraphNodeKind) => void
  onToggleLinkKind: (kind: AdvisorGraphLinkKind) => void
  onTogglePreview: () => void
  onToggleHideExamples: () => void
  onPresetChange: (preset: RenderPreset) => void
  onFit: () => void
  onReheat: () => void
  onReset: () => void
  onSelectPin: (id: string) => void
  onClearPins: () => void
  onTracePins: () => void
}) {
  const pinnedNodes = graph.nodes.filter(node => pinnedIds.has(node.id))

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent side={getMemoryControlsDrawerSide(isMobile)}>
        <DrawerHeader className="border-b border-border/60">
          <DrawerTitle>Explorer la mémoire</DrawerTitle>
          <DrawerDescription>
            Choisis une vue ou réduis la carte aux souvenirs utiles.
          </DrawerDescription>
        </DrawerHeader>

        <div className="space-y-6 px-5 pb-6 pt-3">
          <ControlSection title="Vues" icon={<GridPixelIcon size={13} />}>
            <div className="grid grid-cols-2 gap-2">
              {ADVISOR_GRAPH_LENSES.map(item => (
                <ToggleButton
                  key={item.id}
                  active={item.id === lensId}
                  onClick={() => onLensChange(item.id)}
                >
                  {item.label}
                </ToggleButton>
              ))}
            </div>
          </ControlSection>

          <ControlSection title="Visites guidées" icon={<ChartNetworkPixelIcon size={13} />}>
            <div className="space-y-2">
              {ADVISOR_GRAPH_TOURS.map(tour => (
                <ToggleButton
                  key={tour.id}
                  active={tour.id === activeTourId}
                  onClick={() => onActivateTour(tour.id)}
                  full
                >
                  {tour.label}
                </ToggleButton>
              ))}
            </div>
          </ControlSection>

          <ControlSection title="Filtres" icon={<FilterPixelIcon size={13} />}>
            <div className="grid grid-cols-2 gap-2">
              {ADVISOR_GRAPH_QUICK_FILTERS.map(filter => (
                <ToggleButton
                  key={filter.id}
                  active={activeQuickFilters.has(filter.id)}
                  onClick={() => onToggleQuickFilter(filter.id)}
                >
                  {QUICK_FILTER_LABELS[filter.id]}
                </ToggleButton>
              ))}
            </div>
          </ControlSection>

          <ControlSection title="Types de souvenirs">
            <div className="flex flex-wrap gap-2">
              {ALL_NODE_KINDS.filter(kind => nodeKindsPresent.has(kind)).map(kind => (
                <ToggleButton
                  key={kind}
                  active={visibleNodeKinds.has(kind)}
                  onClick={() => onToggleNodeKind(kind)}
                >
                  {NODE_KIND_LABEL[kind]}
                </ToggleButton>
              ))}
            </div>
          </ControlSection>

          <details className="rounded-frame border border-border/60 bg-surface-1/55 p-3">
            <summary className="cursor-pointer text-xs font-medium text-foreground">
              Types de relations
            </summary>
            <div className="mt-3 flex flex-wrap gap-2">
              {ALL_LINK_KINDS.filter(kind => linkKindsPresent.has(kind)).map(kind => (
                <ToggleButton
                  key={kind}
                  active={visibleLinkKinds.has(kind)}
                  onClick={() => onToggleLinkKind(kind)}
                >
                  {LINK_KIND_LABEL[kind]}
                </ToggleButton>
              ))}
            </div>
          </details>

          {pinnedNodes.length > 0 ? (
            <ControlSection title="Épingles" icon={<BranchPixelIcon size={13} />}>
              <div className="space-y-1">
                {pinnedNodes.map(node => (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => onSelectPin(node.id)}
                    className="min-h-11 w-full rounded-control px-3 text-left text-sm text-muted-foreground hover:bg-surface-1 hover:text-foreground"
                  >
                    {node.label}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <ToggleButton
                  active={false}
                  onClick={onTracePins}
                  disabled={pinnedNodes.length < 2}
                >
                  Relier
                </ToggleButton>
                <ToggleButton active={false} onClick={onClearPins}>
                  Effacer
                </ToggleButton>
              </div>
            </ControlSection>
          ) : null}

          {isAdmin ? (
            <ControlSection title="Exemples de démonstration">
              <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
                Les exemples sont toujours signalés et ne deviennent jamais des souvenirs réels.
              </p>
              <div className="flex flex-wrap gap-2">
                <ToggleButton active={previewExamples} onClick={onTogglePreview}>
                  {previewExamples ? 'Masquer les exemples' : 'Ajouter des exemples'}
                </ToggleButton>
                {previewExamples ? (
                  <ToggleButton active={hideExamples} onClick={onToggleHideExamples}>
                    Données personnelles seules
                  </ToggleButton>
                ) : null}
              </div>
            </ControlSection>
          ) : null}

          <ControlSection title="Affichage" icon={<RefreshPixelIcon size={13} />}>
            <div className="grid grid-cols-3 gap-2">
              {(['cinematic', 'standard', 'performance'] as const).map(value => (
                <ToggleButton
                  key={value}
                  active={preset === value}
                  onClick={() => onPresetChange(value)}
                  disabled={reducedMotion}
                >
                  {value === 'cinematic'
                    ? 'Détaillé'
                    : value === 'standard'
                      ? 'Équilibré'
                      : 'Léger'}
                </ToggleButton>
              ))}
            </div>
            {reducedMotion ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Le rendu léger est activé pour respecter le mouvement réduit.
              </p>
            ) : null}
            <div className="mt-3 grid grid-cols-3 gap-2">
              <ToggleButton active={false} onClick={onFit}>
                Ajuster
              </ToggleButton>
              <ToggleButton active={false} onClick={onReheat}>
                Réorganiser
              </ToggleButton>
              <ToggleButton active={false} onClick={onReset}>
                Réinitialiser
              </ToggleButton>
            </div>
          </ControlSection>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

function ControlSection({
  title,
  icon,
  children,
}: {
  title: string
  icon?: ReactNode
  children: ReactNode
}) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  )
}

function ToggleButton({
  active,
  onClick,
  children,
  full = false,
  disabled = false,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  full?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`min-h-11 rounded-control border px-3 py-2 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
        full ? 'w-full text-left' : ''
      } ${
        active
          ? 'border-primary/45 bg-primary/12 text-primary'
          : 'border-border/60 bg-surface-1 text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )
}

function MemoryEmptyState({
  pending,
  message,
  onOpenList,
}: {
  pending: boolean
  message: string
  onOpenList: () => void
}) {
  return (
    <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_50%_42%,var(--surface-2),var(--background)_62%)] px-6 text-center">
      <div className="max-w-sm">
        <span className="mx-auto grid size-11 place-items-center rounded-control border border-border/60 bg-card text-primary">
          <ChartNetworkPixelIcon size={18} />
        </span>
        <h1 className="mt-4 text-lg font-semibold text-foreground">
          {pending ? 'Chargement de la mémoire' : 'Aucun souvenir dans cette vue'}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{message}</p>
        {!pending ? (
          <button
            type="button"
            onClick={onOpenList}
            className="mt-4 min-h-11 rounded-control border border-border/60 bg-card px-4 text-sm text-foreground"
          >
            Ouvrir la liste
          </button>
        ) : null}
      </div>
    </div>
  )
}

function MemoryGraphLoading() {
  return (
    <output className="grid h-full place-items-center bg-[radial-gradient(circle_at_50%_42%,var(--surface-2),var(--background)_62%)] text-sm text-muted-foreground">
      Préparation de la carte 3D
    </output>
  )
}

class GraphErrorBoundary extends Component<
  { children: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  override state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  override componentDidCatch() {
    this.props.onFailure()
  }

  override render() {
    if (this.state.failed) {
      return (
        <output className="grid h-full place-items-center text-sm text-muted-foreground">
          La vue 3D est indisponible.
        </output>
      )
    }
    return this.props.children
  }
}

function isEditableTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)')
    const update = () => setIsMobile(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return isMobile
}
