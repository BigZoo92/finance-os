import { randomUUID } from 'node:crypto'
import type { createDbClient } from '@finance-os/db'
import type { getWorkerEnv } from '@finance-os/env'
import {
  type BinanceCashFlow,
  type BinanceCoinInfo,
  type BinanceTrade,
  createBinanceReadonlyClient,
  createExternalInvestmentsRepository,
  createIbkrFlexClient,
  type ExternalInvestmentCredentialPayload,
  type ExternalInvestmentProvider,
  type ExternalInvestmentsJob,
  normalizeBinanceSnapshot,
  normalizeIbkrFlexStatement,
  toExternalInvestmentErrorCode,
  toSafeExternalInvestmentErrorMessage,
} from '@finance-os/external-investments'
import type { createRedisClient } from '@finance-os/redis'

type WorkerDb = ReturnType<typeof createDbClient>['db']
type WorkerRedisClient = ReturnType<typeof createRedisClient>['client']
type WorkerEnv = ReturnType<typeof getWorkerEnv>
type WorkerLog = (
  event: Record<string, unknown> & { level: 'debug' | 'info' | 'warn' | 'error'; msg: string }
) => void

const EXTERNAL_INVESTMENT_LOCK_TTL_SECONDS = 15 * 60
const EXTERNAL_INVESTMENT_LOCK_PREFIX = 'external-investments:lock:connection:'
const BINANCE_TRADE_QUOTE_ASSETS = [
  'EUR',
  'USDT',
  'USDC',
  'FDUSD',
  'BUSD',
  'USD',
  'BTC',
  'ETH',
  'BNB',
]
const BINANCE_CASH_OR_STABLE_ASSETS = new Set([
  'EUR',
  'USD',
  'GBP',
  'CHF',
  'JPY',
  'CAD',
  'AUD',
  'USDT',
  'USDC',
  'DAI',
  'BUSD',
  'TUSD',
  'FDUSD',
  'USDP',
])

const aggregateCounts = (
  left: Record<string, number>,
  right: Record<string, number>
): Record<string, number> => {
  const next = { ...left }
  for (const [key, value] of Object.entries(right)) {
    next[key] = (next[key] ?? 0) + value
  }
  return next
}

const isProviderEnabled = ({
  env,
  provider,
}: {
  env: WorkerEnv
  provider: ExternalInvestmentProvider
}) => (provider === 'ibkr' ? env.IBKR_FLEX_ENABLED : env.BINANCE_SPOT_ENABLED)

const isExternalInvestmentsSafeModeActive = (env: WorkerEnv) =>
  env.EXTERNAL_INTEGRATIONS_SAFE_MODE || env.EXTERNAL_INVESTMENTS_SAFE_MODE

const sanitizeError = (error: unknown) =>
  toSafeExternalInvestmentErrorMessage(error).slice(0, 1000)

const providerFailureStatus = (error: unknown) => ({
  errorCode: toExternalInvestmentErrorCode(error),
  errorMessage: sanitizeError(error),
})

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {}

const asString = (value: unknown) => (typeof value === 'string' && value.length > 0 ? value : null)

const deriveBinanceTradeSymbols = ({
  positionSymbols,
  exchangeInfo,
}: {
  positionSymbols: string[]
  exchangeInfo: Record<string, unknown>
}) => {
  const baseAssets = new Set(
    positionSymbols
      .map(symbol => symbol.toUpperCase())
      .filter(symbol => !BINANCE_CASH_OR_STABLE_ASSETS.has(symbol))
  )
  const symbols = Array.isArray(exchangeInfo.symbols) ? exchangeInfo.symbols : []
  const quoteRank = new Map(BINANCE_TRADE_QUOTE_ASSETS.map((asset, index) => [asset, index]))

  return [
    ...new Set(
      symbols.flatMap(symbolValue => {
        const symbol = asRecord(symbolValue)
        const id = asString(symbol.symbol)
        const baseAsset = asString(symbol.baseAsset)?.toUpperCase()
        const quoteAsset = asString(symbol.quoteAsset)?.toUpperCase()
        const status = asString(symbol.status)
        if (!id || !baseAsset || !quoteAsset) return []
        if (!baseAssets.has(baseAsset) || !quoteRank.has(quoteAsset)) return []
        if (status && status !== 'TRADING') return []
        if (symbol.isSpotTradingAllowed === false) return []
        return [id]
      })
    ),
  ].sort((left, right) => {
    const leftQuote = BINANCE_TRADE_QUOTE_ASSETS.find(quote => left.endsWith(quote)) ?? ''
    const rightQuote = BINANCE_TRADE_QUOTE_ASSETS.find(quote => right.endsWith(quote)) ?? ''
    return (quoteRank.get(leftQuote) ?? 999) - (quoteRank.get(rightQuote) ?? 999) || left.localeCompare(right)
  })
}

