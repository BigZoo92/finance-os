import { randomUUID } from 'node:crypto'
import { logApiEvent, toErrorLogFields } from '../../../../observability/logger'
import type {
  DashboardAdvisorManualOperationResponse,
  DashboardAdvisorManualRefreshAndRunPostResponse,
} from '../../advisor-contract'
import type {
  DashboardAdvisorRepository,
  DashboardMarketsRepository,
  DashboardNewsRepository,
  DashboardReadRepository,
  DashboardUseCases,
  RedisClient,
} from '../../types'

const MANUAL_OPERATION_LOCK_KEY = 'advisor:dashboard:manual-refresh-and-run:lock'
const MANUAL_OPERATION_LOCK_TTL_SECONDS = 15 * 60
const POWENS_SYNC_WAIT_TIMEOUT_MS = 90_000
const POWENS_SYNC_POLL_INTERVAL_MS = 2_000

const MANUAL_OPERATION_STEPS = [
  {
    stepKey: 'personal_sync',
    label: 'Synchronisation donnees personnelles',
  },
  {
    stepKey: 'news_refresh',
    label: 'Rafraichissement news',
  },
  {
    stepKey: 'market_refresh',
    label: 'Rafraichissement marches',
  },
  {
    stepKey: 'advisor_run',
    label: 'Analyse advisor',
  },
] as const

type ManualOperationStepKey = (typeof MANUAL_OPERATION_STEPS)[number]['stepKey']

type StepResolution =
  | {
      status: 'completed' | 'degraded' | 'skipped'
      details: Record<string, unknown>
    }
  | {
      status: 'failed'
      errorCode: string
      errorMessage: string
      details?: Record<string, unknown>
    }

const delay = async (ms: number) =>
  new Promise<void>(resolve => {
    setTimeout(resolve, ms)
  })

const toSafeErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

const acquireLock = async (redisClient: RedisClient) => {
  const token = randomUUID()
  const acquired = await redisClient.set(MANUAL_OPERATION_LOCK_KEY, token, {
    NX: true,
    EX: MANUAL_OPERATION_LOCK_TTL_SECONDS,
  })

  return acquired === 'OK' ? token : null
}

const releaseLock = async ({
  redisClient,
  token,
}: {
  redisClient: RedisClient
  token: string
}) => {
  await redisClient.eval(
    'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end',
    {
      keys: [MANUAL_OPERATION_LOCK_KEY],
      arguments: [token],
    }
  )
}

const summarizeSyncStatuses = (
  connections: Awaited<ReturnType<DashboardReadRepository['listPowensConnections']>>,
  stageStartedAt: Date
) => {
  let refreshedCount = 0
  let failedCount = 0
  let pendingCount = 0
  let syncingCount = 0

  const items = connections.map(connection => {
    const attemptAt = connection.lastSyncAttemptAt?.getTime() ?? 0
    const stageStartedAtMs = stageStartedAt.getTime()
    const attemptedForThisRun = attemptAt >= stageStartedAtMs
    const successForThisRun =
      connection.lastSuccessAt !== null &&
      connection.lastSuccessAt.getTime() >= stageStartedAtMs &&
      connection.status === 'connected'
    const failedForThisRun =
      attemptedForThisRun &&
      (connection.status === 'error' ||
        connection.status === 'reconnect_required' ||
        (connection.lastFailedAt !== null && connection.lastFailedAt.getTime() >= stageStartedAtMs))

    let state: 'completed' | 'failed' | 'pending' | 'running'
    if (successForThisRun) {
      refreshedCount += 1
      state = 'completed'
    } else if (failedForThisRun) {
      failedCount += 1
      state = 'failed'
    } else if (attemptedForThisRun && connection.status === 'syncing') {
      syncingCount += 1
      state = 'running'
    } else {
      pendingCount += 1
      state = 'pending'
    }

    return {
      connectionId: connection.powensConnectionId,
      institution: connection.providerInstitutionName ?? connection.providerConnectionId,
      status: connection.status,
      state,
      lastSyncAttemptAt: connection.lastSyncAttemptAt?.toISOString() ?? null,
      lastSuccessAt: connection.lastSuccessAt?.toISOString() ?? null,
      lastFailedAt: connection.lastFailedAt?.toISOString() ?? null,
      lastSyncReasonCode: connection.lastSyncReasonCode,
    }
  })

  return {
    totalCount: connections.length,
    refreshedCount,
    failedCount,
    pendingCount,
    syncingCount,
    items,
    done: pendingCount === 0 && syncingCount === 0,
  }
}

