import { css, cva, cx } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
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
import { useIsMobile } from '@/lib/use-is-mobile'
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

// ─── styles ───────────────────────────────────────────────────────────────

// Full-bleed canvas: fixed when immersive, otherwise bleeds out of the page gutters.
const memoryShell = cva({
  base: { overflow: 'hidden', bg: 'background', color: 'foreground' },
  variants: {
    immersive: {
      true: { position: 'fixed', inset: '0', zIndex: '55' },
      false: {
        mx: '-5',
        mt: '-5',
        h: 'calc(100dvh - 6.5rem)',
        minH: '34rem',
        lg: {
          mt: '-9',
          h: 'calc(100dvh - 7.25rem)',
          minH: '44rem',
          rounded: 'frame',
          borderWidth: '1px',
          borderColor: 'border/60',
        },
      },
    },
  },
})

const listViewport = css({
  position: 'absolute',
  inset: '0',
  overflowY: 'auto',
  bg: 'background',
  px: '3',
  pb: '20',
  pt: '32',
  sm: { px: '5' },
  lg: { px: '5.5rem', pb: '16', pt: '24' },
})

const listCard = css({
  mx: 'auto',
  maxW: '3xl',
  overflow: 'hidden',
  rounded: 'frame',
  borderWidth: '1px',
  borderColor: 'border/60',
  bg: 'card',
})

const listNotice = css({
  borderBottomWidth: '1px',
  borderColor: 'border/60',
  px: '4',
  py: '3',
  textStyle: 'sm',
  color: 'warning',
})

// Centered floating notices over the canvas (missing selection, active path).
const floatingNotice = cva({
  base: {
    position: 'absolute',
    left: '50%',
    zIndex: '20',
    display: 'flex',
    translate: '-50% 0',
    alignItems: 'center',
    gap: '3',
    rounded: 'control',
    borderWidth: '1px',
    px: '3',
    py: '2',
    textStyle: 'xs',
    shadow: 'floating',
    backdropFilter: 'blur(8px)',
  },
  variants: {
    kind: {
      missing: {
        top: '32',
        borderColor: 'warning/35',
        bg: 'card/95',
        color: 'warning',
        lg: { top: '20' },
      },
      path: { bottom: '16', borderColor: 'primary/30', bg: 'card/90', color: 'foreground' },
    },
  },
})

const underlined = css({ textDecorationLine: 'underline' })

const quietLink = css({ color: 'muted.foreground', _hover: { color: 'foreground' } })

const detailsRail = css({
  position: 'absolute',
  right: '5',
  top: '20',
  zIndex: '20',
  display: 'none',
  maxH: 'calc(100% - 8.5rem)',
  w: '320px',
  overflowY: 'auto',
  rounded: 'frame',
  bg: 'card/96',
  shadow: 'overlay',
  backdropFilter: 'blur(8px)',
  lg: { display: 'block' },
})

const iconButton = cva({
  base: {
    display: 'grid',
    boxSize: '8',
    placeItems: 'center',
    rounded: 'control',
    color: 'muted.foreground',
    _hover: { bg: 'surface.2', color: 'foreground' },
  },
  variants: {
    placement: {
      rail: {
        position: 'absolute',
        right: '3',
        top: '3',
        zIndex: '10',
        _focusVisible: {
          outlineStyle: 'none',
          boxShadow: '0 0 0 2px color-mix(in srgb, {colors.ring} 70%, transparent)',
        },
      },
      inline: {},
    },
  },
})

// Floating chrome over the canvas: a bordered, blurred card tint.
const chip = cva({
  base: {
    rounded: 'control',
    borderWidth: '1px',
    borderColor: 'border/60',
    px: '3',
    backdropFilter: 'blur(8px)',
  },
  variants: {
    tint: {
      strong: { bg: 'card/88', shadow: 'floating' },
      medium: { bg: 'card/84', shadow: 'floating' },
      flat: { bg: 'card/82' },
    },
    target: {
      compact: { minH: '9' },
      regular: { minH: '10' },
      touch: { minH: '11' },
    },
    inline: { true: { display: 'inline-flex', alignItems: 'center' } },
    text: {
      xs: { textStyle: 'xs' },
      mono: {
        fontFamily: 'mono',
        fontSize: '10px',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
      },
    },
    quiet: { true: { color: 'muted.foreground', _hover: { color: 'foreground' } } },
  },
})

