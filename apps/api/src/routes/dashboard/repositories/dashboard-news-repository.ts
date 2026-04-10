import { schema } from '@finance-os/db'
import { and, desc, eq, gte, inArray, lte, or, sql } from 'drizzle-orm'
import type {
  DashboardNewsFilters,
  DashboardNewsSignalCard,
  NewsMetadataFetchStatus,
  NewsPersistableSignalDraft,
  NewsProviderHealth,
  NewsProviderRunResult,
} from '../domain/news-types'
import { inferDirection, toIsoOrNull, toScoreLabel, uniqueStrings } from '../domain/news-helpers'
import {
  normalizeNewsMetadataCard,
  selectPreferredNewsMetadata,
} from '../domain/news-metadata'
import { NEWS_PROVIDER_LABELS, type NewsProviderId } from '../domain/news-taxonomy'
import type { ApiDb, DashboardNewsCacheStateRow } from '../types'
import type { NewsDuplicateCandidate } from '../domain/news-dedupe'

const sourcePriority = (sourceType: string) => {
  switch (sourceType) {
    case 'filing':
      return 5
    case 'central_bank':
    case 'regulator':
      return 4
    case 'macro_data':
      return 3
    case 'media':
      return 2
    default:
      return 1
  }
}

const mergeUniqueByJson = <T>(values: T[]) => {
  const seen = new Set<string>()
  const output: T[] = []

  for (const value of values) {
    const key = JSON.stringify(value)
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    output.push(value)
  }

  return output
}

const jsonbArrayContains = (column: unknown, value: string) => {
  return sql<boolean>`${column} @> ${JSON.stringify([value])}::jsonb`
}

