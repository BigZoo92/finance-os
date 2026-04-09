import type {
  DashboardNewsSignalCard,
  NewsContextBundle,
  NewsContextBundleCluster,
  NewsContextBundleSignal,
} from './news-types'
import type { NewsContextBundleRange } from './news-taxonomy'

const takeTop = <T>(items: T[], limit: number) => items.slice(0, limit)

const toBundleSignal = (item: DashboardNewsSignalCard): NewsContextBundleSignal => ({
  id: item.id,
  title: item.title,
  publishedAt: item.publishedAt,
  eventType: item.eventType,
  direction: item.direction,
  severity: item.severity,
  confidence: item.confidence,
  novelty: item.novelty,
  marketImpactScore: item.marketImpactScore,
  relevanceScore: item.relevanceScore,
  sourceCount: item.provenance.sourceCount,
  providerCount: item.provenance.providerCount,
  affectedEntities: item.affectedEntities.map(entity => entity.name),
  affectedSectors: item.affectedSectors,
  affectedTickers: item.affectedTickers,
  whyItMatters: item.whyItMatters,
  supportingUrls: item.sources.map(source => source.providerUrl).filter((value): value is string => Boolean(value)),
})

export const buildNewsClusters = (
  items: DashboardNewsSignalCard[]
): NewsContextBundleCluster[] => {
  const grouped = new Map<string, DashboardNewsSignalCard[]>()

  for (const item of items) {
    const existing = grouped.get(item.eventClusterId)
    if (existing) {
      existing.push(item)
    } else {
      grouped.set(item.eventClusterId, [item])
    }
  }

  return Array.from(grouped.entries())
    .flatMap(([clusterId, clusterItems]) => {
      const sorted = [...clusterItems].sort((left, right) => {
        if (right.marketImpactScore !== left.marketImpactScore) {
          return right.marketImpactScore - left.marketImpactScore
        }

        return new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime()
      })
      const leader = sorted[0]
      const latestPublishedAt = sorted
        .map(item => item.publishedAt)
        .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0]

      if (!leader || !latestPublishedAt) {
        return []
      }

      return [{
        clusterId,
        title: leader.title,
        eventType: leader.eventType,
        direction: leader.direction,
        signalCount: clusterItems.length,
        sourceCount: clusterItems.reduce((count, item) => count + item.provenance.sourceCount, 0),
        latestPublishedAt,
        topDomains: Array.from(new Set(clusterItems.flatMap(item => item.domains))).slice(0, 4),
        topSectors: Array.from(new Set(clusterItems.flatMap(item => item.affectedSectors))).slice(0, 4),
        headlineIds: takeTop(sorted, 4).map(item => item.id),
      }]
    })
    .sort((left, right) => {
      if (right.signalCount !== left.signalCount) {
        return right.signalCount - left.signalCount
      }

      return new Date(right.latestPublishedAt).getTime() - new Date(left.latestPublishedAt).getTime()
    })
}

export const buildNewsContextBundle = ({
  items,
  range,
  lastUpdatedAt,
  staleCache,
  providerFailureRate,
  requestId,
}: {
  items: DashboardNewsSignalCard[]
  range: NewsContextBundleRange
  lastUpdatedAt: string | null
  staleCache: boolean
  providerFailureRate: number
  requestId: string
}): NewsContextBundle => {
  const sortedByRelevance = [...items].sort((left, right) => {
    if (right.relevanceScore !== left.relevanceScore) {
      return right.relevanceScore - left.relevanceScore
    }

    return new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime()
  })
  const topSignals = takeTop(sortedByRelevance, 12)
  const clusters = buildNewsClusters(items)

  const impactedSectors = new Map<string, number>()
  const impactedEntities = new Map<string, number>()
  const causalHypotheses = new Set<string>()
  const contradictions = new Map<string, { bullishCount: number; bearishCount: number; signalIds: string[] }>()

  for (const item of items) {
    for (const sector of item.affectedSectors) {
      impactedSectors.set(sector, (impactedSectors.get(sector) ?? 0) + item.marketImpactScore)
    }

    for (const entity of item.affectedEntities) {
      impactedEntities.set(entity.name, (impactedEntities.get(entity.name) ?? 0) + item.marketImpactScore)
    }

    for (const hypothesis of item.transmissionHypotheses) {
      causalHypotheses.add(hypothesis.label)
    }

    const contradictionKey = item.domains[0] ?? item.topic
    const contradictionRow = contradictions.get(contradictionKey) ?? {
      bullishCount: 0,
      bearishCount: 0,
      signalIds: [],
    }
    if (item.direction === 'opportunity') {
      contradictionRow.bullishCount += 1
    } else {
      contradictionRow.bearishCount += 1
    }
    contradictionRow.signalIds.push(item.id)
    contradictions.set(contradictionKey, contradictionRow)
  }

  const sortMapEntries = (value: Map<string, number>) =>
    Array.from(value.entries())
      .map(([label, score]) => ({ label, score }))
      .sort((left, right) => right.score - left.score)

  return {
    range,
    generatedAt: new Date().toISOString(),
    freshness: {
      lastUpdatedAt,
      staleCache,
      providerFailureRate,
      requestId,
    },
    topSignals: topSignals.map(toBundleSignal),
    clusteredEvents: takeTop(clusters, 10),
    mostImpactedSectors: takeTop(sortMapEntries(impactedSectors), 8).map(entry => ({
      sector: entry.label,
      score: entry.score,
    })),
    mostImpactedEntities: takeTop(sortMapEntries(impactedEntities), 10).map(entry => ({
      entity: entry.label,
      score: entry.score,
    })),
    regulatorHighlights: items
      .filter(item => item.sourceType === 'regulator')
      .slice(0, 6)
      .map(toBundleSignal),
    centralBankHighlights: items
      .filter(item => item.sourceType === 'central_bank')
      .slice(0, 6)
      .map(toBundleSignal),
    filingsHighlights: items
      .filter(item => item.sourceType === 'filing')
      .slice(0, 6)
      .map(toBundleSignal),
    thematicHighlights: {
      ai: items.filter(item => item.domains.includes('ai')).slice(0, 5).map(toBundleSignal),
      cyber: items.filter(item => item.domains.includes('cybersecurity')).slice(0, 5).map(toBundleSignal),
      geopolitics: items.filter(item => item.domains.includes('geopolitics')).slice(0, 5).map(toBundleSignal),
      macro: items.filter(item => item.domains.includes('macroeconomy')).slice(0, 5).map(toBundleSignal),
    },
    contradictorySignals: Array.from(contradictions.entries())
      .filter(([, row]) => row.bullishCount > 0 && row.bearishCount > 0)
      .slice(0, 6)
      .map(([topic, row]) => ({
        topic,
        bullishCount: row.bullishCount,
        bearishCount: row.bearishCount,
        signalIds: row.signalIds,
      })),
    causalHypotheses: Array.from(causalHypotheses).slice(0, 12),
    references: takeTop(sortedByRelevance, 20).map(item => ({
      id: item.id,
      title: item.title,
      url: item.url,
      sourceName: item.sourceName,
      publishedAt: item.publishedAt,
    })),
  }
}