const Chip = styled('div', chip)
const ChipButton = styled('button', chip)

const lensButton = cva({
  base: {
    minH: '9',
    rounded: 'control',
    borderWidth: '1px',
    px: '3',
    textStyle: 'xs',
    transitionProperty: 'colors',
    transitionDuration: '150ms',
    transitionTimingFunction: 'default',
  },
  variants: {
    active: {
      true: { borderColor: 'primary/45', bg: 'primary/14', color: 'primary' },
      false: {
        borderColor: 'border/60',
        bg: 'card/82',
        color: 'muted.foreground',
        backdropFilter: 'blur(8px)',
        _hover: { color: 'foreground' },
      },
    },
  },
})

// Mono eyebrow labels; `tracking` mirrors the three letter spacings in use.
const monoLabel = cva({
  base: { fontFamily: 'mono', color: 'muted.foreground' },
  variants: {
    size: {
      '9px': { fontSize: '9px' },
      '10px': { fontSize: '10px' },
    },
    tracking: {
      none: {},
      snug: { textTransform: 'uppercase', letterSpacing: '0.08em' },
      normal: { textTransform: 'uppercase', letterSpacing: '0.1em' },
      wide: { textTransform: 'uppercase', letterSpacing: '0.12em' },
    },
  },
  defaultVariants: { tracking: 'none' },
})

const topBar = css({
  pointerEvents: 'none',
  position: 'absolute',
  insetX: '3',
  top: '3',
  zIndex: '30',
  lg: { insetX: '5', top: '5' },
})

const mobileRow = css({
  display: 'flex',
  alignItems: 'center',
  gap: '2',
  lg: { display: 'none' },
})

const searchRow = css({
  mt: '2',
  display: 'flex',
  alignItems: 'flex-start',
  gap: '3',
  lg: { mt: '0', justifyContent: 'space-between' },
})

const searchForm = css({
  pointerEvents: 'auto',
  position: 'relative',
  w: 'full',
  sm: { w: '320px' },
})

const searchIcon = css({
  pointerEvents: 'none',
  position: 'absolute',
  left: '3',
  top: '50%',
  zIndex: '10',
  translate: '0 -50%',
  color: 'muted.foreground',
})

// Bare `rounded` is Tailwind's inlined 0.25rem, not a radius token.
const searchKbd = css({
  pointerEvents: 'none',
  position: 'absolute',
  right: '3',
  top: '50%',
  display: 'none',
  translate: '0 -50%',
  rounded: '0.25rem',
  borderWidth: '1px',
  borderColor: 'border/60',
  px: '1.5',
  py: '0.5',
  fontFamily: 'mono',
  fontSize: '9px',
  color: 'muted.foreground',
  sm: { display: 'block' },
})

const desktopRow = css({
  pointerEvents: 'auto',
  display: 'none',
  alignItems: 'center',
  gap: '1.5',
  lg: { display: 'flex' },
})

const searchResults = css({
  position: 'absolute',
  left: '0',
  right: '0',
  top: 'calc(100% + 0.4rem)',
  maxH: '72',
  overflowY: 'auto',
  rounded: 'frame',
  borderWidth: '1px',
  borderColor: 'border/60',
  bg: 'card',
  p: '1.5',
  shadow: 'overlay',
})

const searchEmpty = css({
  px: '3',
  py: '4',
  textAlign: 'center',
  textStyle: 'xs',
  color: 'muted.foreground',
})

const searchOption = css({
  display: 'flex',
  minH: '11',
  w: 'full',
  alignItems: 'center',
  gap: '3',
  rounded: 'control',
  px: '3',
  py: '2',
  textAlign: 'left',
  _hover: { bg: 'surface.1' },
  _focusVisible: {
    outlineStyle: 'none',
    boxShadow: '0 0 0 2px color-mix(in srgb, {colors.ring} 70%, transparent)',
  },
})

