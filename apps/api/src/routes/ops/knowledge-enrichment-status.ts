import { schema } from '@finance-os/db'
import { desc, sql } from 'drizzle-orm'
import { Elysia } from 'elysia'
import { getAuth, getRequestMeta } from '../../auth/context'
import { requireAdmin } from '../../auth/guard'
import type { ApiDb } from '../dashboard/types'

export const createOpsKnowledgeEnrichmentStatusRoute = ({
  db,
  knowledgeServiceEnabled,
  knowledgeServiceUrl,
  knowledgeServiceTimeoutMs,
  advisorGraphIngestEnabled,
}: {
  db: ApiDb
  knowledgeServiceEnabled: boolean
  knowledgeServiceUrl: string
  knowledgeServiceTimeoutMs: number
  advisorGraphIngestEnabled: boolean
}) =>
  new Elysia({ prefix: '/ops/knowledge/enrichment' }).get('/status', async context => {
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

      if (knowledgeServiceEnabled) {
        try {
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), knowledgeServiceTimeoutMs)
          let response: Response
          try {
            response = await fetch(`${knowledgeServiceUrl.replace(/\/$/, '')}/health`, {
              headers: { 'x-request-id': requestId },
              signal: controller.signal,
            })
          } finally {
            clearTimeout(timeout)
          }
          const payload = (await response.json()) as {
            status?: string
            backend?: string
            productionConfigured?: boolean
            productionActive?: boolean
            backends?: unknown
          }
          serviceHealth = {
            status: response.ok && payload.status === 'ok' ? 'ok' : 'degraded',
            backend: payload.backend ?? null,
            productionConfigured: payload.productionConfigured ?? null,
            productionActive: payload.productionActive ?? null,
            backends: payload.backends ?? null,
            lastError: response.ok ? null : `HTTP_${response.status}`,
          }
        } catch (error) {
          serviceHealth = {
            status: 'unavailable',
            backend: null,
            productionConfigured: null,
            productionActive: null,
            backends: null,
            lastError: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
          }
        }
      }

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
        memoryEventCounts: {
          pending: Number(counts?.pending ?? 0),
          sent: Number(counts?.sent ?? 0),
          failed: Number(counts?.failed ?? 0),
          skipped: Number(counts?.skipped ?? 0),
        },
        serviceHealth,
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
      }
    }
  })
