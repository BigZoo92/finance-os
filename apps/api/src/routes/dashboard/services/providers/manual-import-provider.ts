import type { NewsProviderRawItem } from '../../domain/news-types'

export interface ManualImportItem {
  text: string
  author?: string
  url?: string
  publishedAt?: string
  language?: string
  provider?: string
}

/**
 * Normalizes manually imported items (JSON/text) into the standard NewsProviderRawItem format.
 * This is not a polling provider — it is called explicitly from the manual import API route.
 */
export const normalizeManualImportItems = (
  items: ManualImportItem[],
  maxItems: number
): NewsProviderRawItem[] => {
  const now = new Date()

  return items
    .map((item, index) => {
      const text = item.text?.trim()
      if (!text) return null

      const publishedAt = item.publishedAt ? new Date(item.publishedAt) : now
      if (Number.isNaN(publishedAt.getTime())) return null

      const providerArticleId = `manual_${now.getTime()}_${index}`
      const author = item.author?.trim() ?? 'import manuel'
      const providerUrl = item.url?.trim() ?? null

      return {
        provider: 'manual_import' as const,
        providerArticleId,
        providerUrl,
        canonicalUrl: providerUrl,
        sourceName: author,
        sourceDomain: providerUrl ? new URL(providerUrl).hostname : null,
        sourceType: 'manual' as const,
        title: text.length > 280 ? `${text.slice(0, 277)}...` : text,
        summary: null,
        contentSnippet: text,
        language: item.language?.trim() ?? 'en',
        country: null,
        region: null,
        geoScope: 'global' as const,
        publishedAt,
        metadata: {
          originalProvider: item.provider?.trim() ?? null,
          importedAt: now.toISOString(),
        },
        rawPayload: null,
      } satisfies NewsProviderRawItem
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .slice(0, maxItems)
}
