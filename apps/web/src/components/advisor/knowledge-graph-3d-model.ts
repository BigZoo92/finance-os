import {
  type AdvisorGraph,
  type AdvisorGraphLink,
  type AdvisorGraphLinkKind,
  type AdvisorGraphNode,
  type AdvisorGraphNodeKind,
  linkKey,
  NODE_KIND_LABEL,
} from '@/features/advisor-graph-data'

export type KnowledgeGraphPreset = 'cinematic' | 'standard' | 'performance'

export interface KnowledgeGraphPalette {
  background: string
  surface: string
  foreground: string
  mutedForeground: string
  primary: string
  positive: string
  negative: string
  warning: string
  teal: string
  warmAccent: string
  ai: string
}

export const DEFAULT_KNOWLEDGE_GRAPH_PALETTE: KnowledgeGraphPalette = {
  background: '#242019',
  surface: '#2c2720',
  foreground: '#f6f1e6',
  mutedForeground: '#a89e8b',
  primary: '#f97a3c',
  positive: '#4cbb82',
  negative: '#e0685a',
  warning: '#d9a441',
  teal: '#6fb5aa',
  warmAccent: '#dccba6',
  ai: '#9b8ce8',
}

/**
 * Simulation-owned copies. The force engine writes coordinates onto nodes and
 * replaces string endpoints with node references, so domain DTOs must never be
 * passed to it directly.
 */
export interface RuntimeGraphNode extends AdvisorGraphNode {
  index?: number
  x?: number
  y?: number
  z?: number
  vx?: number
  vy?: number
  vz?: number
}

export interface RuntimeGraphLink extends Omit<AdvisorGraphLink, 'source' | 'target'> {
  index?: number
  source: string | RuntimeGraphNode
  target: string | RuntimeGraphNode
}

export interface RuntimeGraphData {
  nodes: RuntimeGraphNode[]
  links: RuntimeGraphLink[]
}

export interface RuntimeDetailProfile {
  pixelRatio: number
  warmupTicks: number
  cooldownTicks: number
  arrowResolution: number
  particleResolution: number
  particlesEnabled: boolean
}

export type PersistentLabelRole = 'selected' | 'pinned' | 'important'

export interface PersistentNodeLabel {
  nodeId: string
  role: PersistentLabelRole
}

const DESKTOP_LABEL_LIMIT = 8
const DESKTOP_PINNED_LABEL_LIMIT = 4
const DESKTOP_IMPORTANT_LABEL_LIMIT = 3
const MOBILE_LABEL_LIMIT = 4
const MOBILE_PINNED_LABEL_LIMIT = 2
const MOBILE_IMPORTANT_LABEL_LIMIT = 1

function compareNodePriority(left: AdvisorGraphNode, right: AdvisorGraphNode): number {
  const importanceDifference = (right.importance ?? 0) - (left.importance ?? 0)
  if (importanceDifference !== 0) return importanceDifference

  const confidenceDifference = (right.confidence ?? 0) - (left.confidence ?? 0)
  if (confidenceDifference !== 0) return confidenceDifference

  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0
}

export function humanNodeLabel(node: AdvisorGraphNode): string {
  const label = node.label.trim()
  return label.length > 0 && label !== node.id ? label : NODE_KIND_LABEL[node.kind]
}

/**
 * Keeps the 3D canvas readable: one selected label, a bounded subset of pins,
 * then only the most important remaining nodes. Every category is capped so a
 * large saved pin set cannot turn into a labels-all view.
 */
