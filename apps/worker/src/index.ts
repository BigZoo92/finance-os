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
import {
  EXTERNAL_INVESTMENTS_JOB_QUEUE_KEY,
  parseExternalInvestmentsJob,
} from '@finance-os/external-investments'
import { buildRuntimeHealthWithFlags, resolveRuntimeVersion } from '@finance-os/prelude'
import { createRedisClient } from '@finance-os/redis'
import { and, eq, inArray, isNull, ne, sql } from 'drizzle-orm'
import { env } from './env'
import {
  collectNormalizedIbans,
  dedupePowensAccountRows,
  normalizePowensIban,
} from './powens-account-dedupe'
import {
  startDashboardMarketsScheduler,
  triggerDashboardMarketsRefresh,
} from './market-refresh-scheduler'
import {
  startDashboardAdvisorScheduler,
  triggerDashboardAdvisorDailyRun,
} from './advisor-daily-scheduler'
import {
  startDailyIntelligenceScheduler,
  triggerDailyIntelligenceRun,
} from './daily-intelligence-scheduler'
import { startDashboardNewsScheduler, triggerDashboardNewsIngest } from './news-ingest-scheduler'
import { startPowensAutoSyncScheduler } from './powens-auto-sync-scheduler'
import { startSocialSignalScheduler, triggerSocialSignalIngest } from './social-signal-scheduler'
import {
  startAttentionRebuildScheduler,
  triggerAttentionRebuild,
} from './attention-rebuild-scheduler'
import { logWorkerEvent } from './observability/logger'
import {
  buildProviderRawImportRow,
  deriveAccountBalance,
  deriveAccountMetadata,
  derivePowensTransactionFields,
  deriveTransactionProviderObjectAt,
  type ProviderRawImportInsert,
} from './raw-import'
import {
  type PersistedSyncReasonCode,
  type PersistedSyncStatus,
  resolvePersistedSyncSnapshot,
} from './sync-status-persistence'
import { parseDisabledProviders, resolveSyncWindow } from './sync-window'
import { shouldRunReconnectRecoverySync } from './reconnect-recovery'
import { resolveAssetTypeFromPowensAccountType } from './powens-account-type'
import { detectSyncIntegrityIssues } from './sync-integrity-checks'
import { detectTransactionGaps } from './transaction-gap-detection'
import { createExternalInvestmentsSyncWorker } from './external-investments-sync'

const dbClient = createDbClient(env.DATABASE_URL)
const redisClient = createRedisClient(env.REDIS_URL)
const powensClient = createPowensClient({
  baseUrl: env.POWENS_BASE_URL,
  clientId: env.POWENS_CLIENT_ID,
  clientSecret: env.POWENS_CLIENT_SECRET,
  userAgent: 'finance-os-worker/1.0',
  maxRetries: 2,
})
const externalInvestmentsSyncWorker = createExternalInvestmentsSyncWorker({
  db: dbClient.db,
  redisClient: redisClient.client,
  env,
  log: logWorkerEvent,
})

const TRANSACTION_BATCH_SIZE = 800
const POWENS_TRANSACTION_PAGE_LIMIT = 250
const LOCK_TTL_SECONDS = 15 * 60
const CONNECTION_LOCK_PREFIX = 'powens:lock:connection:'
const DEFAULT_SYNC_WINDOW_DAYS = 90
const FULL_RESYNC_WINDOW_DAYS = 3650
const INCREMENTAL_LOOKBACK_DAYS = env.POWENS_SYNC_INCREMENTAL_LOOKBACK_DAYS
const FORCE_FULL_SYNC_MODE = env.POWENS_FORCE_FULL_SYNC
const DISABLED_SYNC_PROVIDERS = parseDisabledProviders(env.POWENS_SYNC_DISABLED_PROVIDERS)
const TRANSACTION_GAP_THRESHOLD_DAYS = 45
const MAX_TRANSACTION_GAP_DETAILS = 5
const MAX_INTEGRITY_ISSUE_DETAILS = 5
const RECONNECT_REQUIRED_STATUS_CODES = new Set([401, 403])
const METRIC_RETENTION_SECONDS = 3 * 24 * 60 * 60
const SYNC_COUNT_METRIC_PREFIX = 'powens:metrics:sync:count:'
const SYNC_STATUS_COUNT_METRIC_PREFIX = 'powens:metrics:sync_status:count:'
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
let newsSchedulerTimer: ReturnType<typeof setInterval> | null = null
let marketSchedulerTimer: ReturnType<typeof setInterval> | null = null
let advisorSchedulerTimer: ReturnType<typeof setInterval> | null = null
let dailyIntelligenceSchedulerTimer: ReturnType<typeof setInterval> | null = null
let socialSchedulerTimer: ReturnType<typeof setInterval> | null = null
let attentionSchedulerTimer: ReturnType<typeof setInterval> | null = null
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
  logWorkerEvent({
    level: 'info',
    msg: 'worker status server listening',
    host: WORKER_STATUS_HOST,
    port: WORKER_STATUS_PORT,
  })
}

