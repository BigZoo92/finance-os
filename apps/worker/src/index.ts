import { createHash, randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { eq, sql } from 'drizzle-orm'
import { createDbClient, schema } from '@finance-os/db'
import {
  createPowensClient,
  decryptString,
  parsePowensJob,
  PowensApiError,
  POWENS_JOB_QUEUE_KEY,
  serializePowensJob,
  type PowensAccount,
  type PowensJob,
  type PowensTransaction,
} from '@finance-os/powens'
import { createRedisClient } from '@finance-os/redis'
import { env } from './env'

const dbClient = createDbClient(env.DATABASE_URL)
const redisClient = createRedisClient(env.REDIS_URL)
const powensClient = createPowensClient({
  baseUrl: env.POWENS_BASE_URL,
  clientId: env.POWENS_CLIENT_ID,
  clientSecret: env.POWENS_CLIENT_SECRET,
  userAgent: 'finance-os-worker/1.0',
  timeoutMs: 12_000,
  maxRetries: 2,
})

const TRANSACTION_BATCH_SIZE = 800
const LOCK_TTL_SECONDS = 15 * 60
const CONNECTION_LOCK_PREFIX = 'powens:lock:connection:'
const RECONNECT_REQUIRED_STATUS_CODES = new Set([401, 403])
const METRIC_RETENTION_SECONDS = 3 * 24 * 60 * 60
const SYNC_COUNT_METRIC_PREFIX = 'powens:metrics:sync:count:'
const POWENS_CALLS_METRIC_PREFIX = 'powens:metrics:powens_calls:count:'
const LAST_SYNC_STARTED_AT_KEY = 'powens:metrics:sync:last_started_at'
const LAST_SYNC_STARTED_CONNECTION_KEY = 'powens:metrics:sync:last_started_connection'
const LAST_SYNC_ENDED_AT_KEY = 'powens:metrics:sync:last_ended_at'
const LAST_SYNC_ENDED_CONNECTION_KEY = 'powens:metrics:sync:last_ended_connection'
const LAST_SYNC_RESULT_KEY = 'powens:metrics:sync:last_result'
const WORKER_HEALTHCHECK_FILE = process.env.WORKER_HEALTHCHECK_FILE ?? '/tmp/worker-heartbeat'

let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let schedulerTimer: ReturnType<typeof setInterval> | null = null
let keepRunning = true

const pingDatabase = async () => {
  const result = await dbClient.sql<{ now: string }[]>`
    select now()::text as now
  `

  return result[0]?.now ?? null
}

const formatDate = (value: Date) => value.toISOString().slice(0, 10)

const subtractDays = (value: Date, days: number) => {
  return new Date(value.getTime() - days * 24 * 60 * 60 * 1000)
}

const normalizeLabel = (label: string) => {
  return label.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase()
}

const hashLabel = (label: string) => {
  return createHash('sha256').update(normalizeLabel(label), 'utf8').digest('hex')
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

const parseTransactionDate = (transaction: PowensTransaction) => {
  const raw = transaction.date ?? transaction.rdate

  if (typeof raw !== 'string' || raw.length < 10) {
    return null
  }

  const datePart = raw.slice(0, 10)
  const parsed = new Date(`${datePart}T00:00:00Z`)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return formatDate(parsed)
}

const parseTransactionAmount = (transaction: PowensTransaction) => {
  if (typeof transaction.amount === 'number' && Number.isFinite(transaction.amount)) {
    return transaction.amount.toFixed(2)
  }

  if (typeof transaction.amount === 'string' && transaction.amount.trim().length > 0) {
    const asNumber = Number(transaction.amount)
    if (Number.isFinite(asNumber)) {
      return asNumber.toFixed(2)
    }
  }

  return null
}

const parseTransactionLabel = (transaction: PowensTransaction) => {
  const candidates = [
    transaction.wording,
    typeof transaction.raw === 'string' ? transaction.raw : null,
    toStringValue(transaction.label),
    toStringValue(transaction.original_wording),
  ]

  for (const candidate of candidates) {
    if (candidate && candidate.trim().length > 0) {
      return candidate.trim()
    }
  }

  return 'Transaction'
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

const updateHeartbeatFile = async () => {
  try {
    await writeFile(WORKER_HEALTHCHECK_FILE, String(Date.now()), 'utf8')
  } catch (error) {
    console.error('[worker] failed to update heartbeat file:', toSafeErrorMessage(error))
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
        powensAccountId: accountId,
        powensConnectionId: connectionId,
        name: safeString(account.name, `Compte ${accountId}`),
        iban: typeof account.iban === 'string' && account.iban.length > 0 ? account.iban : null,
        currency: parseCurrency(account.currency, 'EUR'),
        type: parseAccountType(account.type),
        enabled: parseEnabledFlag(account.disabled),
        raw: account,
        updatedAt: now,
      }
    })
    .filter(value => value !== null)

  if (values.length === 0) {
    return []
  }

  await dbClient.db
    .insert(schema.bankAccount)
    .values(values)
    .onConflictDoUpdate({
      target: schema.bankAccount.powensAccountId,
      set: {
        powensConnectionId: sql`excluded.powens_connection_id`,
        name: sql`excluded.name`,
        iban: sql`excluded.iban`,
        currency: sql`excluded.currency`,
        type: sql`excluded.type`,
        enabled: sql`excluded.enabled`,
        raw: sql`excluded.raw`,
        updatedAt: now,
      },
    })

  return values
}

type TransactionInsert = typeof schema.transaction.$inferInsert

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
          raw: sql`excluded.raw`,
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
          raw: sql`excluded.raw`,
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
  const bookingDate = parseTransactionDate(params.transaction)
  const amount = parseTransactionAmount(params.transaction)

  if (!bookingDate || !amount) {
    return null
  }

  const label = parseTransactionLabel(params.transaction)
  const transactionId = toStringValue(params.transaction.id)

  return {
    powensTransactionId: transactionId,
    powensConnectionId: params.connectionId,
    powensAccountId: params.accountId,
    bookingDate,
    amount,
    currency: parseCurrency(params.transaction.currency, params.accountCurrency),
    label,
    labelHash: hashLabel(label),
    raw: params.transaction,
  }
}

