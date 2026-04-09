import type { NewsProviderAdapter } from '../news-provider-types'
import { fetchJson, sanitizePayload, trimOrNull } from '../news-provider-utils'

export const createGdeltNewsProvider = ({
  enabled,
  query,
}: {
  enabled: boolean
  query: string
}): NewsProviderAdapter => ({
  provider: 'gdelt_doc',
  enabled,
  cooldownMs: 5_500,
  async fetchItems({ requestId, maxItems }) {
    const url =
      'https://api.gdeltproject.org/api/v2/doc/doc?' +
      new URLSearchParams({
        query,
        mode: 'artlist',
        format: 'json',
        sort: 'datedesc',
        maxrecords: String(Math.min(maxItems, 50)),
      }).toString()

    const payload = await fetchJson<{
      articles?: Array<Record<string, unknown>>
    }>({
      url,
      requestId,
      headers: {
        'user-agent': 'finance-os-api/1.0',
      },
    })

    return (payload.articles ?? [])
      .map(article => {
        const title = trimOrNull(
          typeof article.title === 'string'
            ? article.title
            : typeof article.seenArticle === 'string'
              ? article.seenArticle
              : null
        )
        const providerUrl = trimOrNull(typeof article.url === 'string' ? article.url : null)
        const providerArticleId = trimOrNull(
          typeof article.url === 'string'
            ? article.url
            : typeof article.id === 'string'
              ? article.id
              : null
        )
        const publishedAtRaw =
          typeof article.seendate === 'string'
            ? article.seendate
            : typeof article.seenDate === 'string'
              ? article.seenDate
              : typeof article.date === 'string'
                ? article.date
                : null
        const publishedAt = publishedAtRaw ? new Date(publishedAtRaw) : null

        if (!title || !providerUrl || !providerArticleId || !publishedAt || Number.isNaN(publishedAt.getTime())) {
          return null
        }

        const sourceDomain =
          trimOrNull(typeof article.domain === 'string' ? article.domain : null) ?? new URL(providerUrl).hostname

        return {
          provider: 'gdelt_doc' as const,
          providerArticleId,
          providerUrl,
          canonicalUrl: providerUrl,
          sourceName: sourceDomain,
          sourceDomain,
          sourceType: 'media' as const,
          title,
          summary: null,
          contentSnippet: trimOrNull(
            typeof article.excerpt === 'string'
              ? article.excerpt
              : typeof article.snippet === 'string'
                ? article.snippet
                : null
          ),
          language:
            trimOrNull(typeof article.language === 'string' ? article.language : null) ?? 'en',
          country: trimOrNull(
            typeof article.sourcecountry === 'string' ? article.sourcecountry : null
          ),
          region: null,
          geoScope: 'global' as const,
          publishedAt,
          metadata: {
            ...(typeof article.socialimage === 'string' ? { socialImage: article.socialimage } : {}),
            ...(typeof article.tone === 'string' ? { tone: article.tone } : {}),
          },
          rawPayload: sanitizePayload(article),
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
  },
})
