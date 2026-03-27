import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import { createDbClient, schema } from '@finance-os/db'
import {
  createPowensClient,
  decryptString,
  POWENS_JOB_QUEUE_KEY,
  type PowensAccount,
  PowensApiError,
  type PowensJob,
  type PowensTransaction,
  parsePowensJob,
  serializePowensJob,
} from '@finance-os/powens'
import { buildRuntimeHealthWithFlags, resolveRuntimeVersion } from '@finance-os/prelude'
import { createRedisClient } from '@finance-os/redis'
import { eq, sql } from 'drizzle-orm'
import { env } from './env'
import { logWorkerEvent } from './observability/logger'
import {
  buildProviderRawImportRow,
  deriveAccountBalance,
  derivePowensTransactionFields,
  deriveTransactionProviderObjectAt,
  type ProviderRawImportInsert,
} from './raw-import'

const dbClient = createDbClient(env.DATABASE_URL)
const redisClient = createRedisClient(env.REDIS_URL)
const powensClient = createPowensClient({
  baseUrl: env.POWENS_BASE_URL,
  clientId: env.POWENS_CLIENT_ID,
  clientSecret: env.POWENS_CLIENT_SECRET,
  userAgent: 'finance-os-worker/1.0',
  maxRetries: 2,
})

const TRANSACTION_BATCH_SIZE = 800
const POWENS_TRANSACTION_PAGE_LIMIT = 250
const LOCK_TTL_SECONDS = 15 * 60
const CONNECTION_LOCK_PREFIX = 'powens:lock:connection:'
const DEFAULT_SYNC_WINDOW_DAYS = 90
const FULL_RESYNC_WINDOW_DAYS = 3650
const RECONNECT_REQUIRED_STATUS_CODES = new Set([401, 403])
const METRIC_RETENTION_SECONDS = 3 * 24 * 60 * 60
const SYNC_COUNT_METRIC_PREFIX = 'powens:metrics:sync:count:'
const POWENS_CALLS_METRIC_PREFIX = 'powens:metrics:powens_calls:count:'
const LAST_SYNC_STARTED_AT_KEY = 'powens:metrics:sync:last_started_at'
const LAST_SYNC_STARTED_CONNECTION_KEY = 'powens:metrics:sync:last_started_connection'
const LAST_SYNC_ENDED_AT_KEY = 'powens:metrics:sync:last_ended_at'
const LAST_SYNC_ENDED_CONNECTION_KEY = 'powens:metrics:sync:last_ended_connection'
const LAST_SYNC_RESULT_KEY = 'powens:metrics:sync:last_result'
const SYNC_RUNS_LIST_KEY = 'powens:metrics:sync:runs'
const SYNC_RUN_KEY_PREFIX = 'powens:metrics:sync:run:'
const SYNC_RUN_RETENTION_SECONDS = 30 * 24 * 60 * 60
const SYNC_RUN_MAX_ITEMS = 40
const WORKER_HEALTHCHECK_FILE = process.env.WORKER_HEALTHCHECK_FILE ?? '/tmp/worker-heartbeat'
const WORKER_STATUS_HOST = '127.0.0.1'
const WORKER_STATUS_PORT = 3002

let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let schedulerTimer: ReturnType<typeof setInterval> | null = null
let statusServer: Server | null = null
let keepRunning = true

const pingDatabase = async () => {
  const result = await dbClient.sql<{ now: string }[]>`
    select now()::text as now
  `

  return result[0]?.now ?? null
}

const resolveWorkerVersion = () =>
  resolveRuntimeVersion({
    service: 'worker',
    nodeEnv: env.NODE_ENV,
    gitSha: process.env.GIT_SHA,
    gitTag: process.env.GIT_TAG,
    buildTime: process.env.BUILD_TIME,
    appCommitSha: process.env.APP_COMMIT_SHA ?? null,
    appVersion: process.env.APP_VERSION ?? null,
    safeModeActive: env.EXTERNAL_INTEGRATIONS_SAFE_MODE,
  })

const sendJson = (
  response: import('node:http').ServerResponse,
  statusCode: number,
  body: unknown
) => {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  response.end(JSON.stringify(body))
}

