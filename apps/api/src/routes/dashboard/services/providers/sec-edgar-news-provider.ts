import type { NewsProviderAdapter } from '../news-provider-types'
import { fetchJson, sanitizePayload, trimOrNull } from '../news-provider-utils'

const RELEVANT_SEC_FORMS = new Set(['8-K', '10-Q', '10-K', '20-F', '6-K'])

type CompanyTickerRow = {
  cik_str?: number
  ticker?: string
  title?: string
}

const zeroPadCik = (value: number) => value.toString().padStart(10, '0')

export const createSecEdgarNewsProvider = ({
  enabled,
  userAgent,
  watchlistTickers,
}: {
  enabled: boolean
  userAgent: string
  watchlistTickers: string[]
}): NewsProviderAdapter => ({
  provider: 'sec_edgar',
  enabled: enabled && watchlistTickers.length > 0,
  cooldownMs: 2_500,
  async fetchItems({ requestId, maxItems }) {
    const tickerMapPayload = await fetchJson<Record<string, CompanyTickerRow>>({
      url: 'https://www.sec.gov/files/company_tickers.json',
      requestId,
      headers: {
        'user-agent': userAgent,
      },
    })

    const companies = Object.values(tickerMapPayload).filter(
      row =>
        row.ticker &&
        typeof row.cik_str === 'number' &&
        watchlistTickers.includes(row.ticker.toUpperCase())
    )

    const items = []

    for (const company of companies) {
      const cik = zeroPadCik(company.cik_str as number)
      const payload = await fetchJson<{
        filings?: {
          recent?: {
            accessionNumber?: string[]
            filingDate?: string[]
            form?: string[]
            primaryDocument?: string[]
            primaryDocDescription?: string[]
            items?: string[]
          }
        }
        name?: string
        tickers?: string[]
      }>({
        url: `https://data.sec.gov/submissions/CIK${cik}.json`,
        requestId,
        headers: {
          'user-agent': userAgent,
        },
      })

      const recent = payload.filings?.recent
      if (!recent?.accessionNumber || !recent.form || !recent.filingDate) {
        continue
      }

      for (let index = 0; index < recent.accessionNumber.length; index += 1) {
        const form = recent.form[index]
        const filingDate = recent.filingDate[index]
        const accessionNumber = recent.accessionNumber[index]
        if (!form || !filingDate || !accessionNumber || !RELEVANT_SEC_FORMS.has(form)) {
          continue
        }

        const primaryDocument = recent.primaryDocument?.[index]
        const cikNoLeadingZero = String(company.cik_str)
        const accessionNoDashes = accessionNumber.replace(/-/g, '')
        const providerUrl = primaryDocument
          ? `https://www.sec.gov/Archives/edgar/data/${cikNoLeadingZero}/${accessionNoDashes}/${primaryDocument}`
          : `https://www.sec.gov/Archives/edgar/data/${cikNoLeadingZero}/${accessionNoDashes}/`
        const description =
          trimOrNull(recent.primaryDocDescription?.[index]) ??
          trimOrNull(recent.items?.[index]) ??
          'SEC filing'
        const publishedAt = new Date(`${filingDate}T00:00:00.000Z`)

        if (Number.isNaN(publishedAt.getTime())) {
          continue
        }

        items.push({
          provider: 'sec_edgar' as const,
          providerArticleId: `${cik}-${accessionNumber}`,
          providerUrl,
          canonicalUrl: providerUrl,
          sourceName: 'SEC EDGAR',
          sourceDomain: 'sec.gov',
          sourceType: 'filing' as const,
          title: `${company.ticker} filed ${form}: ${description}`,
          summary: description,
          contentSnippet: null,
          language: 'en',
          country: 'US',
          region: 'north_america',
          geoScope: 'company' as const,
          publishedAt,
          metadata: {
            form,
            cik,
            ticker: company.ticker,
            companyName: payload.name ?? company.title ?? null,
          },
          rawPayload: sanitizePayload({
            form,
            accessionNumber,
            filingDate,
            primaryDocument,
            description,
          }),
        })

        if (items.length >= maxItems) {
          return items
        }
      }
    }

    return items
  },
})
