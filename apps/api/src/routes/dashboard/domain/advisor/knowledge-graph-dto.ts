/**
 * Advisor Knowledge Graph DTO — typed, redacted, graph-visualization-ready
 * shape returned by `GET /dashboard/advisor/knowledge/graph`.
 *
 * Single source of truth for the wire format. Both the API route and the
 * frontend mapper import from here to stay in sync. We deliberately keep
 * this module dependency-free (no Elysia, no DB, no provider clients) so
 * it's trivially testable and importable from anywhere in the workspace.
 *
 * Trust contract:
 *   - real    → assembled strictly from admin Advisor memory
 *   - demo    → deterministic curated fixture, no provider/LLM/DB access
 *   - example → opt-in illustrative nodes mixed alongside real (admin)
 *   - mixed   → real + tagged example
 *   - empty   → no graph-ready data; UI prompts the user
 *   - degraded → service unavailable; same shape, with a reason
 */

// ─── kinds ────────────────────────────────────────────────────────────────

export type AdvisorGraphNodeKind =
  | 'personal_snapshot'
  | 'financial_account'
  | 'transaction_cluster'
  | 'asset'
  | 'investment'
  | 'goal'
  | 'recommendation'
  | 'assumption'
  | 'market_signal'
  | 'news_signal'
  | 'social_signal'
  | 'concept'
  | 'formula'
  | 'risk'
  | 'source'
  | 'contradiction'
  | 'unknown'

export type AdvisorGraphLinkKind =
  | 'supports'
  | 'explains'
  | 'contradicts'
  | 'weakens'
  | 'derived_from'
  | 'related_to'
  | 'affects'
  | 'mentions'
  | 'uses_assumption'
  | 'belongs_to'

export type AdvisorGraphOrigin = 'real' | 'demo' | 'example'

export type AdvisorGraphFreshness = 'fresh' | 'stale' | 'unknown'

export type AdvisorKnowledgeGraphMetaOrigin =
  | 'real'
  | 'demo'
  | 'mixed'
  | 'empty'
  | 'degraded'

export interface AdvisorGraphNodeDto {
  id: string
  label: string
  kind: AdvisorGraphNodeKind
  group?: string
  confidence?: number
  freshness?: AdvisorGraphFreshness
  importance?: number
  observedAt?: string
  source?: string
  summary?: string
  whyItMatters?: string
  origin: AdvisorGraphOrigin
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
  origin: AdvisorGraphOrigin
  metadata?: Record<string, unknown>
}

export interface AdvisorKnowledgeGraphDto {
  nodes: AdvisorGraphNodeDto[]
  links: AdvisorGraphLinkDto[]
  meta: {
    origin: AdvisorKnowledgeGraphMetaOrigin
    generatedAt: string
    scope: string
    nodeCount: number
    linkCount: number
    freshness: AdvisorGraphFreshness
    degraded?: boolean
    reason?: string
    redacted?: boolean
    source?: 'knowledge-service' | 'advisor-artifacts' | 'demo' | 'fallback'
  }
}

// ─── scopes ──────────────────────────────────────────────────────────────

export type AdvisorKnowledgeGraphScope =
  | 'overview'
  | 'advisor'
  | 'recommendations'
  | 'sources'
  | 'risk'
  | 'personal'

const SCOPE_INCLUDES: Record<
  AdvisorKnowledgeGraphScope,
  ReadonlyArray<AdvisorGraphNodeKind>
> = {
  overview: [
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
    'source',
    'contradiction',
    'unknown',
  ],
  advisor: [
    'recommendation',
    'assumption',
    'risk',
    'contradiction',
    'concept',
    'formula',
    'source',
    'investment',
    'asset',
    'goal',
  ],
  recommendations: [
    'recommendation',
    'assumption',
    'risk',
    'concept',
    'investment',
    'asset',
  ],
  sources: ['source', 'concept', 'formula', 'recommendation'],
  risk: ['risk', 'contradiction', 'assumption', 'recommendation', 'investment', 'asset'],
  personal: [
    'personal_snapshot',
    'financial_account',
    'transaction_cluster',
    'asset',
    'investment',
    'goal',
  ],
}

// ─── helpers ─────────────────────────────────────────────────────────────

export const isValidScope = (raw: unknown): raw is AdvisorKnowledgeGraphScope =>
  typeof raw === 'string' && raw in SCOPE_INCLUDES

export const filterByScope = <T extends { kind: AdvisorGraphNodeKind }>(
  nodes: ReadonlyArray<T>,
  scope: AdvisorKnowledgeGraphScope
): T[] => {
  const allow = new Set(SCOPE_INCLUDES[scope])
  return nodes.filter(n => allow.has(n.kind))
}

const inferFreshnessFromRecency = (recency: number | undefined): AdvisorGraphFreshness => {
  if (recency === undefined) return 'unknown'
  if (recency >= 0.7) return 'fresh'
  if (recency >= 0.3) return 'stale'
  return 'unknown'
}

