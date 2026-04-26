import { schema } from '@finance-os/db'
import { type SQL, and, desc, eq, gte, inArray, sql } from 'drizzle-orm'
import type { ApiDb } from '../types'

export interface SignalItemRow {
  id: number
  sourceProvider: string
  sourceType: string
  sourceAccountId: number | null
  externalId: string
  url: string | null
  title: string
  body: string | null
  author: string | null
  publishedAt: string
  fetchedAt: string
  language: string
  entities: string[]
  tickers: string[]
  sectors: string[]
  regions: string[]
  topics: string[]
  signalDomain: string
  relevanceScore: number
  noveltyScore: number
  confidenceScore: number
  impactScore: number
  urgencyScore: number
  requiresAttention: boolean
  attentionReason: string | null
  sentiment: number | null
  dedupeKey: string
  contentHash: string
  provenance: Record<string, unknown>
  graphIngestStatus: string
  advisorIngestStatus: string
  scope: string
  ingestionRunId: number | null
  createdAt: string
  updatedAt: string
}

export interface InsertSignalItemInput {
  sourceProvider: string
  sourceType: string
  sourceAccountId?: number
  externalId: string
  url?: string
  title: string
  body?: string
  author?: string
  publishedAt: Date
  fetchedAt: Date
  language?: string
  entities?: string[]
  tickers?: string[]
  sectors?: string[]
  regions?: string[]
  topics?: string[]
  signalDomain: string
  relevanceScore: number
  noveltyScore: number
  confidenceScore: number
  impactScore: number
  urgencyScore: number
  requiresAttention: boolean
  attentionReason?: string
  sentiment?: number
  dedupeKey: string
  contentHash: string
  provenance: Record<string, unknown>
  rawPayloadRedacted?: Record<string, unknown> | null
  graphIngestStatus?: 'pending' | 'sent' | 'skipped' | 'failed'
  advisorIngestStatus?: 'pending' | 'sent' | 'skipped'
  scope?: 'admin' | 'demo'
  ingestionRunId?: number
}

const toRow = (r: typeof schema.signalItem.$inferSelect): SignalItemRow => ({
  id: r.id,
  sourceProvider: r.sourceProvider,
  sourceType: r.sourceType,
  sourceAccountId: r.sourceAccountId,
  externalId: r.externalId,
  url: r.url,
  title: r.title,
  body: r.body,
  author: r.author,
  publishedAt: r.publishedAt.toISOString(),
  fetchedAt: r.fetchedAt.toISOString(),
  language: r.language,
  entities: r.entities,
  tickers: r.tickers,
  sectors: r.sectors,
  regions: r.regions,
  topics: r.topics,
  signalDomain: r.signalDomain,
  relevanceScore: r.relevanceScore,
  noveltyScore: r.noveltyScore,
  confidenceScore: r.confidenceScore,
  impactScore: r.impactScore,
  urgencyScore: r.urgencyScore,
  requiresAttention: r.requiresAttention,
  attentionReason: r.attentionReason,
  sentiment: r.sentiment,
  dedupeKey: r.dedupeKey,
  contentHash: r.contentHash,
  provenance: r.provenance,
  graphIngestStatus: r.graphIngestStatus,
  advisorIngestStatus: r.advisorIngestStatus,
  scope: r.scope,
  ingestionRunId: r.ingestionRunId,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
})

