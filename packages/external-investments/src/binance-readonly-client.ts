import { createHmac } from 'node:crypto'
import {
  ProviderOperationError,
  type ProviderRetryPolicy,
  runProviderOperationOrThrow,
} from '@finance-os/provider-runtime/policy'
import { ExternalInvestmentProviderError } from './errors'
import type { ExternalInvestmentFetch } from './types'

export const BINANCE_READONLY_ALLOWED_ENDPOINTS = new Set([
  '/api/v3/account',
  '/api/v3/myTrades',
  '/api/v3/exchangeInfo',
  '/api/v3/time',
  // Public unauthenticated price endpoints used by the crypto price resolver.
  // No order/trade side effect — strictly market data.
  '/api/v3/ticker/price',
  '/api/v3/ticker/24hr',
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
  fetchImpl?: ExternalInvestmentFetch
  /** Transport retry policy; Binance read-only calls do not retry unless configured. */
  retry?: ProviderRetryPolicy
  /** Caller cancellation, e.g. the sync lease; aborts the in-flight request and stops retries. */
  signal?: AbortSignal
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
  retry,
  signal,
}: BinanceReadonlyClientConfig) => {
  const classifyBinanceError = (error: unknown) => ({
    retryable: error instanceof ExternalInvestmentProviderError ? error.retryable : true,
  })

  const toBinanceProviderError = (error: unknown) => {
    if (error instanceof ExternalInvestmentProviderError) {
      return error
    }
    if (error instanceof ProviderOperationError) {
      return new ExternalInvestmentProviderError({
        provider: 'binance',
        code: 'PROVIDER_TIMEOUT',
        message:
          error.kind === 'cancelled'
            ? 'Binance request was cancelled before completion.'
            : 'Binance request timed out.',
        retryable: error.kind !== 'cancelled',
      })
    }
    return new ExternalInvestmentProviderError({
      provider: 'binance',
      code: 'PROVIDER_SCHEMA_CHANGED',
      message: error instanceof Error ? error.message : String(error),
      retryable: true,
    })
  }

  const readJson = async <TResponse>(response: Response) => {
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
  }

  const request = <TResponse>(operation: string, url: string, headers: Record<string, string>) =>
    runProviderOperationOrThrow({
      provider: 'binance',
      operation,
      policy: { timeoutMs, ...(retry ? { retry } : {}) },
      ...(signal ? { signal } : {}),
      classify: classifyBinanceError,
      run: async attemptSignal =>
        readJson<TResponse>(
          await fetchImpl(url, { method: 'GET', headers, signal: attemptSignal })
        ),
    }).catch((error: unknown) => {
      throw toBinanceProviderError(error)
    })

  const publicGet = <TResponse>(path: string, params: BinanceRequestParams = {}) => {
    assertBinanceReadonlyEndpoint({ method: 'GET', path })
    const queryString = toQueryString(params)
    const url = `${baseUrl.replace(/\/+$/, '')}${path}${queryString ? `?${queryString}` : ''}`
    return request<TResponse>(`public${path}`, url, { Accept: 'application/json' })
  }

  const signedGet = <TResponse>(path: string, params: BinanceRequestParams = {}) => {
    assertBinanceReadonlyEndpoint({ method: 'GET', path })
    // The timestamp and signature are computed per attempt so a retried request
    // never replays a stale recvWindow.
    return runProviderOperationOrThrow({
      provider: 'binance',
      operation: `signed${path}`,
      policy: { timeoutMs, ...(retry ? { retry } : {}) },
      ...(signal ? { signal } : {}),
      classify: classifyBinanceError,
      run: async attemptSignal => {
        const { signedQueryString } = signBinanceUserDataParams({
          secret: apiSecret,
          params: { ...params, recvWindow: recvWindowMs, timestamp: now() },
        })
        const response = await fetchImpl(
          `${baseUrl.replace(/\/+$/, '')}${path}?${signedQueryString}`,
          {
            method: 'GET',
            headers: { 'X-MBX-APIKEY': apiKey, Accept: 'application/json' },
            signal: attemptSignal,
          }
        )
        return readJson<TResponse>(response)
      },
    }).catch((error: unknown) => {
      throw toBinanceProviderError(error)
    })
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
      publicGet<Record<string, unknown>>('/api/v3/exchangeInfo', params),
    getServerTime: () => publicGet<{ serverTime: number }>('/api/v3/time'),
    getTickerPrice: (params: { symbol: string }) =>
      publicGet<{ symbol: string; price: string }>('/api/v3/ticker/price', params),
  }
}
