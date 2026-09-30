import { css } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
import { type Token, token } from '@finance-os/styled-system/tokens'
import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  AdvisorGraph,
  AdvisorGraphLink,
  AdvisorGraphLinkKind,
  AdvisorGraphNodeKind,
} from '@/features/advisor-graph-data'
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion'
import {
  buildRuntimeGraphData,
  DEFAULT_KNOWLEDGE_GRAPH_PALETTE,
  type KnowledgeGraphPalette,
  type KnowledgeGraphPreset,
} from './knowledge-graph-3d-model'
import type {
  KnowledgeGraphRuntime,
  KnowledgeGraphRuntimeUpdate,
} from './knowledge-graph-3d-runtime'

const EMPTY_STRING_SET: ReadonlySet<string> = new Set()
const EMPTY_NODE_KIND_SET: ReadonlySet<AdvisorGraphNodeKind> = new Set()

export type KnowledgeGraphRenderState = 'idle' | 'loading' | 'ready' | 'error'

export interface KnowledgeGraph3DProps {
  graph: AdvisorGraph
  selectedNodeId: string | null
  onSelectNode: (id: string | null) => void
  onSelectLink: (link: AdvisorGraphLink | null) => void
  highlightedNodeIds: Set<string>
  visibleNodeKinds: Set<AdvisorGraphNodeKind>
  visibleLinkKinds: Set<AdvisorGraphLinkKind>
  paused: boolean
  /** Ids that should glow as the active path. */
  pathLinkKeys?: Set<string>
  pathNodeIds?: Set<string>
  /** Pinned node ids rendered with a persistent outer ring. */
  pinnedNodeIds?: Set<string>
  /** Node kinds emphasized by the active lens. */
  emphasizedKinds?: Set<AdvisorGraphNodeKind>
  preset?: KnowledgeGraphPreset
  /** Slowly orbit only after the simulation and user interaction are idle. */
  autoOrbit?: boolean
  registerCameraApi?: (api: CameraApi | null) => void
  /** Optional integration seam for route-level WebGL fallback telemetry/UI. */
  onRenderStateChange?: (state: KnowledgeGraphRenderState) => void
  onRenderError?: (error: Error) => void
  /** Compatibility shorthand for opening an accessible fallback surface. */
  onWebGlFailure?: () => void
}

export interface CameraApi {
  resetView: () => void
  fitView: () => void
  focusNode: (id: string) => void
  reheat: () => void
}

interface CanvasSize {
  width: number
  height: number
}

// The WebGL scene needs resolved colors: the palette reads Panda's semantic
// color variables from <html> so it follows the `.dark` class like the DOM does.
const PALETTE_TOKENS: Readonly<Record<keyof KnowledgeGraphPalette, Token>> = {
  background: 'colors.background',
  surface: 'colors.surface.1',
  foreground: 'colors.foreground',
  mutedForeground: 'colors.muted.foreground',
  primary: 'colors.primary',
  positive: 'colors.positive',
  negative: 'colors.negative',
  warning: 'colors.warning',
  teal: 'colors.teal',
  warmAccent: 'colors.warmAccent',
  ai: 'colors.ai',
}

// `token.var('colors.primary')` is `var(--colors-primary)`; getPropertyValue wants
// the bare custom property name.
function toCustomPropertyName(reference: string): string {
  return reference.startsWith('var(') ? reference.slice('var('.length, -1) : reference
}

function readTokenValue(style: CSSStyleDeclaration, path: Token, fallback: string): string {
  const value = style.getPropertyValue(toCustomPropertyName(token.var(path))).trim()
  return value.length > 0 ? value : fallback
}

function readKnowledgeGraphPalette(): KnowledgeGraphPalette {
  if (typeof document === 'undefined') return DEFAULT_KNOWLEDGE_GRAPH_PALETTE
  const style = getComputedStyle(document.documentElement)
  const fallback = DEFAULT_KNOWLEDGE_GRAPH_PALETTE
  return {
    background: readTokenValue(style, PALETTE_TOKENS.background, fallback.background),
    surface: readTokenValue(style, PALETTE_TOKENS.surface, fallback.surface),
    foreground: readTokenValue(style, PALETTE_TOKENS.foreground, fallback.foreground),
    mutedForeground: readTokenValue(
      style,
      PALETTE_TOKENS.mutedForeground,
      fallback.mutedForeground
    ),
    primary: readTokenValue(style, PALETTE_TOKENS.primary, fallback.primary),
    positive: readTokenValue(style, PALETTE_TOKENS.positive, fallback.positive),
    negative: readTokenValue(style, PALETTE_TOKENS.negative, fallback.negative),
    warning: readTokenValue(style, PALETTE_TOKENS.warning, fallback.warning),
    teal: readTokenValue(style, PALETTE_TOKENS.teal, fallback.teal),
    warmAccent: readTokenValue(style, PALETTE_TOKENS.warmAccent, fallback.warmAccent),
    ai: readTokenValue(style, PALETTE_TOKENS.ai, fallback.ai),
  }
}