const syncConnection = async (connectionId: string) => {
  const lock = await acquireConnectionLock(connectionId)
  if (!lock) {
    return
  }

  const syncStart = new Date()

  try {
    const [connection] = await dbClient.db
      .select({
        powensConnectionId: schema.powensConnection.powensConnectionId,
        accessTokenEncrypted: schema.powensConnection.accessTokenEncrypted,
        lastSyncAt: schema.powensConnection.lastSyncAt,
      })
      .from(schema.powensConnection)
      .where(eq(schema.powensConnection.powensConnectionId, connectionId))
      .limit(1)

    if (!connection) {
      return
    }

    await Promise.all([
      incrementDailyMetric(SYNC_COUNT_METRIC_PREFIX),
      recordLastSyncStarted(connectionId),
    ])

    await dbClient.db
      .update(schema.powensConnection)
      .set({
        status: 'syncing',
        lastSyncAt: syncStart,
        lastError: null,
        updatedAt: syncStart,
      })
      .where(eq(schema.powensConnection.powensConnectionId, connectionId))

    const accessToken = decryptString(connection.accessTokenEncrypted, env.APP_ENCRYPTION_KEY)
    await recordPowensCall()
    const accounts = await powensClient.listConnectionAccounts(connectionId, accessToken)
    const upsertedAccounts = await upsertAccounts(connectionId, accounts)

    const fromDate = connection.lastSyncAt
      ? formatDate(subtractDays(connection.lastSyncAt, 3))
      : formatDate(subtractDays(syncStart, 90))
    const maxDate = formatDate(syncStart)

    const accountCurrencyById = new Map<string, string>()
    for (const account of upsertedAccounts) {
      accountCurrencyById.set(account.powensAccountId, account.currency)
    }

    const batchBuffer: TransactionInsert[] = []

    for (const account of upsertedAccounts) {
      await recordPowensCall()
      const transactions = await powensClient.listAccountTransactions({
        accessToken,
        accountId: account.powensAccountId,
        minDate: fromDate,
        maxDate,
        limit: 1000,
      })

      const fallbackCurrency = accountCurrencyById.get(account.powensAccountId) ?? 'EUR'

      for (const transaction of transactions) {
        const row = buildTransactionInsert({
          connectionId,
          accountId: account.powensAccountId,
          accountCurrency: fallbackCurrency,
          transaction,
        })

        if (!row) {
          continue
        }

        batchBuffer.push(row)

        if (batchBuffer.length >= TRANSACTION_BATCH_SIZE) {
          await upsertTransactionsBatch(batchBuffer.splice(0, TRANSACTION_BATCH_SIZE))
        }
      }
    }

    if (batchBuffer.length > 0) {
      await upsertTransactionsBatch(batchBuffer)
    }

    const successAt = new Date()
    await dbClient.db
      .update(schema.powensConnection)
      .set({
        status: 'connected',
        lastSyncAt: successAt,
        lastSuccessAt: successAt,
        lastError: null,
        updatedAt: successAt,
      })
      .where(eq(schema.powensConnection.powensConnectionId, connectionId))

    await recordLastSyncEnded({
      connectionId,
      result: 'success',
    })
  } catch (error) {
    const failedAt = new Date()
    const failureStatus = toConnectionStatus(error)

    await dbClient.db
      .update(schema.powensConnection)
      .set({
        status: failureStatus,
        lastSyncAt: failedAt,
        lastError: toSafeErrorMessage(error),
        updatedAt: failedAt,
      })
      .where(eq(schema.powensConnection.powensConnectionId, connectionId))

    await recordLastSyncEnded({
      connectionId,
      result: failureStatus,
    })

    console.error('[worker] connection sync failed for', connectionId, '-', toSafeErrorMessage(error))
  } finally {
    await releaseConnectionLock(lock)
  }
}

