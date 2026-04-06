import { createHash } from 'node:crypto'

export interface LiveNewsArticle {
  providerArticleId: string
  dedupeKey: string
  title: string
  summary: string | null
  url: string
  sourceName: string
  topic: string
  language: string
  publishedAt: Date
  metadata: Record<string, unknown> | null
}

const TOPIC_REGEX: Array<{ pattern: RegExp; topic: string }> = [
  { pattern: /bitcoin|crypto|ethereum/i, topic: 'crypto' },
  { pattern: /etf|index fund|fund/i, topic: 'etf' },
  { pattern: /rate|inflation|gdp|fed|macro/i, topic: 'macro' },
]

const inferTopic = (title: string) => {
  for (const entry of TOPIC_REGEX) {
    if (entry.pattern.test(title)) {
      return entry.topic
    }
  }

  return 'markets'
}

const toDedupeKey = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 48)

export const fetchLiveNews = async ({ requestId }: { requestId: string }): Promise<LiveNewsArticle[]> => {
  const response = await fetch('https://hn.algolia.com/api/v1/search_by_date?query=finance&tags=story', {
    headers: {
      'x-request-id': requestId,
      accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`NEWS_PROVIDER_HTTP_${response.status}`)
  }

  const payload = (await response.json()) as {
    hits?: Array<{
      objectID?: string
      title?: string
      story_title?: string
      url?: string
      story_url?: string
      created_at?: string
      author?: string
    }>
  }

  const hits = payload.hits ?? []
  const normalized: Array<LiveNewsArticle | null> = hits.map(hit => {
      const title = (hit.title ?? hit.story_title ?? '').trim()
      const url = (hit.url ?? hit.story_url ?? '').trim()
      const objectId = (hit.objectID ?? '').trim()
      const createdAt = hit.created_at ? new Date(hit.created_at) : null

      if (!title || !url || !objectId || !createdAt || Number.isNaN(createdAt.getTime())) {
        return null
      }

      const topic = inferTopic(title)

      return {
        providerArticleId: objectId,
        dedupeKey: toDedupeKey(`${title.toLowerCase()}|${url}`),
        title,
        summary: null,
        url,
        sourceName: 'Hacker News',
        topic,
        language: 'en',
        publishedAt: createdAt,
        metadata: hit.author ? { author: hit.author } : null,
      }
    })
  return normalized.filter((item): item is LiveNewsArticle => item !== null).slice(0, 40)
}
