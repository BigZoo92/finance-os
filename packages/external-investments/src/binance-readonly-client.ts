import { createHmac } from 'node:crypto'
import { ExternalInvestmentProviderError } from './errors'

export const BINANCE_READONLY_ALLOWED_ENDPOINTS = new Set([
  '/api/v3/account',
  '/api/v3/myTrades',
  '/api/v3/exchangeInfo',
  '/api/v3/time',
  '/sapi/v1/capital/deposit/hisrec',
  '/sapi/v1/capital/withdraw/history',
  '/sapi/v1/capital/config/getall',
])

const BINANCE_FORBIDDEN_PATTERN =
  /\/(order|openOrders|withdraw\/apply|transfer|convert|margin|fapi|dapi|staking|simple-earn|asset\/transfer)\b/i

export type BinanceRequestParams = Record<string, string | number | boolean | undefined>

const toQueryString = (params: BinanceRequestParams) => {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) {
      continue
    }
    search.append(key, String(value))
  }
  return search.toString()
}

export const assertBinanceReadonlyEndpoint = ({
  method,
  path,
}: {
  method: string
  path: string
}) => {
  const normalizedMethod = method.toUpperCase()
  if (normalizedMethod !== 'GET') {
    throw new ExternalInvestmentProviderError({
      provider: 'binance',
      code: 'PROVIDER_PERMISSION_UNSAFE',
      message: `Rejected non-read-only Binance method ${normalizedMethod}.`,
    })
  }

  if (BINANCE_FORBIDDEN_PATTERN.test(path) || !BINANCE_READONLY_ALLOWED_ENDPOINTS.has(path)) {
    throw new ExternalInvestmentProviderError({
      provider: 'binance',
      code: 'PROVIDER_PERMISSION_UNSAFE',
      message: `Rejected non-allowlisted Binance endpoint ${path}.`,
    })
  }
}

export const signBinanceUserDataParams = ({
  secret,
  params,
}: {
  secret: string
  params: BinanceRequestParams
}) => {
  const queryString = toQueryString(params)
  const signature = createHmac('sha256', secret).update(queryString).digest('hex')
  return {
    queryString,
    signature,
    signedQueryString: `${queryString}&signature=${signature}`,
  }
}

export type BinanceReadonlyClientConfig = {
  apiKey: string
  apiSecret: string
  baseUrl?: string
  recvWindowMs: number
  timeoutMs: number
  now?: () => number
  fetchImpl?: typeof fetch
}

export type BinanceAccountInfo = {
  accountType?: string
  balances?: Array<{ asset: string; free: string; locked: string }>
}

export type BinanceTrade = {
  id: number | string
  orderId?: number | string
  symbol: string
  price: string
  qty: string
  quoteQty: string
  commission: string
  commissionAsset: string
  time: number
  isBuyer?: boolean
  isMaker?: boolean
}

export type BinanceCashFlow = {
  id?: string
  txId?: string
  amount: string
  coin: string
  network?: string
  status?: number
  insertTime?: number
  applyTime?: string
  completeTime?: string
  transferType?: number
  transactionFee?: string
}

export type BinanceCoinInfo = {
  coin: string
  name?: string
  networkList?: Array<{ network?: string; depositEnable?: boolean; withdrawEnable?: boolean }>
}

export const createBinanceReadonlyClient = ({
  apiKey,
  apiSecret,
  baseUrl = 'https://api.binance.com',
  recvWindowMs,
  timeoutMs,
  now = () => Date.now(),
  fetchImpl = fetch,
}: BinanceReadonlyClientConfig) => {
  const signedGet = async <TResponse>(path: string, params: BinanceRequestParams = {}) => {
    assertBinanceReadonlyEndpoint({ method: 'GET', path })

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    const timestamp = now()
    const { signedQueryString } = signBinanceUserDataParams({
      secret: apiSecret,
      params: {
        ...params,
        recvWindow: recvWindowMs,
        timestamp,
      },
    })

    try {
      const response = await fetchImpl(`${baseUrl.replace(/\/+$/, '')}${path}?${signedQueryString}`, {
        method: 'GET',
        headers: {
          'X-MBX-APIKEY': apiKey,
          Accept: 'application/json',
        },
        signal: controller.signal,
      })

      if (!response.ok) {
        const retryable = response.status === 418 || response.status === 429 || response.status >= 500
        throw new ExternalInvestmentProviderError({
          provider: 'binance',
          code:
            response.status === 401 || response.status === 403
              ? 'PROVIDER_CREDENTIALS_INVALID'
              : response.status === 418 || response.status === 429
                ? 'PROVIDER_RATE_LIMITED'
                : 'PROVIDER_SCHEMA_CHANGED',
          message: `Binance read-only endpoint failed with HTTP ${response.status}.`,
          retryable,
          statusCode: response.status,
        })
      }

      return (await response.json()) as TResponse
    } catch (error) {
      if (error instanceof ExternalInvestmentProviderError) {
        throw error
      }
      throw new ExternalInvestmentProviderError({
        provider: 'binance',
        code: error instanceof Error && error.name === 'AbortError' ? 'PROVIDER_TIMEOUT' : 'PROVIDER_SCHEMA_CHANGED',
        message: error instanceof Error ? error.message : String(error),
        retryable: true,
      })
    } finally {
      clearTimeout(timeout)
    }
  }

  return {
    getAccountInfo: () => signedGet<BinanceAccountInfo>('/api/v3/account'),
    getTrades: (params: { symbol: string; startTime?: number; endTime?: number; limit?: number }) =>
      signedGet<BinanceTrade[]>('/api/v3/myTrades', params),
    getDeposits: (params: { startTime?: number; endTime?: number; limit?: number } = {}) =>
      signedGet<BinanceCashFlow[]>('/sapi/v1/capital/deposit/hisrec', params),
    getWithdrawals: (params: { startTime?: number; endTime?: number; limit?: number } = {}) =>
      signedGet<BinanceCashFlow[]>('/sapi/v1/capital/withdraw/history', params),
    getAllCoinsInfo: () => signedGet<BinanceCoinInfo[]>('/sapi/v1/capital/config/getall'),
    getExchangeInfo: (params: { symbol?: string; symbols?: string } = {}) =>
      signedGet<Record<string, unknown>>('/api/v3/exchangeInfo', params),
    getServerTime: () => signedGet<{ serverTime: number }>('/api/v3/time'),
  }
}
