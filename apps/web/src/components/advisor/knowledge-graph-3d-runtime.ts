import ForceGraph3D, { type ForceGraph3DInstance } from '3d-force-graph'
import {
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  DoubleSide,
  Group,
  LinearFilter,
  LineDashedMaterial,
  LineLoop,
  type Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TetrahedronGeometry,
  TorusGeometry,
  Vector3,
} from 'three'
import {
  type AdvisorGraphLink,
  type AdvisorGraphLinkKind,
  type AdvisorGraphNodeKind,
  LINK_KIND_LABEL,
  NEGATIVE_LINK_KINDS,
  NODE_KIND_LABEL,
  POSITIVE_LINK_KINDS,
} from '@/features/advisor-graph-data'
import {
  humanNodeLabel,
  type KnowledgeGraphPalette,
  type KnowledgeGraphPreset,
  type RuntimeDetailProfile,
  type RuntimeGraphData,
  type RuntimeGraphLink,
  type RuntimeGraphNode,
  resolveRuntimeDetailProfile,
  runtimeEndpointId,
  runtimeLinkKey,
  selectPersistentNodeLabels,
  toAdvisorGraphLink,
} from './knowledge-graph-3d-model'

const IDLE_ORBIT_DELAY_MS = 2_200
const CAMERA_DISTANCE = 86

interface RuntimeCallbacks {
  onSelectNode: (id: string | null) => void
  onSelectLink: (link: AdvisorGraphLink | null) => void
  onError: (error: Error) => void
}

export interface KnowledgeGraphRuntimeUpdate {
  graph: RuntimeGraphData
  selectedNodeId: string | null
  highlightedNodeIds: ReadonlySet<string>
  pathLinkKeys: ReadonlySet<string>
  pathNodeIds: ReadonlySet<string>
  pinnedNodeIds: ReadonlySet<string>
  emphasizedKinds: ReadonlySet<AdvisorGraphNodeKind>
  preset: KnowledgeGraphPreset
  autoOrbit: boolean
  reducedMotion: boolean
  paused: boolean
  mobile: boolean
  width: number
  height: number
  devicePixelRatio: number
  palette: KnowledgeGraphPalette
}

export interface KnowledgeGraphRuntime {
  update: (options: KnowledgeGraphRuntimeUpdate) => void
  resetView: () => void
  fitView: () => void
  focusNode: (id: string) => void
  reheat: () => void
  destroy: () => void
}

interface OwnedGeometries {
  sphere: SphereGeometry
  halo: SphereGeometry
  recommendation: OctahedronGeometry
  risk: TetrahedronGeometry
  goal: DodecahedronGeometry
  source: CylinderGeometry
  signal: ConeGeometry
  ring: TorusGeometry
  thickRing: TorusGeometry
  exampleRing: BufferGeometry
}

interface SemanticRing {
  role: 'personal' | 'contradiction'
  mesh: Mesh<TorusGeometry, MeshBasicMaterial>
  material: MeshBasicMaterial
}

interface NodeLabelVisual {
  key: string
  sprite: Sprite
  material: SpriteMaterial
  texture: CanvasTexture
}

interface NodeVisual {
  group: Group
  core: Mesh<BufferGeometry, MeshStandardMaterial>
  coreMaterial: MeshStandardMaterial
  halo: Mesh<SphereGeometry, MeshBasicMaterial>
  haloMaterial: MeshBasicMaterial
  focusRing: Mesh<TorusGeometry, MeshBasicMaterial>
  focusRingMaterial: MeshBasicMaterial
  semanticRings: SemanticRing[]
  exampleRing: LineLoop<BufferGeometry, LineDashedMaterial> | null
  radius: number
  label: NodeLabelVisual | null
  geometries: BufferGeometry[]
  materials: Material[]
}

interface DerivedPalette {
  quietLink: string
  exampleNode: string
  exampleLink: string
}

function createExampleRingGeometry(): BufferGeometry {
  const points: Vector3[] = []
  for (let index = 0; index < 48; index += 1) {
    const angle = (index / 48) * Math.PI * 2
    points.push(new Vector3(Math.cos(angle), Math.sin(angle), 0))
  }
  return new BufferGeometry().setFromPoints(points)
}

function createOwnedGeometries(): OwnedGeometries {
  return {
    sphere: new SphereGeometry(1, 14, 10),
    halo: new SphereGeometry(1, 12, 8),
    recommendation: new OctahedronGeometry(1, 0),
    risk: new TetrahedronGeometry(1, 0),
    goal: new DodecahedronGeometry(1, 0),
    source: new CylinderGeometry(1, 1, 0.24, 18),
    signal: new ConeGeometry(1, 1.65, 14),
    ring: new TorusGeometry(1.35, 0.035, 6, 32),
    thickRing: new TorusGeometry(1.45, 0.07, 8, 32),
    exampleRing: createExampleRingGeometry(),
  }
}

function mixColors(from: string, to: string, amount: number): string {
  return `#${new Color(from).lerp(new Color(to), amount).getHexString()}`
}

