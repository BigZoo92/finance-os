import { toErrorLogFields, logApiEvent } from '../../../observability/logger'
import type {
  DashboardDerivedRecomputeRepository,
  DashboardDerivedRecomputeRunResponse,
  DashboardDerivedRecomputeRunRow,
  DashboardDerivedRecomputeStatusResponse,
} from '../types'

const toIsoString = (value: Date | null) => {
  return value ? value.toISOString() : null
}

const toSnapshotVersion = (startedAt: Date) => {
  const compact = startedAt
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')
  return `derived-${compact}`
}

const mapRunResponse = (
  run: DashboardDerivedRecomputeRunRow | null
): DashboardDerivedRecomputeRunResponse | null => {
  if (!run) {
    return null
  }

  return {
    snapshotVersion: run.snapshotVersion,
    status: run.status,
    triggerSource: run.triggerSource,
    requestId: run.requestId,
    stage: run.stage,
    rowCounts: run.rowCounts,
    safeErrorCode: run.safeErrorCode,
    safeErrorMessage: run.safeErrorMessage,
    startedAt: run.startedAt.toISOString(),
    finishedAt: toIsoString(run.finishedAt),
    durationMs: run.durationMs,
  }
}

const buildStatusResponse = async ({
  featureEnabled,
  repository,
}: {
  featureEnabled: boolean
  repository: DashboardDerivedRecomputeRepository
}): Promise<DashboardDerivedRecomputeStatusResponse> => {
  const [latestRun, currentSnapshotRun] = await Promise.all([
    repository.getLatestRun(),
    repository.getCurrentSnapshotRun(),
  ])

  const latestRunResponse = mapRunResponse(latestRun)
  const currentSnapshot = currentSnapshotRun
    ? {
        snapshotVersion: currentSnapshotRun.snapshotVersion,
        finishedAt:
          currentSnapshotRun.finishedAt?.toISOString() ??
          currentSnapshotRun.startedAt.toISOString(),
        rowCounts: currentSnapshotRun.rowCounts,
      }
    : null

  let state: DashboardDerivedRecomputeStatusResponse['state'] = 'idle'
  if (latestRun?.status === 'running') {
    state = 'running'
  } else if (latestRun?.status === 'failed') {
    state = 'failed'
  } else if (currentSnapshot) {
    state = 'completed'
  }

  return {
    featureEnabled,
    state,
    latestRun: latestRunResponse,
    currentSnapshot,
  }
}

export class DashboardDerivedRecomputeDisabledError extends Error {
  readonly code = 'DERIVED_RECOMPUTE_DISABLED' as const
  readonly requestId: string

  constructor(requestId: string) {
    super('Derived recompute is disabled by runtime flag')
    this.name = 'DashboardDerivedRecomputeDisabledError'
    this.requestId = requestId
  }
}

export class DashboardDerivedRecomputeAlreadyRunningError extends Error {
  readonly code = 'DERIVED_RECOMPUTE_RUNNING' as const
  readonly requestId: string

  constructor(requestId: string) {
    super('Derived recompute already in progress')
    this.name = 'DashboardDerivedRecomputeAlreadyRunningError'
    this.requestId = requestId
  }
}

export class DashboardDerivedRecomputeFailedError extends Error {
  readonly code = 'DERIVED_RECOMPUTE_FAILED' as const
  readonly requestId: string

  constructor(requestId: string) {
    super('Derived recompute failed. Snapshot remains unchanged.')
    this.name = 'DashboardDerivedRecomputeFailedError'
    this.requestId = requestId
  }
}

export const createGetDashboardDerivedRecomputeStatusUseCase = ({
  featureEnabled,
  repository,
}: {
  featureEnabled: boolean
  repository: DashboardDerivedRecomputeRepository
}) => {
  return async () => {
    return buildStatusResponse({
      featureEnabled,
      repository,
    })
  }
}

export const createRunDashboardDerivedRecomputeUseCase = ({
  featureEnabled,
  repository,
}: {
  featureEnabled: boolean
  repository: DashboardDerivedRecomputeRepository
}) => {
  return async (input: { requestId: string; triggerSource: 'admin' | 'internal' }) => {
    if (!featureEnabled) {
      throw new DashboardDerivedRecomputeDisabledError(input.requestId)
    }

    const acquired = await repository.acquireRunLock()
    if (!acquired) {
      throw new DashboardDerivedRecomputeAlreadyRunningError(input.requestId)
    }

    const startedAt = new Date()
    const run = await repository.createRun({
      snapshotVersion: toSnapshotVersion(startedAt),
      triggerSource: input.triggerSource,
      requestId: input.requestId,
      stage: 'starting',
      startedAt,
    })

    logApiEvent({
      level: 'info',
      msg: 'dashboard derived recompute started',
      requestId: input.requestId,
      triggerSource: input.triggerSource,
      snapshotVersion: run.snapshotVersion,
      runId: run.id,
    })

    try {
      await repository.updateRunProgress({
        runId: run.id,
        stage: 'reading_source',
      })

      logApiEvent({
        level: 'info',
        msg: 'dashboard derived recompute progress',
        requestId: input.requestId,
        triggerSource: input.triggerSource,
        snapshotVersion: run.snapshotVersion,
        runId: run.id,
        stage: 'reading_source',
        durationMs: Date.now() - startedAt.getTime(),
      })

      const result = await repository.recomputeFromSourceOfTruth({
        runId: run.id,
        startedAt,
      })

      logApiEvent({
        level: 'info',
        msg: 'dashboard derived recompute progress',
        requestId: input.requestId,
        triggerSource: input.triggerSource,
        snapshotVersion: run.snapshotVersion,
        runId: run.id,
        stage: 'applied_snapshot',
        durationMs: result.durationMs,
        rowCounts: result.rowCounts,
      })

      logApiEvent({
        level: 'info',
        msg: 'dashboard derived recompute succeeded',
        requestId: input.requestId,
        triggerSource: input.triggerSource,
        snapshotVersion: run.snapshotVersion,
        runId: run.id,
        durationMs: result.durationMs,
        rowCounts: result.rowCounts,
      })

      return buildStatusResponse({
        featureEnabled,
        repository,
      })
    } catch (error) {
      const finishedAt = new Date()
      const durationMs = finishedAt.getTime() - startedAt.getTime()
      const safeErrorCode = 'DERIVED_RECOMPUTE_FAILED'
      const safeErrorMessage = 'Derived recompute failed. Snapshot remains unchanged.'

      await repository.markRunFailed({
        runId: run.id,
        stage: 'failed',
        safeErrorCode,
        safeErrorMessage,
        finishedAt,
        durationMs,
      })

      logApiEvent({
        level: 'error',
        msg: 'dashboard derived recompute failed',
        requestId: input.requestId,
        triggerSource: input.triggerSource,
        snapshotVersion: run.snapshotVersion,
        runId: run.id,
        durationMs,
        safeErrorCode,
        safeErrorMessage,
        ...toErrorLogFields({
          error,
          includeStack: true,
        }),
      })

      throw new DashboardDerivedRecomputeFailedError(input.requestId)
    } finally {
      await repository.releaseRunLock()
    }
  }
}