export function selectPersistentNodeLabels(
  nodes: readonly AdvisorGraphNode[],
  selectedNodeId: string | null,
  pinnedNodeIds: ReadonlySet<string>,
  mobile: boolean
): PersistentNodeLabel[] {
  const totalLimit = mobile ? MOBILE_LABEL_LIMIT : DESKTOP_LABEL_LIMIT
  const pinnedLimit = mobile ? MOBILE_PINNED_LABEL_LIMIT : DESKTOP_PINNED_LABEL_LIMIT
  const importantLimit = mobile ? MOBILE_IMPORTANT_LABEL_LIMIT : DESKTOP_IMPORTANT_LABEL_LIMIT
  const nodeById = new Map(nodes.map(node => [node.id, node]))
  const selectedNode = selectedNodeId === null ? undefined : nodeById.get(selectedNodeId)
  const labels: PersistentNodeLabel[] = []
  const labeledNodeIds = new Set<string>()

  const append = (
    candidates: readonly AdvisorGraphNode[],
    role: PersistentLabelRole,
    categoryLimit: number
  ) => {
    let added = 0
    for (const node of candidates) {
      if (labels.length >= totalLimit || added >= categoryLimit) break
      if (labeledNodeIds.has(node.id)) continue
      labeledNodeIds.add(node.id)
      labels.push({ nodeId: node.id, role })
      added += 1
    }
  }

  if (selectedNode) append([selectedNode], 'selected', 1)

  append(
    nodes.filter(node => pinnedNodeIds.has(node.id)).sort(compareNodePriority),
    'pinned',
    pinnedLimit
  )
  append(
    nodes
      .filter(node => typeof node.importance === 'number' && node.importance > 0)
      .sort(compareNodePriority),
    'important',
    importantLimit
  )

  return labels
}

export function buildRuntimeGraphData(
  graph: AdvisorGraph,
  visibleNodeKinds: ReadonlySet<AdvisorGraphNodeKind>,
  visibleLinkKinds: ReadonlySet<AdvisorGraphLinkKind>
): RuntimeGraphData {
  const nodes = graph.nodes
    .filter(node => visibleNodeKinds.has(node.kind))
    .map(node => ({ ...node }))
  const nodeIds = new Set(nodes.map(node => node.id))
  const links = graph.links
    .filter(
      graphLink =>
        nodeIds.has(graphLink.source) &&
        nodeIds.has(graphLink.target) &&
        visibleLinkKinds.has(graphLink.kind)
    )
    .map(graphLink => ({ ...graphLink }))

  return { nodes, links }
}

export function runtimeEndpointId(endpoint: RuntimeGraphLink['source']): string {
  return typeof endpoint === 'string' ? endpoint : endpoint.id
}

export function runtimeLinkKey(graphLink: RuntimeGraphLink): string {
  return linkKey({
    source: runtimeEndpointId(graphLink.source),
    target: runtimeEndpointId(graphLink.target),
    kind: graphLink.kind,
  })
}

export function toAdvisorGraphLink(graphLink: RuntimeGraphLink): AdvisorGraphLink {
  return {
    source: runtimeEndpointId(graphLink.source),
    target: runtimeEndpointId(graphLink.target),
    kind: graphLink.kind,
    ...(graphLink.label !== undefined ? { label: graphLink.label } : {}),
    ...(graphLink.confidence !== undefined ? { confidence: graphLink.confidence } : {}),
    ...(graphLink.strength !== undefined ? { strength: graphLink.strength } : {}),
    ...(graphLink.observedAt !== undefined ? { observedAt: graphLink.observedAt } : {}),
    ...(graphLink.summary !== undefined ? { summary: graphLink.summary } : {}),
  }
}

export function resolveRuntimeDetailProfile(
  preset: KnowledgeGraphPreset,
  mobile: boolean,
  reducedMotion: boolean,
  devicePixelRatio: number
): RuntimeDetailProfile {
  const safePixelRatio =
    Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1
  const pixelRatioCap =
    reducedMotion || mobile || preset === 'performance' ? 1 : preset === 'cinematic' ? 1.75 : 1.5

  if (reducedMotion) {
    return {
      pixelRatio: Math.min(safePixelRatio, pixelRatioCap),
      warmupTicks: 40,
      cooldownTicks: 0,
      arrowResolution: 3,
      particleResolution: 2,
      particlesEnabled: false,
    }
  }

  if (mobile || preset === 'performance') {
    return {
      pixelRatio: Math.min(safePixelRatio, pixelRatioCap),
      warmupTicks: 10,
      cooldownTicks: 90,
      arrowResolution: 3,
      particleResolution: 2,
      particlesEnabled: false,
    }
  }

  return {
    pixelRatio: Math.min(safePixelRatio, pixelRatioCap),
    warmupTicks: preset === 'cinematic' ? 30 : 20,
    cooldownTicks: preset === 'cinematic' ? 180 : 140,
    arrowResolution: preset === 'cinematic' ? 6 : 5,
    particleResolution: preset === 'cinematic' ? 4 : 3,
    particlesEnabled: true,
  }
}
