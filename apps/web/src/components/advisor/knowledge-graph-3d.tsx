/**
 * KnowledgeGraph3D — V2 immersive 3D force-directed view of the Advisor
 * memory graph. Strictly client-side: the underlying ForceGraph3D pulls
 * three.js + WebGL state at module load, so the library is dynamically
 * imported at mount.
 *
 * V2 visual identity: Memory Atlas + Neural Constellation hybrid.
 *   - default sphere drives base color/opacity (reactive to selection);
 *   - additive `nodeThreeObject` decorates each node with halos, rings,
 *     icon-like geometries (octahedron for recommendations, torus for
 *     personal nodes, dashed ring for example nodes);
 *   - selection adds a transparent outer halo;
 *   - paths are highlighted with stronger link width + bright color;
 *   - performance mode strips particles, labels, and detail.
 *
 * Data shaping and demo fixtures live in `@/features/advisor-graph-data`.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import {
  type AdvisorGraph,
  type AdvisorGraphLink,
  type AdvisorGraphLinkKind,
  type AdvisorGraphNode,
  type AdvisorGraphNodeKind,
  LINK_KIND_COLOR,
  LINK_KIND_LABEL,
  NEGATIVE_LINK_KINDS,
  NODE_KIND_COLOR,
  NODE_KIND_LABEL,
  POSITIVE_LINK_KINDS,
  linkKey as linkKeyOf,
} from '@/features/advisor-graph-data'

type ForceGraphInstance = {
  cameraPosition: (
    pos: { x: number; y: number; z: number },
    lookAt?: { x: number; y: number; z: number },
    duration?: number
  ) => void
  zoomToFit: (durationMs?: number, padding?: number) => void
  pauseAnimation: () => void
  resumeAnimation: () => void
  d3ReheatSimulation: () => void
}

interface KnowledgeGraph3DProps {
  graph: AdvisorGraph
  selectedNodeId: string | null
  onSelectNode: (id: string | null) => void
  onSelectLink: (link: AdvisorGraphLink | null) => void
  highlightedNodeIds: Set<string>
  visibleNodeKinds: Set<AdvisorGraphNodeKind>
  visibleLinkKinds: Set<AdvisorGraphLinkKind>
  paused: boolean
  /** Ids that should glow as the active path (BFS result). */
  pathLinkKeys?: Set<string>
  pathNodeIds?: Set<string>
  /** Pinned node ids — rendered with a persistent outer ring. */
  pinnedNodeIds?: Set<string>
  /**
   * Emphasized node kinds (lens emphasis). Non-emphasized kinds are
   * rendered with reduced opacity but still visible/interactive.
   */
  emphasizedKinds?: Set<AdvisorGraphNodeKind>
  /** Performance preset — drives particles, resolution, cooldown. */
  preset?: 'cinematic' | 'standard' | 'performance'
  /** When true, slowly orbit the camera around the graph center while idle. */
  autoOrbit?: boolean
  /** Imperative handle to expose camera controls to parent. */
  registerCameraApi?: (api: CameraApi | null) => void
}

export interface CameraApi {
  resetView: () => void
  fitView: () => void
  focusNode: (id: string) => void
  reheat: () => void
}

// Internal node/link types extending the public ones with simulation
// fields written by the force engine.
interface SimNode extends AdvisorGraphNode {
  x?: number
  y?: number
  z?: number
}

interface SimLink extends Omit<AdvisorGraphLink, 'source' | 'target'> {
  source: SimNode | string
  target: SimNode | string
}

const HIGHLIGHT_COLOR = '#fef3c7'
const NEUTRAL_LINK_COLOR = 'rgba(148, 163, 184, 0.18)'
const PATH_LINK_COLOR = 'rgba(254, 243, 199, 0.92)'
const FOCUS_LINK_BOOST = 1.6
const PATH_LINK_BOOST = 2.4

// ─── shared three.js geometries (built once, reused across all nodes) ────
//
// Three.js is SSR-safe at module load (no window access). Geometries are
// cheap and reusing them across all nodes keeps the GPU footprint small.
const GEOM_HALO = new THREE.SphereGeometry(1, 18, 14)
const GEOM_RECO_OCTA = new THREE.OctahedronGeometry(1, 0)
const GEOM_RISK_TETRA = new THREE.TetrahedronGeometry(1, 0)
const GEOM_SOURCE_DISC = new THREE.CircleGeometry(1, 24)
const GEOM_RING = new THREE.TorusGeometry(1, 0.04, 8, 36)
const GEOM_RING_THICK = new THREE.TorusGeometry(1, 0.08, 10, 40)
const GEOM_DASH_DOT = new THREE.SphereGeometry(0.06, 6, 6)

