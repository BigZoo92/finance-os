export type KnowledgeMode = 'demo' | 'admin' | 'internal'
export type KnowledgeRetrievalMode = 'hybrid' | 'graph' | 'vector' | 'fulltext'

export interface KnowledgeStatsResponse {
  ok: boolean
  requestId: string
  generatedAt: string
  backend: string
  vectorBackend: string
  entityCount: number
  relationCount: number
  historicalEntityCount: number
  historicalRelationCount: number
  sourceCounts: Record<string, number>
  entityTypeCounts: Record<string, number>
  relationTypeCounts: Record<string, number>
  contradictionCount: number
  supersededFactCount: number
  dedupeCount: number
  ingestCount: number
  lastIngestAt: string | null
  lastSuccessfulRebuildAt: string | null
  lastFailureReason: string | null
  queryLatencyMs: number
  graphTraversalLatencyMs: number
  vectorRetrievalLatencyMs: number
  fulltextRetrievalLatencyMs: number
  contextBundleTokenEstimate: number
  rebuildDurationMs: number
  fallbackUsageCount: number
  storageSizeBytes: number
  degraded?: boolean
  fallbackReason?: string | null
  backendHealth?: KnowledgeBackendHealth
}

export interface KnowledgeBackendHealth {
  neo4j: { available: boolean; lastError: string | null; database: string }
  qdrant: { available: boolean; lastError: string | null; collection: string }
  degradedReasons: string[]
  productionActive: boolean
}

export interface KnowledgeSchemaResponse {
  ok: boolean
  requestId: string
  schemaVersion: string
  nodeTypes: string[]
  relationTypes: string[]
  temporalFields: string[]
  selectedProductionBackends?: {
    graph: string
    vector: string
    fullText: string
  }
  degraded?: boolean
  fallbackReason?: string | null
}

export interface KnowledgeEntity {
  id: string
  type: string
  label: string
  description: string
  source: string
  sourceRef?: string | null
  sourceUrl?: string | null
  createdAt: string
  updatedAt: string
  observedAt?: string | null
  validFrom?: string | null
  validTo?: string | null
  invalidatedAt?: string | null
  supersededBy?: string | null
  sourceTimestamp?: string | null
  ingestionTimestamp: string
  confidence: number
  severity?: number | null
  impact?: number | null
  tags: string[]
  scope: KnowledgeMode
  metadata: Record<string, unknown>
}

export interface KnowledgeRelation {
  id: string
  type: string
  fromId: string
  toId: string
  label?: string | null
  description?: string
  confidence: number
  weight?: number
  tags?: string[]
}

export interface KnowledgeHit {
  entity: KnowledgeEntity
  score: {
    total: number
    fulltext: number
    vector: number
    graph: number
    temporal: number
    confidence: number
    provenance: number
    relationWeight: number
  }
  why: string[]
  relations: KnowledgeRelation[]
  paths: Array<{
    pathId: string
    score: number
    explanation: string
    steps: Array<{ entity: KnowledgeEntity; viaRelation?: KnowledgeRelation | null }>
  }>
  evidence: KnowledgeEntity[]
  contradictoryEvidence: KnowledgeEntity[]
}

export interface KnowledgeQueryResponse {
  ok: boolean
  requestId: string
  mode: KnowledgeMode
  query: string
  retrievalMode: KnowledgeRetrievalMode
  generatedAt: string
  hits: KnowledgeHit[]
  metrics: Record<string, unknown>
  degraded: boolean
  fallbackReason: string | null
}

export interface KnowledgeContextItem {
  id: string
  type: string
  title: string
  summary: string
  confidence: number
  recency: number
  provenanceRefs: string[]
  why: string[]
}

export interface KnowledgeContextBundleResponse {
  requestId: string
  mode: KnowledgeMode
  generatedAt: string
  query: string
  maxTokens: number
  tokenEstimate: number
  summary: string
  entities: KnowledgeContextItem[]
  relations: KnowledgeRelation[]
  graphPaths: KnowledgeHit['paths']
  evidence: KnowledgeContextItem[]
  contradictoryEvidence: KnowledgeContextItem[]
  assumptions: KnowledgeContextItem[]
  unknowns: string[]
  retrievalExplanation: string[]
  confidence: number
  recency: number
  degraded: boolean
  fallbackReason: string | null
}

export interface KnowledgeRebuildResponse {
  ok: boolean
  requestId: string
  dryRun: boolean
  startedAt: string
  finishedAt: string
  durationMs: number
  entityCount: number
  relationCount: number
  dedupeCount: number
}