function palettesMatch(left: KnowledgeGraphPalette, right: KnowledgeGraphPalette): boolean {
  return (
    left.background === right.background &&
    left.surface === right.surface &&
    left.foreground === right.foreground &&
    left.mutedForeground === right.mutedForeground &&
    left.primary === right.primary &&
    left.positive === right.positive &&
    left.negative === right.negative &&
    left.warning === right.warning &&
    left.teal === right.teal &&
    left.warmAccent === right.warmAccent &&
    left.ai === right.ai
  )
}

function useKnowledgeGraphPalette(): KnowledgeGraphPalette {
  const [palette, setPalette] = useState(DEFAULT_KNOWLEDGE_GRAPH_PALETTE)

  useEffect(() => {
    const update = () => {
      const next = readKnowledgeGraphPalette()
      setPalette(current => (palettesMatch(current, next) ? current : next))
    }
    update()

    if (typeof MutationObserver === 'undefined') return
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style'],
    })
    return () => observer.disconnect()
  }, [])

  return palette
}

const statusOverlay = css({
  position: 'absolute',
  inset: '0',
  zIndex: '10',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  p: '8',
  textAlign: 'center',
})

const sceneFrame = css({
  position: 'relative',
  h: 'full',
  w: 'full',
  overflow: 'hidden',
  rounded: 'frame',
  borderWidth: '1px',
  borderColor: 'border/60',
  bg: 'surface.0',
})

const visuallyHidden = css({ srOnly: true })

// Scene washes: inline `style` keeps the gradients next to the runtime canvas,
// with the colors resolved through Panda's token variables.
const SCENE_BACKGROUND = `radial-gradient(ellipse at center, ${token('colors.surface.1')} 0%, ${token('colors.surface.0')} 72%)`
const SCENE_GLOW = `radial-gradient(circle at 30% 20%, color-mix(in srgb, ${token('colors.primary')} 12%, transparent) 0%, transparent 45%), radial-gradient(circle at 75% 80%, color-mix(in srgb, ${token('colors.teal')} 10%, transparent) 0%, transparent 52%)`
const SCENE_GRID = `radial-gradient(color-mix(in srgb, ${token('colors.foreground')} 16%, transparent) 0.5px, transparent 0.5px), radial-gradient(color-mix(in srgb, ${token('colors.foreground')} 10%, transparent) 0.5px, transparent 0.5px)`

function renderStatus(message: string) {
  return (
    <div className={statusOverlay} aria-live="polite">
      <styled.p maxW="md" fontSize="sm" lineHeight="relaxed" color="muted.foreground">
        {message}
      </styled.p>
    </div>
  )
}

