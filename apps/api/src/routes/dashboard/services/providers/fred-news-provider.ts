import type { NewsProviderAdapter } from '../news-provider-types'
import { fetchJson, sanitizePayload } from '../news-provider-utils'

const DEFAULT_FRED_SERIES_LABELS: Record<string, string> = {
  CPIAUCSL: 'US CPI',
  UNRATE: 'US Unemployment Rate',
  FEDFUNDS: 'Federal Funds Effective Rate',
  DGS10: 'US 10Y Treasury Yield',
  PAYEMS: 'US Nonfarm Payrolls',
}

const toNumberOrNull = (value: string | null | undefined) => {
  if (!value || value === '.') {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export const createFredNewsProvider = ({
  enabled,
  apiKey,
  seriesIds,
}: {
  enabled: boolean
  apiKey: string | undefined
  seriesIds: string[]
}): NewsProviderAdapter => ({
  provider: 'fred',
  enabled: enabled && Boolean(apiKey) && seriesIds.length > 0,
  cooldownMs: 2_000,
  async fetchItems({ requestId, maxItems }) {
    if (!apiKey) {
      return []
    }

    const items = []

    for (const seriesId of seriesIds.slice(0, maxItems)) {
      const payload = await fetchJson<{
        observations?: Array<{
          date?: string
          value?: string
        }>
      }>({
        url:
          'https://api.stlouisfed.org/fred/series/observations?' +
          new URLSearchParams({
            api_key: apiKey,
            file_type: 'json',
            series_id: seriesId,
            sort_order: 'desc',
            limit: '2',
          }).toString(),
        requestId,
      })

      const observations = payload.observations ?? []
      const latest = observations[0]
      if (!latest?.date) {
        continue
      }

      const latestValue = toNumberOrNull(latest.value)
      const previousValue = toNumberOrNull(observations[1]?.value)
      const delta =
        latestValue !== null && previousValue !== null ? latestValue - previousValue : null
      const publishedAt = new Date(`${latest.date}T00:00:00.000Z`)

      if (Number.isNaN(publishedAt.getTime())) {
        continue
      }

      const label = DEFAULT_FRED_SERIES_LABELS[seriesId] ?? seriesId
      const deltaLabel = delta === null ? null : `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}`
      const summary =
        latestValue === null
          ? `${label} updated on ${latest.date}.`
          : deltaLabel
            ? `${label} printed ${latestValue.toFixed(2)} (${deltaLabel} vs prior release).`
            : `${label} printed ${latestValue.toFixed(2)}.`

      items.push({
        provider: 'fred' as const,
        providerArticleId: `${seriesId}:${latest.date}`,
        providerUrl: `https://fred.stlouisfed.org/series/${seriesId}`,
        canonicalUrl: `https://fred.stlouisfed.org/series/${seriesId}`,
        sourceName: 'FRED',
        sourceDomain: 'fred.stlouisfed.org',
        sourceType: 'macro_data' as const,
        title: `${label} update`,
        summary,
        contentSnippet: deltaLabel ? `Delta versus prior release: ${deltaLabel}.` : null,
        language: 'en',
        country: 'US',
        region: 'north_america',
        geoScope: 'country' as const,
        publishedAt,
        metadata: {
          seriesId,
          latestValue,
          previousValue,
          delta,
        },
        rawPayload: sanitizePayload(payload),
      })
    }

    return items
  },
})