const syncAllConnections = async () => {
  const connections = await dbClient.db
    .select({
      powensConnectionId: schema.powensConnection.powensConnectionId,
      status: schema.powensConnection.status,
    })
    .from(schema.powensConnection)

  for (const connection of connections) {
    if (connection.status === 'reconnect_required') {
      continue
    }

    try {
      await syncConnection(connection.powensConnectionId)
    } catch (error) {
      console.error('[worker] syncAll isolated failure:', toSafeErrorMessage(error))
    }
  }
}

const handleJob = async (job: PowensJob) => {
  if (job.type === 'powens.syncAll') {
    await syncAllConnections()
    return
  }

  await syncConnection(job.connectionId)
}

const startScheduler = () => {
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
        })
      )
    } catch (error) {
      console.error('[worker] failed to enqueue scheduled sync:', toSafeErrorMessage(error))
    }
  }, schedulerIntervalMs)

  console.log('[worker] scheduler every', schedulerIntervalMs, 'ms')
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

      await handleJob(job)
    } catch (error) {
      if (!keepRunning) {
        return
      }

      console.error('[worker] job loop error:', toSafeErrorMessage(error))
    }
  }
}

const start = async () => {
  await redisClient.connect()

  const [databaseTime, redisPong] = await Promise.all([pingDatabase(), redisClient.ping()])

  console.log('[worker] started')
  console.log('[worker] database: ok')
  console.log('[worker] redis:', redisPong)
  console.log('[worker] databaseTime:', databaseTime)
  console.log('[worker] heartbeat every', env.WORKER_HEARTBEAT_MS, 'ms')
  console.log('[worker] healthcheck file:', WORKER_HEALTHCHECK_FILE)
  await updateHeartbeatFile()

  heartbeatTimer = setInterval(async () => {
    try {
      const [dbNow, pong] = await Promise.all([pingDatabase(), redisClient.ping()])
      console.log('[worker] heartbeat ok - db:', dbNow, '- redis:', pong)
      await updateHeartbeatFile()
    } catch (error) {
      console.error('[worker] heartbeat failed:', toSafeErrorMessage(error))
    }
  }, env.WORKER_HEARTBEAT_MS)

  startScheduler()
  await consumeJobs()
}

const shutdown = async (signal: string) => {
  console.log(`[worker] received ${signal}, shutting down...`)
  keepRunning = false

  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }

  if (schedulerTimer) {
    clearInterval(schedulerTimer)
    schedulerTimer = null
  }

  await Promise.allSettled([dbClient.close(), redisClient.close()])
  process.exit(0)
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))

void start().catch(async error => {
  console.error('[worker] fatal error:', toSafeErrorMessage(error))
  await Promise.allSettled([dbClient.close(), redisClient.close()])
  process.exit(1)
})
