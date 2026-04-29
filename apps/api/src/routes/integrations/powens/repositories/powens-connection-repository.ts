import { schema } from '@finance-os/db'
import { and, desc, eq, isNull } from 'drizzle-orm'
import type { ApiDb, PowensConnectionRepository, PowensSyncRunView, RedisClient } from '../types'

const SYNC_RUNS_LIST_KEY = 'powens:metrics:sync:runs'
const SYNC_RUN_KEY_PREFIX = 'powens:metrics:sync:run:'

const syncRunKey = (runId: string) => `${SYNC_RUN_KEY_PREFIX}${runId}`

const isPowensSyncRun = (value: unknown): value is PowensSyncRunView => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const run = value as Partial<PowensSyncRunView>
  const allowed = new Set(['running', 'success', 'error', 'reconnect_required'])

  return (
    typeof run.id === 'string' &&
    typeof run.connectionId === 'string' &&
    typeof run.startedAt === 'string' &&
    (run.requestId === null || typeof run.requestId === 'string') &&
    (run.endedAt === null || typeof run.endedAt === 'string') &&
    typeof run.result === 'string' &&
    allowed.has(run.result) &&
    (run.errorMessage === undefined || typeof run.errorMessage === 'string') &&
    (run.errorFingerprint === undefined || typeof run.errorFingerprint === 'string')
  )
}

export const createPowensConnectionRepository = (
  db: ApiDb,
  redisClient: RedisClient
): PowensConnectionRepository => {
  return {
    async upsertConnectedConnection({ connectionId, encryptedAccessToken, now }) {
      await db
        .insert(schema.powensConnection)
        .values({
          source: 'banking',
          provider: 'powens',
          powensConnectionId: connectionId,
          providerConnectionId: connectionId,
          accessTokenEncrypted: encryptedAccessToken,
          status: 'connected',
          lastError: null,
          archivedAt: null,
          archivedReason: null,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: schema.powensConnection.powensConnectionId,
          set: {
            source: 'banking',
            provider: 'powens',
            providerConnectionId: connectionId,
            accessTokenEncrypted: encryptedAccessToken,
            status: 'connected',
            lastError: null,
            archivedAt: null,
            archivedReason: null,
            updatedAt: now,
          },
        })
    },

    async disconnectConnection({ connectionId, now, reason }) {
      const updated = await db.transaction(async tx => {
        const disconnectedConnections = await tx
          .update(schema.powensConnection)
          .set({
            archivedAt: now,
            archivedReason: reason,
            updatedAt: now,
          })
          .where(
            and(
              eq(schema.powensConnection.powensConnectionId, connectionId),
              isNull(schema.powensConnection.archivedAt)
            )
          )
          .returning({ powensConnectionId: schema.powensConnection.powensConnectionId })

        await tx
          .update(schema.financialAccount)
          .set({
            enabled: false,
            updatedAt: now,
          })
          .where(eq(schema.financialAccount.powensConnectionId, connectionId))

        await tx
          .update(schema.asset)
          .set({
            enabled: false,
            updatedAt: now,
          })
          .where(eq(schema.asset.powensConnectionId, connectionId))

        return disconnectedConnections
      })

      return {
        disconnected: updated.length > 0,
        connectionId,
      }
    },

    async listConnectionStatuses() {
      return db
        .select({
          id: schema.powensConnection.id,
          source: schema.powensConnection.source,
          provider: schema.powensConnection.provider,
          powensConnectionId: schema.powensConnection.powensConnectionId,
          providerConnectionId: schema.powensConnection.providerConnectionId,
          providerInstitutionId: schema.powensConnection.providerInstitutionId,
          providerInstitutionName: schema.powensConnection.providerInstitutionName,
          status: schema.powensConnection.status,
          lastSyncStatus: schema.powensConnection.lastSyncStatus,
          lastSyncReasonCode: schema.powensConnection.lastSyncReasonCode,
          lastSyncAttemptAt: schema.powensConnection.lastSyncAttemptAt,
          lastSyncAt: schema.powensConnection.lastSyncAt,
          lastSuccessAt: schema.powensConnection.lastSuccessAt,
          lastFailedAt: schema.powensConnection.lastFailedAt,
          lastError: schema.powensConnection.lastError,
          syncMetadata: schema.powensConnection.syncMetadata,
          createdAt: schema.powensConnection.createdAt,
          updatedAt: schema.powensConnection.updatedAt,
        })
        .from(schema.powensConnection)
        .where(isNull(schema.powensConnection.archivedAt))
        .orderBy(desc(schema.powensConnection.createdAt))
    },

    async listSyncRuns(limit = 20) {
      const boundedLimit = Math.max(1, Math.min(limit, 100))
      const runIds = await redisClient.lRange(SYNC_RUNS_LIST_KEY, 0, boundedLimit - 1)

      if (runIds.length === 0) {
        return []
      }

      const payloads = await redisClient.mGet(runIds.map(runId => syncRunKey(runId)))
      const runs: PowensSyncRunView[] = []

      for (const raw of payloads) {
        if (!raw) {
          continue
        }

        try {
          const parsed = JSON.parse(raw) as unknown
          if (!isPowensSyncRun(parsed)) {
            continue
          }

          runs.push(parsed)
        } catch {}
      }

      return runs.sort((a, b) => {
        return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      })
    },
  }
}