export const createDashboardSignalItemsRepository = ({ db }: { db: ApiDb }) => ({
  /**
   * Insert a signal item if its dedupeKey does not already exist.
   * Returns { inserted: true, item } on success, { inserted: false } on dedupe skip.
   */
  async insertIfNotDuplicate(
    input: InsertSignalItemInput
  ): Promise<{ inserted: boolean; item?: SignalItemRow }> {
    const now = new Date()
    try {
      const rows = await db
        .insert(schema.signalItem)
        .values({
          sourceProvider: input.sourceProvider,
          sourceType: input.sourceType,
          externalId: input.externalId,
          title: input.title,
          publishedAt: input.publishedAt,
          fetchedAt: input.fetchedAt,
          dedupeKey: input.dedupeKey,
          contentHash: input.contentHash,
          signalDomain: input.signalDomain,
          relevanceScore: input.relevanceScore,
          noveltyScore: input.noveltyScore,
          confidenceScore: input.confidenceScore,
          impactScore: input.impactScore,
          urgencyScore: input.urgencyScore,
          requiresAttention: input.requiresAttention,
          provenance: input.provenance,
          language: input.language ?? 'en',
          createdAt: now,
          updatedAt: now,
          ...(input.sourceAccountId !== undefined ? { sourceAccountId: input.sourceAccountId } : {}),
          ...(input.url !== undefined ? { url: input.url } : {}),
          ...(input.body !== undefined ? { body: input.body } : {}),
          ...(input.author !== undefined ? { author: input.author } : {}),
          ...(input.entities !== undefined ? { entities: input.entities } : {}),
          ...(input.tickers !== undefined ? { tickers: input.tickers } : {}),
          ...(input.sectors !== undefined ? { sectors: input.sectors } : {}),
          ...(input.regions !== undefined ? { regions: input.regions } : {}),
          ...(input.topics !== undefined ? { topics: input.topics } : {}),
          ...(input.attentionReason !== undefined ? { attentionReason: input.attentionReason } : {}),
          ...(input.sentiment !== undefined ? { sentiment: input.sentiment } : {}),
          ...(input.rawPayloadRedacted !== undefined ? { rawPayloadRedacted: input.rawPayloadRedacted } : {}),
          ...(input.graphIngestStatus !== undefined ? { graphIngestStatus: input.graphIngestStatus } : {}),
          ...(input.advisorIngestStatus !== undefined ? { advisorIngestStatus: input.advisorIngestStatus } : {}),
          ...(input.scope !== undefined ? { scope: input.scope } : {}),
          ...(input.ingestionRunId !== undefined ? { ingestionRunId: input.ingestionRunId } : {}),
        })
        .onConflictDoNothing({ target: schema.signalItem.dedupeKey })
        .returning()
      if (rows.length === 0) {
        return { inserted: false }
      }
      return { inserted: true, item: toRow(rows[0]!) }
    } catch {
      return { inserted: false }
    }
  },

  async listItems(opts: {
    signalDomain?: string
    sourceProvider?: string
    requiresAttention?: boolean
    graphIngestStatus?: string
    limit?: number
    offset?: number
  }): Promise<SignalItemRow[]> {
    const conditions = []
    if (opts.signalDomain) conditions.push(eq(schema.signalItem.signalDomain, opts.signalDomain))
    if (opts.sourceProvider) conditions.push(eq(schema.signalItem.sourceProvider, opts.sourceProvider))
    if (opts.requiresAttention !== undefined)
      conditions.push(eq(schema.signalItem.requiresAttention, opts.requiresAttention))
    if (opts.graphIngestStatus)
      conditions.push(sql`${schema.signalItem.graphIngestStatus} = ${opts.graphIngestStatus}`)

    const rows = await db
      .select()
      .from(schema.signalItem)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(schema.signalItem.publishedAt))
      .limit(opts.limit ?? 50)
      .offset(opts.offset ?? 0)
    return rows.map(toRow)
  },

  async countItems(): Promise<number> {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.signalItem)
    return row?.count ?? 0
  },

  async listPendingGraphIngest(limit: number, minRelevance: number): Promise<SignalItemRow[]> {
    const rows = await db
      .select()
      .from(schema.signalItem)
      .where(
        and(
          eq(schema.signalItem.graphIngestStatus, 'pending'),
          gte(schema.signalItem.relevanceScore, minRelevance)
        )
      )
      .orderBy(desc(schema.signalItem.impactScore))
      .limit(limit)
    return rows.map(toRow)
  },

  async markGraphIngested(ids: number[], status: 'sent' | 'failed'): Promise<void> {
    if (ids.length === 0) return
    await db
      .update(schema.signalItem)
      .set({ graphIngestStatus: status, updatedAt: new Date() })
      .where(inArray(schema.signalItem.id, ids))
  },
})

export type DashboardSignalItemsRepository = ReturnType<
  typeof createDashboardSignalItemsRepository
>