const startStatusServer = () => {
  statusServer = createServer((request, response) => {
    const pathname = request.url
      ? new URL(request.url, `http://${WORKER_STATUS_HOST}:${WORKER_STATUS_PORT}`).pathname
      : '/'

    if (pathname === '/health') {
      sendJson(
        response,
        200,
        buildRuntimeHealthWithFlags('worker', {
          safeModeActive: env.EXTERNAL_INTEGRATIONS_SAFE_MODE,
        })
      )
      return
    }

    if (pathname === '/version') {
      sendJson(response, 200, resolveWorkerVersion())
      return
    }

    response.writeHead(404)
    response.end('Not Found')
  })

  statusServer.listen(WORKER_STATUS_PORT, WORKER_STATUS_HOST)
  console.log(`[worker] status server: http://${WORKER_STATUS_HOST}:${WORKER_STATUS_PORT}`)
}

const formatDate = (value: Date) => value.toISOString().slice(0, 10)

const subtractDays = (value: Date, days: number) => {
  return new Date(value.getTime() - days * 24 * 60 * 60 * 1000)
}

const toStringValue = (value: unknown) => {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'bigint') {
    return String(value)
  }

  return null
}

const safeString = (value: unknown, fallback: string) => {
  const parsed = toStringValue(value)
  if (!parsed || parsed.length === 0) {
    return fallback
  }

  return parsed
}

const parseCurrency = (value: unknown, fallback: string) => {
  if (typeof value === 'string' && value.length > 0) {
    return value
  }

  if (
    value &&
    typeof value === 'object' &&
    'id' in value &&
    typeof value.id === 'string' &&
    value.id.length > 0
  ) {
    return value.id
  }

  return fallback
}

const parseAccountType = (value: unknown) => {
  if (typeof value === 'string' && value.length > 0) {
    return value
  }

  if (
    value &&
    typeof value === 'object' &&
    'name' in value &&
    typeof value.name === 'string' &&
    value.name.length > 0
  ) {
    return value.name
  }

  if (
    value &&
    typeof value === 'object' &&
    'id' in value &&
    typeof value.id === 'string' &&
    value.id.length > 0
  ) {
    return value.id
  }

  return null
}

const parseEnabledFlag = (disabled: PowensAccount['disabled']) => {
  if (typeof disabled === 'boolean') {
    return !disabled
  }

  if (typeof disabled === 'number') {
    return disabled === 0
  }

  return true
}

const toConnectionStatus = (error: unknown): 'error' | 'reconnect_required' => {
  if (error instanceof PowensApiError && error.statusCode !== null) {
    if (RECONNECT_REQUIRED_STATUS_CODES.has(error.statusCode)) {
      return 'reconnect_required'
    }
  }

  return 'error'
}

const toSafeErrorMessage = (error: unknown) => {
  const raw = error instanceof Error ? error.message : String(error)
  return raw.length > 2000 ? raw.slice(0, 2000) : raw
}

const toErrorFingerprint = (message: string) => {
  const normalized = message
    .toLowerCase()
    .replace(/\b\d+\b/g, '#')
    .replace(/[a-f0-9]{8,}/g, '#')
    .replace(/\s+/g, ' ')
    .trim()

  if (!normalized) {
    return 'unknown_error'
  }

  return normalized.slice(0, 120)
}

const updateHeartbeatFile = async () => {
  try {
    await writeFile(WORKER_HEALTHCHECK_FILE, String(Date.now()), 'utf8')
  } catch (error) {
    logWorkerEvent({
      level: 'error',
      msg: 'worker heartbeat file update failed',
      healthcheckFile: WORKER_HEALTHCHECK_FILE,
      errMessage: toSafeErrorMessage(error),
    })
  }
}

const metricDaySuffix = () => formatDate(new Date())

const incrementDailyMetric = async (prefix: string) => {
  const key = `${prefix}${metricDaySuffix()}`
  await redisClient.client.incr(key)
  await redisClient.client.expire(key, METRIC_RETENTION_SECONDS)
}