const HEX_COLOR_CACHE = new Map<string, THREE.Color>()
const colorOf = (hex: string): THREE.Color => {
  let c = HEX_COLOR_CACHE.get(hex)
  if (!c) {
    c = new THREE.Color(hex)
    HEX_COLOR_CACHE.set(hex, c)
  }
  return c
}

/**
 * Build the additive decoration Object3D for a node. The default sphere
 * (driven by nodeColor/nodeOpacity) is preserved underneath.
 *
 * Decorations are deliberately small and non-animated to keep cost flat.
 * The "Neural Constellation" feel comes from the combination of the
 * default emissive sphere + halo + occasional iconic geometry.
 */
function buildNodeDecoration(node: AdvisorGraphNode): THREE.Object3D {
  const group = new THREE.Group()
  const baseHex = NODE_KIND_COLOR[node.kind] ?? NODE_KIND_COLOR.unknown
  const color = colorOf(baseHex)
  const importance = node.importance ?? 0.4
  const isExample = node.isExample === true

  // Outer translucent halo — sized by importance. Adds depth without
  // requiring postprocessing bloom.
  const haloRadius = (4 + importance * 14) * (isExample ? 0.5 : 0.85)
  const haloMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: isExample ? 0.06 : 0.1,
    depthWrite: false,
  })
  const halo = new THREE.Mesh(GEOM_HALO, haloMat)
  halo.scale.setScalar(haloRadius * 1.7)
  halo.userData['fos:role'] = 'halo'
  group.add(halo)

  // Personal nodes get a subtle equatorial ring — like a planet.
  if (node.isPersonal === true) {
    const ringMat = new THREE.MeshBasicMaterial({
      color: colorOf('#34d399'),
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    })
    const ring = new THREE.Mesh(GEOM_RING, ringMat)
    ring.scale.setScalar(haloRadius * 1.05)
    ring.rotation.x = Math.PI / 2
    group.add(ring)
  }

  // Contradicted nodes get a thin warning ring.
  if (node.isContradicted === true) {
    const ringMat = new THREE.MeshBasicMaterial({
      color: colorOf('#f97316'),
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    })
    const ring = new THREE.Mesh(GEOM_RING_THICK, ringMat)
    ring.scale.setScalar(haloRadius * 1.15)
    ring.rotation.x = Math.PI / 3
    group.add(ring)
  }

  // Iconic geometries on top of the default sphere convey the kind.
  // We attach a thin, semi-transparent overlay so the default sphere's
  // selection-driven color still reads through.
  let iconicGeom: THREE.BufferGeometry | null = null
  let iconicScale = haloRadius * 0.7
  let iconicOpacity = 0.45
  if (node.kind === 'recommendation') {
    iconicGeom = GEOM_RECO_OCTA
    iconicScale = haloRadius * 0.85
    iconicOpacity = 0.55
  } else if (node.kind === 'risk' || node.kind === 'contradiction') {
    iconicGeom = GEOM_RISK_TETRA
    iconicScale = haloRadius * 0.9
    iconicOpacity = 0.55
  } else if (node.kind === 'source') {
    iconicGeom = GEOM_SOURCE_DISC
    iconicScale = haloRadius * 0.9
    iconicOpacity = 0.4
  }
  if (iconicGeom) {
    const iconicMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: iconicOpacity,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    const iconic = new THREE.Mesh(iconicGeom, iconicMat)
    iconic.scale.setScalar(iconicScale)
    group.add(iconic)
  }

  // Example nodes get a dashed-ring effect: a circle of small spheres
  // orbiting the node, with a slate tint so they read as illustrative.
  if (isExample) {
    const dashCount = 12
    const dashRadius = haloRadius * 1.25
    const dashMat = new THREE.MeshBasicMaterial({
      color: colorOf('#fbbf24'),
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    })
    for (let i = 0; i < dashCount; i++) {
      const angle = (i / dashCount) * Math.PI * 2
      const dot = new THREE.Mesh(GEOM_DASH_DOT, dashMat)
      dot.position.set(Math.cos(angle) * dashRadius, Math.sin(angle) * dashRadius, 0)
      dot.scale.setScalar(haloRadius * 0.18)
      group.add(dot)
    }
  }

  return group
}

