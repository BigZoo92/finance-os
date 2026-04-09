import type { NewsProviderAdapter } from '../news-provider-types'
import { fetchText, parseCsvRows, sanitizePayload } from '../news-provider-utils'

const toNumberOrNull = (value: string | null | undefined) => {
  if (!value) {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export const createEcbDataNewsProvider = ({
  enabled,
  seriesKeys,
}: {
  enabled: boolean
  seriesKeys: string[]
}): NewsProviderAdapter => ({
  provider: 'ecb_data',
  enabled: enabled && seriesKeys.length > 0,
  cooldownMs: 2_000,
  async fetchItems({ requestId, maxItems }) {
    const items = []

    for (const seriesKey of seriesKeys.slice(0, maxItems)) {
      const csv = await fetchText({
        url: `https://data-api.ecb.europa.eu/service/data/${seriesKey}?lastNObservations=2&format=csvdata`,
        requestId,
      })
      const rows = parseCsvRows(csv)
      const latest = rows.at(-1)
      const previous = rows.at(-2)
      if (!latest || typeof latest.TIME_PERIOD !== 'string') {
        continue
      }

      const publishedAt = new Date(`${latest.TIME_PERIOD}T00:00:00.000Z`)
      if (Number.isNaN(publishedAt.getTime())) {
        continue
      }

      const latestValue = toNumberOrNull(typeof latest.OBS_VALUE === 'string' ? latest.OBS_VALUE : null)
      const previousValue = toNumberOrNull(typeof previous?.OBS_VALUE === 'string' ? previous.OBS_VALUE : null)
      const delta =
        latestValue !== null && previousValue !== null ? latestValue - previousValue : null
      const title =
        typeof latest.NAT_TITLE === 'string' && latest.NAT_TITLE.length > 0
          ? latest.NAT_TITLE
          : typeof latest.TITLE === 'string' && latest.TITLE.length > 0
            ? latest.TITLE
            : seriesKey
      const summary =
        latestValue === null
          ? `${title} updated on ${latest.TIME_PERIOD}.`
          : delta === null
            ? `${title} printed ${latestValue.toFixed(4)}.`
            : `${title} printed ${latestValue.toFixed(4)} (${delta >= 0 ? '+' : ''}${delta.toFixed(4)} vs prior observation).`

      items.push({
        provider: 'ecb_data' as const,
        providerArticleId: `${seriesKey}:${latest.TIME_PERIOD}`,
        providerUrl: `https://data.ecb.europa.eu/data/datasets/${seriesKey}`,
        canonicalUrl: `https://data.ecb.europa.eu/data/datasets/${seriesKey}`,
        sourceName: 'ECB Data Portal',
        sourceDomain: 'data.ecb.europa.eu',
        sourceType: 'macro_data' as const,
        title: `${title} update`,
        summary,
        contentSnippet: delta === null ? null : `Delta versus prior observation: ${delta.toFixed(4)}.`,
        language: 'en',
        country: 'EU',
        region: 'europe',
        geoScope: 'regional' as const,
        publishedAt,
        metadata: {
          seriesKey,
          latestValue,
          previousValue,
          delta,
          unit: typeof latest.UNIT === 'string' ? latest.UNIT : null,
        },
        rawPayload: sanitizePayload({
          latest,
          previous,
        }),
      })
    }

    return items
  },
})
