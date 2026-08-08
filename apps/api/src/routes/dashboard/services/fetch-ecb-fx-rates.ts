/**
 * ECB daily reference FX rates — free, keyless, EUR-based.
 *
 * Source: https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml
 * Convention: 1 EUR = `rate` units of quote currency (ECB reference rates).
 * Published business days around 16:00 CET; the `staleAfterSeconds` policy
 * must therefore tolerate weekends (default 96 h).
 *
 * This provider is optional and fail-soft: callers fall back to the latest
 * persisted fx_rate_snapshot rows when the fetch fails.
 */

const DEFAULT_TIMEOUT_MS = 12_000

export const ECB_FX_DAILY_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml'

export interface EcbFxRate {
  baseCurrency: 'EUR'
  quoteCurrency: string
  rate: number
  provider: 'ecb'
  sourceType: 'daily'
  rateTimestamp: Date
}

export class EcbFxParseError extends Error {
  readonly code = 'FX_ECB_PARSE_FAILED' as const

  constructor(message: string) {
    super(message)
    this.name = 'EcbFxParseError'
  }
}

export const parseEcbFxDailyXml = (xml: string): EcbFxRate[] => {
  const timeMatch = xml.match(/<Cube[^>]*\btime=['"](\d{4}-\d{2}-\d{2})['"]/)
  if (!timeMatch?.[1]) {
    throw new EcbFxParseError('ECB daily XML: missing time attribute')
  }

  // ECB reference rates are fixed around 16:00 CET; anchor at 15:00 UTC so the
  // rate timestamp is never in the future relative to its publication.
  const rateTimestamp = new Date(`${timeMatch[1]}T15:00:00.000Z`)

  const rates: EcbFxRate[] = []
  const cubePattern = /<Cube[^>]*\bcurrency=['"]([A-Z]{3})['"][^>]*\brate=['"]([0-9.]+)['"]/g
  for (const match of xml.matchAll(cubePattern)) {
    const quoteCurrency = match[1]
    const rate = Number(match[2])
    if (!quoteCurrency || !Number.isFinite(rate) || rate <= 0) {
      continue
    }
    rates.push({
      baseCurrency: 'EUR',
      quoteCurrency,
      rate,
      provider: 'ecb',
      sourceType: 'daily',
      rateTimestamp,
    })
  }

  if (rates.length === 0) {
    throw new EcbFxParseError('ECB daily XML: no currency rates found')
  }

  return rates
}

export const fetchEcbFxRates = async ({
  url = ECB_FX_DAILY_URL,
  requestId,
}: {
  url?: string
  requestId: string
}): Promise<EcbFxRate[]> => {
  const response = await fetch(url, {
    headers: {
      accept: 'application/xml, text/xml',
      'x-request-id': requestId,
    },
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  })

  if (!response.ok) {
    throw Object.assign(new Error(`FX_ECB_HTTP_${response.status}`), {
      code: `FX_ECB_HTTP_${response.status}`,
    })
  }

  return parseEcbFxDailyXml(await response.text())
}