const recordLastSyncStarted = async (connectionId: string) => {
  const timestamp = new Date().toISOString()
  await Promise.all([
    redisClient.client.set(LAST_SYNC_STARTED_AT_KEY, timestamp),
    redisClient.client.set(LAST_SYNC_STARTED_CONNECTION_KEY, connectionId),
  ])
}

const recordLastSyncEnded = async (params: {
  connectionId: string
  result: 'success' | 'error' | 'reconnect_required'
}) => {
  const timestamp = new Date().toISOString()
  await Promise.all([
    redisClient.client.set(LAST_SYNC_ENDED_AT_KEY, timestamp),
    redisClient.client.set(LAST_SYNC_ENDED_CONNECTION_KEY, params.connectionId),
    redisClient.client.set(LAST_SYNC_RESULT_KEY, params.result),
  ])
}

type SyncRunResult = 'success' | 'error' | 'reconnect_required'

type StoredSyncRun = {
  id: string
  requestId: string | null
  connectionId: string
  startedAt: string
  endedAt: string | null
  result: SyncRunResult | 'running'
  errorMessage?: string
  errorFingerprint?: string
}

const syncRunKey = (runId: string) => `${SYNC_RUN_KEY_PREFIX}${runId}`

const recordSyncRunStarted = async (params: { connectionId: string; requestId?: string }) => {
  const run: StoredSyncRun = {
    id: randomUUID(),
    requestId: params.requestId ?? null,
    connectionId: params.connectionId,
    startedAt: new Date().toISOString(),
    endedAt: null,
    result: 'running',
  }

  const runKey = syncRunKey(run.id)
  await Promise.all([
    redisClient.client.set(runKey, JSON.stringify(run), {
      EX: SYNC_RUN_RETENTION_SECONDS,
    }),
    redisClient.client.lPush(SYNC_RUNS_LIST_KEY, run.id),
    redisClient.client.lTrim(SYNC_RUNS_LIST_KEY, 0, SYNC_RUN_MAX_ITEMS - 1),
    redisClient.client.expire(SYNC_RUNS_LIST_KEY, SYNC_RUN_RETENTION_SECONDS),
  ])

  return run.id
}

const recordSyncRunEnded = async (params: {
  runId: string
  result: SyncRunResult
  errorMessage?: string
  errorFingerprint?: string
}) => {
  const runKey = syncRunKey(params.runId)
  const raw = await redisClient.client.get(runKey)
  if (!raw) {
    return
  }

  try {
    const parsed = JSON.parse(raw) as StoredSyncRun
    const updatedRun: StoredSyncRun = {
      ...parsed,
      endedAt: new Date().toISOString(),
      result: params.result,
      ...(params.errorMessage ? { errorMessage: params.errorMessage } : {}),
      ...(params.errorFingerprint ? { errorFingerprint: params.errorFingerprint } : {}),
    }

    await redisClient.client.set(runKey, JSON.stringify(updatedRun), {
      EX: SYNC_RUN_RETENTION_SECONDS,
    })
  } catch {
    // Ignore malformed metric payloads.
  }
}

const recordPowensCall = async () => {
  await incrementDailyMetric(POWENS_CALLS_METRIC_PREFIX)
}

const acquireConnectionLock = async (connectionId: string) => {
  const lockKey = `${CONNECTION_LOCK_PREFIX}${connectionId}`
  const lockToken = randomUUID()
  const acquired = await redisClient.client.set(lockKey, lockToken, {
    NX: true,
    EX: LOCK_TTL_SECONDS,
  })

  if (acquired !== 'OK') {
    return null
  }

  return {
    key: lockKey,
    token: lockToken,
  }
}

const releaseConnectionLock = async (lock: { key: string; token: string }) => {
  await redisClient.client.eval(
    'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end',
    {
      keys: [lock.key],
      arguments: [lock.token],
    }
  )
}