export function KnowledgeGraph3D({
  graph,
  selectedNodeId,
  onSelectNode,
  onSelectLink,
  highlightedNodeIds,
  visibleNodeKinds,
  visibleLinkKinds,
  paused,
  pathLinkKeys,
  pathNodeIds,
  pinnedNodeIds,
  emphasizedKinds,
  preset = 'standard',
  autoOrbit = false,
  registerCameraApi,
  onRenderStateChange,
  onRenderError,
  onWebGlFailure,
}: KnowledgeGraph3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mountRef = useRef<HTMLDivElement | null>(null)
  const runtimeRef = useRef<KnowledgeGraphRuntime | null>(null)
  const callbacksRef = useRef({
    onSelectNode,
    onSelectLink,
    onRenderStateChange,
    onRenderError,
    onWebGlFailure,
  })
  callbacksRef.current = {
    onSelectNode,
    onSelectLink,
    onRenderStateChange,
    onRenderError,
    onWebGlFailure,
  }

  const [runtime, setRuntime] = useState<KnowledgeGraphRuntime | null>(null)
  const [renderState, setRenderState] = useState<KnowledgeGraphRenderState>('idle')
  const [size, setSize] = useState<CanvasSize>({ width: 0, height: 0 })
  const reducedMotion = usePrefersReducedMotion()
  const palette = useKnowledgeGraphPalette()

  const runtimeGraph = useMemo(
    () => buildRuntimeGraphData(graph, visibleNodeKinds, visibleLinkKinds),
    [graph, visibleNodeKinds, visibleLinkKinds]
  )
  const hasNodes = runtimeGraph.nodes.length > 0

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const updateSize = (width: number, height: number) => {
      const next = {
        width: Math.max(0, Math.floor(width)),
        height: Math.max(0, Math.floor(height)),
      }
      setSize(current =>
        current.width === next.width && current.height === next.height ? current : next
      )
    }
    const measure = () => updateSize(element.clientWidth, element.clientHeight)
    measure()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }

    const observer = new ResizeObserver(entries => {
      const entry = entries[0]
      if (entry) updateSize(entry.contentRect.width, entry.contentRect.height)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!hasNodes) {
      setRenderState('idle')
      callbacksRef.current.onRenderStateChange?.('idle')
      return
    }

    const element = mountRef.current
    if (!element) return
    let cancelled = false
    let ownedRuntime: KnowledgeGraphRuntime | null = null

    const reportState = (state: KnowledgeGraphRenderState) => {
      if (cancelled) return
      setRenderState(state)
      callbacksRef.current.onRenderStateChange?.(state)
    }
    const reportError = (error: Error) => {
      if (cancelled) return
      runtimeRef.current = null
      setRuntime(null)
      callbacksRef.current.onRenderError?.(error)
      callbacksRef.current.onWebGlFailure?.()
      reportState('error')
    }

    reportState('loading')
    void import('./knowledge-graph-3d-runtime')
      .then(({ createKnowledgeGraphRuntime }) => {
        if (cancelled) return
        const created = createKnowledgeGraphRuntime(element, {
          onSelectNode: id => callbacksRef.current.onSelectNode(id),
          onSelectLink: link => callbacksRef.current.onSelectLink(link),
          onError: reportError,
        })
        if (cancelled) {
          created.destroy()
          return
        }
        ownedRuntime = created
        runtimeRef.current = created
        setRuntime(created)
        reportState('ready')
      })
      .catch(error => {
        reportError(error instanceof Error ? error : new Error('Le rendu 3D est indisponible.'))
      })

    return () => {
      cancelled = true
      ownedRuntime?.destroy()
      if (runtimeRef.current === ownedRuntime) runtimeRef.current = null
    }
  }, [hasNodes])

  useEffect(() => {
    if (!runtime) return
    const update: KnowledgeGraphRuntimeUpdate = {
      graph: runtimeGraph,
      selectedNodeId,
      highlightedNodeIds,
      pathLinkKeys: pathLinkKeys ?? EMPTY_STRING_SET,
      pathNodeIds: pathNodeIds ?? EMPTY_STRING_SET,
      pinnedNodeIds: pinnedNodeIds ?? EMPTY_STRING_SET,
      emphasizedKinds: emphasizedKinds ?? EMPTY_NODE_KIND_SET,
      preset,
      autoOrbit,
      reducedMotion,
      paused,
      mobile: size.width > 0 && size.width < 640,
      width: size.width,
      height: size.height,
      devicePixelRatio:
        typeof window === 'undefined' || !Number.isFinite(window.devicePixelRatio)
          ? 1
          : window.devicePixelRatio,
      palette,
    }
    runtime.update(update)
  }, [
    runtime,
    runtimeGraph,
    selectedNodeId,
    highlightedNodeIds,
    pathLinkKeys,
    pathNodeIds,
    pinnedNodeIds,
    emphasizedKinds,
    preset,
    autoOrbit,
    reducedMotion,
    paused,
    size,
    palette,
  ])

  useEffect(() => {
    if (!registerCameraApi) return
    if (!runtime) {
      registerCameraApi(null)
      return
    }
    const api: CameraApi = {
      resetView: () => runtime.resetView(),
      fitView: () => runtime.fitView(),
      focusNode: id => runtime.focusNode(id),
      reheat: () => runtime.reheat(),
    }
    registerCameraApi(api)
    return () => registerCameraApi(null)
  }, [registerCameraApi, runtime])

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={'Carte interactive de la m\u00e9moire financi\u00e8re'}
      data-render-state={renderState}
      className={sceneFrame}
      style={{ backgroundImage: SCENE_BACKGROUND }}
    >
      <styled.div
        pointerEvents="none"
        position="absolute"
        inset="0"
        style={{ backgroundImage: SCENE_GLOW }}
      />
      <styled.div
        pointerEvents="none"
        position="absolute"
        inset="0"
        opacity="0.4"
        style={{
          backgroundImage: SCENE_GRID,
          backgroundPosition: '0 0, 45px 45px',
          backgroundSize: '90px 90px, 160px 160px',
        }}
      />
      <styled.div ref={mountRef} position="absolute" inset="0" />

      {!hasNodes
        ? renderStatus('Aucun souvenir ne correspond aux filtres actuels.')
        : renderState === 'loading'
          ? renderStatus('Pr\u00e9paration de la m\u00e9moire 3D.')
          : renderState === 'error'
            ? renderStatus(
                'La vue 3D est indisponible. La m\u00e9moire reste accessible dans la liste.'
              )
            : null}
      {renderState === 'ready' ? (
        <span className={visuallyHidden}>{'La carte 3D est pr\u00eate.'}</span>
      ) : null}
    </div>
  )
}

export default KnowledgeGraph3D