export const createDashboardNewsRepository = ({ db }: { db: ApiDb }) => {
  const listSourceRefsByArticleIds = async (articleIds: number[]) => {
    if (articleIds.length === 0) {
      return []
    }

    return db
      .select({
        newsArticleId: schema.newsArticleSourceRef.newsArticleId,
        provider: schema.newsArticleSourceRef.provider,
        providerArticleId: schema.newsArticleSourceRef.providerArticleId,
        providerUrl: schema.newsArticleSourceRef.providerUrl,
        sourceName: schema.newsArticleSourceRef.sourceName,
        sourceDomain: schema.newsArticleSourceRef.sourceDomain,
        sourceType: schema.newsArticleSourceRef.sourceType,
        publishedAt: schema.newsArticleSourceRef.publishedAt,
      })
      .from(schema.newsArticleSourceRef)
      .where(inArray(schema.newsArticleSourceRef.newsArticleId, articleIds))
      .orderBy(desc(schema.newsArticleSourceRef.publishedAt), desc(schema.newsArticleSourceRef.id))
  }

  return {
    async listNewsArticles(filters: DashboardNewsFilters): Promise<DashboardNewsSignalCard[]> {
      const predicates = []
      if (filters.topic) {
        predicates.push(eq(schema.newsArticle.topic, filters.topic))
      }
      if (filters.sourceName) {
        predicates.push(eq(schema.newsArticle.sourceName, filters.sourceName))
      }
      if (filters.sourceType) {
        predicates.push(eq(schema.newsArticle.sourceType, filters.sourceType))
      }
      if (filters.domain) {
        predicates.push(jsonbArrayContains(schema.newsArticle.domains, filters.domain))
      }
      if (filters.eventType) {
        predicates.push(eq(schema.newsArticle.eventType, filters.eventType))
      }
      if (filters.minSeverity !== undefined) {
        predicates.push(gte(schema.newsArticle.severity, filters.minSeverity))
      }
      if (filters.region) {
        predicates.push(eq(schema.newsArticle.region, filters.region))
      }
      if (filters.ticker) {
        predicates.push(jsonbArrayContains(schema.newsArticle.affectedTickers, filters.ticker))
      }
      if (filters.sector) {
        predicates.push(jsonbArrayContains(schema.newsArticle.affectedSectors, filters.sector))
      }
      if (filters.direction === 'risk') {
        predicates.push(sql`${schema.newsArticle.riskFlags} <> '[]'::jsonb`)
      }
      if (filters.direction === 'opportunity') {
        predicates.push(sql`${schema.newsArticle.opportunityFlags} <> '[]'::jsonb`)
      }
      if (filters.from) {
        predicates.push(gte(schema.newsArticle.publishedAt, new Date(filters.from)))
      }
      if (filters.to) {
        predicates.push(lte(schema.newsArticle.publishedAt, new Date(filters.to)))
      }

      const rows = await db
        .select({
          id: schema.newsArticle.id,
          title: schema.newsArticle.title,
          summary: schema.newsArticle.summary,
          contentSnippet: schema.newsArticle.contentSnippet,
          url: schema.newsArticle.url,
          canonicalUrl: schema.newsArticle.canonicalUrl,
          sourceName: schema.newsArticle.sourceName,
          sourceDomain: schema.newsArticle.sourceDomain,
          sourceType: schema.newsArticle.sourceType,
          topic: schema.newsArticle.topic,
          language: schema.newsArticle.language,
          publishedAt: schema.newsArticle.publishedAt,
          domains: schema.newsArticle.domains,
          categories: schema.newsArticle.categories,
          subcategories: schema.newsArticle.subcategories,
          eventType: schema.newsArticle.eventType,
          severity: schema.newsArticle.severity,
          confidence: schema.newsArticle.confidence,
          novelty: schema.newsArticle.novelty,
          marketImpactScore: schema.newsArticle.marketImpactScore,
          relevanceScore: schema.newsArticle.relevanceScore,
          riskFlags: schema.newsArticle.riskFlags,
          opportunityFlags: schema.newsArticle.opportunityFlags,
          affectedEntities: schema.newsArticle.affectedEntities,
          affectedTickers: schema.newsArticle.affectedTickers,
          affectedSectors: schema.newsArticle.affectedSectors,
          affectedThemes: schema.newsArticle.affectedThemes,
          transmissionHypotheses: schema.newsArticle.transmissionHypotheses,
          whyItMatters: schema.newsArticle.whyItMatters,
          scoringReasons: schema.newsArticle.scoringReasons,
          metadataCard: schema.newsArticle.metadataCard,
          metadataFetchStatus: schema.newsArticle.metadataFetchStatus,
          eventClusterId: schema.newsArticle.eventClusterId,
          provenance: schema.newsArticle.provenance,
        })
        .from(schema.newsArticle)
        .where(predicates.length > 0 ? and(...predicates) : undefined)
        .orderBy(
          desc(schema.newsArticle.relevanceScore),
          desc(schema.newsArticle.marketImpactScore),
          desc(schema.newsArticle.publishedAt),
          desc(schema.newsArticle.id)
        )
        .limit(filters.limit)

      const articleIds = rows.map(row => row.id)
      const sourceRefs = await listSourceRefsByArticleIds(articleIds)
      const refsByArticleId = new Map<number, typeof sourceRefs>()
      for (const ref of sourceRefs) {
        const existing = refsByArticleId.get(ref.newsArticleId)
        if (existing) {
          existing.push(ref)
        } else {
          refsByArticleId.set(ref.newsArticleId, [ref])
        }
      }

      return rows.map(row => {
        const articleSourceRefs = refsByArticleId.get(row.id) ?? []
        const derivedProviderCount = new Set(articleSourceRefs.map(ref => ref.provider)).size

        return {
        id: String(row.id),
        title: row.title,
        summary: row.summary,
        contentSnippet: row.contentSnippet,
        url: row.url,
        canonicalUrl: row.canonicalUrl,
        sourceName: row.sourceName,
        sourceDomain: row.sourceDomain,
        sourceType: row.sourceType as DashboardNewsSignalCard['sourceType'],
        topic: row.topic,
        language: row.language,
        publishedAt: row.publishedAt.toISOString(),
        domains: (row.domains ?? []) as DashboardNewsSignalCard['domains'],
        categories: row.categories ?? [],
        subcategories: row.subcategories ?? [],
        eventType: row.eventType as DashboardNewsSignalCard['eventType'],
        severity: row.severity,
        severityLabel: toScoreLabel(row.severity),
        confidence: row.confidence,
        novelty: row.novelty,
        marketImpactScore: row.marketImpactScore,
        relevanceScore: row.relevanceScore,
        direction: inferDirection({
          riskFlags: row.riskFlags ?? [],
          opportunityFlags: row.opportunityFlags ?? [],
        }),
        riskFlags: (row.riskFlags ?? []) as DashboardNewsSignalCard['riskFlags'],
        opportunityFlags: (row.opportunityFlags ?? []) as DashboardNewsSignalCard['opportunityFlags'],
        affectedEntities: (row.affectedEntities ?? []) as DashboardNewsSignalCard['affectedEntities'],
        affectedTickers: row.affectedTickers ?? [],
        affectedSectors: row.affectedSectors ?? [],
        affectedThemes: row.affectedThemes ?? [],
        transmissionHypotheses: row.transmissionHypotheses ?? [],
        whyItMatters: row.whyItMatters ?? [],
        scoringReasons: row.scoringReasons ?? [],
        metadataCard: normalizeNewsMetadataCard(row.metadataCard),
        metadataFetchStatus: row.metadataFetchStatus as DashboardNewsSignalCard['metadataFetchStatus'],
        eventClusterId: row.eventClusterId,
        provenance: {
          sourceCount: row.provenance?.sourceCount ?? (articleSourceRefs.length || 1),
          providerCount: row.provenance?.providerCount ?? (derivedProviderCount || 1),
          providers:
            ((row.provenance?.providers as NewsProviderId[] | undefined) ??
              (uniqueStrings(articleSourceRefs.map(ref => ref.provider)) as NewsProviderId[])),
          sourceDomains: row.provenance?.sourceDomains ?? uniqueStrings([row.sourceDomain]),
        },
        sources: articleSourceRefs.map(ref => ({
          provider: ref.provider as NewsProviderId,
          providerArticleId: ref.providerArticleId,
          sourceName: ref.sourceName,
          sourceDomain: ref.sourceDomain,
          sourceType: ref.sourceType as DashboardNewsSignalCard['sourceType'],
          publishedAt: ref.publishedAt.toISOString(),
          providerUrl: ref.providerUrl,
        })),
      }})
    },

    async countNewsArticles() {
      const [row] = await db
        .select({
          count: sql<number>`count(*)::int`,
        })
        .from(schema.newsArticle)

      return row?.count ?? 0
    },

    async findNewsArticleCandidates(params: {
      canonicalUrlFingerprint: string | null
      normalizedTitle: string
      publishedAfter: Date
      publishedBefore: Date
    }): Promise<NewsDuplicateCandidate[]> {
      const titleMatch = eq(schema.newsArticle.normalizedTitle, params.normalizedTitle)
      const fingerprintMatch = params.canonicalUrlFingerprint
        ? eq(schema.newsArticle.canonicalUrlFingerprint, params.canonicalUrlFingerprint)
        : null

      return db
        .select({
          id: schema.newsArticle.id,
          canonicalUrlFingerprint: schema.newsArticle.canonicalUrlFingerprint,
          normalizedTitle: schema.newsArticle.normalizedTitle,
          sourceDomain: schema.newsArticle.sourceDomain,
          eventType: schema.newsArticle.eventType,
          publishedAt: schema.newsArticle.publishedAt,
          affectedEntities: schema.newsArticle.affectedEntities,
          eventClusterId: schema.newsArticle.eventClusterId,
        })
        .from(schema.newsArticle)
        .where(
          and(
            gte(schema.newsArticle.publishedAt, params.publishedAfter),
            lte(schema.newsArticle.publishedAt, params.publishedBefore),
            fingerprintMatch ? or(fingerprintMatch, titleMatch) : titleMatch
          )
        )
        .orderBy(desc(schema.newsArticle.publishedAt), desc(schema.newsArticle.id))
        .then(rows =>
          rows.map(row => ({
            ...row,
            eventType: row.eventType,
            affectedEntities: row.affectedEntities as NewsDuplicateCandidate['affectedEntities'],
          }))
        )
    },

    async insertNewsSignal(signal: NewsPersistableSignalDraft) {
      return db.transaction(async tx => {
        const insertValue: typeof schema.newsArticle.$inferInsert = {
          provider: signal.provider,
          providerArticleId: signal.providerArticleId,
          dedupeKey: signal.dedupeKey,
          title: signal.title,
          summary: signal.summary,
          url: signal.providerUrl ?? signal.canonicalUrl ?? '',
          providerUrl: signal.providerUrl,
          canonicalUrl: signal.canonicalUrl,
          sourceName: signal.sourceName,
          sourceDomain: signal.sourceDomain,
          sourceType: signal.sourceType,
          topic: signal.topic,
          contentSnippet: signal.contentSnippet,
          language: signal.language,
          country: signal.country,
          region: signal.region,
          geoScope: signal.geoScope,
          domains: signal.domains,
          categories: signal.categories,
          subcategories: signal.subcategories,
          eventType: signal.eventType,
          severity: signal.severity,
          confidence: signal.confidence,
          novelty: signal.novelty,
          marketImpactScore: signal.marketImpactScore,
          relevanceScore: signal.relevanceScore,
          riskFlags: signal.riskFlags,
          opportunityFlags: signal.opportunityFlags,
          affectedEntities: signal.affectedEntities,
          affectedTickers: signal.affectedTickers,
          affectedSectors: signal.affectedSectors,
          affectedThemes: signal.affectedThemes,
          transmissionHypotheses: signal.transmissionHypotheses,
          macroLinks: signal.macroLinks as unknown as Array<Record<string, unknown>>,
          policyLinks: signal.policyLinks as unknown as Array<Record<string, unknown>>,
          filingLinks: signal.filingLinks as unknown as Array<Record<string, unknown>>,
          whyItMatters: signal.whyItMatters,
          scoringReasons: signal.scoringReasons,
          normalizedTitle: signal.normalizedTitle,
          canonicalUrlFingerprint: signal.canonicalUrlFingerprint,
          clusteringKey: signal.clusteringKey,
          eventClusterId: signal.eventClusterId,
          publishedAt: signal.publishedAt,
          firstSeenAt: signal.firstSeenAt,
          metadata: signal.metadata,
          rawProviderPayload: signal.rawProviderPayload,
          provenance: signal.provenance,
          metadataFetchStatus: signal.metadataFetchStatus,
          metadataCard:
            (normalizeNewsMetadataCard(signal.metadataCard) as unknown as Record<string, unknown> | null),
          metadataFetchedAt: signal.metadataFetchedAt,
          ingestedAt: signal.ingestedAt,
          lastEnrichedAt: signal.lastEnrichedAt,
          updatedAt: signal.ingestedAt,
        }
        const [created] = await tx
          .insert(schema.newsArticle)
          .values(insertValue)
          .returning({ id: schema.newsArticle.id })

        if (!created) {
          throw new Error('Failed to create news article')
        }

        await tx.insert(schema.newsArticleSourceRef).values(
          signal.sourceRefs.map(sourceRef => ({
            newsArticleId: created.id,
            provider: sourceRef.provider,
            providerArticleId: sourceRef.providerArticleId,
            providerUrl: sourceRef.providerUrl,
            canonicalUrl: sourceRef.canonicalUrl,
            sourceName: sourceRef.sourceName,
            sourceDomain: sourceRef.sourceDomain,
            sourceType: sourceRef.sourceType,
            title: sourceRef.title,
            normalizedTitle: sourceRef.normalizedTitle,
            language: sourceRef.language,
            publishedAt: sourceRef.publishedAt,
            metadata: sourceRef.metadata,
            rawProviderPayload: sourceRef.rawProviderPayload,
            dedupeEvidence: sourceRef.dedupeEvidence,
            ingestedAt: signal.ingestedAt,
            updatedAt: signal.ingestedAt,
          }))
        )

        return created.id
      })
    },

    async mergeNewsSignal(params: {
      articleId: number
      signal: NewsPersistableSignalDraft
      dedupeEvidence: Record<string, unknown> | null
    }) {
      return db.transaction(async tx => {
        const [existing] = await tx
          .select({
            sourceType: schema.newsArticle.sourceType,
            title: schema.newsArticle.title,
            summary: schema.newsArticle.summary,
            contentSnippet: schema.newsArticle.contentSnippet,
            sourceName: schema.newsArticle.sourceName,
            sourceDomain: schema.newsArticle.sourceDomain,
            topic: schema.newsArticle.topic,
            language: schema.newsArticle.language,
            country: schema.newsArticle.country,
            region: schema.newsArticle.region,
            geoScope: schema.newsArticle.geoScope,
            domains: schema.newsArticle.domains,
            categories: schema.newsArticle.categories,
            subcategories: schema.newsArticle.subcategories,
            severity: schema.newsArticle.severity,
            confidence: schema.newsArticle.confidence,
            novelty: schema.newsArticle.novelty,
            marketImpactScore: schema.newsArticle.marketImpactScore,
            relevanceScore: schema.newsArticle.relevanceScore,
            riskFlags: schema.newsArticle.riskFlags,
            opportunityFlags: schema.newsArticle.opportunityFlags,
            affectedEntities: schema.newsArticle.affectedEntities,
            affectedTickers: schema.newsArticle.affectedTickers,
            affectedSectors: schema.newsArticle.affectedSectors,
            affectedThemes: schema.newsArticle.affectedThemes,
            transmissionHypotheses: schema.newsArticle.transmissionHypotheses,
            macroLinks: schema.newsArticle.macroLinks,
            policyLinks: schema.newsArticle.policyLinks,
            filingLinks: schema.newsArticle.filingLinks,
            whyItMatters: schema.newsArticle.whyItMatters,
            scoringReasons: schema.newsArticle.scoringReasons,
            metadataFetchStatus: schema.newsArticle.metadataFetchStatus,
            metadataCard: schema.newsArticle.metadataCard,
            metadataFetchedAt: schema.newsArticle.metadataFetchedAt,
            provenance: schema.newsArticle.provenance,
          })
          .from(schema.newsArticle)
          .where(eq(schema.newsArticle.id, params.articleId))
          .limit(1)

        if (!existing) {
          throw new Error('NEWS_ARTICLE_NOT_FOUND')
        }

        const existingSourceRefs = await tx
          .select({
            provider: schema.newsArticleSourceRef.provider,
            sourceDomain: schema.newsArticleSourceRef.sourceDomain,
          })
          .from(schema.newsArticleSourceRef)
          .where(eq(schema.newsArticleSourceRef.newsArticleId, params.articleId))

        const providerSet = new Set<string>([
          ...existingSourceRefs.map(ref => ref.provider),
          ...params.signal.sourceRefs.map(ref => ref.provider),
        ])
        const sourceDomainSet = new Set<string>(
          uniqueStrings([
            ...existingSourceRefs.map(ref => ref.sourceDomain),
            ...params.signal.sourceRefs.map(ref => ref.sourceDomain),
          ])
        )

        const useIncomingPrimary =
          sourcePriority(params.signal.sourceType) > sourcePriority(existing.sourceType) ||
          (params.signal.summary?.length ?? 0) > (existing.summary?.length ?? 0)

        const selectedMetadata = selectPreferredNewsMetadata({
          existingStatus: existing.metadataFetchStatus as NewsMetadataFetchStatus,
          existingCard: existing.metadataCard,
          existingFetchedAt: existing.metadataFetchedAt,
          incomingStatus: params.signal.metadataFetchStatus,
          incomingCard: params.signal.metadataCard,
          incomingFetchedAt: params.signal.metadataFetchedAt,
        })

        await tx
          .update(schema.newsArticle)
          .set({
            ...(useIncomingPrimary
              ? {
                  provider: params.signal.provider,
                  providerArticleId: params.signal.providerArticleId,
                  title: params.signal.title,
                  summary: params.signal.summary,
                  url: params.signal.providerUrl ?? params.signal.canonicalUrl ?? '',
                  providerUrl: params.signal.providerUrl,
                  canonicalUrl: params.signal.canonicalUrl,
                  sourceName: params.signal.sourceName,
                  sourceDomain: params.signal.sourceDomain,
                  sourceType: params.signal.sourceType,
                  topic: params.signal.topic,
                  contentSnippet: params.signal.contentSnippet,
                }
              : {}),
            language: existing.language || params.signal.language,
            country: existing.country ?? params.signal.country,
            region: existing.region ?? params.signal.region,
            geoScope: existing.geoScope ?? params.signal.geoScope,
            domains: mergeUniqueByJson([...(existing.domains ?? []), ...params.signal.domains]),
            categories: mergeUniqueByJson([...(existing.categories ?? []), ...params.signal.categories]),
            subcategories: mergeUniqueByJson([...(existing.subcategories ?? []), ...params.signal.subcategories]),
            severity: Math.max(existing.severity, params.signal.severity),
            confidence: Math.max(existing.confidence, params.signal.confidence),
            novelty: Math.max(existing.novelty, params.signal.novelty),
            marketImpactScore: Math.max(existing.marketImpactScore, params.signal.marketImpactScore),
            relevanceScore: Math.max(existing.relevanceScore, params.signal.relevanceScore),
            riskFlags: mergeUniqueByJson([...(existing.riskFlags ?? []), ...params.signal.riskFlags]),
            opportunityFlags: mergeUniqueByJson([
              ...(existing.opportunityFlags ?? []),
              ...params.signal.opportunityFlags,
            ]),
            affectedEntities: mergeUniqueByJson([
              ...(existing.affectedEntities ?? []),
              ...params.signal.affectedEntities,
            ]),
            affectedTickers: mergeUniqueByJson([
              ...(existing.affectedTickers ?? []),
              ...params.signal.affectedTickers,
            ]),
            affectedSectors: mergeUniqueByJson([
              ...(existing.affectedSectors ?? []),
              ...params.signal.affectedSectors,
            ]),
            affectedThemes: mergeUniqueByJson([
              ...(existing.affectedThemes ?? []),
              ...params.signal.affectedThemes,
            ]),
            transmissionHypotheses: mergeUniqueByJson([
              ...(existing.transmissionHypotheses ?? []),
              ...params.signal.transmissionHypotheses,
            ]),
            macroLinks: mergeUniqueByJson([...(existing.macroLinks ?? []), ...params.signal.macroLinks]) as Array<Record<string, unknown>>,
            policyLinks: mergeUniqueByJson([...(existing.policyLinks ?? []), ...params.signal.policyLinks]) as Array<Record<string, unknown>>,
            filingLinks: mergeUniqueByJson([...(existing.filingLinks ?? []), ...params.signal.filingLinks]) as Array<Record<string, unknown>>,
            whyItMatters: mergeUniqueByJson([...(existing.whyItMatters ?? []), ...params.signal.whyItMatters]),
            scoringReasons: mergeUniqueByJson([
              ...(existing.scoringReasons ?? []),
              ...params.signal.scoringReasons,
            ]),
            metadataFetchStatus: selectedMetadata.status,
            metadataCard:
              (selectedMetadata.card as unknown as Record<string, unknown> | null),
            metadataFetchedAt: selectedMetadata.fetchedAt,
            provenance: {
              sourceCount: existingSourceRefs.length + params.signal.sourceRefs.length,
              providerCount: providerSet.size,
              providers: Array.from(providerSet),
              sourceDomains: Array.from(sourceDomainSet),
              primaryReason:
                useIncomingPrimary && params.dedupeEvidence?.reasons
                  ? String(params.dedupeEvidence.reasons)
                  : existing.provenance?.primaryReason ?? null,
            },
            lastEnrichedAt: params.signal.lastEnrichedAt,
            updatedAt: params.signal.ingestedAt,
          })
          .where(eq(schema.newsArticle.id, params.articleId))

        await tx
          .insert(schema.newsArticleSourceRef)
          .values(
            params.signal.sourceRefs.map(sourceRef => ({
              newsArticleId: params.articleId,
              provider: sourceRef.provider,
              providerArticleId: sourceRef.providerArticleId,
              providerUrl: sourceRef.providerUrl,
              canonicalUrl: sourceRef.canonicalUrl,
              sourceName: sourceRef.sourceName,
              sourceDomain: sourceRef.sourceDomain,
              sourceType: sourceRef.sourceType,
              title: sourceRef.title,
              normalizedTitle: sourceRef.normalizedTitle,
              language: sourceRef.language,
              publishedAt: sourceRef.publishedAt,
              metadata: sourceRef.metadata,
              rawProviderPayload: sourceRef.rawProviderPayload,
              dedupeEvidence: params.dedupeEvidence ?? sourceRef.dedupeEvidence,
              ingestedAt: params.signal.ingestedAt,
              updatedAt: params.signal.ingestedAt,
            }))
          )
          .onConflictDoUpdate({
            target: [
              schema.newsArticleSourceRef.provider,
              schema.newsArticleSourceRef.providerArticleId,
            ],
            set: {
              newsArticleId: params.articleId,
              providerUrl: sql`excluded.provider_url`,
              canonicalUrl: sql`excluded.canonical_url`,
              sourceName: sql`excluded.source_name`,
              sourceDomain: sql`excluded.source_domain`,
              sourceType: sql`excluded.source_type`,
              title: sql`excluded.title`,
              normalizedTitle: sql`excluded.normalized_title`,
              language: sql`excluded.language`,
              publishedAt: sql`excluded.published_at`,
              metadata: sql`excluded.metadata`,
              rawProviderPayload: sql`excluded.raw_provider_payload`,
              dedupeEvidence: sql`excluded.dedupe_evidence`,
              updatedAt: params.signal.ingestedAt,
            },
          })
      })
    },

    async getNewsCacheState(): Promise<DashboardNewsCacheStateRow | null> {
      const [row] = await db
        .select({
          lastSuccessAt: schema.newsCacheState.lastSuccessAt,
          lastAttemptAt: schema.newsCacheState.lastAttemptAt,
          lastFailureAt: schema.newsCacheState.lastFailureAt,
          lastErrorCode: schema.newsCacheState.lastErrorCode,
          lastErrorMessage: schema.newsCacheState.lastErrorMessage,
          ingestionCount: schema.newsCacheState.ingestionCount,
          dedupeDropCount: schema.newsCacheState.dedupeDropCount,
          providerFailureCount: schema.newsCacheState.providerFailureCount,
          lastFetchedCount: schema.newsCacheState.lastFetchedCount,
          lastInsertedCount: schema.newsCacheState.lastInsertedCount,
          lastMergedCount: schema.newsCacheState.lastMergedCount,
          lastProviderCount: schema.newsCacheState.lastProviderCount,
          lastSignalCount: schema.newsCacheState.lastSignalCount,
        })
        .from(schema.newsCacheState)
        .where(eq(schema.newsCacheState.singleton, true))
        .limit(1)

      return row ?? null
    },

    async upsertNewsCacheState(input: {
      lastSuccessAt?: Date | null
      lastAttemptAt?: Date | null
      lastFailureAt?: Date | null
      lastErrorCode?: string | null
      lastErrorMessage?: string | null
      lastRequestId?: string | null
      ingestionCountIncrement?: number
      dedupeDropCountIncrement?: number
      providerFailureCountIncrement?: number
      lastIngestDurationMs?: number
      lastFetchedCount?: number | null
      lastInsertedCount?: number | null
      lastMergedCount?: number | null
      lastProviderCount?: number | null
      lastSignalCount?: number | null
    }) {
      await db
        .insert(schema.newsCacheState)
        .values({
          singleton: true,
          ...(input.lastSuccessAt !== undefined ? { lastSuccessAt: input.lastSuccessAt } : {}),
          ...(input.lastAttemptAt !== undefined ? { lastAttemptAt: input.lastAttemptAt } : {}),
          ...(input.lastFailureAt !== undefined ? { lastFailureAt: input.lastFailureAt } : {}),
          ...(input.lastErrorCode !== undefined ? { lastErrorCode: input.lastErrorCode } : {}),
          ...(input.lastErrorMessage !== undefined ? { lastErrorMessage: input.lastErrorMessage } : {}),
          ...(input.lastRequestId !== undefined ? { lastRequestId: input.lastRequestId } : {}),
          ...(input.lastIngestDurationMs !== undefined ? { lastIngestDurationMs: input.lastIngestDurationMs } : {}),
          ...(input.lastFetchedCount !== undefined ? { lastFetchedCount: input.lastFetchedCount } : {}),
          ...(input.lastInsertedCount !== undefined ? { lastInsertedCount: input.lastInsertedCount } : {}),
          ...(input.lastMergedCount !== undefined ? { lastMergedCount: input.lastMergedCount } : {}),
          ...(input.lastProviderCount !== undefined ? { lastProviderCount: input.lastProviderCount } : {}),
          ...(input.lastSignalCount !== undefined ? { lastSignalCount: input.lastSignalCount } : {}),
          ...(input.ingestionCountIncrement !== undefined ? { ingestionCount: input.ingestionCountIncrement } : {}),
          ...(input.dedupeDropCountIncrement !== undefined ? { dedupeDropCount: input.dedupeDropCountIncrement } : {}),
          ...(input.providerFailureCountIncrement !== undefined
            ? { providerFailureCount: input.providerFailureCountIncrement }
            : {}),
        })
        .onConflictDoUpdate({
          target: schema.newsCacheState.singleton,
          set: {
            ...(input.lastSuccessAt !== undefined ? { lastSuccessAt: input.lastSuccessAt } : {}),
            ...(input.lastAttemptAt !== undefined ? { lastAttemptAt: input.lastAttemptAt } : {}),
            ...(input.lastFailureAt !== undefined ? { lastFailureAt: input.lastFailureAt } : {}),
            ...(input.lastErrorCode !== undefined ? { lastErrorCode: input.lastErrorCode } : {}),
            ...(input.lastErrorMessage !== undefined ? { lastErrorMessage: input.lastErrorMessage } : {}),
            ...(input.lastRequestId !== undefined ? { lastRequestId: input.lastRequestId } : {}),
            ...(input.lastIngestDurationMs !== undefined ? { lastIngestDurationMs: input.lastIngestDurationMs } : {}),
            ...(input.lastFetchedCount !== undefined ? { lastFetchedCount: input.lastFetchedCount } : {}),
            ...(input.lastInsertedCount !== undefined ? { lastInsertedCount: input.lastInsertedCount } : {}),
            ...(input.lastMergedCount !== undefined ? { lastMergedCount: input.lastMergedCount } : {}),
            ...(input.lastProviderCount !== undefined ? { lastProviderCount: input.lastProviderCount } : {}),
            ...(input.lastSignalCount !== undefined ? { lastSignalCount: input.lastSignalCount } : {}),
            ...(input.ingestionCountIncrement !== undefined
              ? { ingestionCount: sql`${schema.newsCacheState.ingestionCount} + ${input.ingestionCountIncrement}` }
              : {}),
            ...(input.dedupeDropCountIncrement !== undefined
              ? { dedupeDropCount: sql`${schema.newsCacheState.dedupeDropCount} + ${input.dedupeDropCountIncrement}` }
              : {}),
            ...(input.providerFailureCountIncrement !== undefined
              ? {
                  providerFailureCount: sql`${schema.newsCacheState.providerFailureCount} + ${input.providerFailureCountIncrement}`,
                }
              : {}),
            updatedAt: new Date(),
          },
        })
    },

    async upsertNewsProviderState(input: NewsProviderRunResult & { enabled: boolean }) {
      await db
        .insert(schema.newsProviderState)
        .values({
          provider: input.provider,
          enabled: input.enabled,
          ...(input.status === 'success' ? { lastSuccessAt: new Date() } : {}),
          lastAttemptAt: new Date(),
          ...(input.status === 'failed' ? { lastFailureAt: new Date() } : {}),
          lastErrorCode: input.errorCode,
          lastErrorMessage: input.errorMessage,
          lastRequestId: input.requestId,
          lastFetchedCount: input.fetchedCount,
          lastInsertedCount: input.insertedCount,
          lastMergedCount: input.mergedCount,
          successCount: input.status === 'success' ? 1 : 0,
          failureCount: input.status === 'failed' ? 1 : 0,
          skippedCount: input.status === 'skipped' ? 1 : 0,
          lastDurationMs: input.durationMs,
          cooldownUntil: input.cooldownUntil,
        })
        .onConflictDoUpdate({
          target: schema.newsProviderState.provider,
          set: {
            enabled: input.enabled,
            ...(input.status === 'success' ? { lastSuccessAt: new Date() } : {}),
            lastAttemptAt: new Date(),
            ...(input.status === 'failed' ? { lastFailureAt: new Date() } : {}),
            lastErrorCode: input.errorCode,
            lastErrorMessage: input.errorMessage,
            lastRequestId: input.requestId,
            lastFetchedCount: input.fetchedCount,
            lastInsertedCount: input.insertedCount,
            lastMergedCount: input.mergedCount,
            successCount:
              input.status === 'success'
                ? sql`${schema.newsProviderState.successCount} + 1`
                : schema.newsProviderState.successCount,
            failureCount:
              input.status === 'failed'
                ? sql`${schema.newsProviderState.failureCount} + 1`
                : schema.newsProviderState.failureCount,
            skippedCount:
              input.status === 'skipped'
                ? sql`${schema.newsProviderState.skippedCount} + 1`
                : schema.newsProviderState.skippedCount,
            lastDurationMs: input.durationMs,
            cooldownUntil: input.cooldownUntil,
            updatedAt: new Date(),
          },
        })
    },

    async listNewsProviderHealth(): Promise<NewsProviderHealth[]> {
      const rows = await db
        .select({
          provider: schema.newsProviderState.provider,
          enabled: schema.newsProviderState.enabled,
          lastSuccessAt: schema.newsProviderState.lastSuccessAt,
          lastAttemptAt: schema.newsProviderState.lastAttemptAt,
          lastFailureAt: schema.newsProviderState.lastFailureAt,
          lastErrorCode: schema.newsProviderState.lastErrorCode,
          lastErrorMessage: schema.newsProviderState.lastErrorMessage,
          successCount: schema.newsProviderState.successCount,
          failureCount: schema.newsProviderState.failureCount,
          skippedCount: schema.newsProviderState.skippedCount,
          lastFetchedCount: schema.newsProviderState.lastFetchedCount,
          lastInsertedCount: schema.newsProviderState.lastInsertedCount,
          lastMergedCount: schema.newsProviderState.lastMergedCount,
          cooldownUntil: schema.newsProviderState.cooldownUntil,
        })
        .from(schema.newsProviderState)
        .orderBy(schema.newsProviderState.provider)

      return rows.map(row => {
        const status =
          row.failureCount > row.successCount && row.failureCount > 0
            ? 'failing'
            : row.lastFailureAt && (!row.lastSuccessAt || row.lastFailureAt > row.lastSuccessAt)
              ? 'degraded'
              : row.lastSuccessAt
                ? 'healthy'
                : 'idle'

        return {
          provider: row.provider as NewsProviderId,
          label: NEWS_PROVIDER_LABELS[row.provider as NewsProviderId] ?? row.provider,
          enabled: row.enabled,
          status,
          lastSuccessAt: toIsoOrNull(row.lastSuccessAt),
          lastAttemptAt: toIsoOrNull(row.lastAttemptAt),
          lastFailureAt: toIsoOrNull(row.lastFailureAt),
          lastErrorCode: row.lastErrorCode,
          lastErrorMessage: row.lastErrorMessage,
          successCount: row.successCount,
          failureCount: row.failureCount,
          skippedCount: row.skippedCount,
          lastFetchedCount: row.lastFetchedCount ?? 0,
          lastInsertedCount: row.lastInsertedCount ?? 0,
          lastMergedCount: row.lastMergedCount ?? 0,
          cooldownUntil: toIsoOrNull(row.cooldownUntil),
        }
      })
    },
  }
}
