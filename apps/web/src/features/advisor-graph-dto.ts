/**
 * Advisor Knowledge Graph DTO — wire shape mirrored from the backend
 * (`apps/api/src/routes/dashboard/domain/advisor/knowledge-graph-dto.ts`).
 *
 * Kept as a small standalone module so the page can import the typed
 * shape without pulling the heavier `advisor-graph-data` view-model.
 *
 * Mapping `dto → AdvisorGraph` (the renderer's view-model) lives here
 * too so the page stays thin.
 */
import type {
  AdvisorGraph,
  AdvisorGraphLink,
  AdvisorGraphLinkKind,
  AdvisorGraphNode,
  AdvisorGraphNodeKind,
} from './advisor-graph-data'

// ─── DTO types (mirror of backend) ────────────────────────────────────────

export type AdvisorGraphOriginDto = 'real' | 'demo' | 'example'

export type AdvisorGraphFreshnessDto = 'fresh' | 'stale' | 'unknown'

export interface AdvisorGraphNodeDto {
  id: string
  label: string
  kind: AdvisorGraphNodeKind
  group?: string
  confidence?: number
  freshness?: AdvisorGraphFreshnessDto
  importance?: number
  observedAt?: string
  source?: string
  summary?: string
  whyItMatters?: string
  origin: AdvisorGraphOriginDto
  isPersonal?: boolean
  isSensitive?: boolean
  isContradicted?: boolean
  metadata?: Record<string, unknown>
}

export interface AdvisorGraphLinkDto {
  source: string
  target: string
  kind: AdvisorGraphLinkKind
  label?: string
  confidence?: number
  strength?: number
  observedAt?: string
  summary?: string
  origin: AdvisorGraphOriginDto
  metadata?: Record<string, unknown>
}

export type AdvisorKnowledgeGraphMetaOriginDto =
  | 'real'
  | 'demo'
  | 'mixed'
  | 'empty'
  | 'degraded'

export interface AdvisorKnowledgeGraphDto {
  nodes: AdvisorGraphNodeDto[]
  links: AdvisorGraphLinkDto[]
  meta: {
    origin: AdvisorKnowledgeGraphMetaOriginDto
    generatedAt: string
    scope: string
    nodeCount: number
    linkCount: number
    freshness: AdvisorGraphFreshnessDto
    degraded?: boolean
    reason?: string
    redacted?: boolean
    source?: 'knowledge-service' | 'advisor-artifacts' | 'demo' | 'fallback'
  }
}

export type AdvisorKnowledgeGraphScope =
  | 'overview'
  | 'advisor'
  | 'recommendations'
  | 'sources'
  | 'risk'
  | 'personal'

// ─── DTO → view-model mapper ─────────────────────────────────────────────

/**
 * Map the wire DTO into the renderer's `AdvisorGraph` view-model. The
 * mapping is straightforward because the DTO is already the typed shape;
 * we only adapt the meta to the existing `AdvisorGraph` envelope and
 * translate per-node `origin: "demo" | "example" | "real"` to the
 * `isExample` boolean the renderer already understands.
 */
export const mapAdvisorKnowledgeGraphDtoToViewModel = (
  dto: AdvisorKnowledgeGraphDto
): AdvisorGraph => {
  const nodes: AdvisorGraphNode[] = dto.nodes.map(node => {
    const view: AdvisorGraphNode = {
      id: node.id,
      label: node.label,
      kind: node.kind,
    }
    if (node.group !== undefined) view.group = node.group
    if (node.confidence !== undefined) view.confidence = node.confidence
    if (node.freshness !== undefined) view.freshness = node.freshness
    if (node.importance !== undefined) view.importance = node.importance
    if (node.observedAt !== undefined) view.observedAt = node.observedAt
    if (node.source !== undefined) view.source = node.source
    if (node.summary !== undefined) view.summary = node.summary
    if (node.isPersonal === true) view.isPersonal = true
    if (node.isSensitive === true) view.isSensitive = true
    if (node.isContradicted === true) view.isContradicted = true
    if (node.origin === 'example') view.isExample = true
    return view
  })

  const links: AdvisorGraphLink[] = dto.links.map(link => {
    const view: AdvisorGraphLink = {
      source: link.source,
      target: link.target,
      kind: link.kind,
    }
    if (link.label !== undefined) view.label = link.label
    if (link.confidence !== undefined) view.confidence = link.confidence
    if (link.strength !== undefined) view.strength = link.strength
    if (link.observedAt !== undefined) view.observedAt = link.observedAt
    if (link.summary !== undefined) view.summary = link.summary
    return view
  })

  const realNodeCount = nodes.filter(n => !n.isExample).length
  const exampleNodeCount = nodes.length - realNodeCount

  // Translate the DTO meta.origin to the view-model's narrower union.
  const origin: AdvisorGraph['meta']['origin'] =
    dto.meta.origin === 'degraded'
      ? 'empty'
      : dto.meta.origin

  return {
    nodes,
    links,
    meta: {
      origin,
      summary:
        dto.meta.reason ??
        `Mémoire Advisor — ${nodes.length} nœuds, ${links.length} relations.`,
      nodeCount: nodes.length,
      linkCount: links.length,
      realNodeCount,
      exampleNodeCount,
      ...(dto.meta.degraded === true ? { degraded: true } : {}),
    },
  }
}