const runPersonalSyncStep = async ({
  readModel,
  enqueueAllConnectionsSync,
  requestId,
}: {
  readModel: DashboardReadRepository
  enqueueAllConnectionsSync: (params?: { requestId?: string }) => Promise<void>
  requestId: string
}): Promise<StepResolution> => {
  const connections = await readModel.listPowensConnections()
  if (connections.length === 0) {
    return {
      status: 'skipped',
      details: {
        totalCount: 0,
        message: 'Aucune connexion Powens a synchroniser.',
      },
    }
  }

  const stageStartedAt = new Date()
  await enqueueAllConnectionsSync({ requestId })

  const deadline = Date.now() + POWENS_SYNC_WAIT_TIMEOUT_MS
  let latestSummary = summarizeSyncStatuses(
    await readModel.listPowensConnections(),
    stageStartedAt
  )

  while (!latestSummary.done && Date.now() < deadline) {
    await delay(POWENS_SYNC_POLL_INTERVAL_MS)
    latestSummary = summarizeSyncStatuses(await readModel.listPowensConnections(), stageStartedAt)
  }

  if (latestSummary.failedCount > 0 || !latestSummary.done) {
    return {
      status: 'degraded',
      details: {
        ...latestSummary,
        timedOut: !latestSummary.done,
      },
    }
  }

  return {
    status: 'completed',
    details: latestSummary,
  }
}

const runNewsRefreshStep = async ({
  repository,
  ingestNews,
  requestId,
}: {
  repository: DashboardNewsRepository | undefined
  ingestNews: DashboardUseCases['ingestNews'] | undefined
  requestId: string
}): Promise<StepResolution> => {
  if (!repository || !ingestNews) {
    return {
      status: 'skipped',
      details: {
        message: 'Runtime news indisponible.',
      },
    }
  }

  try {
    const result = await ingestNews({ requestId })
    const state = await repository.getNewsCacheState()
    return {
      status: state?.lastErrorCode === 'PARTIAL_PROVIDER_FAILURE' ? 'degraded' : 'completed',
      details: {
        ...result,
        lastSuccessAt: state?.lastSuccessAt?.toISOString() ?? null,
        lastErrorCode: state?.lastErrorCode ?? null,
      },
    }
  } catch (error) {
    const state = await repository.getNewsCacheState()
    return {
      status: 'degraded',
      details: {
        lastSuccessAt: state?.lastSuccessAt?.toISOString() ?? null,
        lastErrorCode: state?.lastErrorCode ?? null,
        message: toSafeErrorMessage(error),
      },
    }
  }
}

const runMarketRefreshStep = async ({
  repository,
  refreshMarkets,
  requestId,
}: {
  repository: DashboardMarketsRepository | undefined
  refreshMarkets: DashboardUseCases['refreshMarkets'] | undefined
  requestId: string
}): Promise<StepResolution> => {
  if (!repository || !refreshMarkets) {
    return {
      status: 'skipped',
      details: {
        message: 'Runtime marches indisponible.',
      },
    }
  }

  try {
    const result = await refreshMarkets({ requestId })
    const state = await repository.getMarketCacheState()
    return {
      status: state?.lastErrorCode === 'PARTIAL_PROVIDER_FAILURE' ? 'degraded' : 'completed',
      details: {
        quoteCount: result.quoteCount,
        macroObservationCount: result.macroObservationCount,
        signalCount: result.signalCount,
        refreshedAt: result.refreshedAt,
        lastErrorCode: state?.lastErrorCode ?? null,
      },
    }
  } catch (error) {
    const state = await repository.getMarketCacheState()
    return {
      status: 'degraded',
      details: {
        lastSuccessAt: state?.lastSuccessAt?.toISOString() ?? null,
        lastErrorCode: state?.lastErrorCode ?? null,
        message: toSafeErrorMessage(error),
      },
    }
  }
}

const runAdvisorStep = async ({
  runAdvisorDaily,
  requestId,
  triggerSource,
}: {
  runAdvisorDaily: DashboardUseCases['runAdvisorDaily'] | undefined
  requestId: string
  triggerSource: string
}): Promise<
  StepResolution & {
    advisorRunId: number | null
  }