const upsertAccounts = async (connectionId: string, accounts: PowensAccount[]) => {
  if (accounts.length === 0) {
    return []
  }

  const now = new Date()

  const values = accounts
    .map(account => {
      const accountId = toStringValue(account.id)
      if (!accountId) {
        return null
      }

      return {
        source: 'banking',
        provider: 'powens',
        providerConnectionId: connectionId,
        providerAccountId: accountId,
        powensAccountId: accountId,
        powensConnectionId: connectionId,
        name: safeString(account.name, `Compte ${accountId}`),
        iban: typeof account.iban === 'string' && account.iban.length > 0 ? account.iban : null,
        currency: parseCurrency(account.currency, 'EUR'),
        type: parseAccountType(account.type),
        enabled: parseEnabledFlag(account.disabled),
        balance: deriveAccountBalance(account),
        raw: account,
        updatedAt: now,
      }
    })
    .filter(value => value !== null)

  if (values.length === 0) {
    return []
  }

  await dbClient.db
    .insert(schema.financialAccount)
    .values(values)
    .onConflictDoUpdate({
      target: schema.financialAccount.powensAccountId,
      set: {
        source: sql`excluded.source`,
        provider: sql`excluded.provider`,
        providerConnectionId: sql`excluded.provider_connection_id`,
        providerAccountId: sql`excluded.provider_account_id`,
        powensConnectionId: sql`excluded.powens_connection_id`,
        name: sql`excluded.name`,
        iban: sql`excluded.iban`,
        currency: sql`excluded.currency`,
        type: sql`excluded.type`,
        enabled: sql`excluded.enabled`,
        balance: sql`excluded.balance`,
        raw: sql`excluded.raw`,
        updatedAt: now,
      },
    })

  await dbClient.db
    .insert(schema.asset)
    .values(
      values.map(account => ({
        assetType: 'cash' as const,
        origin: 'provider' as const,
        source: 'banking',
        provider: 'powens',
        providerConnectionId: connectionId,
        providerExternalAssetId: account.powensAccountId,
        powensConnectionId: connectionId,
        powensAccountId: account.powensAccountId,
        name: account.name,
        currency: account.currency,
        valuation: account.balance,
        valuationAsOf: now,
        enabled: account.enabled,
        raw: account.raw,
        updatedAt: now,
      }))
    )
    .onConflictDoUpdate({
      target: [
        schema.asset.provider,
        schema.asset.providerConnectionId,
        schema.asset.providerExternalAssetId,
      ],
      set: {
        source: sql`excluded.source`,
        powensConnectionId: sql`excluded.powens_connection_id`,
        powensAccountId: sql`excluded.powens_account_id`,
        name: sql`excluded.name`,
        currency: sql`excluded.currency`,
        valuation: sql`excluded.valuation`,
        valuationAsOf: sql`excluded.valuation_as_of`,
        enabled: sql`excluded.enabled`,
        raw: sql`excluded.raw`,
        updatedAt: now,
      },
    })

  return values
}

type TransactionInsert = typeof schema.transaction.$inferInsert

const upsertProviderRawImports = async (rows: ProviderRawImportInsert[]) => {
  if (rows.length === 0) {
    return
  }

  await dbClient.db
    .insert(schema.providerRawImport)
    .values(rows)
    .onConflictDoUpdate({
      target: [
        schema.providerRawImport.provider,
        schema.providerRawImport.providerConnectionId,
        schema.providerRawImport.objectType,
        schema.providerRawImport.externalObjectId,
      ],
      set: {
        source: sql`excluded.source`,
        parentExternalObjectId: sql`excluded.parent_external_object_id`,
        importStatus: sql`excluded.import_status`,
        providerObjectAt: sql`excluded.provider_object_at`,
        lastSeenAt: sql`excluded.last_seen_at`,
        requestId: sql`excluded.request_id`,
        payload: sql`excluded.payload`,
        payloadChecksum: sql`excluded.payload_checksum`,
      },
    })
}

