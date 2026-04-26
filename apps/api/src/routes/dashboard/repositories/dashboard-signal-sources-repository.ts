import { schema } from '@finance-os/db'
import { and, desc, eq, sql } from 'drizzle-orm'
import type { ApiDb } from '../types'

export type SignalSourceGroup = 'finance' | 'ai_tech'
export type SignalSourceAttentionPolicy = 'auto' | 'always' | 'never' | 'high_only'

export interface SignalSourceRow {
  id: number
  provider: string
  handle: string
  displayName: string
  url: string | null
  group: SignalSourceGroup
  enabled: boolean
  priority: number
  tags: string[]
  language: string
  includePatterns: string[]
  excludePatterns: string[]
  minRelevanceScore: number
  requiresAttentionPolicy: SignalSourceAttentionPolicy
  lastFetchedAt: string | null
  lastCursor: string | null
  lastError: string | null
  lastFetchedCount: number | null
  createdAt: string
  updatedAt: string
}

export interface CreateSignalSourceInput {
  provider: string
  handle: string
  displayName: string
  url?: string
  group: SignalSourceGroup
  enabled?: boolean
  priority?: number
  tags?: string[]
  language?: string
  includePatterns?: string[]
  excludePatterns?: string[]
  minRelevanceScore?: number
  requiresAttentionPolicy?: SignalSourceAttentionPolicy
}

export interface UpdateSignalSourceInput {
  displayName?: string
  url?: string
  group?: SignalSourceGroup
  enabled?: boolean
  priority?: number
  tags?: string[]
  language?: string
  includePatterns?: string[]
  excludePatterns?: string[]
  minRelevanceScore?: number
  requiresAttentionPolicy?: SignalSourceAttentionPolicy
}

export interface SignalIngestionRunRow {
  id: number
  provider: string
  runType: string
  startedAt: string
  finishedAt: string | null
  status: string
  fetchedCount: number
  insertedCount: number
  dedupedCount: number
  classifiedCount: number
  graphIngestedCount: number
  failedCount: number
  errorSummary: string | null
  requestId: string | null
  durationMs: number | null
  createdAt: string
}

