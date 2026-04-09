import type { NewsProviderAdapter } from '../news-provider-types'
import { ensureArray, fetchText, newsXmlParser, sanitizePayload, trimOrNull } from '../news-provider-utils'

export const createFedRssNewsProvider = ({
  enabled,
  feedUrls,
}: {
  enabled: boolean
  feedUrls: string[]
}): NewsProviderAdapter => ({
  provider: 'fed_rss',
  enabled,
  cooldownMs: 2_000,
  async fetchItems({ requestId, maxItems }) {
    const allItems = await Promise.all(
      feedUrls.map(async feedUrl => {
        const xml = await fetchText({
          url: feedUrl,
          requestId,
        })
        const parsed = newsXmlParser.parse(xml) as {
          rss?: {
            channel?: {
              title?: string
              item?: Array<Record<string, unknown>> | Record<string, unknown>
            }
          }
        }

        const channelTitle = trimOrNull(parsed.rss?.channel?.title) ?? 'Federal Reserve'

        return ensureArray(parsed.rss?.channel?.item).map(item => {
          const title = trimOrNull(typeof item.title === 'string' ? item.title : null)
          const providerUrl = trimOrNull(typeof item.link === 'string' ? item.link : null)
          const providerArticleId =
            trimOrNull(typeof item.guid === 'string' ? item.guid : null) ??
            providerUrl ??
            title
          const publishedAtRaw = trimOrNull(typeof item.pubDate === 'string' ? item.pubDate : null)
          const publishedAt = publishedAtRaw ? new Date(publishedAtRaw) : null

          if (!title || !providerUrl || !providerArticleId || !publishedAt || Number.isNaN(publishedAt.getTime())) {
            return null
          }

          return {
            provider: 'fed_rss' as const,
            providerArticleId,
            providerUrl,
            canonicalUrl: providerUrl,
            sourceName: channelTitle,
            sourceDomain: 'federalreserve.gov',
            sourceType: 'central_bank' as const,
            title,
            summary: trimOrNull(typeof item.description === 'string' ? item.description : null),
            contentSnippet: null,
            language: 'en',
            country: 'US',
            region: 'north_america',
            geoScope: 'country' as const,
            publishedAt,
            metadata: {
              feedUrl,
            },
            rawPayload: sanitizePayload(item),
          }
        })
      })
    )

    return allItems.flat().filter((item): item is NonNullable<typeof item> => item !== null).slice(0, maxItems)
  },
})
