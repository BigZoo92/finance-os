/**
 * Memory (knowledge graph) readiness model for the Ops/Memory UI.
 *
 * Maps the `/ops/knowledge/enrichment/status` payload to one of five honest
 * states so the UI never claims the graph is "ready" while Qdrant/Neo4j are
 * empty or while running on the local fallback.
 */

export type MemoryReadinessState = 'demo' | 'degraded' | 'fallback' | 'empty' | 'ready'

export type EnrichmentStorage = {
  reachable: boolean | null
  backend: string | null
  productionConfigured: boolean | null
  productionActive: boolean | null
  fallbackActive: boolean | null
  qdrantReachable: boolean | null
  qdrantCollectionExists: boolean | null
  qdrantCollection: string | null
  qdrantPoints: number | null
  neo4jReachable: boolean | null
  neo4jNodes: number | null
  neo4jRelationships: number | null
  neo4jDatabase: string | null
  empty: boolean | null
  emptyBecauseNoIngest?: boolean | null
}

export type EnrichmentStatusResponse = {
  mode: 'demo' | 'admin'
  enabled?: boolean
  status?: string
  serviceHealth?: { status: 'ok' | 'degraded' | 'unavailable' } | null
  storage: EnrichmentStorage | null
}

export type MemoryReadinessDescriptor = {
  state: MemoryReadinessState
  label: string
  detail: string
}

/**
 * Precedence (most-blocking first): demo fixture, unreachable/degraded service,
 * local fallback (production backends not active), empty graph (ready storage
 * but nothing ingested), then ready. An empty graph is explicitly NOT "ready".
 */
export const describeMemoryReadiness = (
  status: EnrichmentStatusResponse | null | undefined
): MemoryReadinessDescriptor => {
  if (!status || status.mode === 'demo') {
    return {
      state: 'demo',
      label: 'Démo',
      detail: 'Fixture déterministe: aucune mémoire de production.',
    }
  }

  const storage = status.storage
  if (
    !storage ||
    storage.reachable === false ||
    status.serviceHealth?.status === 'unavailable'
  ) {
    return {
      state: 'degraded',
      label: 'Dégradé',
      detail:
        'Service mémoire injoignable. Vérifier knowledge-service, Qdrant et Neo4j.',
    }
  }

  if (storage.fallbackActive === true || storage.backend === 'local' || storage.productionActive === false) {
    return {
      state: 'fallback',
      label: 'Fallback local',
      detail:
        'Backends de production non actifs: la mémoire utilise le cache local déterministe.',
    }
  }

  if (storage.empty === true) {
    return {
      state: 'empty',
      label: 'Vide (aucun ingest)',
      detail:
        'Stockage prêt mais vide: aucun ingest ni rebuild lancé depuis le déploiement.',
    }
  }

  return {
    state: 'ready',
    label: 'Prête',
    detail: `Neo4j ${storage.neo4jNodes ?? 0} nœuds · Qdrant ${storage.qdrantPoints ?? 0} points.`,
  }
}
