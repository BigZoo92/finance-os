import { schema } from '@finance-os/db'
import { desc, sql } from 'drizzle-orm'
import { Elysia } from 'elysia'
import { getAuth, getRequestMeta } from '../../auth/context'
import { requireAdmin } from '../../auth/guard'
import type { ApiDb } from '../dashboard/types'

type KnowledgeServiceDeps = {
  db: ApiDb
  knowledgeServiceEnabled: boolean
  knowledgeServiceUrl: string
  knowledgeServiceTimeoutMs: number
  advisorGraphIngestEnabled: boolean
}

type KnowledgeStorageStatus = {
  backend?: string
  productionConfigured?: boolean
  productionActive?: boolean
  fallbackActive?: boolean
  empty?: boolean
  neo4j?: {
    reachable?: boolean
    nodes?: number
    relationships?: number
    database?: string | null
    lastError?: string | null
  }
  qdrant?: {
    reachable?: boolean
    collectionExists?: boolean
    collection?: string | null
    points?: number
    lastError?: string | null
  }
}

type KnowledgeServiceCallResult = {
  ok: boolean
  status: number
  payload: unknown
  errorName: string | null
}

const callKnowledgeService = async (
  {
    knowledgeServiceUrl,
    knowledgeServiceTimeoutMs,
  }: { knowledgeServiceUrl: string; knowledgeServiceTimeoutMs: number },
  path: string,
  requestId: string,
  method: 'GET' | 'POST' = 'GET'
): Promise<KnowledgeServiceCallResult> => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), knowledgeServiceTimeoutMs)
  try {
    const response = await fetch(`${knowledgeServiceUrl.replace(/\/$/, '')}${path}`, {
      method,
      headers: { 'x-request-id': requestId },
      signal: controller.signal,
    })
    let payload: unknown = null
    try {
      payload = await response.json()
    } catch {
      payload = null
    }
    return {
      ok: response.ok,
      status: response.status,
      payload,
      errorName: response.ok ? null : `HTTP_${response.status}`,
    }
  } catch (error) {
    return {
      ok: false,
      status: 0,
      payload: null,
      errorName: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
    }
  } finally {
    clearTimeout(timeout)
  }
}

const extractStorage = (payload: unknown): KnowledgeStorageStatus | null => {
  if (!payload || typeof payload !== 'object') {
    return null
  }
  const storage = (payload as { storage?: unknown }).storage
  if (!storage || typeof storage !== 'object') {
    return null
  }
  return storage as KnowledgeStorageStatus
}

/**
 * Normalize the knowledge-service storage status into the flat, UI-friendly
 * shape the Ops surface renders. `reachable` is whether we got a storage
 * snapshot at all; nulls mean "unknown" (service unreachable or disabled).
 */
const buildStorageBlock = (storage: KnowledgeStorageStatus | null, reachable: boolean) => ({
  reachable,
  backend: storage?.backend ?? null,
  productionConfigured: storage?.productionConfigured ?? null,
  productionActive: storage?.productionActive ?? null,
  fallbackActive: storage?.fallbackActive ?? null,
  qdrantReachable: storage?.qdrant?.reachable ?? null,
  qdrantCollectionExists: storage?.qdrant?.collectionExists ?? null,
  qdrantCollection: storage?.qdrant?.collection ?? null,
  qdrantPoints: storage?.qdrant?.points ?? null,
  neo4jReachable: storage?.neo4j?.reachable ?? null,
  neo4jNodes: storage?.neo4j?.nodes ?? null,
  neo4jRelationships: storage?.neo4j?.relationships ?? null,
  neo4jDatabase: storage?.neo4j?.database ?? null,
  empty: storage?.empty ?? null,
  lastError: storage?.qdrant?.lastError ?? storage?.neo4j?.lastError ?? null,
})