> => {
  if (!runAdvisorDaily) {
    return {
      status: 'failed',
      errorCode: 'ADVISOR_RUNTIME_UNAVAILABLE',
      errorMessage: 'Advisor runtime unavailable.',
      advisorRunId: null,
    }
  }

  const result = await runAdvisorDaily({
    mode: 'admin',
    requestId,
    triggerSource,
  })

  return {
    status: result.run.status === 'degraded' || result.run.status === 'failed' ? 'degraded' : 'completed',
    details: {
      advisorRunId: result.run.id,
      advisorRunStatus: result.run.status,
      fallbackReason: result.run.fallbackReason,
    },
    advisorRunId: result.run.id,
  }
}

export const createAdvisorManualRefreshAndRunUseCases = ({
  repository,
  readModel,
  newsRepository,
  marketsRepository,
  enqueueAllConnectionsSync,
  ingestNews,
  refreshMarkets,
  runAdvisorDaily,
  redisClient,
}: {
  repository: DashboardAdvisorRepository
  readModel: DashboardReadRepository
  newsRepository?: DashboardNewsRepository
  marketsRepository?: DashboardMarketsRepository
  enqueueAllConnectionsSync: (params?: { requestId?: string }) => Promise<void>
  ingestNews?: DashboardUseCases['ingestNews']
  refreshMarkets?: DashboardUseCases['refreshMarkets']
  runAdvisorDaily?: DashboardUseCases['runAdvisorDaily']
  redisClient: RedisClient
}) => {
  const runOperationInBackground = async ({
    operationId,
    requestId,
    triggerSource,
    lockToken,
  }: {
    operationId: string
    requestId: string
    triggerSource: string
    lockToken: string
  }) => {
    const startedAtMs = Date.now()
    let operationDegraded = false

    const markStep = async ({
      stepKey,
      status,
      details,
      errorCode,
      errorMessage,
      startedAt,
    }: {
      stepKey: ManualOperationStepKey
      status: 'completed' | 'failed' | 'degraded' | 'skipped'
      details?: Record<string, unknown>
      errorCode?: string
      errorMessage?: string
      startedAt: Date
    }) => {
      await repository.upsertManualOperationStep({
        operationId,
        stepKey,
        label: MANUAL_OPERATION_STEPS.find(step => step.stepKey === stepKey)?.label ?? stepKey,
        status,
        startedAt,
        finishedAt: new Date(),
        durationMs: Date.now() - startedAt.getTime(),
        ...(errorCode ? { errorCode } : {}),
        ...(errorMessage ? { errorMessage } : {}),
        ...(details !== undefined ? { details } : {}),
      })
    }

    try {
      for (const step of MANUAL_OPERATION_STEPS) {
        const stepStartedAt = new Date()
        await repository.updateManualOperation({
          operationId,
          status: 'running',
          currentStage: step.stepKey,
          statusMessage: step.label,
          degraded: operationDegraded,
        })
        await repository.upsertManualOperationStep({
          operationId,
          stepKey: step.stepKey,
          label: step.label,
          status: 'running',
          startedAt: stepStartedAt,
        })

        if (step.stepKey === 'personal_sync') {
          const result = await runPersonalSyncStep({
            readModel,
            enqueueAllConnectionsSync,
            requestId,
          })
          if (result.status === 'degraded') {
            operationDegraded = true
          }
          if (result.status === 'failed') {
            await markStep({
              stepKey: step.stepKey,
              status: 'failed',
              startedAt: stepStartedAt,
              errorCode: result.errorCode,
              errorMessage: result.errorMessage,
              ...(result.details ? { details: result.details } : {}),
            })
            throw new Error(result.errorMessage)
          }
          await markStep({
            stepKey: step.stepKey,
            status: result.status,
            startedAt: stepStartedAt,
            ...(result.details ? { details: result.details } : {}),
          })
          continue
        }

        if (step.stepKey === 'news_refresh') {
          const result = await runNewsRefreshStep({
            repository: newsRepository,
            ingestNews,
            requestId,
          })
          if (result.status === 'degraded') {
            operationDegraded = true
          }
          await markStep({
            stepKey: step.stepKey,
            status: result.status,
            startedAt: stepStartedAt,
            ...(result.details ? { details: result.details } : {}),
          })
          continue
        }

        if (step.stepKey === 'market_refresh') {
          const result = await runMarketRefreshStep({
            repository: marketsRepository,
            refreshMarkets,
            requestId,
          })
          if (result.status === 'degraded') {
            operationDegraded = true
          }
          await markStep({
            stepKey: step.stepKey,
            status: result.status,
            startedAt: stepStartedAt,
            ...(result.details ? { details: result.details } : {}),
          })
          continue
        }

        const result = await runAdvisorStep({
          runAdvisorDaily,
          requestId,
          triggerSource,
        })
        if (result.status === 'degraded') {
          operationDegraded = true
        }
        if (result.status === 'failed') {
          await markStep({
            stepKey: step.stepKey,
            status: 'failed',
            startedAt: stepStartedAt,
            errorCode: result.errorCode,
            errorMessage: result.errorMessage,
            ...(result.details ? { details: result.details } : {}),
          })
          await repository.updateManualOperation({
            operationId,
            status: 'failed',
            currentStage: step.stepKey,
            statusMessage: result.errorMessage,
            degraded: true,
            errorCode: result.errorCode,
            errorMessage: result.errorMessage,
            finishedAt: new Date(),
            durationMs: Date.now() - startedAtMs,
          })
          return
        }

        await markStep({
          stepKey: step.stepKey,
          status: result.status,
          details: result.details,
          startedAt: stepStartedAt,
        })
        await repository.updateManualOperation({
          operationId,
          ...(result.advisorRunId !== null ? { advisorRunId: result.advisorRunId } : {}),
        })
      }

      await repository.updateManualOperation({
        operationId,
        status: operationDegraded ? 'degraded' : 'completed',
        currentStage: null,
        statusMessage: operationDegraded
          ? 'Mission terminee avec degradations.'
          : 'Mission terminee.',
        degraded: operationDegraded,
        finishedAt: new Date(),
        durationMs: Date.now() - startedAtMs,
        outputDigest: {
          completedAt: new Date().toISOString(),
          degraded: operationDegraded,
        },
      })
    } catch (error) {
      await repository.updateManualOperation({
        operationId,
        status: 'failed',
        currentStage: null,
        statusMessage: 'Mission interrompue.',
        degraded: true,
        errorCode: 'MANUAL_REFRESH_AND_RUN_FAILED',
        errorMessage: toSafeErrorMessage(error),
        finishedAt: new Date(),
        durationMs: Date.now() - startedAtMs,
      })

      logApiEvent({
        level: 'error',
        msg: 'dashboard advisor manual refresh and run failed',
        requestId,
        operationId,
        ...toErrorLogFields({
          error,
          includeStack: false,
        }),
      })
    } finally {
      await releaseLock({
        redisClient,
        token: lockToken,
      })
    }
  }

  return {
    getLatestManualOperation: async () => repository.getLatestManualOperation(),

    getManualOperationById: async (operationId: string) => repository.getManualOperation(operationId),

    startManualRefreshAndRun: async ({
      requestId,
      triggerSource,
    }: {
      requestId: string
      triggerSource: string
    }): Promise<DashboardAdvisorManualRefreshAndRunPostResponse> => {
      const active = await repository.getLatestActiveManualOperation()
      if (active) {
        return {
          ok: true,
          requestId,
          alreadyRunning: true,
          operation: active,
        }
      }

      const lockToken = await acquireLock(redisClient)
      if (!lockToken) {
        const latest = await repository.getLatestActiveManualOperation()
        if (latest) {
          return {
            ok: true,
            requestId,
            alreadyRunning: true,
            operation: latest,
          }
        }

        throw new Error('Unable to acquire manual advisor orchestration lock')
      }

      const operationId = randomUUID()
      try {
        await repository.createManualOperation({
          operationId,
          status: 'queued',
          mode: 'admin',
          triggerSource,
          requestId,
          currentStage: null,
          statusMessage: 'Mission planifiee.',
          degraded: false,
          inputDigest: {
            pipeline: 'manual_refresh_and_run',
          },
        })

        for (const step of MANUAL_OPERATION_STEPS) {
          await repository.upsertManualOperationStep({
            operationId,
            stepKey: step.stepKey,
            label: step.label,
            status: 'queued',
          })
        }
      } catch (error) {
        await releaseLock({
          redisClient,
          token: lockToken,
        })
        throw error
      }

      void Promise.resolve().then(() =>
        runOperationInBackground({
          operationId,
          requestId,
          triggerSource,
          lockToken,
        })
      )

      const operation = await repository.getManualOperation(operationId)
      if (!operation) {
        throw new Error('Failed to reload manual advisor operation')
      }

      logApiEvent({
        level: 'info',
        msg: 'dashboard advisor manual refresh and run queued',
        requestId,
        operationId,
      })

      return {
        ok: true,
        requestId,
        alreadyRunning: false,
        operation,
      }
    },
  }
}
