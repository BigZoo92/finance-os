const NEWS_RECENCY_WINDOW_HOURS = 72

export type NewsRelevanceInput = {
  id: string
  title: string
  summary: string | null
  url: string
  sourceName: string
  sourceDomain: string | null
  sourceType: string
  topic: string
  language: string
  publishedAt: string
  domains: string[]
  eventType: string
  severity: number
  confidence: number
  novelty: number
  marketImpactScore: number
  relevanceScore: number
  direction: 'risk' | 'opportunity' | 'mixed'
  affectedSectors: string[]
  affectedTickers: string[]
}

export type PersonalSignalRelevanceInput = {
  id: string
  title: string
  detail: string
  tone: 'outline' | 'destructive'
}

export type RankedEntry<T> = {
  item: T
  score: number
  reasons: string[]
}

const clamp = (value: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, value))
}

const tokenize = (value: string) => value.toLowerCase().trim()

export const rankNewsByRelevance = <T extends NewsRelevanceInput>(
  items: T[],
  context: {
    topicFilter: string
    sourceFilter: string
    domainFilter: string
    eventTypeFilter: string
    now?: Date
  }
): RankedEntry<T>[] => {
  const topicFilter = tokenize(context.topicFilter)
  const sourceFilter = tokenize(context.sourceFilter)
  const domainFilter = tokenize(context.domainFilter)
  const eventTypeFilter = tokenize(context.eventTypeFilter)
  const nowMs = (context.now ?? new Date()).getTime()

  return items
    .map(item => {
      const reasons: string[] = []
      let score = item.relevanceScore + Math.round(item.marketImpactScore * 0.35)

      if (topicFilter.length > 0 && tokenize(item.topic).includes(topicFilter)) {
        score += 18
        reasons.push('topic matches filter')
      }

      if (sourceFilter.length > 0 && tokenize(item.sourceName).includes(sourceFilter)) {
        score += 12
        reasons.push('source matches filter')
      }

      if (
        domainFilter.length > 0 &&
        item.domains.some(domain => tokenize(domain).includes(domainFilter))
      ) {
        score += 16
        reasons.push('domain matches filter')
      }

      if (
        eventTypeFilter.length > 0 &&
        tokenize(item.eventType).includes(eventTypeFilter)
      ) {
        score += 14
        reasons.push('event type matches filter')
      }

      const publishedMs = new Date(item.publishedAt).getTime()
      if (Number.isFinite(publishedMs)) {
        const ageHours = (nowMs - publishedMs) / 3_600_000
        const recencyScore =
          clamp((NEWS_RECENCY_WINDOW_HOURS - ageHours) / NEWS_RECENCY_WINDOW_HOURS, 0, 1) * 18
        if (recencyScore > 0) {
          score += recencyScore
          reasons.push('recent publication')
        }
      }

      if (item.affectedTickers.length > 0) {
        score += 8
        reasons.push('named listed exposure')
      }

      if (item.affectedSectors.length > 1) {
        score += 6
        reasons.push('multi-sector spillover')
      }

      if (item.direction === 'mixed') {
        score += 4
        reasons.push('mixed signal')
      }

      return {
        item,
        score: Math.round(score),
        reasons: reasons.length > 0 ? reasons : ['baseline relevance'],
      }
    })
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score
      }

      const aPublished = new Date(a.item.publishedAt).getTime()
      const bPublished = new Date(b.item.publishedAt).getTime()
      return bPublished - aPublished
    })
}

export const rankPersonalSignalsByRelevance = (
  items: PersonalSignalRelevanceInput[]
): RankedEntry<PersonalSignalRelevanceInput>[] => {
  return items
    .map(item => {
      const reasons: string[] = []
      let score = 0

      if (item.tone === 'destructive') {
        score += 45
        reasons.push('critical tone')
      } else {
        score += 25
        reasons.push('actionable tone')
      }

      const lowerText = `${item.title} ${item.detail}`.toLowerCase()
      if (/(sync|backlog|incident|anomal)/.test(lowerText)) {
        score += 25
        reasons.push('operational risk signal')
      }

      const numericMatch = lowerText.match(/(\d+)/)
      if (numericMatch) {
        const numericValue = Number.parseInt(numericMatch[1] ?? '0', 10)
        if (Number.isFinite(numericValue) && numericValue > 0) {
          score += clamp(numericValue, 1, 20)
          reasons.push('quantified impact')
        }
      }

      return {
        item,
        score,
        reasons: reasons.length > 0 ? reasons : ['baseline relevance'],
      }
    })
    .sort((a, b) => b.score - a.score)
}