export const createExternalInvestmentsSyncWorker = ({
  db,
  redisClient,
  env,
  log,
}: {
  db: WorkerDb
  redisClient: WorkerRedisClient
  env: WorkerEnv
  log: WorkerLog
}) => {
  const repository = createExternalInvestmentsRepository({
    db,
    staleAfterMinutes: env.EXTERNAL_INVESTMENTS_STALE_AFTER_MINUTES,
  })

  const acquireConnectionLock = async (connectionId: number) => {
    const key = `${EXTERNAL_INVESTMENT_LOCK_PREFIX}${connectionId}`
    const token = randomUUID()
    const acquired = await redisClient.set(key, token, {
      NX: true,
      EX: EXTERNAL_INVESTMENT_LOCK_TTL_SECONDS,
    })

    if (acquired !== 'OK') {
      return null
    }

    return { key, token }
  }

  const releaseConnectionLock = async (lock: { key: string; token: string }) => {
    await redisClient.eval(
      'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end',
      {
        keys: [lock.key],
        arguments: [lock.token],
      }
    )
  }

  const syncIbkrConnection = async ({
    connection,
    payload,
    requestId,
  }: {
    connection: Awaited<ReturnType<typeof repository.listCredentialPayloads>>[number]['connection']
    payload: Extract<ExternalInvestmentCredentialPayload, { provider: 'ibkr' }>
    requestId?: string
  }) => {
    const generatedAt = new Date().toISOString()
    const client = createIbkrFlexClient({
      token: payload.flexToken,
      baseUrl: payload.baseUrl ?? env.IBKR_FLEX_BASE_URL,
      userAgent: payload.userAgent ?? env.IBKR_FLEX_USER_AGENT,
      timeoutMs: env.IBKR_FLEX_TIMEOUT_MS,
    })
    let rowCounts: Record<string, number> = {}
    const degradedReasons: string[] = []
    let successCount = 0

    for (const queryId of payload.queryIds) {
      try {
        const statement = await client.runQuery(queryId)
        const snapshot = normalizeIbkrFlexStatement({
          connectionId: String(connection.id),
          generatedAt,
          accountAlias: payload.accountAlias ?? null,
          queryId,
          statement,
        })
        const counts = await repository.upsertCanonicalSnapshot({
          connection,
          snapshot,
          ...(requestId ? { requestId } : {}),
        })
        rowCounts = aggregateCounts(rowCounts, counts)
        successCount += 1
      } catch (error) {
        degradedReasons.push(toExternalInvestmentErrorCode(error))
        log({
          level: 'warn',
          msg: 'external investments ibkr flex query failed',
          provider: 'ibkr',
          connectionId: connection.id,
          requestId: requestId ?? 'n/a',
          queryIdMasked: `***${queryId.slice(-3)}`,
          errMessage: sanitizeError(error),
        })
      }
    }

    if (successCount === 0) {
      throw new Error(degradedReasons[0] ?? 'PROVIDER_SCHEMA_CHANGED')
    }

    return {
      rowCounts,
      degradedReasons,
    }
  }

  const listBinanceTrades = async ({
    connectionId,
    client,
    requestId,
  }: {
    connectionId: number
    client: ReturnType<typeof createBinanceReadonlyClient>
    requestId?: string
  }) => {
    const positionSymbols = await repository.getAvailableTradeSymbols('binance', connectionId)
    const trades: BinanceTrade[] = []
    const degradedReasons: string[] = []
    let symbols: string[] = []

    try {
      symbols = deriveBinanceTradeSymbols({
        positionSymbols,
        exchangeInfo: await client.getExchangeInfo(),
      })
    } catch (error) {
      degradedReasons.push(toExternalInvestmentErrorCode(error))
      log({
        level: 'warn',
        msg: 'external investments binance exchange info fetch failed',
        provider: 'binance',
        connectionId,
        requestId: requestId ?? 'n/a',
        errMessage: sanitizeError(error),
      })
      return { trades, degradedReasons }
    }

    for (const symbol of symbols.slice(0, 50)) {
      try {
        trades.push(...(await client.getTrades({ symbol, limit: 500 })))
      } catch (error) {
        degradedReasons.push(toExternalInvestmentErrorCode(error))
        log({
          level: 'warn',
          msg: 'external investments binance trades fetch failed',
          provider: 'binance',
          connectionId,
          requestId: requestId ?? 'n/a',
          symbol,
          errMessage: sanitizeError(error),
        })
      }
    }

    return { trades, degradedReasons }
  }

  const safeBinanceArray = async <T>(
    providerCall: () => Promise<T[]>,
    fallback: T[],
    onError: (error: unknown) => void
  ) => {
    try {
      return await providerCall()
    } catch (error) {
      onError(error)
      return fallback
    }
  }

  const syncBinanceConnection = async ({
    connection,
    payload,
    requestId,
  }: {
    connection: Awaited<ReturnType<typeof repository.listCredentialPayloads>>[number]['connection']
    payload: Extract<ExternalInvestmentCredentialPayload, { provider: 'binance' }>
    requestId?: string
  }) => {
    const generatedAt = new Date().toISOString()
    const client = createBinanceReadonlyClient({
      apiKey: payload.apiKey,
      apiSecret: payload.apiSecret,
      baseUrl: payload.baseUrl ?? env.BINANCE_SPOT_BASE_URL,
      recvWindowMs: env.BINANCE_SPOT_RECV_WINDOW_MS,
      timeoutMs: env.BINANCE_SPOT_TIMEOUT_MS,
    })
    const degradedReasons: string[] = []
    const accountInfo = await client.getAccountInfo()
    const deposits = await safeBinanceArray(
      () => client.getDeposits({ limit: 1000 }),
      [] as BinanceCashFlow[],
      error => degradedReasons.push(toExternalInvestmentErrorCode(error))
    )
    const withdrawals = await safeBinanceArray(
      () => client.getWithdrawals({ limit: 1000 }),
      [] as BinanceCashFlow[],
      error => degradedReasons.push(toExternalInvestmentErrorCode(error))
    )
    const coins = await safeBinanceArray(
      () => client.getAllCoinsInfo(),
      [] as BinanceCoinInfo[],
      error => degradedReasons.push(toExternalInvestmentErrorCode(error))
    )
    const tradesResult = await listBinanceTrades({
      connectionId: connection.id,
      client,
      ...(requestId ? { requestId } : {}),
    })
    degradedReasons.push(...tradesResult.degradedReasons)

    const snapshot = normalizeBinanceSnapshot({
      connectionId: String(connection.id),
      generatedAt,
      accountAlias: payload.accountAlias ?? null,
      accountInfo,
      trades: tradesResult.trades,
      deposits,
      withdrawals,
      coins,
    })
    const rowCounts = await repository.upsertCanonicalSnapshot({
      connection,
      snapshot: {
        ...snapshot,
        degradedReasons: Array.from(new Set([...snapshot.degradedReasons, ...degradedReasons])),
        warnings:
          tradesResult.trades.length === 0
            ? [
                ...snapshot.warnings,
                'Binance trade import found no valid pair history; cost basis remains unknown without supported trade history.',
              ]
            : snapshot.warnings,
      },
      ...(requestId ? { requestId } : {}),
    })

    return {
      rowCounts,
      degradedReasons: Array.from(new Set([...snapshot.degradedReasons, ...degradedReasons])),
    }
  }

  const syncCredentialRecord = async ({
    record,
    requestId,
    triggerSource,
  }: {
    record: Awaited<ReturnType<typeof repository.listCredentialPayloads>>[number]
    requestId?: string
    triggerSource: string
  }) => {
    const runId = `external-investments-${randomUUID()}`
    const startedAt = new Date()
    const connection = record.connection

    await repository.createSyncRun({
      runId,
      ...(requestId ? { requestId } : {}),
      provider: connection.provider,
      connectionId: connection.id,
      providerConnectionId: connection.providerConnectionId,
      triggerSource,
    })

    const lock = await acquireConnectionLock(connection.id)
    if (!lock) {
      await repository.finishSyncRun({
        runId,
        status: 'skipped',
        startedAt,
        errorCode: 'PROVIDER_PARTIAL_DATA',
        errorMessage: 'Connection sync skipped because another run owns the lock.',
      })
      await repository.updateProviderHealth({
        provider: connection.provider,
        enabled: true,
        status: 'idle',
        ...(requestId ? { requestId } : {}),
        skipped: true,
        metadata: { reason: 'lock_not_acquired' },
      })
      return
    }

    try {
      await repository.updateConnectionSyncState({
        connectionId: connection.id,
        status: 'syncing',
        attempted: true,
      })

      const result =
        record.payload.provider === 'ibkr'
          ? await syncIbkrConnection({
              connection,
              payload: record.payload,
              ...(requestId ? { requestId } : {}),
            })
          : await syncBinanceConnection({
              connection,
              payload: record.payload,
              ...(requestId ? { requestId } : {}),
            })

      const durationMs = Date.now() - startedAt.getTime()
      const degradedReasons = Array.from(new Set(result.degradedReasons))
      const status = degradedReasons.length > 0 ? 'degraded' : 'success'

      if (degradedReasons.length > 0) {
        await repository.updateConnectionSyncState({
          connectionId: connection.id,
          status: 'degraded',
          lastSyncStatus: 'PARTIAL',
          lastSyncReasonCode: degradedReasons[0] ?? 'PROVIDER_PARTIAL_DATA',
          lastErrorCode: null,
          lastErrorMessage: null,
          syncMetadata: {
            rowCounts: result.rowCounts,
            degradedReasons,
          },
          success: true,
        })
      }

      await repository.finishSyncRun({
        runId,
        status,
        startedAt,
        rowCounts: result.rowCounts,
        degradedReasons,
      })
      await repository.updateProviderHealth({
        provider: connection.provider,
        enabled: true,
        status: degradedReasons.length > 0 ? 'degraded' : 'healthy',
        ...(requestId ? { requestId } : {}),
        durationMs,
        rawImportCount: result.rowCounts.rawImports ?? 0,
        normalizedRowCount:
          (result.rowCounts.accounts ?? 0) +
          (result.rowCounts.instruments ?? 0) +
          (result.rowCounts.positions ?? 0) +
          (result.rowCounts.trades ?? 0) +
          (result.rowCounts.cashFlows ?? 0),
        success: true,
        metadata: { degradedReasons },
      })
      log({
        level: degradedReasons.length > 0 ? 'warn' : 'info',
        msg: 'external investments connection sync completed',
        provider: connection.provider,
        connectionId: connection.id,
        requestId: requestId ?? 'n/a',
        durationMs,
        rowCounts: result.rowCounts,
        degradedReasons,
      })
    } catch (error) {
      const failure = providerFailureStatus(error)
      await repository.updateConnectionSyncState({
        connectionId: connection.id,
        status: 'error',
        lastSyncStatus: 'KO',
        lastSyncReasonCode: failure.errorCode,
        lastErrorCode: failure.errorCode,
        lastErrorMessage: failure.errorMessage,
        syncMetadata: { provider: connection.provider },
        failed: true,
      })
      await repository.finishSyncRun({
        runId,
        status: 'failed',
        startedAt,
        errorCode: failure.errorCode,
        errorMessage: failure.errorMessage,
        degradedReasons: [failure.errorCode],
      })
      await repository.updateProviderHealth({
        provider: connection.provider,
        enabled: true,
        status: 'failing',
        ...(requestId ? { requestId } : {}),
        durationMs: Date.now() - startedAt.getTime(),
        errorCode: failure.errorCode,
        errorMessage: failure.errorMessage,
        failed: true,
      })
      log({
        level: 'error',
        msg: 'external investments connection sync failed',
        provider: connection.provider,
        connectionId: connection.id,
        requestId: requestId ?? 'n/a',
        errCode: failure.errorCode,
        errMessage: failure.errorMessage,
      })
    } finally {
      await releaseConnectionLock(lock)
    }
  }

  const syncProvider = async ({
    provider,
    requestId,
    triggerSource,
  }: {
    provider: ExternalInvestmentProvider
    requestId?: string
    triggerSource: string
  }) => {
    if (!env.EXTERNAL_INVESTMENTS_ENABLED || !isProviderEnabled({ env, provider })) {
      await repository.updateProviderHealth({
        provider,
        enabled: false,
        status: 'idle',
        ...(requestId ? { requestId } : {}),
        skipped: true,
        metadata: { reason: 'provider_disabled' },
      })
      log({
        level: 'info',
        msg: 'external investments provider sync skipped because disabled',
        provider,
        requestId: requestId ?? 'n/a',
      })
      return
    }

    const records = await repository.listCredentialPayloads({
      encryptionKey: env.APP_ENCRYPTION_KEY,
      provider,
    })

    if (records.length === 0) {
      await repository.updateProviderHealth({
        provider,
        enabled: true,
        status: 'idle',
        ...(requestId ? { requestId } : {}),
        skipped: true,
        errorCode: 'PROVIDER_CREDENTIALS_MISSING',
        errorMessage: 'Provider credentials are not configured.',
        metadata: { reason: 'credentials_missing' },
      })
      log({
        level: 'info',
        msg: 'external investments provider sync skipped because credentials are missing',
        provider,
        requestId: requestId ?? 'n/a',
      })
      return
    }

    for (const record of records) {
      await syncCredentialRecord({
        record,
        ...(requestId ? { requestId } : {}),
        triggerSource,
      })
    }
  }

  const generateBundle = async (requestId?: string) => {
    try {
      const bundle = await repository.generateContextBundle({
        ...(requestId ? { requestId } : {}),
      })
      log({
        level: 'info',
        msg: 'external investments advisor bundle generated',
        requestId: requestId ?? 'n/a',
        totalKnownValue: bundle.totalKnownValue,
        unknownValuePositionCount: bundle.unknownValuePositionCount,
        confidence: bundle.confidence,
      })
    } catch (error) {
      log({
        level: 'warn',
        msg: 'external investments advisor bundle generation failed',
        requestId: requestId ?? 'n/a',
        errMessage: sanitizeError(error),
      })
    }
  }

  return {
    async handleJob(job: ExternalInvestmentsJob) {
      if (isExternalInvestmentsSafeModeActive(env)) {
        log({
          level: 'warn',
          msg: 'external investments job skipped because safe mode is enabled',
          jobType: job.type,
          requestId: job.requestId ?? 'n/a',
        })
        return
      }

      if (job.type === 'externalInvestments.syncAll') {
        await syncProvider({
          provider: 'ibkr',
          ...(job.requestId ? { requestId: job.requestId } : {}),
          triggerSource: 'worker.syncAll',
        })
        await syncProvider({
          provider: 'binance',
          ...(job.requestId ? { requestId: job.requestId } : {}),
          triggerSource: 'worker.syncAll',
        })
        await generateBundle(job.requestId)
        return
      }

      if (job.type === 'externalInvestments.syncProvider') {
        await syncProvider({
          provider: job.provider,
          ...(job.requestId ? { requestId: job.requestId } : {}),
          triggerSource: 'worker.syncProvider',
        })
        await generateBundle(job.requestId)
        return
      }

      const connectionId = Number(job.connectionId)
      const records = await repository.listCredentialPayloads({
        encryptionKey: env.APP_ENCRYPTION_KEY,
        provider: job.provider,
      })
      const record = records.find(item => item.connection.id === connectionId)
      if (!record) {
        await repository.updateProviderHealth({
          provider: job.provider,
          enabled: true,
          status: 'idle',
          ...(job.requestId ? { requestId: job.requestId } : {}),
          skipped: true,
          errorCode: 'PROVIDER_CREDENTIALS_MISSING',
          errorMessage: 'Requested connection credential was not found.',
          metadata: { connectionId },
        })
        return
      }

      await syncCredentialRecord({
        record,
        ...(job.requestId ? { requestId: job.requestId } : {}),
        triggerSource: 'worker.syncConnection',
      })
      await generateBundle(job.requestId)
    },
  }
}
