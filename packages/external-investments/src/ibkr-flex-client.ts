import { XMLParser } from 'fast-xml-parser'
import { ExternalInvestmentProviderError } from './errors'

const DEFAULT_IBKR_FLEX_BASE_URL = 'https://ndcdyn.interactivebrokers.com'
const CURRENT_IBKR_FLEX_PATH = '/AccountManagement/FlexWebService'
const LEGACY_IBKR_FLEX_PATH = '/Universal/servlet'
const DEFAULT_GET_STATEMENT_MAX_ATTEMPTS = 4
const DEFAULT_GET_STATEMENT_RETRY_DELAY_MS = 5_000

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: true,
})

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const toIbkrProviderErrorCode = (errorCode: string, errorMessage: string | null) => {
  const signature = `${errorCode} ${errorMessage ?? ''}`
  if (/invalid|token|query|inactive|ip restriction/i.test(signature)) {
    return 'PROVIDER_CREDENTIALS_INVALID'
  }
  if (/temporar|try|progress|later|not ready|incomplete|heavy load/i.test(signature)) {
    return 'PROVIDER_PARTIAL_DATA'
  }
  return 'PROVIDER_SCHEMA_CHANGED'
}

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
      code: toIbkrProviderErrorCode(errorCode, errorMessage),
      message: `IBKR Flex error ${errorCode}: ${errorMessage ?? 'Provider error'}`,
      retryable: /temporar|try|progress|later|not ready|incomplete|heavy load/i.test(
        errorMessage ?? ''
      ),
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
  statementMaxAttempts?: number
  statementRetryDelayMs?: number
  fetchImpl?: typeof fetch
}

type IbkrFlexEndpoint = 'SendRequest' | 'GetStatement'

const resolveIbkrEndpointPath = (baseUrl: string, endpoint: IbkrFlexEndpoint) => {
  const url = new URL(baseUrl)
  const normalizedPath = url.pathname.replace(/\/+$/, '')

  if (normalizedPath.endsWith(LEGACY_IBKR_FLEX_PATH)) {
    return `${normalizedPath}/FlexStatementService.${endpoint}`
  }

  if (normalizedPath.endsWith(CURRENT_IBKR_FLEX_PATH)) {
    return `${normalizedPath}/${endpoint}`
  }

  return `${normalizedPath === '/' ? '' : normalizedPath}${CURRENT_IBKR_FLEX_PATH}/${endpoint}`
}

const buildIbkrUrl = ({
  baseUrl,
  endpoint,
  params,
}: {
  baseUrl: string
  endpoint: IbkrFlexEndpoint
  params: Record<string, string>
}) => {
  const parsedBaseUrl = new URL(baseUrl)
  parsedBaseUrl.pathname = resolveIbkrEndpointPath(baseUrl, endpoint)
  parsedBaseUrl.search = ''
  parsedBaseUrl.hash = ''
  for (const [key, value] of Object.entries(params)) {
    parsedBaseUrl.searchParams.set(key, value)
  }
  return parsedBaseUrl
}

export const createIbkrFlexClient = ({
  token,
  baseUrl = DEFAULT_IBKR_FLEX_BASE_URL,
  userAgent,
  timeoutMs,
  statementMaxAttempts = DEFAULT_GET_STATEMENT_MAX_ATTEMPTS,
  statementRetryDelayMs = DEFAULT_GET_STATEMENT_RETRY_DELAY_MS,
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
        endpoint: 'SendRequest',
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
    for (let attempt = 1; attempt <= statementMaxAttempts; attempt += 1) {
      try {
        const xml = await fetchXml(
          buildIbkrUrl({
            baseUrl,
            endpoint: 'GetStatement',
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
            code: 'PROVIDER_PARTIAL_DATA',
            message: 'IBKR Flex GetStatement returned another reference code.',
            retryable: true,
          })
        }
        return parsed.statement
      } catch (error) {
        if (
          error instanceof ExternalInvestmentProviderError &&
          error.retryable &&
          attempt < statementMaxAttempts
        ) {
          await sleep(statementRetryDelayMs)
          continue
        }
        throw error
      }
    }
    throw new ExternalInvestmentProviderError({
      provider: 'ibkr',
      code: 'PROVIDER_PARTIAL_DATA',
      message: 'IBKR Flex GetStatement did not complete before retry budget was exhausted.',
      retryable: true,
    })
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
