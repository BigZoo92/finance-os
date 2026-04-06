const NEWS_RECENCY_WINDOW_HOURS = 72

export type NewsRelevanceInput = {
  id: string
  title: string
  summary: string | null
  url: string
  sourceName: string
  topic: string
  language: string
  publishedAt: string
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

export const rankNewsByRelevance = (
  items: NewsRelevanceInput[],
  context: {
    topicFilter: string
    sourceFilter: string
    now?: Date
  }
): RankedEntry<NewsRelevanceInput>[] => {
  const topicFilter = tokenize(context.topicFilter)
  const sourceFilter = tokenize(context.sourceFilter)
  const nowMs = (context.now ?? new Date()).getTime()

  return items
    .map(item => {
      const reasons: string[] = []
      let score = 0

      if (topicFilter.length > 0 && tokenize(item.topic) === topicFilter) {
        score += 35
        reasons.push('topic matches filter')
      }

      if (sourceFilter.length > 0 && tokenize(item.sourceName).includes(sourceFilter)) {
        score += 25
        reasons.push('source matches filter')
      }

      const publishedMs = new Date(item.publishedAt).getTime()
      if (Number.isFinite(publishedMs)) {
        const ageHours = (nowMs - publishedMs) / 3_600_000
        const recencyScore = clamp((NEWS_RECENCY_WINDOW_HOURS - ageHours) / NEWS_RECENCY_WINDOW_HOURS, 0, 1) * 30
        if (recencyScore > 0) {
          score += recencyScore
          reasons.push('recent publication')
        }
      }

      if (item.summary && item.summary.trim().length > 0) {
        score += 5
        reasons.push('has summary context')
      }

      const lowerTitle = item.title.toLowerCase()
      if (/(etf|rates?|inflation|crypto|equity|bond|market)/.test(lowerTitle)) {
        score += 10
        reasons.push('finance keyword in title')
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