const TYPE_TO_KIND: Array<{ test: RegExp; kind: AdvisorGraphNodeKind }> = [
  { test: /snapshot|userfinancialstate/i, kind: 'personal_snapshot' },
  { test: /goal/i, kind: 'goal' },
  { test: /transactioncluster|recurringcommitment|budget/i, kind: 'transaction_cluster' },
  { test: /account/i, kind: 'financial_account' },
  { test: /portfolio|investment|position/i, kind: 'investment' },
  { test: /asset|ticker|sector|region/i, kind: 'asset' },
  { test: /recommendation/i, kind: 'recommendation' },
  { test: /assumption/i, kind: 'assumption' },
  { test: /macrosignal|marketevent|indicator/i, kind: 'market_signal' },
  { test: /newssignal|news/i, kind: 'news_signal' },
  { test: /tweet|social/i, kind: 'social_signal' },
  { test: /formula|mathconcept/i, kind: 'formula' },
  { test: /concept|tradingstrategy|personalfinancerule/i, kind: 'concept' },
  { test: /risk/i, kind: 'risk' },
  { test: /contradiction/i, kind: 'contradiction' },
  { test: /source|provider|sourcedocument|evidence/i, kind: 'source' },
]

const RELATION_TO_KIND: Array<{ test: RegExp; kind: AdvisorGraphLinkKind }> = [
  { test: /supported_by|reinforces|justifies|generated_recommendation/i, kind: 'supports' },
  { test: /contradicted_by|invalidates/i, kind: 'contradicts' },
  { test: /weakens/i, kind: 'weakens' },
  { test: /derived_from|defines|uses_formula/i, kind: 'derived_from' },
  { test: /requires_assumption/i, kind: 'uses_assumption' },
  {
    test: /affects|impacts|increases_risk|decreases_risk|affects_asset|affects_sector|affects_goal|mitigates/i,
    kind: 'affects',
  },
  { test: /observed_in|mentions|triggered_by/i, kind: 'mentions' },
  { test: /belongs|part_of/i, kind: 'belongs_to' },
  { test: /correlates_with|similar_to|leads_to|causes/i, kind: 'related_to' },
  { test: /explain/i, kind: 'explains' },
]

export const inferNodeKindFromType = (type: string | undefined): AdvisorGraphNodeKind => {
  if (!type) return 'unknown'
  for (const rule of TYPE_TO_KIND) if (rule.test.test(type)) return rule.kind
  return 'unknown'
}

export const inferLinkKindFromType = (type: string | undefined): AdvisorGraphLinkKind => {
  if (!type) return 'related_to'
  for (const rule of RELATION_TO_KIND) if (rule.test.test(type)) return rule.kind
  return 'related_to'
}

export { SCOPE_INCLUDES, inferFreshnessFromRecency }

// ─── safe redaction ──────────────────────────────────────────────────────

/**
 * Strip any field that could carry sensitive provider material.
 * Whitelist-based: we only keep small, primitive metadata that has been
 * explicitly allow-listed, never raw payloads.
 */
const SAFE_METADATA_KEYS = new Set([
  'kind',
  'topic',
  'severity',
  'category',
  'sector',
  'region',
  'sourceType',
  'temporalKind',
])

export const redactMetadata = (
  metadata: Record<string, unknown> | undefined
): Record<string, unknown> | undefined => {
  if (!metadata) return undefined
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(metadata)) {
    if (!SAFE_METADATA_KEYS.has(key)) continue
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      out[key] = value
    }
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/**
 * Final hardening: ensures all link endpoints reference an existing node,
 * de-dupes links, clamps numeric fields and clears any leaking metadata.
 */
export const hardenGraphDto = (dto: AdvisorKnowledgeGraphDto): AdvisorKnowledgeGraphDto => {
  const ids = new Set(dto.nodes.map(n => n.id))
  const seen = new Set<string>()
  const links: AdvisorGraphLinkDto[] = []
  for (const link of dto.links) {
    if (!ids.has(link.source) || !ids.has(link.target)) continue
    const key = `${link.source}::${link.kind}::${link.target}`
    if (seen.has(key)) continue
    seen.add(key)
    const cleaned: AdvisorGraphLinkDto = { ...link }
    const md = redactMetadata(link.metadata)
    if (md) cleaned.metadata = md
    else delete cleaned.metadata
    if (typeof cleaned.confidence === 'number') {
      cleaned.confidence = Math.min(1, Math.max(0, cleaned.confidence))
    }
    if (typeof cleaned.strength === 'number') {
      cleaned.strength = Math.min(1, Math.max(0, cleaned.strength))
    }
    links.push(cleaned)
  }
  const nodes: AdvisorGraphNodeDto[] = dto.nodes.map(node => {
    const cleaned: AdvisorGraphNodeDto = { ...node }
    const md = redactMetadata(node.metadata)
    if (md) cleaned.metadata = md
    else delete cleaned.metadata
    if (typeof cleaned.confidence === 'number') {
      cleaned.confidence = Math.min(1, Math.max(0, cleaned.confidence))
    }
    if (typeof cleaned.importance === 'number') {
      cleaned.importance = Math.min(1, Math.max(0, cleaned.importance))
    }
    return cleaned
  })
  return {
    nodes,
    links,
    meta: {
      ...dto.meta,
      nodeCount: nodes.length,
      linkCount: links.length,
      redacted: true,
    },
  }
}