const upsertTransactionsBatch = async (rows: TransactionInsert[]) => {
  if (rows.length === 0) {
    return
  }

  const withPowensId = rows.filter(row => row.powensTransactionId !== null)
  const withoutPowensId = rows.filter(row => row.powensTransactionId === null)

  if (withPowensId.length > 0) {
    await dbClient.db
      .insert(schema.transaction)
      .values(withPowensId)
      .onConflictDoUpdate({
        target: [schema.transaction.powensConnectionId, schema.transaction.powensTransactionId],
        set: {
          powensAccountId: sql`excluded.powens_account_id`,
          bookingDate: sql`excluded.booking_date`,
          amount: sql`excluded.amount`,
          currency: sql`excluded.currency`,
          label: sql`excluded.label`,
          labelHash: sql`excluded.label_hash`,
          category: sql`excluded.category`,
          merchant: sql`excluded.merchant`,
        },
      })
  }

  if (withoutPowensId.length > 0) {
    await dbClient.db
      .insert(schema.transaction)
      .values(withoutPowensId)
      .onConflictDoUpdate({
        target: [
          schema.transaction.powensConnectionId,
          schema.transaction.powensAccountId,
          schema.transaction.bookingDate,
          schema.transaction.amount,
          schema.transaction.labelHash,
        ],
        set: {
          currency: sql`excluded.currency`,
          label: sql`excluded.label`,
          category: sql`excluded.category`,
          merchant: sql`excluded.merchant`,
        },
      })
  }
}

const buildTransactionInsert = (params: {
  connectionId: string
  accountId: string
  accountCurrency: string
  transaction: PowensTransaction
}): TransactionInsert | null => {
  const derived = derivePowensTransactionFields(params.transaction)
  if (!derived) {
    return null
  }

  const transactionId = toStringValue(params.transaction.id)

  return {
    powensTransactionId: transactionId,
    powensConnectionId: params.connectionId,
    powensAccountId: params.accountId,
    bookingDate: derived.bookingDate,
    amount: derived.amount,
    currency: parseCurrency(params.transaction.currency, params.accountCurrency),
    label: derived.label,
    labelHash: derived.labelHash,
    category: derived.category,
    merchant: derived.merchant,
  }
}