const searchDot = cva({
  base: { boxSize: '1.5', flexShrink: '0', rounded: 'full' },
  variants: {
    first: {
      true: { bg: 'primary' },
      false: { bg: 'muted.foreground/45' },
    },
  },
})

const pinnedBar = css({
  position: 'absolute',
  bottom: '16',
  left: '3',
  zIndex: '20',
  display: 'none',
  maxW: '60%',
  alignItems: 'center',
  gap: '1.5',
  rounded: 'control',
  borderWidth: '1px',
  borderColor: 'border/60',
  bg: 'card/88',
  p: '1.5',
  shadow: 'floating',
  backdropFilter: 'blur(8px)',
  lg: { display: 'flex' },
})

const pinnedChip = css({
  maxW: '40',
  truncate: true,
  rounded: 'control',
  px: '2',
  py: '1',
  textStyle: 'xs',
  color: 'muted.foreground',
  _hover: { bg: 'surface.2', color: 'foreground' },
})

const pinnedTrace = css({
  display: 'inline-flex',
  minH: '8',
  alignItems: 'center',
  gap: '1.5',
  rounded: 'control',
  bg: 'primary/12',
  px: '2',
  textStyle: 'xs',
  color: 'primary',
})

const bottomBar = css({
  pointerEvents: 'none',
  position: 'absolute',
  insetX: '3',
  bottom: '3',
  zIndex: '20',
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  gap: '3',
  lg: { insetX: '5', bottom: '5' },
})

const originBox = css({
  pointerEvents: 'auto',
  rounded: 'control',
  borderWidth: '1px',
  borderColor: 'border/50',
  bg: 'card/80',
  px: '2.5',
  py: '1.5',
  shadow: 'floating',
  backdropFilter: 'blur(8px)',
})

const bottomActions = cva({
  base: { pointerEvents: 'auto', alignItems: 'center', gap: '1.5' },
  variants: {
    immersive: {
      true: { display: 'none' },
      false: { display: 'flex' },
    },
  },
})

const twoColumnGrid = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '2',
})

const threeColumnGrid = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: '2',
})

// Tailwind's `space-y-*` put the margin on every child but the last; the
// children here are inline-block buttons, so the rule is kept verbatim.
const stackedButtons = cva({
  base: {},
  variants: {
    gap: {
      '1': { '& > :not(:last-child)': { marginBlockEnd: '1' } },
      '2': { '& > :not(:last-child)': { marginBlockEnd: '2' } },
    },
  },
})

const relationsSummary = css({
  cursor: 'pointer',
  textStyle: 'xs',
  fontWeight: 'medium',
  color: 'foreground',
})

const pinnedRow = css({
  minH: '11',
  w: 'full',
  rounded: 'control',
  px: '3',
  textAlign: 'left',
  textStyle: 'sm',
  color: 'muted.foreground',
  _hover: { bg: 'surface.1', color: 'foreground' },
})

const sectionHeading = css({
  mb: '2',
  display: 'flex',
  alignItems: 'center',
  gap: '2',
})

const toggleButton = cva({
  base: {
    minH: '11',
    rounded: 'control',
    borderWidth: '1px',
    px: '3',
    py: '2',
    textStyle: 'xs',
    transitionProperty: 'colors',
    transitionDuration: '150ms',
    transitionTimingFunction: 'default',
    _disabled: { cursor: 'not-allowed', opacity: '0.45' },
  },
  variants: {
    active: {
      true: { borderColor: 'primary/45', bg: 'primary/12', color: 'primary' },
      false: {
        borderColor: 'border/60',
        bg: 'surface.1',
        color: 'muted.foreground',
        _hover: { color: 'foreground' },
      },
    },
    full: { true: { w: 'full', textAlign: 'left' } },
  },
})

// Canvas placeholders share the radial wash of the 3D scene.
const canvasState = cva({
  base: {
    display: 'grid',
    h: 'full',
    placeItems: 'center',
    bgImage: 'radial-gradient(circle at 50% 42%, {colors.surface.2}, {colors.background} 62%)',
  },
  variants: {
    kind: {
      empty: { px: '6', textAlign: 'center' },
      loading: { textStyle: 'sm', color: 'muted.foreground' },
    },
  },
})

