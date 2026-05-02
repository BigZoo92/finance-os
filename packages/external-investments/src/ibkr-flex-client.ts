import { XMLParser } from 'fast-xml-parser'
import { ExternalInvestmentProviderError } from './errors'

const DEFAULT_IBKR_FLEX_BASE_URL = 'https://gdcdyn.interactivebrokers.com/Universal/servlet'

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: true,
})

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {}

const findNestedString = (value: unknown, keys: string[]): string | null => {
  const queue: unknown[] = [value]
  while (queue.length > 0) {
    const item = queue.shift()
    if (!item || typeof item !== 'object') {
      continue
    }
    const record = item as Record<string, unknown>
    for (const key of keys) {
      const candidate = record[key]
      if (typeof candidate === 'string' && candidate.length > 0) {
        return candidate
      }
      if (typeof candidate === 'number') {
        return String(candidate)
      }
    }
    queue.push(...Object.values(record))
  }
  return null
}

export type IbkrFlexParsedResponse =
  | {
      kind: 'request'
      referenceCode: string
    }
  | {
      kind: 'statement'
      statement: Record<string, unknown>
    }

export const parseIbkrFlexXml = (xml: string): IbkrFlexParsedResponse => {
  const parsed = parser.parse(xml) as Record<string, unknown>
  const errorCode = findNestedString(parsed, ['ErrorCode', 'errorCode', 'code'])
  const errorMessage = findNestedString(parsed, ['ErrorMessage', 'errorMessage', 'message'])
  if (errorCode && errorCode !== '0') {
    throw new ExternalInvestmentProviderError({
      provider: 'ibkr',
      code: /invalid|token|query/i.test(`${errorCode} ${errorMessage ?? ''}`)
        ? 'PROVIDER_CREDENTIALS_INVALID'
        : 'PROVIDER_SCHEMA_CHANGED',
      message: `IBKR Flex error ${errorCode}: ${errorMessage ?? 'Provider error'}`,
      retryable: /temporar|try|progress|later/i.test(errorMessage ?? ''),
    })
  }

  const referenceCode = findNestedString(parsed, ['ReferenceCode', 'referenceCode'])
  if (referenceCode) {
    return {
      kind: 'request',
      referenceCode,
    }
  }

  const statement = asRecord(
    asRecord(parsed.FlexQueryResponse).FlexStatements ?? asRecord(parsed).FlexStatement ?? parsed
  )

  return {
    kind: 'statement',
    statement,
  }
}

export type IbkrFlexClientConfig = {
  token: string
  baseUrl?: string
  userAgent: string
  timeoutMs: number
  fetchImpl?: typeof fetch
}

const buildIbkrUrl = ({
  baseUrl,
  endpoint,
  params,
}: {
  baseUrl: string
  endpoint: string
  params: Record<string, string>
}) => {
  const url = new URL(`${baseUrl.replace(/\/+$/, '')}/${endpoint}`)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return url
}

export const createIbkrFlexClient = ({
  token,
  baseUrl = DEFAULT_IBKR_FLEX_BASE_URL,
  userAgent,
  timeoutMs,
  fetchImpl = fetch,
}: IbkrFlexClientConfig) => {
  if (!userAgent.trim()) {
    throw new ExternalInvestmentProviderError({
      provider: 'ibkr',
      code: 'PROVIDER_CREDENTIALS_INVALID',
      message: 'IBKR Flex User-Agent is required.',
    })
  }

  const fetchXml = async (url: URL) => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetchImpl(url, {
        method: 'GET',
        headers: {
          Accept: 'application/xml,text/xml',
          'User-Agent': userAgent,
        },
        signal: controller.signal,
      })
      if (!response.ok) {
        throw new ExternalInvestmentProviderError({
          provider: 'ibkr',
          code:
            response.status === 401 || response.status === 403
              ? 'PROVIDER_CREDENTIALS_INVALID'
              : 'PROVIDER_SCHEMA_CHANGED',
          message: `IBKR Flex endpoint failed with HTTP ${response.status}.`,
          retryable: response.status === 429 || response.status >= 500,
          statusCode: response.status,
        })
      }
      return response.text()
    } catch (error) {
      if (error instanceof ExternalInvestmentProviderError) {
        throw error
      }
      throw new ExternalInvestmentProviderError({
        provider: 'ibkr',
        code: error instanceof Error && error.name === 'AbortError' ? 'PROVIDER_TIMEOUT' : 'PROVIDER_SCHEMA_CHANGED',
        message: error instanceof Error ? error.message : String(error),
        retryable: true,
      })
    } finally {
      clearTimeout(timeout)
    }
  }

  const requestReport = async (queryId: string) => {
    const xml = await fetchXml(
      buildIbkrUrl({
        baseUrl,
        endpoint: 'FlexStatementService.SendRequest',
        params: {
          t: token,
          q: queryId,
          v: '3',
        },
      })
    )
    const parsed = parseIbkrFlexXml(xml)
    if (parsed.kind !== 'request') {
      throw new ExternalInvestmentProviderError({
        provider: 'ibkr',
        code: 'PROVIDER_SCHEMA_CHANGED',
        message: 'IBKR Flex SendRequest did not return a reference code.',
      })
    }
    return parsed.referenceCode
  }

  const getStatement = async (referenceCode: string) => {
    const xml = await fetchXml(
      buildIbkrUrl({
        baseUrl,
        endpoint: 'FlexStatementService.GetStatement',
        params: {
          t: token,
          q: referenceCode,
          v: '3',
        },
      })
    )
    const parsed = parseIbkrFlexXml(xml)
    if (parsed.kind !== 'statement') {
      throw new ExternalInvestmentProviderError({
        provider: 'ibkr',
        code: 'PROVIDER_SCHEMA_CHANGED',
        message: 'IBKR Flex GetStatement returned another reference code.',
        retryable: true,
      })
    }
    return parsed.statement
  }

  return {
    requestReport,
    getStatement,
    async runQuery(queryId: string) {
      const referenceCode = await requestReport(queryId)
      return getStatement(referenceCode)
    },
  }
}
