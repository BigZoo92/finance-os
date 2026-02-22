type PrimitiveQueryValue = string | number | boolean

interface PowensRequestOptions {
  method?: 'GET' | 'POST'
  pathOrUrl: string
  accessToken?: string
  query?: Record<string, PrimitiveQueryValue | null | undefined>
  body?: unknown
}

export interface PowensClientConfig {
  baseUrl: string
  clientId: string
  clientSecret: string
  userAgent: string
  timeoutMs?: number
  maxRetries?: number
}

export interface PowensTokenResponse {
  access_token: string
  expires_in?: number
  token_type?: string
  scope?: string
}

export interface PowensAccount {
  id: number | string
  id_connection?: number | string
  name?: string
  iban?: string | null
  currency?: string | { id?: string } | null
  type?: string | { id?: string; name?: string } | null
  disabled?: number | boolean
  [key: string]: unknown
}

export interface PowensTransaction {
  id?: number | string
  id_account?: number | string
  date?: string
  rdate?: string
  amount?: number | string
  currency?: string | { id?: string } | null
  wording?: string
  raw?: string
  [key: string]: unknown
}

interface PowensTransactionResponse {
  transactions?: PowensTransaction[]
  _links?: {
    next?: { href?: string } | string
  }
}

interface PowensAccountResponse {
  accounts?: PowensAccount[]
}

const DEFAULT_TIMEOUT_MS = 12_000
const DEFAULT_MAX_RETRIES = 2
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504])

const toUrl = (
  baseUrl: string,
  pathOrUrl: string,
  query?: Record<string, PrimitiveQueryValue | null | undefined>
) => {
  const hasProtocol = /^https?:\/\//i.test(pathOrUrl)
  const url = hasProtocol ? new URL(pathOrUrl) : new URL(pathOrUrl, withTrailingSlash(baseUrl))

  if (!query) {
    return url
  }

  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined) {
      continue
    }

    url.searchParams.set(key, String(value))
  }

  return url
}

const withTrailingSlash = (value: string) => {
  return value.endsWith('/') ? value : `${value}/`
}

const isRetryableError = (error: unknown) => {
  if (error instanceof PowensApiError) {
    return error.statusCode !== null && RETRYABLE_STATUS.has(error.statusCode)
  }

  return error instanceof Error
}

const sleep = async (durationMs: number) => {
  await new Promise(resolve => setTimeout(resolve, durationMs))
}

const readResponseBody = async (response: Response) => {
  const contentType = response.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    return response.json()
  }

  return response.text()
}

const extractNextUrl = (response: PowensTransactionResponse): string | null => {
  const next = response._links?.next

  if (typeof next === 'string' && next.length > 0) {
    return next
  }

  if (next && typeof next === 'object' && typeof next.href === 'string' && next.href.length > 0) {
    return next.href
  }

  return null
}

export class PowensApiError extends Error {
  statusCode: number | null
  body: unknown

  constructor(message: string, statusCode: number | null, body: unknown) {
    super(message)
    this.name = 'PowensApiError'
    this.statusCode = statusCode
    this.body = body
  }
}

export const normalizePowensDomain = (domain: string) => {
  return domain.endsWith('.biapi.pro') ? domain : `${domain}.biapi.pro`
}

export const buildPowensWebviewUrl = (params: {
  webviewBaseUrl: string
  domain: string
  clientId: string
  redirectUri: string
}) => {
  const url = new URL(params.webviewBaseUrl)
  url.searchParams.set('domain', normalizePowensDomain(params.domain))
  url.searchParams.set('client_id', params.clientId)
  url.searchParams.set('redirect_uri', params.redirectUri)
  return url.toString()
}

export const createPowensClient = (config: PowensClientConfig) => {
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES

  const requestJson = async <TResponse>({
    method = 'GET',
    pathOrUrl,
    accessToken,
    query,
    body,
  }: PowensRequestOptions): Promise<TResponse> => {
    const url = toUrl(config.baseUrl, pathOrUrl, query)

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), timeoutMs)

      try {
        const requestInit: RequestInit = {
          method,
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': config.userAgent,
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          signal: controller.signal,
        }

        if (body !== undefined) {
          requestInit.body = JSON.stringify(body)
        }

        const response = await fetch(url, requestInit)

        if (!response.ok) {
          const parsedBody = await readResponseBody(response)
          const error = new PowensApiError(
            `Powens request failed with status ${response.status}`,
            response.status,
            parsedBody
          )

          if (attempt < maxRetries && RETRYABLE_STATUS.has(response.status)) {
            await sleep(250 * (attempt + 1))
            continue
          }

          throw error
        }

        return (await response.json()) as TResponse
      } catch (error) {
        if (attempt < maxRetries && isRetryableError(error)) {
          await sleep(250 * (attempt + 1))
          continue
        }

        if (error instanceof PowensApiError) {
          throw error
        }

        const message = error instanceof Error ? error.message : 'Unknown Powens network error'
        throw new PowensApiError(message, null, null)
      } finally {
        clearTimeout(timeout)
      }
    }

    throw new PowensApiError('Powens retry budget exhausted', null, null)
  }

  const exchangeCodeForToken = async (code: string) => {
    // Powens auth endpoint documented as POST /auth/token/access.
    const response = await requestJson<PowensTokenResponse>({
      method: 'POST',
      pathOrUrl: '/auth/token/access',
      body: {
        grant_type: 'authorization_code',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
      },
    })

    if (!response.access_token || response.access_token.length === 0) {
      throw new PowensApiError('Powens token exchange returned an empty access token', null, response)
    }

    return response
  }

  const listConnectionAccounts = async (connectionId: string, accessToken: string) => {
    // Powens route alias for a connection account list.
    const response = await requestJson<PowensAccountResponse>({
      pathOrUrl: `/users/me/connections/${encodeURIComponent(connectionId)}/accounts`,
      accessToken,
      query: {
        all: true,
      },
    })

    return Array.isArray(response.accounts) ? response.accounts : []
  }

  const listAccountTransactions = async (params: {
    accountId: string
    accessToken: string
    minDate: string
    maxDate: string
    limit?: number
  }) => {
    const limit = params.limit ?? 1000
    const transactions: PowensTransaction[] = []
    let offset = 0
    let nextPageUrl: string | null = null

    for (let page = 0; page < 500; page += 1) {
      const request: PowensRequestOptions = {
        // Powens route alias for account transactions.
        pathOrUrl:
          nextPageUrl ??
          `/users/me/accounts/${encodeURIComponent(params.accountId)}/transactions`,
        accessToken: params.accessToken,
      }

      if (nextPageUrl === null) {
        request.query = {
          min_date: params.minDate,
          max_date: params.maxDate,
          limit,
          offset,
        }
      }

      const response = await requestJson<PowensTransactionResponse>(request)

      const pageItems = Array.isArray(response.transactions) ? response.transactions : []
      transactions.push(...pageItems)

      const nextUrl = extractNextUrl(response)
      if (nextUrl) {
        nextPageUrl = nextUrl
        continue
      }

      if (pageItems.length < limit) {
        break
      }

      offset += pageItems.length
      nextPageUrl = null
    }

    return transactions
  }

  return {
    exchangeCodeForToken,
    listConnectionAccounts,
    listAccountTransactions,
  }
}