export const createOpsKnowledgeEnrichmentStatusRoute = ({
  db,
  knowledgeServiceEnabled,
  knowledgeServiceUrl,
  knowledgeServiceTimeoutMs,
  advisorGraphIngestEnabled,
}: KnowledgeServiceDeps) =>
  new Elysia({ prefix: '/ops/knowledge/enrichment' })
    .get('/status', async context => {
      const requestId = getRequestMeta(context).requestId
      const mode = getAuth(context).mode
      if (mode !== 'admin') {
        return {
          requestId,
          mode: 'demo' as const,
          enabled: false,
          status: 'demo_read_only' as const,
          lastWriteAt: null,
          lastWriteStatus: null,
          nodesWrittenLastRun: 0,
          edgesWrittenLastRun: 0,
          vectorsWrittenLastRun: 0,
          lastError: null,
          serviceHealth: null,
          storage: null,
        }
      }

      requireAdmin(context)

      try {
        const [latest] = await db
          .select({
            createdAt: schema.advisorMemoryEvent.createdAt,
            graphWriteStatus: schema.advisorMemoryEvent.graphWriteStatus,
            graphWriteError: schema.advisorMemoryEvent.graphWriteError,
            nodesWritten: schema.advisorMemoryEvent.nodesWritten,
            edgesWritten: schema.advisorMemoryEvent.edgesWritten,
            vectorsWritten: schema.advisorMemoryEvent.vectorsWritten,
          })
          .from(schema.advisorMemoryEvent)
          .orderBy(desc(schema.advisorMemoryEvent.createdAt))
          .limit(1)

        const [counts] = await db
          .select({
            pending: sql<number>`count(*) filter (where ${schema.advisorMemoryEvent.graphWriteStatus} = 'pending')`,
            sent: sql<number>`count(*) filter (where ${schema.advisorMemoryEvent.graphWriteStatus} = 'sent')`,
            failed: sql<number>`count(*) filter (where ${schema.advisorMemoryEvent.graphWriteStatus} = 'failed')`,
            skipped: sql<number>`count(*) filter (where ${schema.advisorMemoryEvent.graphWriteStatus} = 'skipped')`,
          })
          .from(schema.advisorMemoryEvent)

        let serviceHealth:
          | {
              status: 'ok' | 'degraded' | 'unavailable'
              backend: string | null
              productionConfigured: boolean | null
              productionActive: boolean | null
              backends: unknown
              lastError: string | null
            }
          | null = null
        let storage = buildStorageBlock(null, false)

        if (knowledgeServiceEnabled) {
          const [healthResult, storageResult] = await Promise.all([
            callKnowledgeService(
              { knowledgeServiceUrl, knowledgeServiceTimeoutMs },
              '/health',
              requestId
            ),
            callKnowledgeService(
              { knowledgeServiceUrl, knowledgeServiceTimeoutMs },
              '/knowledge/storage/status',
              requestId
            ),
          ])

          const healthPayload = (healthResult.payload ?? {}) as {
            status?: string
            backend?: string
            productionConfigured?: boolean
            productionActive?: boolean
            backends?: unknown
          }
          serviceHealth = {
            status: healthResult.ok && healthPayload.status === 'ok' ? 'ok' : 'degraded',
            backend: healthPayload.backend ?? null,
            productionConfigured: healthPayload.productionConfigured ?? null,
            productionActive: healthPayload.productionActive ?? null,
            backends: healthPayload.backends ?? null,
            lastError: healthResult.errorName,
          }
          if (!healthResult.ok && healthResult.status === 0) {
            serviceHealth.status = 'unavailable'
          }

          storage = buildStorageBlock(extractStorage(storageResult.payload), storageResult.ok)
        }

        const memoryEventCounts = {
          pending: Number(counts?.pending ?? 0),
          sent: Number(counts?.sent ?? 0),
          failed: Number(counts?.failed ?? 0),
          skipped: Number(counts?.skipped ?? 0),
        }
        // "Empty because no ingest yet" is the expected post-deploy state: the
        // graph holds nothing AND no successful memory write has happened.
        const emptyBecauseNoIngest =
          storage.empty === true && memoryEventCounts.sent === 0 && latest == null

        return {
          requestId,
          mode,
          enabled: knowledgeServiceEnabled && advisorGraphIngestEnabled,
          status:
            knowledgeServiceEnabled && advisorGraphIngestEnabled ? 'enabled' : 'disabled_by_flags',
          backend: knowledgeServiceEnabled ? 'knowledge-service' : 'disabled',
          lastWriteAt: latest?.createdAt?.toISOString() ?? null,
          lastWriteStatus: latest?.graphWriteStatus ?? null,
          nodesWrittenLastRun: latest?.nodesWritten ?? 0,
          edgesWrittenLastRun: latest?.edgesWritten ?? 0,
          vectorsWrittenLastRun: latest?.vectorsWritten ?? 0,
          lastError: latest?.graphWriteError ?? null,
          memoryEventCounts,
          serviceHealth,
          storage: { ...storage, emptyBecauseNoIngest },
        }
      } catch (error) {
        return {
          requestId,
          mode,
          enabled: knowledgeServiceEnabled && advisorGraphIngestEnabled,
          status: 'degraded',
          backend: knowledgeServiceEnabled ? 'knowledge-service' : 'disabled',
          lastWriteAt: null,
          lastWriteStatus: null,
          nodesWrittenLastRun: 0,
          edgesWrittenLastRun: 0,
          vectorsWrittenLastRun: 0,
          lastError: error instanceof Error ? error.message.slice(0, 300) : 'UNKNOWN_ERROR',
          memoryEventCounts: null,
          serviceHealth: null,
          storage: null,
        }
      }
    })
    .post('/ensure', async context => {
      const requestId = getRequestMeta(context).requestId
      const mode = getAuth(context).mode
      if (mode !== 'admin') {
        context.set.status = 403
        return {
          ok: false,
          code: 'DEMO_MODE_FORBIDDEN',
          message: 'Admin session or internal token required.',
          requestId,
        }
      }
      requireAdmin(context)

      if (!knowledgeServiceEnabled) {
        context.set.status = 409
        return {
          ok: false,
          code: 'KNOWLEDGE_SERVICE_DISABLED',
          message: 'Knowledge service is disabled by configuration.',
          requestId,
        }
      }

      // Idempotent, non-destructive: ensures the Qdrant collection + Neo4j
      // schema exist and reports counts. Never resets or deletes data.
      const result = await callKnowledgeService(
        { knowledgeServiceUrl, knowledgeServiceTimeoutMs },
        '/knowledge/storage/ensure',
        requestId,
        'POST'
      )

      if (!result.ok) {
        context.set.status = 502
        return {
          ok: false,
          code: 'KNOWLEDGE_SERVICE_ENSURE_FAILED',
          message: 'Knowledge service did not complete the storage ensure step.',
          requestId,
          lastError: result.errorName,
        }
      }

      return {
        ok: true,
        requestId,
        mode,
        storage: { ...buildStorageBlock(extractStorage(result.payload), true) },
      }
    })
