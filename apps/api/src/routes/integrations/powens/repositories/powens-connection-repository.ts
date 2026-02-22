import { schema } from '@finance-os/db'
import { desc } from 'drizzle-orm'
import type { ApiDb, PowensConnectionRepository } from '../types'

export const createPowensConnectionRepository = (db: ApiDb): PowensConnectionRepository => {
  return {
    async upsertConnectedConnection({ connectionId, encryptedAccessToken, now }) {
      await db
        .insert(schema.powensConnection)
        .values({
          powensConnectionId: connectionId,
          accessTokenEncrypted: encryptedAccessToken,
          status: 'connected',
          lastError: null,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: schema.powensConnection.powensConnectionId,
          set: {
            accessTokenEncrypted: encryptedAccessToken,
            status: 'connected',
            lastError: null,
            updatedAt: now,
          },
        })
    },

    async listConnectionStatuses() {
      return db
        .select({
          id: schema.powensConnection.id,
          powensConnectionId: schema.powensConnection.powensConnectionId,
          status: schema.powensConnection.status,
          lastSyncAt: schema.powensConnection.lastSyncAt,
          lastSuccessAt: schema.powensConnection.lastSuccessAt,
          lastError: schema.powensConnection.lastError,
          createdAt: schema.powensConnection.createdAt,
          updatedAt: schema.powensConnection.updatedAt,
        })
        .from(schema.powensConnection)
        .orderBy(desc(schema.powensConnection.createdAt))
    },
  }
}