function derivePalette(palette: KnowledgeGraphPalette): DerivedPalette {
  return {
    quietLink: mixColors(palette.mutedForeground, palette.background, 0.68),
    exampleNode: mixColors(palette.mutedForeground, palette.background, 0.18),
    exampleLink: mixColors(palette.mutedForeground, palette.background, 0.52),
  }
}

function nodeKindColor(kind: AdvisorGraphNodeKind, palette: KnowledgeGraphPalette): string {
  switch (kind) {
    case 'personal_snapshot':
    case 'financial_account':
    case 'transaction_cluster':
      return palette.positive
    case 'asset':
    case 'investment':
      return palette.teal
    case 'goal':
      return palette.warmAccent
    case 'recommendation':
      return palette.primary
    case 'assumption':
    case 'concept':
    case 'formula':
      return palette.ai
    case 'market_signal':
    case 'news_signal':
      return palette.warning
    case 'social_signal':
      return palette.warmAccent
    case 'risk':
    case 'contradiction':
      return palette.negative
    case 'source':
    case 'unknown':
      return palette.mutedForeground
  }
}

function linkKindColor(kind: AdvisorGraphLinkKind, palette: KnowledgeGraphPalette): string {
  switch (kind) {
    case 'supports':
      return palette.positive
    case 'explains':
      return palette.primary
    case 'contradicts':
      return palette.negative
    case 'weakens':
      return palette.warning
    case 'derived_from':
    case 'uses_assumption':
      return palette.ai
    case 'affects':
      return palette.teal
    case 'related_to':
    case 'mentions':
    case 'belongs_to':
      return palette.mutedForeground
  }
}