const syncConnection = async (params: {
  connectionId: string
  requestId?: string
  fullResync?: boolean
}) => {
  const { connectionId, requestId, fullResync } = params
  const lock = await acquireConnectionLock(connectionId)
  if (!lock) {
    return
  }

  const syncStart = new Date()
  const runId = await recordSyncRunStarted({
    connectionId,
    ...(requestId !== undefined ? { requestId } : {}),
  })
  let connectionProvider = 'powens'
  let connectionSource = 'banking'
  let providerConnectionId = connectionId
  let previousLastSyncAt: Date | null = null

  try {
    const [connection] = await dbClient.db
      .select({
        source: schema.powensConnection.source,
        provider: schema.powensConnection.provider,
        powensConnectionId: schema.powensConnection.powensConnectionId,
        providerConnectionId: schema.powensConnection.providerConnectionId,
        accessTokenEncrypted: schema.powensConnection.accessTokenEncrypted,
        lastSyncAt: schema.powensConnection.lastSyncAt,
      })
      .from(schema.powensConnection)
      .where(eq(schema.powensConnection.powensConnectionId, connectionId))
      .limit(1)

    if (!connection) {
      return
    }

    connectionProvider = connection.provider
    connectionSource = connection.source
    providerConnectionId = connection.providerConnectionId
    previousLastSyncAt = connection.lastSyncAt

    await Promise.all([
      incrementDailyMetric(SYNC_COUNT_METRIC_PREFIX),
      recordLastSyncStarted(connectionId),
    ])

    await dbClient.db
      .update(schema.powensConnection)
      .set({
        status: 'syncing',
        lastSyncAttemptAt: syncStart,
        lastSyncAt: syncStart,
        lastError: null,
        updatedAt: syncStart,
      })
      .where(eq(schema.powensConnection.powensConnectionId, connectionId))

    const accessToken = decryptString(connection.accessTokenEncrypted, env.APP_ENCRYPTION_KEY)
    await recordPowensCall()
    const accounts = await powensClient.listConnectionAccounts(connectionId, accessToken)
    const upsertedAccounts = await upsertAccounts(connectionId, accounts)
    const normalizedAccountIds = new Set(upsertedAccounts.map(account => account.powensAccountId))
    const rawAccountImports = accounts.map(account =>
      buildProviderRawImportRow({
        source: connectionSource,
        provider: connectionProvider,
        providerConnectionId,
        objectType: 'account',
        externalObjectId: toStringValue(account.id),
        importStatus: normalizedAccountIds.has(toStringValue(account.id) ?? '')
          ? 'normalized'
          : 'failed',
        payload: account,
        importedAt: syncStart,
        lastSeenAt: syncStart,
        ...(requestId ? { requestId } : {}),
      })
    )
    await upsertProviderRawImports(rawAccountImports)

    const fromDate =
      fullResync === true
        ? formatDate(subtractDays(syncStart, FULL_RESYNC_WINDOW_DAYS))
        : connection.lastSyncAt
          ? formatDate(subtractDays(connection.lastSyncAt, 3))
          : formatDate(subtractDays(syncStart, DEFAULT_SYNC_WINDOW_DAYS))
    const maxDate = formatDate(syncStart)

    const accountCurrencyById = new Map<string, string>()
    for (const account of upsertedAccounts) {
      accountCurrencyById.set(account.powensAccountId, account.currency)
    }

    const batchBuffer: TransactionInsert[] = []
    const rawImportBatchBuffer: ProviderRawImportInsert[] = []
    let importedTransactionCount = 0
    let failedRawImportCount = rawAccountImports.filter(row => row.importStatus === 'failed').length
    let normalizedRawImportCount = rawAccountImports.length - failedRawImportCount

    for (const account of upsertedAccounts) {
      await recordPowensCall()
      const transactions = await powensClient.listAccountTransactions({
        accessToken,
        accountId: account.powensAccountId,
        minDate: fromDate,
        maxDate,
        limit: POWENS_TRANSACTION_PAGE_LIMIT,
      })

      const fallbackCurrency = accountCurrencyById.get(account.powensAccountId) ?? 'EUR'

      for (const transaction of transactions) {
        const row = buildTransactionInsert({
          connectionId,
          accountId: account.powensAccountId,
          accountCurrency: fallbackCurrency,
          transaction,
        })

        rawImportBatchBuffer.push(
          buildProviderRawImportRow({
            source: connectionSource,
            provider: connectionProvider,
            providerConnectionId,
            objectType: 'transaction',
            externalObjectId: row?.powensTransactionId ?? toStringValue(transaction.id),
            parentExternalObjectId: account.powensAccountId,
            importStatus: row ? 'normalized' : 'failed',
            payload: transaction,
            providerObjectAt: deriveTransactionProviderObjectAt(transaction),
            importedAt: syncStart,
            lastSeenAt: syncStart,
            ...(requestId ? { requestId } : {}),
          })
        )

        if (!row) {
          failedRawImportCount += 1

          if (rawImportBatchBuffer.length >= TRANSACTION_BATCH_SIZE) {
            await upsertProviderRawImports(rawImportBatchBuffer.splice(0, TRANSACTION_BATCH_SIZE))
          }

          continue
        }

        batchBuffer.push(row)
        importedTransactionCount += 1
        normalizedRawImportCount += 1

        if (batchBuffer.length >= TRANSACTION_BATCH_SIZE) {
          await upsertTransactionsBatch(batchBuffer.splice(0, TRANSACTION_BATCH_SIZE))
        }

        if (rawImportBatchBuffer.length >= TRANSACTION_BATCH_SIZE) {
          await upsertProviderRawImports(rawImportBatchBuffer.splice(0, TRANSACTION_BATCH_SIZE))
        }
      }
    }

    if (batchBuffer.length > 0) {
      await upsertTransactionsBatch(batchBuffer)
    }

    if (rawImportBatchBuffer.length > 0) {
      await upsertProviderRawImports(rawImportBatchBuffer)
    }

    const successAt = new Date()
    await dbClient.db
      .update(schema.powensConnection)
      .set({
        status: 'connected',
        lastSyncAt: successAt,
        lastSuccessAt: successAt,
        lastError: null,
        syncMetadata: {
          accountCount: upsertedAccounts.length,
          importedTransactionCount,
          rawImportCount: normalizedRawImportCount + failedRawImportCount,
          rawImportFailedCount: failedRawImportCount,
          rawImportNormalizedCount: normalizedRawImportCount,
          transactionWindow: {
            fromDate,
            maxDate,
          },
          syncMode: fullResync === true ? 'full' : 'incremental',
          lastRunResult: 'success',
          lastRunFinishedAt: successAt.toISOString(),
        },
        updatedAt: successAt,
      })
      .where(eq(schema.powensConnection.powensConnectionId, connectionId))

    await recordLastSyncEnded({
      connectionId,
      result: 'success',
    })
    await recordSyncRunEnded({
      runId,
      result: 'success',
    })
    logWorkerEvent({
      level: 'info',
      msg: 'worker connection sync succeeded',
      source: connectionSource,
      provider: connectionProvider,
      connectionId,
      requestId: requestId ?? 'n/a',
      importedAccountCount: upsertedAccounts.length,
      importedTransactionCount,
      rawImportCount: normalizedRawImportCount + failedRawImportCount,
      rawImportFailedCount: failedRawImportCount,
    })
  } catch (error) {
    const failedAt = new Date()
    const failureStatus = toConnectionStatus(error)
    const errorMessage = toSafeErrorMessage(error)

    await dbClient.db
      .update(schema.powensConnection)
      .set({
        status: failureStatus,
        lastSyncAt: failedAt,
        lastFailedAt: failedAt,
        lastError: errorMessage,
        syncMetadata: {
          transactionWindow: {
            fromDate:
              fullResync === true
                ? formatDate(subtractDays(syncStart, FULL_RESYNC_WINDOW_DAYS))
                : previousLastSyncAt
                  ? formatDate(subtractDays(previousLastSyncAt, 3))
                  : formatDate(subtractDays(syncStart, DEFAULT_SYNC_WINDOW_DAYS)),
            maxDate: formatDate(syncStart),
          },
          syncMode: fullResync === true ? 'full' : 'incremental',
          lastRunResult: failureStatus,
          lastRunFinishedAt: failedAt.toISOString(),
        },
        updatedAt: failedAt,
      })
      .where(eq(schema.powensConnection.powensConnectionId, connectionId))

    await recordLastSyncEnded({
      connectionId,
      result: failureStatus,
    })
    await recordSyncRunEnded({
      runId,
      result: failureStatus,
      errorMessage,
      errorFingerprint: toErrorFingerprint(errorMessage),
    })

    logWorkerEvent({
      level: 'error',
      msg: 'worker connection sync failed',
      source: connectionSource,
      provider: connectionProvider,
      connectionId,
      requestId: requestId ?? 'n/a',
      errMessage: errorMessage,
      failureStatus,
    })
  } finally {
    await releaseConnectionLock(lock)
  }
}

