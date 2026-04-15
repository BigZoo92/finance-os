import { describe, expect, it } from 'bun:test'
import { createAdvisorManualRefreshAndRunUseCases } from './create-manual-refresh-and-run-use-case'
import type {
  DashboardAdvisorRepository,
  DashboardMarketsRepository,
  DashboardNewsRepository,
  DashboardReadRepository,
  RedisClient,
} from '../../types'
import type { DashboardAdvisorManualOperationResponse } from '../../advisor-contract'

const createRepositoryStore = (
  initialOperation: DashboardAdvisorManualOperationResponse | null = null
) => {
  let operation = initialOperation
  let stepId = initialOperation?.steps.length ?? 0

  const repository: Pick<
    DashboardAdvisorRepository,
    | 'createManualOperation'
    | 'updateManualOperation'
    | 'upsertManualOperationStep'
    | 'getManualOperation'
    | 'getLatestManualOperation'
    | 'getLatestActiveManualOperation'
  > = {
    async createManualOperation(input) {
      operation = {
        operationId: input.operationId,
        requestId: input.requestId,
        status: input.status,
        currentStage: input.currentStage ?? null,
        statusMessage: input.statusMessage ?? null,
        triggerSource: input.triggerSource,
        startedAt: new Date().toISOString(),
        finishedAt: null,
        durationMs: null,
        degraded: input.degraded,
        errorCode: null,
        errorMessage: null,
        advisorRunId: input.advisorRunId ?? null,
        advisorRun: null,
        steps: [],
        outputDigest: null,
      }
    },
    async updateManualOperation(input) {
      if (!operation) {
        throw new Error('operation missing')
      }

      operation = {
        ...operation,
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.currentStage !== undefined ? { currentStage: input.currentStage } : {}),
        ...(input.statusMessage !== undefined ? { statusMessage: input.statusMessage } : {}),
        ...(input.degraded !== undefined ? { degraded: input.degraded } : {}),
        ...(input.errorCode !== undefined ? { errorCode: input.errorCode } : {}),
        ...(input.errorMessage !== undefined ? { errorMessage: input.errorMessage } : {}),
        ...(input.advisorRunId !== undefined ? { advisorRunId: input.advisorRunId } : {}),
        ...(input.finishedAt !== undefined
          ? { finishedAt: input.finishedAt?.toISOString() ?? null }
          : {}),
        ...(input.durationMs !== undefined ? { durationMs: input.durationMs } : {}),
        ...(input.outputDigest !== undefined ? { outputDigest: input.outputDigest } : {}),
      }
    },
    async upsertManualOperationStep(input) {
      if (!operation) {
        throw new Error('operation missing')
      }

      const existing = operation.steps.find(
        (step: DashboardAdvisorManualOperationResponse['steps'][number]) =>
          step.stepKey === input.stepKey
      )
      const nextStep = {
        id: existing?.id ?? ++stepId,
        stepKey: input.stepKey,
        label: input.label,
        status: input.status,
        startedAt: input.startedAt?.toISOString() ?? existing?.startedAt ?? null,
        finishedAt: input.finishedAt?.toISOString() ?? null,
        durationMs: input.durationMs ?? null,
        errorCode: input.errorCode ?? null,
        errorMessage: input.errorMessage ?? null,
        details: input.details ?? null,
      } as const

      operation = {
        ...operation,
        steps: existing
          ? operation.steps.map((step: DashboardAdvisorManualOperationResponse['steps'][number]) =>
              step.stepKey === input.stepKey ? nextStep : step
            )
          : [...operation.steps, nextStep],
      }
    },
    async getManualOperation(operationId) {
      return operation?.operationId === operationId ? operation : null
    },
    async getLatestManualOperation() {
      return operation
    },
    async getLatestActiveManualOperation() {
      if (!operation) {
        return null
      }

      return operation.status === 'queued' || operation.status === 'running' ? operation : null
    },
  }

  return {
    repository,
    read: () => operation,
  }
}

const waitForTerminalOperation = async (
  readOperation: () => DashboardAdvisorManualOperationResponse | null
) => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const operation = readOperation()
    if (operation && !['queued', 'running'].includes(operation.status)) {
      return operation
    }

    await new Promise(resolve => {
      setTimeout(resolve, 5)
    })
  }

  throw new Error('operation did not reach a terminal status')
}