const toRow = (row: typeof schema.signalSource.$inferSelect): SignalSourceRow => ({
  id: row.id,
  provider: row.provider,
  handle: row.handle,
  displayName: row.displayName,
  url: row.url,
  group: row.group,
  enabled: row.enabled,
  priority: row.priority,
  tags: row.tags,
  language: row.language,
  includePatterns: row.includePatterns,
  excludePatterns: row.excludePatterns,
  minRelevanceScore: row.minRelevanceScore,
  requiresAttentionPolicy: row.requiresAttentionPolicy,
  lastFetchedAt: row.lastFetchedAt?.toISOString() ?? null,
  lastCursor: row.lastCursor,
  lastError: row.lastError,
  lastFetchedCount: row.lastFetchedCount,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

const toRunRow = (row: typeof schema.signalIngestionRun.$inferSelect): SignalIngestionRunRow => ({
  id: row.id,
  provider: row.provider,
  runType: row.runType,
  startedAt: row.startedAt.toISOString(),
  finishedAt: row.finishedAt?.toISOString() ?? null,
  status: row.status,
  fetchedCount: row.fetchedCount,
  insertedCount: row.insertedCount,
  dedupedCount: row.dedupedCount,
  classifiedCount: row.classifiedCount,
  graphIngestedCount: row.graphIngestedCount,
  failedCount: row.failedCount,
  errorSummary: row.errorSummary,
  requestId: row.requestId,
  durationMs: row.durationMs,
  createdAt: row.createdAt.toISOString(),
})

export const createDashboardSignalSourcesRepository = ({ db }: { db: ApiDb }) => ({
  async listSources(group?: SignalSourceGroup): Promise<SignalSourceRow[]> {
    const conditions = group ? [eq(schema.signalSource.group, group)] : []
    const rows = await db
      .select()
      .from(schema.signalSource)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(schema.signalSource.priority), schema.signalSource.displayName)
    return rows.map(toRow)
  },

  async getSourceById(id: number): Promise<SignalSourceRow | null> {
    const [row] = await db
      .select()
      .from(schema.signalSource)
      .where(eq(schema.signalSource.id, id))
      .limit(1)
    return row ? toRow(row) : null
  },

  async createSource(input: CreateSignalSourceInput): Promise<SignalSourceRow> {
    const now = new Date()
    const values: typeof schema.signalSource.$inferInsert = {
      provider: input.provider,
      handle: input.handle,
      displayName: input.displayName,
      group: input.group,
      language: input.language ?? 'en',
      createdAt: now,
      updatedAt: now,
    }
    if (input.url !== undefined) values.url = input.url
    if (input.enabled !== undefined) values.enabled = input.enabled
    if (input.priority !== undefined) values.priority = input.priority
    if (input.tags !== undefined) values.tags = input.tags
    if (input.includePatterns !== undefined) values.includePatterns = input.includePatterns
    if (input.excludePatterns !== undefined) values.excludePatterns = input.excludePatterns
    if (input.minRelevanceScore !== undefined) values.minRelevanceScore = input.minRelevanceScore
    if (input.requiresAttentionPolicy !== undefined)
      values.requiresAttentionPolicy = input.requiresAttentionPolicy

    const rows = await db.insert(schema.signalSource).values(values).returning()
    return toRow(rows[0]!)
  },

  async updateSource(id: number, input: UpdateSignalSourceInput): Promise<SignalSourceRow | null> {
    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (input.displayName !== undefined) updates.displayName = input.displayName
    if (input.url !== undefined) updates.url = input.url
    if (input.group !== undefined) updates.group = input.group
    if (input.enabled !== undefined) updates.enabled = input.enabled
    if (input.priority !== undefined) updates.priority = input.priority
    if (input.tags !== undefined) updates.tags = input.tags
    if (input.language !== undefined) updates.language = input.language
    if (input.includePatterns !== undefined) updates.includePatterns = input.includePatterns
    if (input.excludePatterns !== undefined) updates.excludePatterns = input.excludePatterns
    if (input.minRelevanceScore !== undefined) updates.minRelevanceScore = input.minRelevanceScore
    if (input.requiresAttentionPolicy !== undefined)
      updates.requiresAttentionPolicy = input.requiresAttentionPolicy

    const [row] = await db
      .update(schema.signalSource)
      .set(updates)
      .where(eq(schema.signalSource.id, id))
      .returning()
    return row ? toRow(row) : null
  },

  async deleteSource(id: number): Promise<boolean> {
    const result = await db
      .delete(schema.signalSource)
      .where(eq(schema.signalSource.id, id))
      .returning({ id: schema.signalSource.id })
    return result.length > 0
  },

  async updateSourceFetchState(
    id: number,
    state: {
      lastFetchedAt: Date
      lastCursor?: string
      lastError?: string
      lastFetchedCount?: number
    }
  ): Promise<void> {
    const updates: Record<string, unknown> = {
      lastFetchedAt: state.lastFetchedAt,
      updatedAt: new Date(),
    }
    if (state.lastCursor !== undefined) updates.lastCursor = state.lastCursor
    if (state.lastError !== undefined) updates.lastError = state.lastError
    if (state.lastFetchedCount !== undefined) updates.lastFetchedCount = state.lastFetchedCount

    await db.update(schema.signalSource).set(updates).where(eq(schema.signalSource.id, id))
  },

  async listEnabledSourcesByProvider(provider: string): Promise<SignalSourceRow[]> {
    const rows = await db
      .select()
      .from(schema.signalSource)
      .where(
        and(eq(schema.signalSource.provider, provider), eq(schema.signalSource.enabled, true))
      )
      .orderBy(desc(schema.signalSource.priority))
    return rows.map(toRow)
  },

  // Ingestion runs
  async createIngestionRun(input: {
    provider: string
    runType: string
    requestId: string
  }): Promise<number> {
    const rows = await db
      .insert(schema.signalIngestionRun)
      .values({
        provider: input.provider,
        runType: input.runType as 'scheduled' | 'manual' | 'social_poll' | 'manual_import',
        startedAt: new Date(),
        status: 'running',
        requestId: input.requestId,
      })
      .returning({ id: schema.signalIngestionRun.id })
    return rows[0]!.id
  },

  async completeIngestionRun(
    id: number,
    result: {
      status: 'success' | 'partial' | 'failed'
      fetchedCount: number
      insertedCount: number
      dedupedCount: number
      classifiedCount: number
      graphIngestedCount?: number
      failedCount?: number
      errorSummary?: string
      durationMs: number
    }
  ): Promise<void> {
    await db
      .update(schema.signalIngestionRun)
      .set({
        finishedAt: new Date(),
        status: result.status,
        fetchedCount: result.fetchedCount,
        insertedCount: result.insertedCount,
        dedupedCount: result.dedupedCount,
        classifiedCount: result.classifiedCount,
        graphIngestedCount: result.graphIngestedCount ?? 0,
        failedCount: result.failedCount ?? 0,
        errorSummary: result.errorSummary,
        durationMs: result.durationMs,
      })
      .where(eq(schema.signalIngestionRun.id, id))
  },

  async listRecentRuns(limit = 20): Promise<SignalIngestionRunRow[]> {
    const rows = await db
      .select()
      .from(schema.signalIngestionRun)
      .orderBy(desc(schema.signalIngestionRun.startedAt))
      .limit(limit)
    return rows.map(toRunRow)
  },

  async countSourcesByGroup(): Promise<{ finance: number; ai_tech: number }> {
    const rows = await db
      .select({
        group: schema.signalSource.group,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.signalSource)
      .groupBy(schema.signalSource.group)

    let finance = 0
    let ai_tech = 0
    for (const row of rows) {
      if (row.group === 'finance') finance = row.count
      else if (row.group === 'ai_tech') ai_tech = row.count
    }
    return { finance, ai_tech }
  },
})

export type DashboardSignalSourcesRepository = ReturnType<
  typeof createDashboardSignalSourcesRepository
>