const syncAllConnections = async (requestId?: string) => {
  const connections = await dbClient.db
    .select({
      provider: schema.powensConnection.provider,
      powensConnectionId: schema.powensConnection.powensConnectionId,
      status: schema.powensConnection.status,
    })
    .from(schema.powensConnection)

  for (const connection of connections) {
    if (connection.status === 'reconnect_required') {
      continue
    }

    try {
      await syncConnection({
        connectionId: connection.powensConnectionId,
        ...(requestId !== undefined ? { requestId } : {}),
      })
    } catch (error) {
      logWorkerEvent({
        level: 'error',
        msg: 'worker syncAll isolated failure',
        provider: connection.provider,
        requestId: requestId ?? 'n/a',
        errMessage: toSafeErrorMessage(error),
      })
    }
  }
}

const handleJob = async (job: PowensJob) => {
  if (env.EXTERNAL_INTEGRATIONS_SAFE_MODE) {
    logWorkerEvent({
      level: 'warn',
      msg: 'worker job skipped because external integrations safe mode is enabled',
      jobType: job.type,
      requestId: job.requestId ?? 'n/a',
    })
    return
  }

  if (job.type === 'powens.syncAll') {
    await syncAllConnections(job.requestId)
    return
  }

  await syncConnection({
    connectionId: job.connectionId,
    ...(job.requestId !== undefined ? { requestId: job.requestId } : {}),
    ...(job.fullResync === true ? { fullResync: true } : {}),
  })
}