describe('createAdvisorManualRefreshAndRunUseCases', () => {
  it('returns the active operation instead of starting a concurrent one', async () => {
    const activeOperation: DashboardAdvisorManualOperationResponse = {
      operationId: 'manual-op-active',
      requestId: 'req-existing',
      status: 'running',
      currentStage: 'personal_sync',
      statusMessage: 'Synchronisation en cours',
      triggerSource: 'manual',
      startedAt: '2026-04-14T08:00:00.000Z',
      finishedAt: null,
      durationMs: null,
      degraded: false,
      errorCode: null,
      errorMessage: null,
      advisorRunId: null,
      advisorRun: null,
      steps: [],
      outputDigest: null,
    }
    const store = createRepositoryStore(activeOperation)

    const useCases = createAdvisorManualRefreshAndRunUseCases({
      repository: store.repository as DashboardAdvisorRepository,
      readModel:
        ({
          listPowensConnections: async () => [],
        } as unknown as DashboardReadRepository),
      enqueueAllConnectionsSync: async () => undefined,
      ingestNews: async () => ({
        fetchedCount: 0,
        insertedCount: 0,
        mergedCount: 0,
        dedupeDropCount: 0,
      }),
      refreshMarkets: async () => ({
        requestId: 'req-existing',
        refreshedAt: '2026-04-14T08:00:00.000Z',
        quoteCount: 0,
        macroObservationCount: 0,
        signalCount: 0,
        providerResults: [],
      }),
      runAdvisorDaily: async () => ({
        ok: true,
        requestId: 'req-existing',
        run: {
          id: 1,
          runType: 'daily',
          status: 'completed',
          triggerSource: 'manual',
          requestId: 'req-existing',
          startedAt: '2026-04-14T08:00:00.000Z',
          finishedAt: '2026-04-14T08:00:03.000Z',
          durationMs: 3000,
          degraded: false,
          fallbackReason: null,
          errorCode: null,
          errorMessage: null,
          budgetState: null,
          usageSummary: {
            totalCalls: 0,
            totalInputTokens: 0,
            totalOutputTokens: 0,
            totalCostUsd: 0,
            totalCostEur: 0,
          },
        },
      }),
      redisClient:
        ({
          set: async () => null,
        } as unknown as RedisClient),
    })

    const result = await useCases.startManualRefreshAndRun({
      requestId: 'req-new',
      triggerSource: 'manual',
    })

    expect(result.alreadyRunning).toBe(true)
    expect(result.operation.operationId).toBe('manual-op-active')
  })

  it('marks the manual operation degraded when one source refresh degrades but advisor still runs', async () => {
    const store = createRepositoryStore()

    const useCases = createAdvisorManualRefreshAndRunUseCases({
      repository: store.repository as DashboardAdvisorRepository,
      readModel:
        ({
          listPowensConnections: async () => [],
        } as unknown as DashboardReadRepository),
      newsRepository: {
        getNewsCacheState: async () => ({
          lastSuccessAt: new Date('2026-04-14T08:05:00.000Z'),
          lastAttemptAt: new Date('2026-04-14T08:05:00.000Z'),
          lastFailureAt: null,
          lastErrorCode: 'PARTIAL_PROVIDER_FAILURE',
          lastErrorMessage: 'one provider failed',
          ingestionCount: 1,
          dedupeDropCount: 0,
          providerFailureCount: 1,
          lastFetchedCount: 12,
          lastInsertedCount: 10,
          lastMergedCount: 2,
          lastProviderCount: 3,
          lastSignalCount: 4,
        }),
      } as DashboardNewsRepository,
      marketsRepository: {
        getMarketCacheState: async () => ({
          lastSuccessAt: new Date('2026-04-14T08:06:00.000Z'),
          lastAttemptAt: new Date('2026-04-14T08:06:00.000Z'),
          lastFailureAt: null,
          lastErrorCode: null,
          lastErrorMessage: null,
          refreshCount: 1,
          providerFailureCount: 0,
          lastInstrumentCount: 15,
          lastMacroObservationCount: 7,
          lastSignalCount: 5,
          lastRefreshDurationMs: 900,
        }),
      } as DashboardMarketsRepository,
      enqueueAllConnectionsSync: async () => undefined,
      ingestNews: async () => ({
        fetchedCount: 12,
        insertedCount: 10,
        mergedCount: 2,
        dedupeDropCount: 0,
      }),
      refreshMarkets: async () => ({
        requestId: 'req-manual',
        refreshedAt: '2026-04-14T08:06:00.000Z',
        quoteCount: 15,
        macroObservationCount: 7,
        signalCount: 5,
        providerResults: [],
      }),
      runAdvisorDaily: async () => ({
        ok: true,
        requestId: 'req-manual',
        run: {
          id: 77,
          runType: 'daily',
          status: 'completed',
          triggerSource: 'manual',
          requestId: 'req-manual',
          startedAt: '2026-04-14T08:07:00.000Z',
          finishedAt: '2026-04-14T08:07:03.000Z',
          durationMs: 3000,
          degraded: false,
          fallbackReason: null,
          errorCode: null,
          errorMessage: null,
          budgetState: null,
          usageSummary: {
            totalCalls: 1,
            totalInputTokens: 100,
            totalOutputTokens: 50,
            totalCostUsd: 0.01,
            totalCostEur: 0.0092,
          },
        },
      }),
      redisClient:
        ({
          set: async () => 'OK',
          eval: async () => 1,
        } as unknown as RedisClient),
    })

    const queued = await useCases.startManualRefreshAndRun({
      requestId: 'req-manual',
      triggerSource: 'manual',
    })

    expect(queued.alreadyRunning).toBe(false)
    expect(queued.operation.status).toBe('queued')

    const operation = await waitForTerminalOperation(store.read)

    expect(operation.status).toBe('degraded')
    expect(operation.degraded).toBe(true)
    expect(operation.advisorRunId).toBe(77)
    expect(
      operation.steps.find(
        (step: DashboardAdvisorManualOperationResponse['steps'][number]) =>
          step.stepKey === 'personal_sync'
      )?.status
    ).toBe('skipped')
    expect(
      operation.steps.find(
        (step: DashboardAdvisorManualOperationResponse['steps'][number]) =>
          step.stepKey === 'news_refresh'
      )?.status
    ).toBe('degraded')
    expect(
      operation.steps.find(
        (step: DashboardAdvisorManualOperationResponse['steps'][number]) =>
          step.stepKey === 'market_refresh'
      )?.status
    ).toBe('completed')
    expect(
      operation.steps.find(
        (step: DashboardAdvisorManualOperationResponse['steps'][number]) =>
          step.stepKey === 'advisor_run'
      )?.status
    ).toBe('completed')
  })
})
