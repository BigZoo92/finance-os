import type { NewsProviderId } from '../domain/news-taxonomy'
import type { NewsProviderRawItem } from '../domain/news-types'

export interface NewsProviderExecutionContext {
  requestId: string
  now: Date
  maxItems: number
}

export interface NewsProviderAdapter {
  provider: NewsProviderId
  enabled: boolean
  cooldownMs: number
  fetchItems: (context: NewsProviderExecutionContext) => Promise<NewsProviderRawItem[]>
}