const formatDate = (value: Date) => value.toISOString().slice(0, 10)

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

const incrementPersistedSyncMetric = async (params: {
  status: PersistedSyncStatus
  reasonCode: PersistedSyncReasonCode
}) => {
  await incrementDailyMetric(
    `${SYNC_STATUS_COUNT_METRIC_PREFIX}${params.status}:${params.reasonCode}:`
  )
}

const logPersistedSyncTransition = (params: {
  source: string
  provider: string
  connectionId: string
  requestId?: string
  previousStatus: PersistedSyncStatus | null
  previousReasonCode: PersistedSyncReasonCode | null
  nextStatus: PersistedSyncStatus
  nextReasonCode: PersistedSyncReasonCode
}) => {
  logWorkerEvent({
    level: 'info',
    msg: 'worker persisted sync snapshot transition',
    source: params.source,
    provider: params.provider,
    connectionId: params.connectionId,
    requestId: params.requestId ?? 'n/a',
    previousStatus: params.previousStatus ?? 'UNKNOWN',
    previousReasonCode: params.previousReasonCode ?? 'UNKNOWN',
    nextStatus: params.nextStatus,
    nextReasonCode: params.nextReasonCode,
    changed:
      params.previousStatus !== params.nextStatus ||
      params.previousReasonCode !== params.nextReasonCode,
  })
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

const dedupeRowsByKey = <T>(rows: T[], getKey: (row: T) => string): T[] => {
  if (rows.length <= 1) {
    return rows
  }

  const indexByKey = new Map<string, number>()
  const dedupedRows: T[] = []

  for (const row of rows) {
    const key = getKey(row)
    const existingIndex = indexByKey.get(key)

    if (existingIndex === undefined) {
      indexByKey.set(key, dedupedRows.length)
      dedupedRows.push(row)
      continue
    }

    dedupedRows[existingIndex] = row
  }

  return dedupedRows
}

const disableSupersededPowensAccounts = async ({
  connectionId,
  accounts,
  now,
}: {
  connectionId: string
  accounts: Array<{
    iban: string | null
    enabled: boolean
  }>
  now: Date
}) => {
  const activeIbans = collectNormalizedIbans(accounts.filter(account => account.enabled))
  if (activeIbans.size === 0) {
    return
  }

  const existingAccounts = await dbClient.db
    .select({
      powensConnectionId: schema.financialAccount.powensConnectionId,
      powensAccountId: schema.financialAccount.powensAccountId,
      iban: schema.financialAccount.iban,
    })
    .from(schema.financialAccount)
    .where(
      and(
        eq(schema.financialAccount.provider, 'powens'),
        eq(schema.financialAccount.enabled, true),
        ne(schema.financialAccount.powensConnectionId, connectionId)
      )
    )

  const supersededAccounts = existingAccounts.filter(account => {
    const normalizedIban = normalizePowensIban(account.iban)
    return normalizedIban ? activeIbans.has(normalizedIban) : false
  })

  if (supersededAccounts.length === 0) {
    return
  }

  const supersededAccountIds = [
    ...new Set(supersededAccounts.map(account => account.powensAccountId)),
  ]
  const supersededConnectionIds = [
    ...new Set(supersededAccounts.map(account => account.powensConnectionId)),
  ]

  await dbClient.db
    .update(schema.financialAccount)
    .set({
      enabled: false,
      updatedAt: now,
    })
    .where(
      and(
        inArray(schema.financialAccount.powensAccountId, supersededAccountIds),
        inArray(schema.financialAccount.powensConnectionId, supersededConnectionIds)
      )
    )

  await dbClient.db
    .update(schema.asset)
    .set({
      enabled: false,
      updatedAt: now,
    })
    .where(
      and(
        inArray(schema.asset.powensAccountId, supersededAccountIds),
        inArray(schema.asset.powensConnectionId, supersededConnectionIds)
      )
    )

  const remainingActiveRows = await dbClient.db
    .select({
      powensConnectionId: schema.financialAccount.powensConnectionId,
      activeAccountCount: sql<number>`count(*)::int`,
    })
    .from(schema.financialAccount)
    .where(
      and(
        inArray(schema.financialAccount.powensConnectionId, supersededConnectionIds),
        eq(schema.financialAccount.enabled, true)
      )
    )
    .groupBy(schema.financialAccount.powensConnectionId)

  const activeConnectionIds = new Set(
    remainingActiveRows.filter(row => row.activeAccountCount > 0).map(row => row.powensConnectionId)
  )
  const fullySupersededConnectionIds = supersededConnectionIds.filter(
    supersededConnectionId => !activeConnectionIds.has(supersededConnectionId)
  )

  if (fullySupersededConnectionIds.length > 0) {
    await dbClient.db
      .update(schema.powensConnection)
      .set({
        archivedAt: now,
        archivedReason: 'duplicate_account_replaced',
        updatedAt: now,
      })
      .where(
        and(
          inArray(schema.powensConnection.powensConnectionId, fullySupersededConnectionIds),
          isNull(schema.powensConnection.archivedAt)
        )
      )
  }

  logWorkerEvent({
    level: 'info',
    msg: 'worker disabled superseded Powens accounts',
    connectionId,
    supersededAccountCount: supersededAccountIds.length,
    supersededConnectionCount: fullySupersededConnectionIds.length,
  })
}

const upsertAccounts = async (connectionId: string, accounts: PowensAccount[]) => {
  if (accounts.length === 0) {
    return []
  }

  const now = new Date()

  const normalizedAccounts = accounts
    .map(account => {
      const accountId = toStringValue(account.id)
      if (!accountId) {
        return null
      }

      const parsedAccountType = parseAccountType(account.type)

      return {
        assetType: resolveAssetTypeFromPowensAccountType(account.type),
        source: 'banking',
        provider: 'powens',
        providerConnectionId: connectionId,
        providerAccountId: accountId,
        powensAccountId: accountId,
        powensConnectionId: connectionId,
        name: safeString(account.name, `Compte ${accountId}`),
        iban: typeof account.iban === 'string' && account.iban.length > 0 ? account.iban : null,
        currency: parseCurrency(account.currency, 'EUR'),
        type: parsedAccountType,
        enabled: parseEnabledFlag(account.disabled),
        balance: deriveAccountBalance(account),
        metadata: deriveAccountMetadata(account),
        raw: account,
        updatedAt: now,
      }
    })
    .filter(value => value !== null)

  if (normalizedAccounts.length === 0) {
    return []
  }

  const dedupedAccounts = dedupePowensAccountRows(normalizedAccounts)

  await disableSupersededPowensAccounts({
    connectionId,
    accounts: dedupedAccounts,
    now,
  })

  const accountValues = dedupedAccounts.map(account => ({
    source: account.source,
    provider: account.provider,
    providerConnectionId: account.providerConnectionId,
    providerAccountId: account.providerAccountId,
    powensAccountId: account.powensAccountId,
    powensConnectionId: account.powensConnectionId,
    name: account.name,
    iban: account.iban,
    currency: account.currency,
    type: account.type,
    enabled: account.enabled,
    balance: account.balance,
    metadata: account.metadata,
    raw: account.raw,
    updatedAt: account.updatedAt,
  }))

  await dbClient.db
    .insert(schema.financialAccount)
    .values(accountValues)
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
        metadata: sql`excluded.metadata`,
        raw: sql`excluded.raw`,
        updatedAt: now,
      },
    })

  await dbClient.db
    .insert(schema.asset)
    .values(
      dedupedAccounts.map(account => ({
        assetType: account.assetType,
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

  return accountValues
}

type TransactionInsert = typeof schema.transaction.$inferInsert

const upsertProviderRawImports = async (rows: ProviderRawImportInsert[]) => {
  if (rows.length === 0) {
    return
  }

  const dedupedRows = dedupeRowsByKey(
    rows,
    row => `${row.provider}|${row.providerConnectionId}|${row.objectType}|${row.externalObjectId}`
  )

  await dbClient.db
    .insert(schema.providerRawImport)
    .values(dedupedRows)
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
  const dedupedWithPowensId = dedupeRowsByKey(
    withPowensId,
    row => `${row.powensConnectionId}|${row.powensTransactionId}`
  )
  const dedupedWithoutPowensId = dedupeRowsByKey(
    withoutPowensId,
    row =>
      `${row.powensConnectionId}|${row.powensAccountId}|${row.bookingDate}|${row.amount}|${row.labelHash}`
  )

  if (dedupedWithPowensId.length > 0) {
    await dbClient.db
      .insert(schema.transaction)
      .values(dedupedWithPowensId)
      .onConflictDoUpdate({
        target: [schema.transaction.powensConnectionId, schema.transaction.powensTransactionId],
        targetWhere: sql`${schema.transaction.powensTransactionId} is not null`,
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

  if (dedupedWithoutPowensId.length > 0) {
    await dbClient.db
      .insert(schema.transaction)
      .values(dedupedWithoutPowensId)
      .onConflictDoUpdate({
        target: [
          schema.transaction.powensConnectionId,
          schema.transaction.powensAccountId,
          schema.transaction.bookingDate,
          schema.transaction.amount,
          schema.transaction.labelHash,
        ],
        targetWhere: sql`${schema.transaction.powensTransactionId} is null`,
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
  let previousLastSuccessAt: Date | null = null
  let previousPersistedSyncStatus: PersistedSyncStatus | null = null
  let previousPersistedSyncReasonCode: PersistedSyncReasonCode | null = null

  try {
    const [connection] = await dbClient.db
      .select({
        source: schema.powensConnection.source,
        provider: schema.powensConnection.provider,
        powensConnectionId: schema.powensConnection.powensConnectionId,
        providerConnectionId: schema.powensConnection.providerConnectionId,
        accessTokenEncrypted: schema.powensConnection.accessTokenEncrypted,
        lastSyncStatus: schema.powensConnection.lastSyncStatus,
        lastSyncReasonCode: schema.powensConnection.lastSyncReasonCode,
        lastSyncAt: schema.powensConnection.lastSyncAt,
        lastSuccessAt: schema.powensConnection.lastSuccessAt,
      })
      .from(schema.powensConnection)
      .where(
        and(
          eq(schema.powensConnection.powensConnectionId, connectionId),
          isNull(schema.powensConnection.archivedAt)
        )
      )
      .limit(1)

    if (!connection) {
      await recordSyncRunEnded({
        runId,
        result: 'success',
      })
      logWorkerEvent({
        level: 'info',
        msg: 'worker connection sync skipped for archived or missing connection',
        connectionId,
        requestId: requestId ?? 'n/a',
        syncId: runId,
      })
      return
    }

    connectionProvider = connection.provider
    connectionSource = connection.source
    providerConnectionId = connection.providerConnectionId
    previousLastSuccessAt = connection.lastSuccessAt
    previousPersistedSyncStatus = connection.lastSyncStatus
    previousPersistedSyncReasonCode = connection.lastSyncReasonCode

    if (DISABLED_SYNC_PROVIDERS.has(connection.provider.toLowerCase())) {
      await recordSyncRunEnded({
        runId,
        result: 'success',
      })
      logWorkerEvent({
        level: 'warn',
        msg: 'worker connection sync skipped for disabled provider',
        source: connection.source,
        provider: connection.provider,
        connectionId,
        requestId: requestId ?? 'n/a',
      })
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
        lastSyncAttemptAt: syncStart,
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

    const syncWindow = resolveSyncWindow({
      syncStart,
      lastSuccessAt: connection.lastSuccessAt,
      fullResyncRequested: fullResync === true,
      forceFullSync: FORCE_FULL_SYNC_MODE,
      incrementalLookbackDays: INCREMENTAL_LOOKBACK_DAYS,
      defaultSyncWindowDays: DEFAULT_SYNC_WINDOW_DAYS,
      fullResyncWindowDays: FULL_RESYNC_WINDOW_DAYS,
    })
    const { fromDate, maxDate } = syncWindow

    logWorkerEvent({
      level: 'info',
      msg: 'worker connection sync started',
      source: connectionSource,
      provider: connectionProvider,
      connectionId,
      requestId: requestId ?? 'n/a',
      syncId: runId,
      syncMode: syncWindow.syncMode,
      fallbackReason: syncWindow.reason,
      transactionWindowFromDate: fromDate,
      transactionWindowMaxDate: maxDate,
    })

    const accountCurrencyById = new Map<string, string>()
    for (const account of upsertedAccounts) {
      accountCurrencyById.set(account.powensAccountId, account.currency)
    }

    const batchBuffer: TransactionInsert[] = []
    const rawImportBatchBuffer: ProviderRawImportInsert[] = []
    const bookingDatesByAccountId = new Map<string, string[]>()
    const transactionIntegrityObservations: Array<{
      expectedAccountId: string
      observedAccountId: string | null
      transactionId: string | null
    }> = []
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
        const observedAccountId = toStringValue(transaction.id_account)
        const transactionId = toStringValue(transaction.id)

        transactionIntegrityObservations.push({
          expectedAccountId: account.powensAccountId,
          observedAccountId,
          transactionId,
        })

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
        const existingBookingDates = bookingDatesByAccountId.get(account.powensAccountId)
        if (existingBookingDates) {
          existingBookingDates.push(row.bookingDate)
        } else {
          bookingDatesByAccountId.set(account.powensAccountId, [row.bookingDate])
        }
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

    const transactionGaps = [...bookingDatesByAccountId.entries()].flatMap(
      ([accountId, bookingDates]) =>
        detectTransactionGaps({
          accountId,
          bookingDates,
          thresholdDays: TRANSACTION_GAP_THRESHOLD_DAYS,
        })
    )
    const integrityIssues = detectSyncIntegrityIssues({
      accounts: upsertedAccounts.map(account => ({
        powensAccountId: account.powensAccountId,
        balance: account.balance,
      })),
      transactions: transactionIntegrityObservations,
    })

    const successAt = new Date()
    const syncSnapshot = resolvePersistedSyncSnapshot({
      result: 'success',
      rawImportFailedCount: failedRawImportCount,
      transactionGapCount: transactionGaps.length,
      integrityIssueCount: integrityIssues.length,
    })
    await dbClient.db
      .update(schema.powensConnection)
      .set({
        status: 'connected',
        lastSyncAt: successAt,
        lastSuccessAt: successAt,
        lastError: null,
        ...(env.SYNC_STATUS_PERSISTENCE_ENABLED
          ? {
              lastSyncStatus: syncSnapshot.status,
              lastSyncReasonCode: syncSnapshot.reasonCode,
            }
          : {}),
        syncMetadata: {
          accountCount: upsertedAccounts.length,
          importedTransactionCount,
          rawImportCount: normalizedRawImportCount + failedRawImportCount,
          rawImportFailedCount: failedRawImportCount,
          rawImportNormalizedCount: normalizedRawImportCount,
          transactionGapDetected: transactionGaps.length > 0,
          transactionGapCount: transactionGaps.length,
          transactionGapThresholdDays: TRANSACTION_GAP_THRESHOLD_DAYS,
          transactionGapSample: transactionGaps.slice(0, MAX_TRANSACTION_GAP_DETAILS),
          integrityIssueDetected: integrityIssues.length > 0,
          integrityIssueCount: integrityIssues.length,
          integrityIssueSample: integrityIssues.slice(0, MAX_INTEGRITY_ISSUE_DETAILS),
          transactionWindow: {
            fromDate,
            maxDate,
          },
          syncMode: syncWindow.syncMode,
          fallbackReason: syncWindow.reason,
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
    if (env.SYNC_STATUS_PERSISTENCE_ENABLED) {
      await incrementPersistedSyncMetric(syncSnapshot)
      logPersistedSyncTransition({
        source: connectionSource,
        provider: connectionProvider,
        connectionId,
        ...(requestId ? { requestId } : {}),
        previousStatus: previousPersistedSyncStatus,
        previousReasonCode: previousPersistedSyncReasonCode,
        nextStatus: syncSnapshot.status,
        nextReasonCode: syncSnapshot.reasonCode,
      })
    }
    logWorkerEvent({
      level: 'info',
      msg: 'worker connection sync succeeded',
      source: connectionSource,
      provider: connectionProvider,
      connectionId,
      requestId: requestId ?? 'n/a',
      syncId: runId,
      syncMode: syncWindow.syncMode,
      fallbackReason: syncWindow.reason,
      importedAccountCount: upsertedAccounts.length,
      importedTransactionCount,
      rawImportCount: normalizedRawImportCount + failedRawImportCount,
      rawImportFailedCount: failedRawImportCount,
      transactionGapCount: transactionGaps.length,
      integrityIssueCount: integrityIssues.length,
    })
  } catch (error) {
    const failedAt = new Date()
    const failureStatus = toConnectionStatus(error)
    const errorMessage = toSafeErrorMessage(error)
    const failedSyncWindow = resolveSyncWindow({
      syncStart,
      lastSuccessAt: previousLastSuccessAt,
      fullResyncRequested: fullResync === true,
      forceFullSync: FORCE_FULL_SYNC_MODE,
      incrementalLookbackDays: INCREMENTAL_LOOKBACK_DAYS,
      defaultSyncWindowDays: DEFAULT_SYNC_WINDOW_DAYS,
      fullResyncWindowDays: FULL_RESYNC_WINDOW_DAYS,
    })
    const syncSnapshot = resolvePersistedSyncSnapshot({
      result: failureStatus,
    })

    await dbClient.db
      .update(schema.powensConnection)
      .set({
        status: failureStatus,
        lastSyncAt: failedAt,
        lastFailedAt: failedAt,
        lastError: errorMessage,
        ...(env.SYNC_STATUS_PERSISTENCE_ENABLED
          ? {
              lastSyncStatus: syncSnapshot.status,
              lastSyncReasonCode: syncSnapshot.reasonCode,
            }
          : {}),
        syncMetadata: {
          transactionWindow: {
            fromDate: failedSyncWindow.fromDate,
            maxDate: failedSyncWindow.maxDate,
          },
          syncMode: failedSyncWindow.syncMode,
          fallbackReason: failedSyncWindow.reason,
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
    if (env.SYNC_STATUS_PERSISTENCE_ENABLED) {
      await incrementPersistedSyncMetric(syncSnapshot)
      logPersistedSyncTransition({
        source: connectionSource,
        provider: connectionProvider,
        connectionId,
        ...(requestId ? { requestId } : {}),
        previousStatus: previousPersistedSyncStatus,
        previousReasonCode: previousPersistedSyncReasonCode,
        nextStatus: syncSnapshot.status,
        nextReasonCode: syncSnapshot.reasonCode,
      })
    }

    logWorkerEvent({
      level: 'error',
      msg: 'worker connection sync failed',
      source: connectionSource,
      provider: connectionProvider,
      connectionId,
      requestId: requestId ?? 'n/a',
      syncId: runId,
      syncMode: failedSyncWindow.syncMode,
      fallbackReason: failedSyncWindow.reason,
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
      lastFailedAt: schema.powensConnection.lastFailedAt,
      lastSyncAttemptAt: schema.powensConnection.lastSyncAttemptAt,
    })
    .from(schema.powensConnection)
    .where(isNull(schema.powensConnection.archivedAt))

  for (const connection of connections) {
    if (
      !shouldRunReconnectRecoverySync({
        status: connection.status,
        lastFailedAt: connection.lastFailedAt,
        lastSyncAttemptAt: connection.lastSyncAttemptAt,
        now: new Date(),
      })
    ) {
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
  const schedulerIntervalMs =
    env.NODE_ENV === 'production'
      ? Math.max(env.POWENS_SYNC_INTERVAL_MS, env.POWENS_SYNC_MIN_INTERVAL_PROD_MS)
      : env.POWENS_SYNC_INTERVAL_MS

  schedulerTimer = startPowensAutoSyncScheduler({
    externalIntegrationsSafeMode: env.EXTERNAL_INTEGRATIONS_SAFE_MODE,
    autoSyncEnabled: env.WORKER_AUTO_SYNC_ENABLED,
    intervalMs: schedulerIntervalMs,
    trigger: async () => {
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
    },
    log: logWorkerEvent,
  })
}

const startNewsScheduler = () => {
  newsSchedulerTimer = startDashboardNewsScheduler({
    externalIntegrationsSafeMode: env.EXTERNAL_INTEGRATIONS_SAFE_MODE,
    autoIngestEnabled: env.NEWS_AUTO_INGEST_ENABLED,
    intervalMs: env.NEWS_FETCH_INTERVAL_MS,
    trigger: () =>
      triggerDashboardNewsIngest({
        redisClient: redisClient.client,
        apiInternalUrl: env.API_INTERNAL_URL,
        log: logWorkerEvent,
        ...(env.PRIVATE_ACCESS_TOKEN ? { privateAccessToken: env.PRIVATE_ACCESS_TOKEN } : {}),
      }),
    log: event =>
      logWorkerEvent({
        ...event,
        ...(event.msg === 'worker news scheduler started'
          ? { apiInternalUrl: env.API_INTERNAL_URL }
          : {}),
      }),
  })
}

const startMarketScheduler = () => {
  marketSchedulerTimer = startDashboardMarketsScheduler({
    externalIntegrationsSafeMode: env.EXTERNAL_INTEGRATIONS_SAFE_MODE,
    autoRefreshEnabled: env.MARKET_DATA_AUTO_REFRESH_ENABLED,
    intervalMs: env.MARKET_DATA_REFRESH_INTERVAL_MS,
    trigger: () =>
      triggerDashboardMarketsRefresh({
        redisClient: redisClient.client,
        apiInternalUrl: env.API_INTERNAL_URL,
        log: logWorkerEvent,
        ...(env.PRIVATE_ACCESS_TOKEN ? { privateAccessToken: env.PRIVATE_ACCESS_TOKEN } : {}),
      }),
    log: event =>
      logWorkerEvent({
        ...event,
        ...(event.msg === 'worker market scheduler started'
          ? { apiInternalUrl: env.API_INTERNAL_URL }
          : {}),
      }),
  })
}

const startAdvisorScheduler = () => {
  advisorSchedulerTimer = startDashboardAdvisorScheduler({
    externalIntegrationsSafeMode: env.EXTERNAL_INTEGRATIONS_SAFE_MODE,
    advisorEnabled: env.AI_ADVISOR_ENABLED,
    autoRunEnabled: env.AI_DAILY_AUTO_RUN_ENABLED,
    intervalMs: env.AI_DAILY_INTERVAL_MS,
    marketOpenWindowEnabled: env.AI_DAILY_MARKET_OPEN_WINDOW_ENABLED,
    marketOpenTimezone: env.AI_DAILY_MARKET_OPEN_TIMEZONE,
    marketOpenHour: env.AI_DAILY_MARKET_OPEN_HOUR,
    marketOpenMinute: env.AI_DAILY_MARKET_OPEN_MINUTE,
    marketOpenLeadMinutes: env.AI_DAILY_MARKET_OPEN_LEAD_MINUTES,
    marketOpenLagMinutes: env.AI_DAILY_MARKET_OPEN_LAG_MINUTES,
    trigger: () =>
      triggerDashboardAdvisorDailyRun({
        redisClient: redisClient.client,
        apiInternalUrl: env.API_INTERNAL_URL,
        log: logWorkerEvent,
        ...(env.PRIVATE_ACCESS_TOKEN ? { privateAccessToken: env.PRIVATE_ACCESS_TOKEN } : {}),
      }),
    log: event =>
      logWorkerEvent({
        ...event,
        ...(event.msg === 'worker advisor scheduler started'
          ? { apiInternalUrl: env.API_INTERNAL_URL }
          : {}),
      }),
  })
}

const startDailyIntelligenceRunScheduler = () => {
  dailyIntelligenceSchedulerTimer = startDailyIntelligenceScheduler({
    externalIntegrationsSafeMode: env.EXTERNAL_INTEGRATIONS_SAFE_MODE,
    enabled: env.DAILY_INTELLIGENCE_ENABLED,
    cron: env.DAILY_INTELLIGENCE_CRON,
    timezone: env.DAILY_INTELLIGENCE_TIMEZONE,
    marketOpenHour: env.DAILY_INTELLIGENCE_MARKET_OPEN_HOUR,
    trigger: () =>
      triggerDailyIntelligenceRun({
        redisClient: redisClient.client,
        apiInternalUrl: env.API_INTERNAL_URL,
        log: logWorkerEvent,
        ...(env.PRIVATE_ACCESS_TOKEN ? { privateAccessToken: env.PRIVATE_ACCESS_TOKEN } : {}),
      }),
    log: event =>
      logWorkerEvent({
        ...event,
        ...(event.msg === 'worker daily intelligence scheduler started'
          ? { apiInternalUrl: env.API_INTERNAL_URL }
          : {}),
      }),
  })
}

const startAttentionScheduler = () => {
  attentionSchedulerTimer = startAttentionRebuildScheduler({
    externalIntegrationsSafeMode: env.EXTERNAL_INTEGRATIONS_SAFE_MODE,
    attentionSystemEnabled: env.ATTENTION_SYSTEM_ENABLED,
    autoRebuildEnabled: env.ATTENTION_REBUILD_AUTO_ENABLED,
    intervalMs: env.ATTENTION_REBUILD_INTERVAL_MS,
    trigger: () =>
      triggerAttentionRebuild({
        redisClient: redisClient.client,
        apiInternalUrl: env.API_INTERNAL_URL,
        log: logWorkerEvent,
        ...(env.PRIVATE_ACCESS_TOKEN ? { privateAccessToken: env.PRIVATE_ACCESS_TOKEN } : {}),
      }),
    log: event =>
      logWorkerEvent({
        ...event,
        ...(event.msg === 'worker attention scheduler started'
          ? { apiInternalUrl: env.API_INTERNAL_URL }
          : {}),
      }),
  })
}

const startSocialScheduler = () => {
  socialSchedulerTimer = startSocialSignalScheduler({
    externalIntegrationsSafeMode: env.EXTERNAL_INTEGRATIONS_SAFE_MODE,
    socialPollingEnabled: env.SIGNALS_SOCIAL_POLLING_ENABLED,
    intervalMs: env.SIGNALS_SOCIAL_POLLING_INTERVAL_MS,
    trigger: () =>
      triggerSocialSignalIngest({
        redisClient: redisClient.client,
        apiInternalUrl: env.API_INTERNAL_URL,
        log: logWorkerEvent,
        ...(env.PRIVATE_ACCESS_TOKEN ? { privateAccessToken: env.PRIVATE_ACCESS_TOKEN } : {}),
      }),
    log: event =>
      logWorkerEvent({
        ...event,
        ...(event.msg === 'worker social signal scheduler started'
          ? { apiInternalUrl: env.API_INTERNAL_URL }
          : {}),
      }),
  })
}

const consumeJobs = async () => {
  while (keepRunning) {
    try {
      const message = await redisClient.client.blPop(
        [POWENS_JOB_QUEUE_KEY, EXTERNAL_INVESTMENTS_JOB_QUEUE_KEY],
        5
      )

      if (!message) {
        continue
      }

      if (message.key === EXTERNAL_INVESTMENTS_JOB_QUEUE_KEY) {
        const job = parseExternalInvestmentsJob(message.element)
        if (!job) {
          continue
        }

        logWorkerEvent({
          level: 'info',
          msg: 'worker processing external investments job',
          jobType: job.type,
          requestId: job.requestId ?? 'n/a',
          ...(job.type === 'externalInvestments.syncProvider'
            ? { provider: job.provider }
            : {}),
          ...(job.type === 'externalInvestments.syncConnection'
            ? { provider: job.provider, connectionId: job.connectionId }
            : {}),
        })
        await externalInvestmentsSyncWorker.handleJob(job)
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
  startNewsScheduler()
  startMarketScheduler()
  startAdvisorScheduler()
  startDailyIntelligenceRunScheduler()
  startSocialScheduler()
  startAttentionScheduler()
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

  if (newsSchedulerTimer) {
    clearInterval(newsSchedulerTimer)
    newsSchedulerTimer = null
  }

  if (marketSchedulerTimer) {
    clearInterval(marketSchedulerTimer)
    marketSchedulerTimer = null
  }

  if (advisorSchedulerTimer) {
    clearInterval(advisorSchedulerTimer)
    advisorSchedulerTimer = null
  }

  if (dailyIntelligenceSchedulerTimer) {
    clearInterval(dailyIntelligenceSchedulerTimer)
    dailyIntelligenceSchedulerTimer = null
  }

  if (socialSchedulerTimer) {
    clearInterval(socialSchedulerTimer)
    socialSchedulerTimer = null
  }

  if (attentionSchedulerTimer) {
    clearInterval(attentionSchedulerTimer)
    attentionSchedulerTimer = null
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
