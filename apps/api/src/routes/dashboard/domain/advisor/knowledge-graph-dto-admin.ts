/**
 * Admin-mode builder for the Advisor Knowledge Graph DTO.
 *
 * Transforms a knowledge-service `contextBundle` response (and optionally
 * a `query` hits response) into the typed DTO. Pure function — no I/O,
 * no provider/LLM calls. The route handler is responsible for fetching
 * the raw data and passing it here.
 *
 * Trust contract: outputs `meta.origin = 'real'` when there is enough
 * graph-ready data, `meta.origin = 'empty'` otherwise. Never silently
 * mixes example data — the example overlay is the route's job.
 */
import type {
  AdvisorGraphLinkDto,
  AdvisorGraphNodeDto,
  AdvisorKnowledgeGraphDto,
  AdvisorKnowledgeGraphScope,
} from './knowledge-graph-dto'
import {
  filterByScope,
  hardenGraphDto,
  inferFreshnessFromRecency,
  inferLinkKindFromType,
  inferNodeKindFromType,
} from './knowledge-graph-dto'

// Minimal structural shapes we accept from the knowledge service. We do
// not bind to its full types because the service contract evolves and
// we only need a few fields to assemble the DTO.

export interface KnowledgeBundleEntityShape {
  id?: unknown
  type?: unknown
  title?: unknown
  summary?: unknown
  confidence?: unknown
  recency?: unknown
  provenanceRefs?: unknown
}

export interface KnowledgeBundleRelationShape {
  fromId?: unknown
  toId?: unknown
  type?: unknown
  label?: unknown
  description?: unknown
  confidence?: unknown
  weight?: unknown
}

export interface KnowledgePathStepShape {
  entity?: unknown
  viaRelation?: unknown
}

export interface KnowledgePathShape {
  pathId?: unknown
  steps?: unknown
}

export interface KnowledgeBundleShape {
  entities?: unknown
  relations?: unknown
  evidence?: unknown
  contradictoryEvidence?: unknown
  assumptions?: unknown
  graphPaths?: unknown
  degraded?: unknown
}

export interface KnowledgeQueryHitShape {
  entity?: unknown
  relations?: unknown
  evidence?: unknown
  contradictoryEvidence?: unknown
  paths?: unknown
  score?: unknown
}

export interface KnowledgeQueryShape {
  hits?: unknown
  degraded?: unknown
}

const MIN_REAL_NODES_FOR_RENDER = 4

const isString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

const readString = (value: unknown, fallback = ''): string =>
  isString(value) ? value : fallback

const readNumber = (value: unknown): number | undefined =>
  isFiniteNumber(value) ? value : undefined

const readEntityShape = (raw: unknown): KnowledgeBundleEntityShape | null => {
  if (!raw || typeof raw !== 'object') return null
  return raw as KnowledgeBundleEntityShape
}

interface NodeAccumulator {
  byId: Map<string, AdvisorGraphNodeDto>
}

const upsertNode = (acc: NodeAccumulator, node: AdvisorGraphNodeDto): void => {
  const existing = acc.byId.get(node.id)
  if (!existing) {
    acc.byId.set(node.id, node)
    return
  }
  const merged: AdvisorGraphNodeDto = {
    ...existing,
    ...node,
    confidence: Math.max(existing.confidence ?? 0, node.confidence ?? 0),
    importance: Math.max(existing.importance ?? 0, node.importance ?? 0),
  }
  if (existing.isContradicted === true || node.isContradicted === true) {
    merged.isContradicted = true
  }
  acc.byId.set(node.id, merged)
}

const ingestEntity = (
  acc: NodeAccumulator,
  raw: KnowledgeBundleEntityShape,
  hints: { importanceScale?: number; forceContradiction?: boolean } = {}
): void => {
  const id = readString(raw.id)
  if (!id) return
  const type = readString(raw.type)
  const title = readString(raw.title, id)
  const summary = readString(raw.summary)
  const confidence = readNumber(raw.confidence)
  const recency = readNumber(raw.recency)
  const importance = confidence !== undefined ? confidence * (hints.importanceScale ?? 1) : undefined
  const provenanceRefs = asArray(raw.provenanceRefs).filter(isString)
  const node: AdvisorGraphNodeDto = {
    id,
    label: title,
    kind: hints.forceContradiction === true ? 'contradiction' : inferNodeKindFromType(type),
    origin: 'real',
    freshness: inferFreshnessFromRecency(recency),
  }
  if (summary) node.summary = summary
  if (confidence !== undefined) node.confidence = confidence
  if (importance !== undefined) node.importance = importance
  const provenance = provenanceRefs[0]
  if (provenance) node.source = provenance
  if (hints.forceContradiction === true) node.isContradicted = true
  upsertNode(acc, node)
}

const ingestPathEntity = (acc: NodeAccumulator, raw: unknown): void => {
  if (!raw || typeof raw !== 'object') return
  const entity = raw as {
    id?: unknown
    type?: unknown
    label?: unknown
    description?: unknown
    confidence?: unknown
    source?: unknown
  }
  const id = readString(entity.id)
  if (!id) return
  const type = readString(entity.type)
  const label = readString(entity.label, id)
  const summary = readString(entity.description)
  const confidence = readNumber(entity.confidence)
  const sourceRef = readString(entity.source)
  const node: AdvisorGraphNodeDto = {
    id,
    label,
    kind: inferNodeKindFromType(type),
    origin: 'real',
    freshness: 'fresh',
  }
  if (summary) node.summary = summary
  if (confidence !== undefined) node.confidence = confidence
  if (sourceRef) node.source = sourceRef
  upsertNode(acc, node)
}