/** Cache of decoration objects keyed by node identity, plus a key that
 * captures all the visual flags the decoration depends on. When a flag
 * changes (e.g. isExample toggled), the cache entry is invalidated.
 */
const buildDecorationKey = (node: AdvisorGraphNode): string =>
  [
    node.id,
    node.kind,
    node.isPersonal === true ? '1' : '0',
    node.isContradicted === true ? '1' : '0',
    node.isExample === true ? '1' : '0',
    Math.round((node.importance ?? 0) * 10),
  ].join('|')

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
}: KnowledgeGraph3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const fgRef = useRef<ForceGraphInstance | null>(null)
  const decorationCacheRef = useRef<Map<string, THREE.Object3D>>(new Map())
  const [ForceGraph3D, setForceGraph3D] = useState<React.ComponentType<
    Record<string, unknown>
  > | null>(null)
  const [size, setSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 })
  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null)
  const [hoverLinkKey, setHoverLinkKey] = useState<string | null>(null)

  // Lazy-load the library only on the client.
  useEffect(() => {
    let alive = true
    import('react-force-graph-3d')
      .then(mod => {
        if (alive) setForceGraph3D(() => mod.default as React.ComponentType<Record<string, unknown>>)
      })
      .catch(() => {
        if (alive) setForceGraph3D(null)
      })
    return () => {
      alive = false
    }
  }, [])

  // Track container size so the canvas fills its parent and reflows on
  // sidebar collapse / window resize without depending on inline styles.
  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        setSize({ width: Math.max(0, Math.floor(width)), height: Math.max(0, Math.floor(height)) })
      }
    })
    observer.observe(el)
    setSize({ width: el.clientWidth, height: el.clientHeight })
    return () => observer.disconnect()
  }, [])

  // Pause / resume the simulation based on prop.
  useEffect(() => {
    if (!fgRef.current) return
    if (paused) fgRef.current.pauseAnimation()
    else fgRef.current.resumeAnimation()
  }, [paused])

  // Filtered graph data. Important: we keep nodes outside filters trimmed
  // and drop dangling links to avoid simulation NaN traps.
  const filtered = useMemo(() => {
    const nodes = graph.nodes.filter(node => visibleNodeKinds.has(node.kind))
    const ids = new Set(nodes.map(n => n.id))
    const links = graph.links.filter(
      link =>
        ids.has(link.source) && ids.has(link.target) && visibleLinkKinds.has(link.kind)
    )
    return { nodes, links }
  }, [graph, visibleNodeKinds, visibleLinkKinds])

  const neighborByNode = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const link of filtered.links) {
      if (!map.has(link.source)) map.set(link.source, new Set())
      if (!map.has(link.target)) map.set(link.target, new Set())
      map.get(link.source)?.add(link.target)
      map.get(link.target)?.add(link.source)
    }
    return map
  }, [filtered.links])

  const focusedIds = useMemo(() => {
    const focus = new Set<string>()
    if (selectedNodeId) {
      focus.add(selectedNodeId)
      const neighbors = neighborByNode.get(selectedNodeId)
      if (neighbors) for (const id of neighbors) focus.add(id)
    }
    if (hoverNodeId) {
      focus.add(hoverNodeId)
      const neighbors = neighborByNode.get(hoverNodeId)
      if (neighbors) for (const id of neighbors) focus.add(id)
    }
    for (const id of highlightedNodeIds) focus.add(id)
    if (pathNodeIds) for (const id of pathNodeIds) focus.add(id)
    return focus
  }, [selectedNodeId, hoverNodeId, neighborByNode, highlightedNodeIds, pathNodeIds])

  const linkKey = (link: SimLink): string => {
    const s = typeof link.source === 'string' ? link.source : link.source.id
    const t = typeof link.target === 'string' ? link.target : link.target.id
    return linkKeyOf({ source: s, target: t, kind: link.kind })
  }

  // Imperative camera API.
  useEffect(() => {
    if (!registerCameraApi) return
    const api: CameraApi = {
      resetView: () => {
        fgRef.current?.cameraPosition({ x: 0, y: 0, z: 360 }, { x: 0, y: 0, z: 0 }, 800)
      },
      fitView: () => {
        fgRef.current?.zoomToFit(800, 80)
      },
      focusNode: (id: string) => {
        const node = filtered.nodes.find(n => n.id === id) as SimNode | undefined
        if (!node || node.x === undefined || node.y === undefined || node.z === undefined) return
        const distance = 80
        const norm = Math.hypot(node.x, node.y, node.z) || 1
        fgRef.current?.cameraPosition(
          {
            x: node.x * (1 + distance / norm),
            y: node.y * (1 + distance / norm),
            z: node.z * (1 + distance / norm),
          },
          { x: node.x, y: node.y, z: node.z },
          900
        )
      },
      reheat: () => fgRef.current?.d3ReheatSimulation(),
    }
    registerCameraApi(api)
    return () => registerCameraApi(null)
  }, [registerCameraApi, filtered.nodes])

  // Idle auto-orbit. Slow rotation around Y axis while no selection / no
  // hover. Suspended in performance mode and when the user is interacting.
  useEffect(() => {
    if (!autoOrbit || !ForceGraph3D || size.width === 0) return
    if (paused || preset === 'performance') return
    if (selectedNodeId !== null || hoverNodeId !== null) return
    let raf = 0
    let angle = 0
    const radius = 360
    const tick = () => {
      angle += 0.0006
      fgRef.current?.cameraPosition(
        {
          x: Math.sin(angle) * radius,
          y: 80,
          z: Math.cos(angle) * radius,
        },
        { x: 0, y: 0, z: 0 },
        // No transition — direct set is enough at this delta.
        0
      )
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [autoOrbit, ForceGraph3D, size.width, paused, preset, selectedNodeId, hoverNodeId])

  // Decoration cache is keyed by a per-node flag digest so stale entries
  // for nodes that no longer exist are simply ignored. The map lives for
  // the component's lifetime (small per-graph footprint) — no need to
  // invalidate on every graph swap.

  const renderEmpty = (message: string) => (
    <div className="flex h-full items-center justify-center p-8 text-center">
      <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{message}</p>
    </div>
  )

  const useParticles = preset !== 'performance'
  const nodeResolution = preset === 'cinematic' ? 18 : preset === 'performance' ? 8 : 14
  const cooldownTicks = preset === 'cinematic' ? 180 : preset === 'performance' ? 90 : 140
  const warmupTicks = preset === 'cinematic' ? 30 : preset === 'performance' ? 10 : 20

  const getDecoration = (node: AdvisorGraphNode): THREE.Object3D => {
    const key = buildDecorationKey(node)
    const cache = decorationCacheRef.current
    let obj = cache.get(key)
    if (!obj) {
      obj = buildNodeDecoration(node)
      cache.set(key, obj)
    }
    return obj
  }

  const isPathLink = (link: SimLink): boolean => pathLinkKeys?.has(linkKey(link)) === true

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-2xl border border-border/60 bg-[radial-gradient(ellipse_at_center,oklch(0.18_0.02_260)_0%,oklch(0.10_0.01_260)_60%,oklch(0.07_0.005_260)_100%)]"
    >
      <div className="pointer-events-none absolute inset-0 [background:radial-gradient(circle_at_30%_20%,oklch(from_var(--primary)_l_c_h/14%)_0%,transparent_45%),radial-gradient(circle_at_75%_80%,oklch(from_var(--accent-2)_l_c_h/12%)_0%,transparent_50%)]" />
      {/* Faint star-field — pure CSS, no GPU cost. */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.18] [background-image:radial-gradient(white_0.5px,transparent_0.5px),radial-gradient(white_0.5px,transparent_0.5px)] [background-size:90px_90px,160px_160px] [background-position:0_0,45px_45px]" />

      {!ForceGraph3D || size.width === 0 ? (
        renderEmpty(
          'Préparation de la mémoire 3D — chargement WebGL côté client. Cette page reste exploitable même si le rendu 3D échoue.'
        )
      ) : filtered.nodes.length === 0 ? (
        renderEmpty(
          'Aucun nœud ne correspond aux filtres actuels. Ajuste les types ou réinitialise la lentille pour faire revenir la mémoire.'
        )
      ) : (
        <ForceGraph3D
          ref={fgRef}
          width={size.width}
          height={size.height}
          graphData={filtered}
          backgroundColor="rgba(0,0,0,0)"
          showNavInfo={false}
          enableNodeDrag={false}
          warmupTicks={warmupTicks}
          cooldownTicks={cooldownTicks}
          nodeRelSize={5}
          nodeOpacity={0.95}
          nodeResolution={nodeResolution}
          nodeId="id"
          nodeLabel={(node: SimNode) => buildNodeTooltip(node)}
          nodeVal={(node: SimNode) =>
            (node.isExample ? 3 : 4) + (node.importance ?? 0.4) * (node.isExample ? 8 : 14)
          }
          nodeColor={(node: SimNode) =>
            nodeColorFor(
              node,
              focusedIds,
              selectedNodeId,
              hoverNodeId,
              pinnedNodeIds,
              emphasizedKinds
            )
          }
          nodeThreeObject={(node: SimNode) => getDecoration(node)}
          nodeThreeObjectExtend={true}
          linkColor={(link: SimLink) =>
            linkColorFor(link, focusedIds, selectedNodeId, hoverNodeId, hoverLinkKey, linkKey, isPathLink(link))
          }
          linkOpacity={0.65}
          linkWidth={(link: SimLink) =>
            linkWidthFor(
              link,
              focusedIds,
              selectedNodeId,
              hoverNodeId,
              hoverLinkKey,
              linkKey,
              isPathLink(link)
            )
          }
          linkCurvature={(link: SimLink) =>
            NEGATIVE_LINK_KINDS.has(link.kind) ? 0.3 : 0
          }
          linkDirectionalParticles={(link: SimLink) => {
            if (!useParticles) return 0
            // Bright path particles override defaults to make the path read.
            if (isPathLink(link)) return 5
            // Suppress evidence particles between two example nodes.
            if (linkSourceIsExample(link) && linkTargetIsExample(link)) return 0
            return POSITIVE_LINK_KINDS.has(link.kind) && (link.confidence ?? 0.5) > 0.5
              ? Math.round((link.confidence ?? 0.5) * 4)
              : 0
          }}
          linkDirectionalParticleSpeed={0.006}
          linkDirectionalParticleWidth={1.6}
          linkDirectionalArrowLength={(link: SimLink) =>
            link.kind === 'contradicts' || link.kind === 'weakens' ? 4.5 : 0
          }
          linkDirectionalArrowRelPos={1}
          linkLabel={(link: SimLink) => buildLinkTooltip(link)}
          onNodeHover={(node: SimNode | null) => setHoverNodeId(node?.id ?? null)}
          onLinkHover={(link: SimLink | null) =>
            setHoverLinkKey(link ? linkKey(link) : null)
          }
          onNodeClick={(node: SimNode) => {
            onSelectNode(node.id)
            onSelectLink(null)
            // Camera orbit toward the clicked node.
            if (node.x !== undefined && node.y !== undefined && node.z !== undefined) {
              const distance = 90
              const norm = Math.hypot(node.x, node.y, node.z) || 1
              fgRef.current?.cameraPosition(
                {
                  x: node.x * (1 + distance / norm),
                  y: node.y * (1 + distance / norm),
                  z: node.z * (1 + distance / norm),
                },
                { x: node.x, y: node.y, z: node.z },
                900
              )
            }
          }}
          onLinkClick={(link: SimLink) => {
            const s = typeof link.source === 'string' ? link.source : link.source.id
            const t = typeof link.target === 'string' ? link.target : link.target.id
            onSelectLink({
              source: s,
              target: t,
              kind: link.kind,
              ...(link.label !== undefined ? { label: link.label } : {}),
              ...(link.confidence !== undefined ? { confidence: link.confidence } : {}),
              ...(link.strength !== undefined ? { strength: link.strength } : {}),
              ...(link.summary !== undefined ? { summary: link.summary } : {}),
              ...(link.observedAt !== undefined ? { observedAt: link.observedAt } : {}),
            })
          }}
          onBackgroundClick={() => {
            onSelectNode(null)
            onSelectLink(null)
          }}
        />
      )}
    </div>
  )
}