const canvasFallback = css({
  display: 'grid',
  h: 'full',
  placeItems: 'center',
  textStyle: 'sm',
  color: 'muted.foreground',
})

const emptyIcon = css({
  mx: 'auto',
  display: 'grid',
  boxSize: '11',
  placeItems: 'center',
  rounded: 'control',
  borderWidth: '1px',
  borderColor: 'border/60',
  bg: 'card',
  color: 'primary',
})

const emptyAction = css({
  mt: '4',
  minH: '11',
  rounded: 'control',
  borderWidth: '1px',
  borderColor: 'border/60',
  bg: 'card',
  px: '4',
  textStyle: 'sm',
  color: 'foreground',
})

const brandIcon = css({ color: 'primary' })

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
      <section aria-label="Mémoire" className={memoryShell({ immersive: isImmersive })}>
        <styled.div position="relative" h="full" minH="0" w="full" overflow="hidden">
          {view === 'list' ? (
            <div className={listViewport}>
              <div className={listCard}>
                {renderState === 'error' ? (
                  <output className={listNotice}>
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
            <output className={floatingNotice({ kind: 'missing' })}>
              <span>Ce souvenir n’est pas visible avec ces filtres.</span>
              <button type="button" className={underlined} onClick={resetExploration}>
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
            <aside aria-label="Souvenir sélectionné" className={detailsRail}>
              <button
                type="button"
                aria-label="Fermer les détails"
                onClick={() => {
                  setSelectedNode(null)
                  setSelectedLink(null)
                  setDetailsOpen(false)
                }}
                className={iconButton({ placement: 'rail' })}
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
        </styled.div>
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
        <DrawerContent side="bottom" lg={{ display: 'none' }}>
          <DrawerHeader srOnly>
            <DrawerTitle>Souvenir sélectionné</DrawerTitle>
            <DrawerDescription>Détails et relations du souvenir.</DrawerDescription>
          </DrawerHeader>
          <styled.div maxH="72dvh" overflowY="auto" px="3" pb="3">
            {selectionContent}
          </styled.div>
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
    <div className={topBar}>
      <div className={mobileRow}>
        {!isImmersive ? (
          <Chip tint="strong" target="regular" inline pointerEvents="auto" gap="2">
            <ChartNetworkPixelIcon size={14} className={brandIcon} />
            <styled.span textStyle="sm" fontWeight="semibold">
              Mémoire
            </styled.span>
            <span className={monoLabel({ size: '10px' })}>{visibleCount}</span>
          </Chip>
        ) : null}
        {isImmersive ? (
          <ChipButton
            type="button"
            onClick={onExitImmersive}
            tint="strong"
            target="touch"
            inline
            text="mono"
            quiet
            pointerEvents="auto"
            ml="auto"
          >
            Échap pour quitter
          </ChipButton>
        ) : (
          <ChipButton
            type="button"
            aria-haspopup="dialog"
            aria-expanded={false}
            onClick={onOpenControls}
            tint="strong"
            target="touch"
            inline
            text="xs"
            quiet
            pointerEvents="auto"
            ml="auto"
            gap="2"
          >
            <FilterPixelIcon size={13} />
            Filtres
          </ChipButton>
        )}
      </div>

      <div className={searchRow}>
        <form onSubmit={onSearchSubmit} className={searchForm}>
          <SearchPixelIcon size={14} className={searchIcon} />
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
            h="11"
            bg="card/90"
            _dark={{ bg: 'card/90' }}
            pl="9"
            pr="9"
            shadow="floating"
            backdropFilter="blur(8px)"
          />
          <kbd className={searchKbd}>/</kbd>
          {searchOpen && searchTerm.trim() ? (
            <MemorySearchResults results={searchResults} onSelect={onSearchSelection} />
          ) : null}
        </form>

        <div className={desktopRow}>
          {!isImmersive ? (
            <>
              {PRIMARY_LENSES.map(item => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={item.id === lensId}
                  onClick={() => onLensChange(item.id)}
                  className={lensButton({ active: item.id === lensId })}
                >
                  {item.label}
                </button>
              ))}
              <ChipButton
                type="button"
                aria-haspopup="dialog"
                onClick={onOpenControls}
                tint="flat"
                target="compact"
                text="xs"
                quiet
              >
                Plus
              </ChipButton>
            </>
          ) : null}
          {isImmersive ? (
            <ChipButton
              type="button"
              onClick={onExitImmersive}
              tint="strong"
              target="touch"
              text="mono"
              quiet
              position="fixed"
              right="3"
              top="3"
              lg={{ position: 'static', ml: '2', minH: '9', bg: 'card/82' }}
            >
              Échap pour quitter
            </ChipButton>
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
    <div id="memory-search-results" className={searchResults}>
      {results.length === 0 ? (
        <p className={searchEmpty}>Aucun souvenir trouvé.</p>
      ) : (
        <div role="listbox" aria-label="Résultats de la recherche">
          {results.slice(0, 8).map((node, index) => (
            <button
              key={node.id}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => onSelect(node)}
              className={searchOption}
            >
              <span aria-hidden="true" className={searchDot({ first: index === 0 })} />
              <styled.span minW="0" flex="1" truncate textStyle="sm" color="foreground">
                {node.label}
              </styled.span>
              <span className={monoLabel({ size: '9px', tracking: 'snug' })}>
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
        <div className={pinnedBar}>
          {pinnedNodes.slice(0, 3).map(node => (
            <button
              key={node.id}
              type="button"
              onClick={() => onSelectPin(node.id)}
              className={pinnedChip}
            >
              {node.label}
            </button>
          ))}
          {pinnedNodes.length >= 2 ? (
            <button type="button" onClick={onTracePins} className={pinnedTrace}>
              <BranchPixelIcon size={11} />
              Relier
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Effacer les épingles"
            onClick={onClearPins}
            className={iconButton({ placement: 'inline' })}
          >
            <TimesPixelIcon size={11} />
          </button>
        </div>
      ) : null}

      <div className={bottomBar}>
        <div className={originBox} title={originDescription}>
          <p className={monoLabel({ size: '9px', tracking: 'normal' })}>
            {visibleCount} {visibleCount === 1 ? 'souvenir' : 'souvenirs'}
          </p>
          <styled.p mt="0.5" fontSize="10px" color="muted.foreground">
            {originLabel}
          </styled.p>
        </div>

        <div className={bottomActions({ immersive: isImmersive })}>
          <ChipButton
            type="button"
            onClick={onToggleView}
            disabled={view === 'list' && renderState === 'error'}
            tint="medium"
            target="regular"
            inline
            text="xs"
            quiet
            gap="1.5"
            _disabled={{ cursor: 'not-allowed', opacity: '0.5' }}
          >
            {view === 'graph' ? <TablePixelIcon size={12} /> : <ChartNetworkPixelIcon size={12} />}
            {view === 'graph' ? 'Liste' : 'Carte 3D'}
          </ChipButton>
          {view === 'graph' ? (
            <ChipButton
              type="button"
              onClick={onResetView}
              tint="medium"
              target="regular"
              text="xs"
              quiet
              display="none"
              sm={{ display: 'block' }}
            >
              Ajuster la vue
            </ChipButton>
          ) : null}
          {!isImmersive ? (
            <ChipButton
              ref={immersiveTriggerRef}
              type="button"
              onClick={onEnterImmersive}
              tint="medium"
              target="regular"
              text="xs"
              quiet
              display="none"
              lg={{ display: 'block' }}
            >
              Immersif
            </ChipButton>
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
      : 'Aucun chemin avec ces filtres.'

  return (
    <output className={floatingNotice({ kind: 'path' })}>
      <BranchPixelIcon size={12} className={brandIcon} />
      <span>{message}</span>
      <button type="button" onClick={onClear} className={quietLink}>
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
        <DrawerHeader borderBottomWidth="1px" borderColor="border/60">
          <DrawerTitle>Explorer la mémoire</DrawerTitle>
          <DrawerDescription>
            Choisis une vue ou réduis la carte aux souvenirs utiles.
          </DrawerDescription>
        </DrawerHeader>

        <styled.div spaceY="6" px="5" pb="6" pt="3">
          <ControlSection title="Vues" icon={<GridPixelIcon size={13} />}>
            <div className={twoColumnGrid}>
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
            <div className={stackedButtons({ gap: '2' })}>
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
            <div className={twoColumnGrid}>
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
            <styled.div display="flex" flexWrap="wrap" gap="2">
              {ALL_NODE_KINDS.filter(kind => nodeKindsPresent.has(kind)).map(kind => (
                <ToggleButton
                  key={kind}
                  active={visibleNodeKinds.has(kind)}
                  onClick={() => onToggleNodeKind(kind)}
                >
                  {NODE_KIND_LABEL[kind]}
                </ToggleButton>
              ))}
            </styled.div>
          </ControlSection>

          <styled.details
            rounded="frame"
            borderWidth="1px"
            borderColor="border/60"
            bg="surface.1/55"
            p="3"
          >
            <summary className={relationsSummary}>Types de relations</summary>
            <styled.div mt="3" display="flex" flexWrap="wrap" gap="2">
              {ALL_LINK_KINDS.filter(kind => linkKindsPresent.has(kind)).map(kind => (
                <ToggleButton
                  key={kind}
                  active={visibleLinkKinds.has(kind)}
                  onClick={() => onToggleLinkKind(kind)}
                >
                  {LINK_KIND_LABEL[kind]}
                </ToggleButton>
              ))}
            </styled.div>
          </styled.details>

          {pinnedNodes.length > 0 ? (
            <ControlSection title="Épingles" icon={<BranchPixelIcon size={13} />}>
              <div className={stackedButtons({ gap: '1' })}>
                {pinnedNodes.map(node => (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => onSelectPin(node.id)}
                    className={pinnedRow}
                  >
                    {node.label}
                  </button>
                ))}
              </div>
              <styled.div mt="2" display="flex" gap="2">
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
              </styled.div>
            </ControlSection>
          ) : null}

          {isAdmin ? (
            <ControlSection title="Exemples de démonstration">
              <styled.p mb="3" fontSize="xs" lineHeight="relaxed" color="muted.foreground">
                Les exemples sont toujours signalés et ne deviennent jamais des souvenirs réels.
              </styled.p>
              <styled.div display="flex" flexWrap="wrap" gap="2">
                <ToggleButton active={previewExamples} onClick={onTogglePreview}>
                  {previewExamples ? 'Masquer les exemples' : 'Ajouter des exemples'}
                </ToggleButton>
                {previewExamples ? (
                  <ToggleButton active={hideExamples} onClick={onToggleHideExamples}>
                    Données personnelles seules
                  </ToggleButton>
                ) : null}
              </styled.div>
            </ControlSection>
          ) : null}

          <ControlSection title="Affichage" icon={<RefreshPixelIcon size={13} />}>
            <div className={threeColumnGrid}>
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
              <styled.p mt="2" textStyle="xs" color="muted.foreground">
                Le rendu léger est activé pour respecter le mouvement réduit.
              </styled.p>
            ) : null}
            <div className={cx(threeColumnGrid, css({ mt: '3' }))}>
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
        </styled.div>
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
      <h2 className={cx(sectionHeading, monoLabel({ size: '10px', tracking: 'wide' }))}>
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
      className={toggleButton({ active, full })}
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
    <div className={canvasState({ kind: 'empty' })}>
      <styled.div maxW="sm">
        <span className={emptyIcon}>
          <ChartNetworkPixelIcon size={18} />
        </span>
        <styled.h1 mt="4" textStyle="lg" fontWeight="semibold" color="foreground">
          {pending ? 'Chargement de la mémoire' : 'Aucun souvenir avec ces filtres'}
        </styled.h1>
        <styled.p mt="2" fontSize="sm" lineHeight="relaxed" color="muted.foreground">
          {message}
        </styled.p>
        {!pending ? (
          <button type="button" onClick={onOpenList} className={emptyAction}>
            Ouvrir la liste
          </button>
        ) : null}
      </styled.div>
    </div>
  )
}

function MemoryGraphLoading() {
  return <output className={canvasState({ kind: 'loading' })}>Préparation de la carte 3D</output>
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
      return <output className={canvasFallback}>La vue 3D est indisponible.</output>
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