const ingestRelation = (
  links: AdvisorGraphLinkDto[],
  raw: KnowledgeBundleRelationShape
): void => {
  const fromId = readString(raw.fromId)
  const toId = readString(raw.toId)
  if (!fromId || !toId) return
  const type = readString(raw.type)
  const label = readString(raw.label, type || undefined)
  const summary = readString(raw.description)
  const confidence = readNumber(raw.confidence)
  const weight = readNumber(raw.weight)
  const link: AdvisorGraphLinkDto = {
    source: fromId,
    target: toId,
    kind: inferLinkKindFromType(type),
    origin: 'real',
  }
  if (label) link.label = label
  if (summary) link.summary = summary
  if (confidence !== undefined) link.confidence = confidence
  if (weight !== undefined) link.strength = weight
  else if (confidence !== undefined) link.strength = confidence
  links.push(link)
}

export interface BuildAdminGraphArgs {
  scope: AdvisorKnowledgeGraphScope
  limit: number
  generatedAt: string
  bundle?: KnowledgeBundleShape | undefined
  query?: KnowledgeQueryShape | undefined
}

/**
 * Build the admin-mode DTO from raw knowledge-service responses. Returns
 * an `empty` DTO if there isn't enough graph-ready data — the UI handles
 * the empty-state messaging.
 */
export const buildAdminKnowledgeGraphDto = ({
  scope,
  limit,
  generatedAt,
  bundle,
  query,
}: BuildAdminGraphArgs): AdvisorKnowledgeGraphDto => {
  const acc: NodeAccumulator = { byId: new Map() }
  const links: AdvisorGraphLinkDto[] = []

  if (bundle) {
    for (const raw of asArray(bundle.entities)) {
      const shape = readEntityShape(raw)
      if (shape) ingestEntity(acc, shape, { importanceScale: 1 })
    }
    for (const raw of asArray(bundle.evidence)) {
      const shape = readEntityShape(raw)
      if (shape) ingestEntity(acc, shape, { importanceScale: 0.9 })
    }
    for (const raw of asArray(bundle.contradictoryEvidence)) {
      const shape = readEntityShape(raw)
      if (shape) ingestEntity(acc, shape, { importanceScale: 1, forceContradiction: true })
    }
    for (const raw of asArray(bundle.assumptions)) {
      const shape = readEntityShape(raw)
      if (shape) ingestEntity(acc, shape, { importanceScale: 0.7 })
    }
    for (const raw of asArray(bundle.relations)) {
      if (raw && typeof raw === 'object') ingestRelation(links, raw as KnowledgeBundleRelationShape)
    }
    for (const rawPath of asArray(bundle.graphPaths)) {
      if (!rawPath || typeof rawPath !== 'object') continue
      const path = rawPath as KnowledgePathShape
      for (const rawStep of asArray(path.steps)) {
        if (!rawStep || typeof rawStep !== 'object') continue
        const step = rawStep as KnowledgePathStepShape
        ingestPathEntity(acc, step.entity)
        if (step.viaRelation && typeof step.viaRelation === 'object') {
          ingestRelation(links, step.viaRelation as KnowledgeBundleRelationShape)
        }
      }
    }
  }

  if (query) {
    for (const rawHit of asArray(query.hits)) {
      if (!rawHit || typeof rawHit !== 'object') continue
      const hit = rawHit as KnowledgeQueryHitShape
      if (hit.entity && typeof hit.entity === 'object') {
        ingestPathEntity(acc, hit.entity)
      }
      for (const rel of asArray(hit.relations)) {
        if (rel && typeof rel === 'object') ingestRelation(links, rel as KnowledgeBundleRelationShape)
      }
      for (const ev of asArray(hit.evidence)) {
        const shape = readEntityShape(ev)
        if (shape) ingestEntity(acc, shape)
      }
      for (const c of asArray(hit.contradictoryEvidence)) {
        const shape = readEntityShape(c)
        if (shape) ingestEntity(acc, shape, { forceContradiction: true })
      }
    }
  }

  const allNodes = Array.from(acc.byId.values())
  const scopedNodes = filterByScope(allNodes, scope).slice(0, limit)
  const validIds = new Set(scopedNodes.map(n => n.id))
  const scopedLinks = links.filter(l => validIds.has(l.source) && validIds.has(l.target))

  const degraded = bundle?.degraded === true || query?.degraded === true

  if (scopedNodes.length < MIN_REAL_NODES_FOR_RENDER) {
    return hardenGraphDto({
      nodes: [],
      links: [],
      meta: {
        origin: degraded ? 'degraded' : 'empty',
        generatedAt,
        scope,
        nodeCount: 0,
        linkCount: 0,
        freshness: 'unknown',
        degraded,
        reason: degraded
          ? 'Knowledge service degraded; the deterministic finance-engine remains primary.'
          : 'No graph-ready knowledge data available yet. Lance une mission Advisor pour générer plus de relations.',
        source: 'advisor-artifacts',
      },
    })
  }

  return hardenGraphDto({
    nodes: scopedNodes,
    links: scopedLinks,
    meta: {
      origin: 'real',
      generatedAt,
      scope,
      nodeCount: scopedNodes.length,
      linkCount: scopedLinks.length,
      freshness: 'fresh',
      degraded,
      source: 'advisor-artifacts',
    },
  })
}

export { MIN_REAL_NODES_FOR_RENDER }