const startScheduler = () => {
  if (env.EXTERNAL_INTEGRATIONS_SAFE_MODE) {
    logWorkerEvent({
      level: 'warn',
      msg: 'worker scheduler disabled',
      reason: 'EXTERNAL_INTEGRATIONS_SAFE_MODE=true',
    })
    return
  }

  if (!env.WORKER_AUTO_SYNC_ENABLED) {
    logWorkerEvent({
      level: 'warn',
      msg: 'worker scheduler disabled',
      reason: 'WORKER_AUTO_SYNC_ENABLED=false',
    })
    return
  }

  const schedulerIntervalMs =
    env.NODE_ENV === 'production'
      ? Math.max(env.POWENS_SYNC_INTERVAL_MS, env.POWENS_SYNC_MIN_INTERVAL_PROD_MS)
      : env.POWENS_SYNC_INTERVAL_MS

  schedulerTimer = setInterval(async () => {
    try {
      await redisClient.client.rPush(
        POWENS_JOB_QUEUE_KEY,
        serializePowensJob({
          type: 'powens.syncAll',
          requestId: `wrk-${randomUUID()}`,
        })
      )
    } catch (error) {
      logWorkerEvent({
        level: 'error',
        msg: 'worker failed to enqueue scheduled sync',
        errMessage: toSafeErrorMessage(error),
      })
    }
  }, schedulerIntervalMs)

  logWorkerEvent({
    level: 'info',
    msg: 'worker scheduler started',
    schedulerIntervalMs,
  })
}

const consumeJobs = async () => {
  while (keepRunning) {
    try {
      const message = await redisClient.client.blPop(POWENS_JOB_QUEUE_KEY, 5)

      if (!message) {
        continue
      }

      const job = parsePowensJob(message.element)
      if (!job) {
        continue
      }

      logWorkerEvent({
        level: 'info',
        msg: 'worker processing job',
        jobType: job.type,
        requestId: job.requestId ?? 'n/a',
        ...(job.type === 'powens.syncConnection' ? { connectionId: job.connectionId } : {}),
      })
      await handleJob(job)
    } catch (error) {
      if (!keepRunning) {
        return
      }

      logWorkerEvent({
        level: 'error',
        msg: 'worker job loop error',
        errMessage: toSafeErrorMessage(error),
      })
    }
  }
}

const start = async () => {
  startStatusServer()

  await redisClient.connect()

  const [databaseTime, redisPong] = await Promise.all([pingDatabase(), redisClient.ping()])

  logWorkerEvent({
    level: 'info',
    msg: 'worker started',
    databaseStatus: 'ok',
    redisStatus: redisPong,
    databaseTime,
    heartbeatIntervalMs: env.WORKER_HEARTBEAT_MS,
    healthcheckFile: WORKER_HEALTHCHECK_FILE,
    externalIntegrationsSafeMode: env.EXTERNAL_INTEGRATIONS_SAFE_MODE,
    autoSchedulerEnabled: env.WORKER_AUTO_SYNC_ENABLED,
  })
  await updateHeartbeatFile()

  heartbeatTimer = setInterval(async () => {
    try {
      const [dbNow, pong] = await Promise.all([pingDatabase(), redisClient.ping()])
      logWorkerEvent({
        level: 'info',
        msg: 'worker heartbeat ok',
        databaseTime: dbNow,
        redisStatus: pong,
      })
      await updateHeartbeatFile()
    } catch (error) {
      logWorkerEvent({
        level: 'error',
        msg: 'worker heartbeat failed',
        errMessage: toSafeErrorMessage(error),
      })
    }
  }, env.WORKER_HEARTBEAT_MS)

  startScheduler()
  await consumeJobs()
}

const shutdown = async (signal: string) => {
  logWorkerEvent({
    level: 'info',
    msg: 'worker shutdown signal received',
    signal,
  })
  keepRunning = false

  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }

  if (schedulerTimer) {
    clearInterval(schedulerTimer)
    schedulerTimer = null
  }

  statusServer?.close()
  statusServer = null

  await Promise.allSettled([dbClient.close(), redisClient.close()])
  process.exit(0)
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))

void start().catch(async error => {
  logWorkerEvent({
    level: 'error',
    msg: 'worker fatal error',
    errMessage: toSafeErrorMessage(error),
  })
  await Promise.allSettled([dbClient.close(), redisClient.close()])
  process.exit(1)
})