// ─── visual helpers ───────────────────────────────────────────────────────

const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const cleaned = hex.replace('#', '')
  const value =
    cleaned.length === 3
      ? cleaned
          .split('')
          .map(c => c + c)
          .join('')
      : cleaned
  const num = Number.parseInt(value, 16)
  if (Number.isNaN(num)) return { r: 148, g: 163, b: 184 }
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
}

const hexToRgba = (hex: string, alpha: number): string => {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r},${g},${b},${alpha})`
}

const EXAMPLE_TINT = { r: 148, g: 163, b: 184 }

const mixHexTowardSlate = (hex: string, mix: number, alpha: number): string => {
  const { r, g, b } = hexToRgb(hex)
  const mr = Math.round(r * (1 - mix) + EXAMPLE_TINT.r * mix)
  const mg = Math.round(g * (1 - mix) + EXAMPLE_TINT.g * mix)
  const mb = Math.round(b * (1 - mix) + EXAMPLE_TINT.b * mix)
  return `rgba(${mr},${mg},${mb},${alpha})`
}

const linkSourceIsExample = (link: SimLink): boolean => {
  const s = typeof link.source === 'string' ? link.source : link.source
  return typeof s === 'object' && s !== null && 'isExample' in s ? Boolean(s.isExample) : false
}
const linkTargetIsExample = (link: SimLink): boolean => {
  const t = typeof link.target === 'string' ? link.target : link.target
  return typeof t === 'object' && t !== null && 'isExample' in t ? Boolean(t.isExample) : false
}

const nodeColorFor = (
  node: AdvisorGraphNode,
  focusedIds: Set<string>,
  selectedId: string | null,
  hoverId: string | null,
  pinnedIds: Set<string> | undefined,
  emphasizedKinds: Set<AdvisorGraphNodeKind> | undefined
): string => {
  const base = NODE_KIND_COLOR[node.kind] ?? NODE_KIND_COLOR.unknown
  const isFocused = node.id === selectedId || node.id === hoverId
  const isAdjacent = focusedIds.has(node.id) && !isFocused
  const isPinned = pinnedIds?.has(node.id) === true
  const isEmphasized =
    emphasizedKinds === undefined || emphasizedKinds.size === 0 || emphasizedKinds.has(node.kind)
  const confidence = node.confidence ?? 0.6
  const staleFactor = node.freshness === 'stale' ? 0.6 : node.freshness === 'unknown' ? 0.45 : 1

  if (node.isExample === true) {
    if (isFocused) return mixHexTowardSlate(base, 0.55, 0.85)
    if (focusedIds.size > 0 && !isAdjacent && selectedId) return mixHexTowardSlate(base, 0.7, 0.12)
    const alpha = Math.min(0.65, 0.32 + confidence * 0.3) * staleFactor
    return mixHexTowardSlate(base, 0.55, alpha)
  }

  if (isFocused) return HIGHLIGHT_COLOR
  if (isPinned) return hexToRgba('#fef3c7', 0.92)

  if (focusedIds.size > 0 && !isAdjacent && selectedId) {
    return hexToRgba(base, 0.18 * staleFactor)
  }

  // Lens emphasis: non-emphasized kinds quieter.
  const emphasisAlpha = isEmphasized ? 1 : 0.55
  const alpha = Math.min(1, 0.45 + confidence * 0.55) * staleFactor * emphasisAlpha
  return hexToRgba(base, alpha)
}

const linkColorFor = (
  link: SimLink,
  focusedIds: Set<string>,
  selectedId: string | null,
  hoverId: string | null,
  hoverLinkKey: string | null,
  keyFn: (l: SimLink) => string,
  isPath: boolean
): string => {
  if (isPath) return PATH_LINK_COLOR
  const s = typeof link.source === 'string' ? link.source : link.source.id
  const t = typeof link.target === 'string' ? link.target : link.target.id
  const onFocusPath =
    selectedId !== null &&
    (s === selectedId || t === selectedId || (focusedIds.has(s) && focusedIds.has(t)))
  const onHover = hoverId !== null && (s === hoverId || t === hoverId)
  const isHovered = hoverLinkKey === keyFn(link)
  const baseHex = LINK_KIND_COLOR[link.kind] ?? '#94a3b8'
  if (linkSourceIsExample(link) && linkTargetIsExample(link)) {
    if (isHovered) return mixHexTowardSlate(baseHex, 0.6, 0.7)
    if (onFocusPath || onHover) return mixHexTowardSlate(baseHex, 0.6, 0.6)
    return mixHexTowardSlate(baseHex, 0.7, 0.3)
  }
  if (isHovered) return hexToRgba(baseHex, 0.95)
  if (onFocusPath || onHover) return hexToRgba(baseHex, 0.85)
  if (selectedId !== null) return NEUTRAL_LINK_COLOR
  return hexToRgba(baseHex, 0.45 + (link.confidence ?? 0.5) * 0.35)
}

const linkWidthFor = (
  link: SimLink,
  focusedIds: Set<string>,
  selectedId: string | null,
  hoverId: string | null,
  hoverLinkKey: string | null,
  keyFn: (l: SimLink) => string,
  isPath: boolean
): number => {
  if (isPath) return (0.6 + (link.confidence ?? 0.5) * 1.2) * PATH_LINK_BOOST
  const s = typeof link.source === 'string' ? link.source : link.source.id
  const t = typeof link.target === 'string' ? link.target : link.target.id
  const onFocusPath =
    selectedId !== null &&
    (s === selectedId || t === selectedId || (focusedIds.has(s) && focusedIds.has(t)))
  const onHover = hoverId !== null && (s === hoverId || t === hoverId)
  const isHovered = hoverLinkKey === keyFn(link)
  const base = 0.6 + (link.confidence ?? 0.5) * 1.2
  if (isHovered || onFocusPath || onHover) return base * FOCUS_LINK_BOOST
  return base
}

const buildNodeTooltip = (node: AdvisorGraphNode): string => {
  const lines: string[] = [
    `<div style="font: 12px/1.45 ui-sans-serif, system-ui;">`,
  ]
  if (node.isExample) {
    lines.push(
      `<div style="display:inline-block;margin-bottom:4px;padding:1px 6px;border:1px dashed rgba(251,191,36,0.7);border-radius:4px;color:#fbbf24;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;">exemple — pas ta mémoire</div>`
    )
  }
  lines.push(
    `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">`,
    `<span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:${NODE_KIND_COLOR[node.kind]};box-shadow:0 0 8px ${NODE_KIND_COLOR[node.kind]}aa;"></span>`,
    `<strong>${escapeHtml(node.label)}</strong>`,
    `</div>`,
    `<div style="opacity:0.75;text-transform:uppercase;letter-spacing:0.08em;font-size:10px;">${escapeHtml(NODE_KIND_LABEL[node.kind])}${node.isPersonal ? ' · personnel' : ''}${node.isContradicted ? ' · contradiction' : ''}</div>`
  )
  if (node.summary) lines.push(`<div style="margin-top:6px;max-width:280px;opacity:0.9;">${escapeHtml(node.summary)}</div>`)
  const meta: string[] = []
  if (node.confidence !== undefined) meta.push(`confiance ${Math.round(node.confidence * 100)}%`)
  if (node.freshness) meta.push(`fraîcheur ${escapeHtml(node.freshness)}`)
  if (node.source) meta.push(`source ${escapeHtml(node.source)}`)
  if (meta.length > 0) lines.push(`<div style="margin-top:6px;opacity:0.7;font-size:11px;">${meta.join(' · ')}</div>`)
  lines.push(`</div>`)
  return lines.join('')
}

const buildLinkTooltip = (link: SimLink): string => {
  const s = typeof link.source === 'string' ? link.source : link.source.id
  const t = typeof link.target === 'string' ? link.target : link.target.id
  return [
    `<div style="font: 12px/1.45 ui-sans-serif, system-ui; max-width:260px;">`,
    `<div style="display:flex;align-items:center;gap:6px;">`,
    `<span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:${LINK_KIND_COLOR[link.kind]};"></span>`,
    `<strong>${escapeHtml(LINK_KIND_LABEL[link.kind])}</strong>`,
    `</div>`,
    `<div style="margin-top:4px;opacity:0.85;font-size:11px;">${escapeHtml(s)} → ${escapeHtml(t)}</div>`,
    link.summary ? `<div style="margin-top:4px;opacity:0.9;">${escapeHtml(link.summary)}</div>` : '',
    link.confidence !== undefined
      ? `<div style="margin-top:4px;opacity:0.7;font-size:11px;">confiance ${Math.round(link.confidence * 100)}%</div>`
      : '',
    `</div>`,
  ].join('')
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export default KnowledgeGraph3D