function geometryForNode(node: RuntimeGraphNode, geometries: OwnedGeometries): BufferGeometry {
  switch (node.kind) {
    case 'recommendation':
      return geometries.recommendation
    case 'risk':
    case 'contradiction':
      return geometries.risk
    case 'goal':
      return geometries.goal
    case 'source':
      return geometries.source
    case 'market_signal':
    case 'news_signal':
    case 'social_signal':
      return geometries.signal
    default:
      return geometries.sphere
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function truncateLabel(value: string, limit = 36): string {
  if (value.length <= limit) return value
  return `${value.slice(0, limit - 1).trimEnd()}\u2026`
}

function drawRoundedRectangle(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  radius: number
): void {
  context.beginPath()
  context.moveTo(radius, 0)
  context.lineTo(width - radius, 0)
  context.quadraticCurveTo(width, 0, width, radius)
  context.lineTo(width, height - radius)
  context.quadraticCurveTo(width, height, width - radius, height)
  context.lineTo(radius, height)
  context.quadraticCurveTo(0, height, 0, height - radius)
  context.lineTo(0, radius)
  context.quadraticCurveTo(0, 0, radius, 0)
  context.closePath()
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error('Le rendu 3D est indisponible.')
}

function sameDetailProfile(
  left: RuntimeDetailProfile | null,
  right: RuntimeDetailProfile
): boolean {
  return (
    left !== null &&
    left.pixelRatio === right.pixelRatio &&
    left.warmupTicks === right.warmupTicks &&
    left.cooldownTicks === right.cooldownTicks &&
    left.arrowResolution === right.arrowResolution &&
    left.particleResolution === right.particleResolution &&
    left.particlesEnabled === right.particlesEnabled
  )
}

class KnowledgeGraphRuntimeImpl implements KnowledgeGraphRuntime {
  private engine: ForceGraph3DInstance<RuntimeGraphNode, RuntimeGraphLink> | null = null
  private readonly element: HTMLElement
  private readonly callbacks: RuntimeCallbacks
  private readonly geometries = createOwnedGeometries()
  private nodeVisuals = new Map<string, NodeVisual>()
  private currentGraph: RuntimeGraphData = { nodes: [], links: [] }
  private nodeById = new Map<string, RuntimeGraphNode>()
  private neighborsById = new Map<string, Set<string>>()
  private focusedNodeIds = new Set<string>()
  private options: KnowledgeGraphRuntimeUpdate | null = null
  private detailProfile: RuntimeDetailProfile | null = null
  private derivedPalette: DerivedPalette | null = null
  private hoverNodeId: string | null = null
  private hoverLinkKey: string | null = null
  private engineIdle = true
  private pendingInitialFit = false
  private pendingFocusNodeId: string | null = null
  private lastInteractionAt = Date.now()
  private orbitFrame = 0
  private orbitTimer = 0
  private orbitAngle = 0
  private orbitRadius = 360
  private orbitHeight = 70
  private lastOrbitFrameAt = 0
  private canvas: HTMLCanvasElement | null = null
  private disposed = false

  constructor(element: HTMLElement, callbacks: RuntimeCallbacks) {
    this.element = element
    this.callbacks = callbacks

    try {
      const engine = new ForceGraph3D(element, {
        controlType: 'orbit',
        rendererConfig: {
          alpha: true,
          antialias: element.clientWidth >= 640,
          powerPreference: 'high-performance',
        },
      }) as unknown as ForceGraph3DInstance<RuntimeGraphNode, RuntimeGraphLink>
      this.engine = engine

      engine
        .backgroundColor('rgba(0,0,0,0)')
        .showNavInfo(false)
        .enableNodeDrag(false)
        .enablePointerInteraction(true)
        .showPointerCursor(true)
        .nodeId('id')
        .nodeThreeObject(node => this.nodeVisualFor(node).group)
        .nodeThreeObjectExtend(false)
        .nodeLabel(node => this.nodeTooltip(node))
        .linkLabel(graphLink => this.linkTooltip(graphLink))
        .linkColor(graphLink => this.linkColor(graphLink))
        .linkWidth(graphLink => this.linkWidth(graphLink))
        .linkOpacity(0.64)
        .linkCurvature(graphLink => (NEGATIVE_LINK_KINDS.has(graphLink.kind) ? 0.28 : 0))
        .linkDirectionalArrowLength(graphLink =>
          NEGATIVE_LINK_KINDS.has(graphLink.kind) ? 4.5 : 0
        )
        .linkDirectionalArrowRelPos(1)
        .linkDirectionalArrowColor(graphLink => this.linkColor(graphLink))
        .linkDirectionalParticles(graphLink => this.linkParticleCount(graphLink))
        .linkDirectionalParticleSpeed(0.006)
        .linkDirectionalParticleWidth(1.45)
        .linkDirectionalParticleColor(graphLink => this.linkColor(graphLink))
        .onNodeHover(node => this.handleNodeHover(node))
        .onLinkHover(graphLink => this.handleLinkHover(graphLink))
        .onNodeClick(node => this.handleNodeClick(node))
        .onLinkClick(graphLink => this.handleLinkClick(graphLink))
        .onBackgroundClick(() => this.handleBackgroundClick())
        .onEngineStop(() => this.handleEngineStop())

      const renderer = engine.renderer()
      renderer.setClearColor(0x000000, 0)
      this.canvas = renderer.domElement
      this.canvas.addEventListener('webglcontextlost', this.handleContextLost)
      element.addEventListener('pointerdown', this.handlePointerInteraction, { passive: true })
      element.addEventListener('wheel', this.handlePointerInteraction, { passive: true })
      document.addEventListener('visibilitychange', this.handleVisibilityChange)
    } catch (error) {
      this.destroy()
      throw toError(error)
    }
  }

  update(options: KnowledgeGraphRuntimeUpdate): void {
    if (this.disposed) return

    try {
      this.options = options
      this.derivedPalette = derivePalette(options.palette)
      this.applyDetailProfile(options)
      this.applySize(options.width, options.height)

      if (this.currentGraph !== options.graph) {
        this.setGraph(options.graph)
      } else {
        this.rebuildFocusedNodeIds()
      }

      this.updateNodeVisuals()
      this.engine?.refresh()
      this.applyAnimationState()
      if (!this.applyInitialFit()) this.scheduleOrbit()
    } catch (error) {
      this.fail(error)
    }
  }

  resetView(): void {
    if (this.disposed) return
    this.markInteraction()
    this.engine?.cameraPosition(
      { x: 0, y: 0, z: 360 },
      { x: 0, y: 0, z: 0 },
      this.cameraDuration(420)
    )
  }

  fitView(): void {
    if (this.disposed) return
    this.markInteraction()
    this.engine?.zoomToFit(this.cameraDuration(480), 76)
  }

  focusNode(id: string): void {
    if (this.disposed) return
    const node = this.nodeById.get(id)
    if (!node) return
    if (!this.hasPosition(node)) {
      this.pendingFocusNodeId = id
      return
    }

    this.pendingFocusNodeId = null
    this.markInteraction()
    const norm = Math.hypot(node.x, node.y, node.z)
    const position =
      norm > 0
        ? {
            x: node.x * (1 + CAMERA_DISTANCE / norm),
            y: node.y * (1 + CAMERA_DISTANCE / norm),
            z: node.z * (1 + CAMERA_DISTANCE / norm),
          }
        : { x: 0, y: 0, z: CAMERA_DISTANCE }
    this.engine?.cameraPosition(
      position,
      { x: node.x, y: node.y, z: node.z },
      this.cameraDuration(460)
    )
  }

  reheat(): void {
    if (this.disposed) return
    this.markInteraction()
    this.engineIdle = false
    this.engine?.d3ReheatSimulation()
  }

  destroy(): void {
    if (this.disposed) return
    this.disposed = true
    this.stopOrbit()

    document.removeEventListener('visibilitychange', this.handleVisibilityChange)
    this.element.removeEventListener('pointerdown', this.handlePointerInteraction)
    this.element.removeEventListener('wheel', this.handlePointerInteraction)
    this.canvas?.removeEventListener('webglcontextlost', this.handleContextLost)

    const engine = this.engine
    this.engine = null
    if (engine) {
      engine.pauseAnimation()
      try {
        engine._destructor()
      } catch {
        // Some drivers can throw while tearing down an already-lost context.
      }
    }

    this.disposeVisualMap(this.nodeVisuals)
    this.nodeVisuals.clear()
    for (const geometry of Object.values(this.geometries)) geometry.dispose()
    this.element.replaceChildren()
    this.canvas = null
  }

  private applyDetailProfile(options: KnowledgeGraphRuntimeUpdate): void {
    const next = resolveRuntimeDetailProfile(
      options.preset,
      options.mobile,
      options.reducedMotion,
      options.devicePixelRatio
    )
    if (sameDetailProfile(this.detailProfile, next)) return
    this.detailProfile = next
    this.engine
      ?.warmupTicks(next.warmupTicks)
      .cooldownTicks(next.cooldownTicks)
      .linkDirectionalArrowResolution(next.arrowResolution)
      .linkDirectionalParticleResolution(next.particleResolution)
    this.engine?.renderer().setPixelRatio(next.pixelRatio)
  }

  private applySize(width: number, height: number): void {
    const safeWidth = Math.max(1, Math.floor(width))
    const safeHeight = Math.max(1, Math.floor(height))
    const engine = this.engine
    if (!engine) return
    if (engine.width() !== safeWidth) engine.width(safeWidth)
    if (engine.height() !== safeHeight) engine.height(safeHeight)
  }

  private setGraph(graph: RuntimeGraphData): void {
    const previousVisuals = this.nodeVisuals
    this.nodeVisuals = new Map()
    this.currentGraph = graph
    this.nodeById = new Map(graph.nodes.map(node => [node.id, node]))
    this.neighborsById = new Map()

    for (const graphLink of graph.links) {
      const source = runtimeEndpointId(graphLink.source)
      const target = runtimeEndpointId(graphLink.target)
      const sourceNeighbors = this.neighborsById.get(source) ?? new Set<string>()
      const targetNeighbors = this.neighborsById.get(target) ?? new Set<string>()
      sourceNeighbors.add(target)
      targetNeighbors.add(source)
      this.neighborsById.set(source, sourceNeighbors)
      this.neighborsById.set(target, targetNeighbors)
    }

    if (this.hoverNodeId !== null && !this.nodeById.has(this.hoverNodeId)) {
      this.hoverNodeId = null
    }
    this.hoverLinkKey = null
    this.engineIdle = false
    this.pendingInitialFit = graph.nodes.length > 0
    this.rebuildFocusedNodeIds()
    this.engine?.graphData(graph)
    this.disposeVisualMap(previousVisuals)
  }

  private rebuildFocusedNodeIds(): void {
    const options = this.options
    const focused = new Set<string>()
    if (!options) {
      this.focusedNodeIds = focused
      return
    }

    for (const id of options.highlightedNodeIds) focused.add(id)
    for (const id of options.pathNodeIds) focused.add(id)

    const addWithNeighbors = (id: string | null) => {
      if (id === null) return
      focused.add(id)
      const neighbors = this.neighborsById.get(id)
      if (neighbors) for (const neighborId of neighbors) focused.add(neighborId)
    }
    addWithNeighbors(options.selectedNodeId)
    addWithNeighbors(this.hoverNodeId)
    this.focusedNodeIds = focused
  }

  private nodeVisualFor(node: RuntimeGraphNode): NodeVisual {
    const existing = this.nodeVisuals.get(node.id)
    if (existing) return existing

    const group = new Group()
    const coreGeometry = geometryForNode(node, this.geometries).clone()
    const coreMaterial = new MeshStandardMaterial({
      color: '#ffffff',
      emissive: '#000000',
      metalness: 0.12,
      roughness: 0.46,
      transparent: true,
      opacity: 0.92,
      side: DoubleSide,
    })
    const core = new Mesh(coreGeometry, coreMaterial)
    const radius = (3.2 + (node.importance ?? 0.4) * 5.4) * (node.isExample ? 0.72 : 1)
    core.scale.setScalar(radius)
    group.add(core)

    const haloMaterial = new MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
    const haloGeometry = this.geometries.halo.clone()
    const halo = new Mesh(haloGeometry, haloMaterial)
    halo.scale.setScalar(radius * 1.72)
    halo.visible = false
    group.add(halo)

    const focusRingMaterial = new MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
    const focusRingGeometry = this.geometries.thickRing.clone()
    const focusRing = new Mesh(focusRingGeometry, focusRingMaterial)
    focusRing.scale.setScalar(radius * 1.08)
    focusRing.rotation.x = Math.PI / 2
    focusRing.visible = false
    group.add(focusRing)

    const semanticRings: SemanticRing[] = []
    if (node.isPersonal === true) {
      semanticRings.push(this.createSemanticRing('personal', radius, group))
    }
    if (node.isContradicted === true) {
      const contradiction = this.createSemanticRing('contradiction', radius * 1.12, group)
      contradiction.mesh.rotation.y = Math.PI / 3
      semanticRings.push(contradiction)
    }

    let exampleRing: LineLoop<BufferGeometry, LineDashedMaterial> | null = null
    const geometries: BufferGeometry[] = [coreGeometry, haloGeometry, focusRingGeometry]
    const materials: Material[] = [coreMaterial, haloMaterial, focusRingMaterial]
    for (const semanticRing of semanticRings) materials.push(semanticRing.material)
    for (const semanticRing of semanticRings) geometries.push(semanticRing.mesh.geometry)
    if (node.isExample === true) {
      const exampleMaterial = new LineDashedMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0.66,
        dashSize: 0.16,
        gapSize: 0.12,
        depthWrite: false,
      })
      const exampleGeometry = this.geometries.exampleRing.clone()
      exampleRing = new LineLoop(exampleGeometry, exampleMaterial)
      exampleRing.scale.setScalar(radius * 1.6)
      exampleRing.computeLineDistances()
      group.add(exampleRing)
      geometries.push(exampleGeometry)
      materials.push(exampleMaterial)
    }

    const visual: NodeVisual = {
      group,
      core,
      coreMaterial,
      halo,
      haloMaterial,
      focusRing,
      focusRingMaterial,
      semanticRings,
      exampleRing,
      radius,
      label: null,
      geometries,
      materials,
    }
    this.nodeVisuals.set(node.id, visual)
    return visual
  }

  private createSemanticRing(
    role: SemanticRing['role'],
    radius: number,
    group: Group
  ): SemanticRing {
    const material = new MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    })
    const mesh = new Mesh(this.geometries.ring.clone(), material)
    mesh.scale.setScalar(radius)
    mesh.rotation.x = Math.PI / 2
    group.add(mesh)
    return { role, mesh, material }
  }

  private updateNodeVisuals(): void {
    const options = this.options
    if (!options) return
    const hasActiveFocus =
      options.selectedNodeId !== null ||
      this.hoverNodeId !== null ||
      options.highlightedNodeIds.size > 0 ||
      options.pathNodeIds.size > 0
    const persistentLabels = new Map(
      selectPersistentNodeLabels(
        this.currentGraph.nodes,
        options.selectedNodeId,
        options.pinnedNodeIds,
        options.mobile
      ).map(label => [label.nodeId, label.role])
    )

    for (const node of this.currentGraph.nodes) {
      const visual = this.nodeVisualFor(node)
      const selected = node.id === options.selectedNodeId
      const hovered = node.id === this.hoverNodeId
      const inPath = options.pathNodeIds.has(node.id)
      const pinned = options.pinnedNodeIds.has(node.id)
      const focused = this.focusedNodeIds.has(node.id)
      const emphasized =
        options.emphasizedKinds.size === 0 || options.emphasizedKinds.has(node.kind)
      const staleMultiplier =
        node.freshness === 'stale' ? 0.65 : node.freshness === 'unknown' ? 0.5 : 1
      const certainty = 0.52 + (node.confidence ?? 0.6) * 0.48
      const baseColor = node.isExample
        ? (this.derivedPalette?.exampleNode ?? options.palette.mutedForeground)
        : nodeKindColor(node.kind, options.palette)
      const focusColor = selected
        ? options.palette.primary
        : hovered
          ? options.palette.foreground
          : inPath
            ? options.palette.primary
            : pinned
              ? options.palette.warmAccent
              : baseColor
      const dimmed = hasActiveFocus && !focused
      const baseOpacity = node.isExample ? 0.58 : Math.min(1, certainty * staleMultiplier)
      const opacity = dimmed ? 0.16 : baseOpacity * (emphasized ? 1 : 0.52)

      visual.coreMaterial.color.set(focusColor)
      visual.coreMaterial.opacity = selected || hovered ? 1 : opacity
      visual.coreMaterial.emissive.set(focusColor)
      visual.coreMaterial.emissiveIntensity = selected || hovered ? 0.42 : inPath ? 0.24 : 0.08
      visual.group.scale.setScalar(selected || hovered ? 1.14 : inPath ? 1.08 : 1)

      const showHalo =
        selected ||
        hovered ||
        inPath ||
        pinned ||
        (!options.mobile && options.preset === 'cinematic' && (node.importance ?? 0) >= 0.82)
      visual.halo.visible = showHalo
      visual.haloMaterial.color.set(focusColor)
      visual.haloMaterial.opacity = selected || hovered ? 0.18 : inPath || pinned ? 0.12 : 0.055

      visual.focusRing.visible = selected || hovered || inPath || pinned
      visual.focusRingMaterial.color.set(focusColor)
      visual.focusRingMaterial.opacity = selected || hovered ? 0.88 : 0.62

      for (const semanticRing of visual.semanticRings) {
        semanticRing.material.color.set(
          semanticRing.role === 'personal' ? options.palette.positive : options.palette.negative
        )
        semanticRing.material.opacity = dimmed ? 0.16 : 0.64
      }
      if (visual.exampleRing) {
        visual.exampleRing.material.color.set(options.palette.warning)
        visual.exampleRing.material.opacity = dimmed ? 0.15 : 0.58
      }

      const labelRole = persistentLabels.get(node.id)
      if (labelRole) {
        const label = this.ensureNodeLabel(visual, node, labelRole, options)
        if (label) {
          label.material.opacity = dimmed && labelRole === 'important' ? 0.32 : 1
        }
      } else {
        this.disposeNodeLabel(visual)
      }
    }
  }

  private ensureNodeLabel(
    visual: NodeVisual,
    node: RuntimeGraphNode,
    role: 'selected' | 'pinned' | 'important',
    options: KnowledgeGraphRuntimeUpdate
  ): NodeLabelVisual | null {
    const label = truncateLabel(humanNodeLabel(node))
    const density = options.mobile
      ? 1
      : Math.min(2, Math.max(1, this.detailProfile?.pixelRatio ?? 1))
    const key = [
      label,
      role,
      density,
      options.mobile ? 'mobile' : 'desktop',
      options.palette.surface,
      options.palette.foreground,
      options.palette.mutedForeground,
      options.palette.primary,
      options.palette.warmAccent,
    ].join('|')
    if (visual.label?.key === key) return visual.label

    this.disposeNodeLabel(visual)
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) return null

    const fontSize = options.mobile ? 24 : 26
    const horizontalPadding = options.mobile ? 14 : 17
    const logicalHeight = options.mobile ? 48 : 52
    const font = `600 ${fontSize}px "Geist Sans", sans-serif`
    context.font = font
    const logicalWidth = Math.min(
      options.mobile ? 300 : 380,
      Math.max(88, Math.ceil(context.measureText(label).width + horizontalPadding * 2))
    )
    canvas.width = Math.ceil(logicalWidth * density)
    canvas.height = Math.ceil(logicalHeight * density)
    context.scale(density, density)
    context.font = font
    context.textAlign = 'center'
    context.textBaseline = 'middle'

    const borderColor =
      role === 'selected'
        ? options.palette.primary
        : role === 'pinned'
          ? options.palette.warmAccent
          : options.palette.mutedForeground
    drawRoundedRectangle(context, logicalWidth, logicalHeight, options.mobile ? 7 : 8)
    context.globalAlpha = role === 'important' ? 0.88 : 0.96
    context.fillStyle = options.palette.surface
    context.fill()
    context.globalAlpha = role === 'important' ? 0.7 : 0.94
    context.lineWidth = role === 'selected' ? 2 : 1
    context.strokeStyle = borderColor
    context.stroke()
    context.globalAlpha = 1
    context.fillStyle = options.palette.foreground
    context.fillText(
      label,
      logicalWidth / 2,
      logicalHeight / 2 + 0.5,
      logicalWidth - horizontalPadding * 2
    )

    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    texture.generateMipmaps = false
    texture.minFilter = LinearFilter
    texture.magFilter = LinearFilter
    texture.needsUpdate = true
    const material = new SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      opacity: 1,
    })
    const sprite = new Sprite(material)
    const worldHeight = options.mobile ? 8.5 : 10
    sprite.center.set(0.5, 0)
    sprite.position.set(0, visual.radius * 1.72 + 2, 0)
    sprite.scale.set(worldHeight * (logicalWidth / logicalHeight), worldHeight, 1)
    sprite.renderOrder = 50
    visual.group.add(sprite)

    const created = { key, sprite, material, texture }
    visual.label = created
    return created
  }

  private disposeNodeLabel(visual: NodeVisual): void {
    const label = visual.label
    if (!label) return
    visual.group.remove(label.sprite)
    label.material.map = null
    label.texture.dispose()
    label.material.dispose()
    visual.label = null
  }

  private linkColor(graphLink: RuntimeGraphLink): string {
    const options = this.options
    if (!options) return '#a89e8b'
    if (options.pathLinkKeys.has(runtimeLinkKey(graphLink))) return options.palette.primary
    if (this.hoverLinkKey === runtimeLinkKey(graphLink)) return options.palette.foreground

    const source = runtimeEndpointId(graphLink.source)
    const target = runtimeEndpointId(graphLink.target)
    const touchesHover =
      this.hoverNodeId !== null && (source === this.hoverNodeId || target === this.hoverNodeId)
    const touchesSelection =
      options.selectedNodeId !== null &&
      (source === options.selectedNodeId || target === options.selectedNodeId)
    if (touchesHover || touchesSelection) return linkKindColor(graphLink.kind, options.palette)
    if (options.selectedNodeId !== null) {
      return this.derivedPalette?.quietLink ?? options.palette.mutedForeground
    }
    if (this.bothEndpointsAreExamples(graphLink)) {
      return this.derivedPalette?.exampleLink ?? options.palette.mutedForeground
    }
    return linkKindColor(graphLink.kind, options.palette)
  }

  private linkWidth(graphLink: RuntimeGraphLink): number {
    const options = this.options
    const base = 0.58 + (graphLink.confidence ?? 0.5) * 1.15
    if (!options) return base
    if (options.pathLinkKeys.has(runtimeLinkKey(graphLink))) return base * 2.5
    if (this.hoverLinkKey === runtimeLinkKey(graphLink)) return base * 1.9
    const source = runtimeEndpointId(graphLink.source)
    const target = runtimeEndpointId(graphLink.target)
    if (
      (this.hoverNodeId !== null && (source === this.hoverNodeId || target === this.hoverNodeId)) ||
      (options.selectedNodeId !== null &&
        (source === options.selectedNodeId || target === options.selectedNodeId))
    ) {
      return base * 1.65
    }
    return base
  }

  private linkParticleCount(graphLink: RuntimeGraphLink): number {
    const options = this.options
    if (!options || this.detailProfile?.particlesEnabled !== true) return 0
    if (options.pathLinkKeys.has(runtimeLinkKey(graphLink))) return 4
    if (this.bothEndpointsAreExamples(graphLink)) return 0
    if (!POSITIVE_LINK_KINDS.has(graphLink.kind)) return 0
    const source = runtimeEndpointId(graphLink.source)
    const target = runtimeEndpointId(graphLink.target)
    const touchesFocus =
      (options.selectedNodeId !== null &&
        (source === options.selectedNodeId || target === options.selectedNodeId)) ||
      (this.hoverNodeId !== null && (source === this.hoverNodeId || target === this.hoverNodeId))
    return touchesFocus && (graphLink.confidence ?? 0.5) > 0.5 ? 2 : 0
  }

  private bothEndpointsAreExamples(graphLink: RuntimeGraphLink): boolean {
    const source =
      typeof graphLink.source === 'string' ? this.nodeById.get(graphLink.source) : graphLink.source
    const target =
      typeof graphLink.target === 'string' ? this.nodeById.get(graphLink.target) : graphLink.target
    return source?.isExample === true && target?.isExample === true
  }

  private nodeTooltip(node: RuntimeGraphNode): string {
    const palette = this.options?.palette
    const foreground = palette?.foreground ?? '#f6f1e6'
    const muted = palette?.mutedForeground ?? '#a89e8b'
    const base = palette ? nodeKindColor(node.kind, palette) : muted
    const lines = [
      `<div style="font:12px/1.45 'Geist Sans',sans-serif;color:${foreground};max-width:280px">`,
    ]
    if (node.isExample) {
      lines.push(
        `<div style="margin-bottom:5px;color:${palette?.warning ?? '#d9a441'};font-size:10px;letter-spacing:.08em;text-transform:uppercase">Exemple, m&eacute;moire illustrative</div>`
      )
    }
    lines.push(
      '<div style="display:flex;align-items:center;gap:7px">',
      `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${base}"></span>`,
      `<strong>${escapeHtml(humanNodeLabel(node))}</strong>`,
      '</div>',
      `<div style="margin-top:3px;color:${muted};font-size:10px;letter-spacing:.08em;text-transform:uppercase">${escapeHtml(NODE_KIND_LABEL[node.kind])}</div>`
    )
    if (node.summary) {
      lines.push(
        `<div style="margin-top:7px;color:${foreground}">${escapeHtml(node.summary)}</div>`
      )
    }
    lines.push('</div>')
    return lines.join('')
  }

  private linkTooltip(graphLink: RuntimeGraphLink): string {
    const palette = this.options?.palette
    const foreground = palette?.foreground ?? '#f6f1e6'
    const muted = palette?.mutedForeground ?? '#a89e8b'
    const source = this.nodeById.get(runtimeEndpointId(graphLink.source))
    const target = this.nodeById.get(runtimeEndpointId(graphLink.target))
    const sourceLabel = source ? humanNodeLabel(source) : 'Souvenir'
    const targetLabel = target ? humanNodeLabel(target) : 'Souvenir'
    return [
      `<div style="font:12px/1.45 'Geist Sans',sans-serif;color:${foreground};max-width:280px">`,
      `<strong>${escapeHtml(LINK_KIND_LABEL[graphLink.kind])}</strong>`,
      `<div style="margin-top:5px;color:${muted}">${escapeHtml(sourceLabel)}</div>`,
      `<div style="color:${muted}">${escapeHtml(targetLabel)}</div>`,
      graphLink.summary
        ? `<div style="margin-top:7px;color:${foreground}">${escapeHtml(graphLink.summary)}</div>`
        : '',
      '</div>',
    ].join('')
  }

  private handleNodeHover(node: RuntimeGraphNode | null): void {
    if (this.disposed) return
    this.hoverNodeId = node?.id ?? null
    this.markInteraction()
    this.rebuildFocusedNodeIds()
    this.updateNodeVisuals()
    this.engine?.refresh()
    this.scheduleOrbit()
  }

  private handleLinkHover(graphLink: RuntimeGraphLink | null): void {
    if (this.disposed) return
    this.hoverLinkKey = graphLink ? runtimeLinkKey(graphLink) : null
    this.markInteraction()
    this.engine?.refresh()
    this.scheduleOrbit()
  }

  private handleNodeClick(node: RuntimeGraphNode): void {
    this.markInteraction()
    this.callbacks.onSelectNode(node.id)
    this.callbacks.onSelectLink(null)
    this.focusNode(node.id)
  }

  private handleLinkClick(graphLink: RuntimeGraphLink): void {
    this.markInteraction()
    this.callbacks.onSelectLink(toAdvisorGraphLink(graphLink))
  }

  private handleBackgroundClick(): void {
    this.markInteraction()
    this.callbacks.onSelectNode(null)
    this.callbacks.onSelectLink(null)
  }

  private handleEngineStop(): void {
    this.engineIdle = true
    if (this.pendingFocusNodeId) {
      const pendingFocusNodeId = this.pendingFocusNodeId
      const pendingNode = this.nodeById.get(pendingFocusNodeId)
      if (pendingNode && this.hasPosition(pendingNode)) {
        this.pendingInitialFit = false
        this.focusNode(pendingFocusNodeId)
        return
      }
    }
    if (this.applyInitialFit()) return
    this.scheduleOrbit()
  }

  private applyInitialFit(): boolean {
    const options = this.options
    if (
      !this.pendingInitialFit ||
      !this.engineIdle ||
      !options ||
      options.width < 2 ||
      options.height < 2 ||
      this.engine === null
    ) {
      return false
    }
    this.pendingInitialFit = false
    this.lastInteractionAt = Date.now()
    this.engine.zoomToFit(this.cameraDuration(560), options.mobile ? 48 : 76)
    this.scheduleOrbit()
    return true
  }

  private readonly handlePointerInteraction = (): void => {
    this.markInteraction()
    this.scheduleOrbit()
  }

  private readonly handleVisibilityChange = (): void => {
    if (document.hidden) this.stopOrbit()
    this.applyAnimationState()
    if (!document.hidden) this.scheduleOrbit()
  }

  private readonly handleContextLost = (event: Event): void => {
    event.preventDefault()
    this.fail(new Error('Le contexte WebGL a \u00e9t\u00e9 interrompu.'))
  }

  private applyAnimationState(): void {
    const engine = this.engine
    if (!engine) return
    if (document.hidden || this.options?.paused === true) {
      this.stopOrbit()
      engine.pauseAnimation()
    } else {
      engine.resumeAnimation()
    }
  }

  private cameraDuration(normalDuration: number): number {
    return this.options?.reducedMotion === true ? 0 : normalDuration
  }

  private hasPosition(
    node: RuntimeGraphNode
  ): node is RuntimeGraphNode & { x: number; y: number; z: number } {
    return Number.isFinite(node.x) && Number.isFinite(node.y) && Number.isFinite(node.z)
  }

  private markInteraction(): void {
    this.lastInteractionAt = Date.now()
    this.stopOrbit()
  }

  private orbitEligible(): boolean {
    const options = this.options
    return (
      !this.disposed &&
      options !== null &&
      options.autoOrbit &&
      !options.reducedMotion &&
      !options.paused &&
      !options.mobile &&
      options.preset !== 'performance' &&
      !document.hidden &&
      this.engineIdle &&
      options.selectedNodeId === null &&
      options.highlightedNodeIds.size === 0 &&
      options.pathNodeIds.size === 0 &&
      this.hoverNodeId === null &&
      this.hoverLinkKey === null
    )
  }

  private scheduleOrbit(): void {
    this.stopOrbit()
    if (!this.orbitEligible()) return
    const delay = Math.max(0, IDLE_ORBIT_DELAY_MS - (Date.now() - this.lastInteractionAt))
    if (delay > 0) {
      this.orbitTimer = window.setTimeout(() => {
        this.orbitTimer = 0
        this.startOrbit()
      }, delay)
      return
    }
    this.startOrbit()
  }

  private startOrbit(): void {
    if (!this.orbitEligible() || this.engine === null) return
    const current = this.engine.cameraPosition()
    this.orbitRadius = Math.max(180, Math.hypot(current.x, current.z))
    this.orbitHeight = current.y
    this.orbitAngle = Math.atan2(current.x, current.z)
    this.lastOrbitFrameAt = performance.now()
    this.orbitFrame = requestAnimationFrame(this.orbitTick)
  }

  private readonly orbitTick = (now: number): void => {
    if (!this.orbitEligible()) {
      this.stopOrbit()
      return
    }
    const elapsed = Math.min(64, now - this.lastOrbitFrameAt)
    this.lastOrbitFrameAt = now
    this.orbitAngle += elapsed * 0.00004
    this.engine?.cameraPosition(
      {
        x: Math.sin(this.orbitAngle) * this.orbitRadius,
        y: this.orbitHeight,
        z: Math.cos(this.orbitAngle) * this.orbitRadius,
      },
      { x: 0, y: 0, z: 0 },
      0
    )
    this.orbitFrame = requestAnimationFrame(this.orbitTick)
  }

  private stopOrbit(): void {
    if (this.orbitFrame !== 0) cancelAnimationFrame(this.orbitFrame)
    if (this.orbitTimer !== 0) window.clearTimeout(this.orbitTimer)
    this.orbitFrame = 0
    this.orbitTimer = 0
  }

  private disposeVisualMap(visuals: Map<string, NodeVisual>): void {
    for (const visual of visuals.values()) {
      this.disposeNodeLabel(visual)
      visual.group.clear()
      for (const geometry of visual.geometries) geometry.dispose()
      for (const material of visual.materials) material.dispose()
    }
  }

  private fail(error: unknown): void {
    if (this.disposed) return
    const normalized = toError(error)
    const onError = this.callbacks.onError
    onError(normalized)
    this.destroy()
  }
}

export function createKnowledgeGraphRuntime(
  element: HTMLElement,
  callbacks: RuntimeCallbacks
): KnowledgeGraphRuntime {
  return new KnowledgeGraphRuntimeImpl(element, callbacks)
}
