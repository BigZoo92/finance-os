import type { ExternalInvestmentProvider } from '@finance-os/external-investments'
import { randomUUID } from 'node:crypto'
import { logApiEvent } from '../../observability/logger'
import type { DashboardAdvisorManualOperationResponse } from '../dashboard/advisor-contract'
import type { DashboardRouteRuntime } from '../dashboard/types'

/**
 * Status taxonomy:
 *
 *   - queued: handed to the underlying queue/use-case, will run later.
 *   - running: actively executing; should not stay here past the job's hard timeout.
 *   - success: completed and produced the expected data.
 *   - partial: completed but with at least one provider in degraded state.
 *   - failed: errored out with an explicit error.
 *   - timed_out: exceeded the job's hard timeout (AbortController fired).
 *   - skipped: legacy generic skip; prefer the specific skip variants below.
 *   - skipped_disabled: the feature flag for this job is off.
 *   - skipped_missing_config: feature flag is on but a required secret is missing
 *     (e.g. NEWS_PROVIDER_X_TWITTER_ENABLED=true without bearer token).
 *   - skipped_budget: paid provider budget exhausted (e.g. X monthly cap reached).
 *   - skipped_dependency_failed: a job listed in `dependencies` failed/timed_out.
 *   - cancelled: explicitly cancelled via /ops/refresh/runs/:runId/cancel.
 */
export type RefreshJobStatus =
  | 'pending'
  | 'disabled'
  | 'queued'
  | 'running'
  | 'success'
  | 'partial'
  | 'failed'
  | 'timed_out'
  | 'cancelled'
  | 'skipped'
  | 'skipped_disabled'
  | 'skipped_missing_config'
  | 'skipped_budget'
  | 'skipped_dependency_failed'

export const FINAL_REFRESH_STATUSES: readonly RefreshJobStatus[] = [
  'success',
  'partial',
  'disabled',
  'failed',
  'timed_out',
  'cancelled',
  'skipped',
  'skipped_disabled',
  'skipped_missing_config',
  'skipped_budget',
  'skipped_dependency_failed',
]

export const isFinalRefreshStatus = (status: RefreshJobStatus): boolean =>
  FINAL_REFRESH_STATUSES.includes(status)
export type RefreshTriggerSource = 'cron' | 'manual-global' | 'manual-individual' | 'internal'

export type RefreshRunKind = 'night' | 'morning' | 'manual' | 'dry_run'

export type RefreshJobDomain =
  | 'banking'
  | 'transactions'
  | 'investments'
  | 'news'
  | 'markets'
  | 'social'
  | 'advisor'

export type RefreshJobDefinition = {
  id: string
  label: string
  description: string
  domain: RefreshJobDomain
  dependencies: string[]
  enabled: boolean
  manualTriggerAllowed: boolean
  scheduleGroup: 'daily-intelligence' | 'manual-only'
  timeoutMs: number
  retryPolicy: {
    maxAttempts: number
    backoffMs: number
  }
}

export type RefreshJobRunResult = {
  jobId: string
  status: RefreshJobStatus
  requestId: string
  runId: string | null
  startedAt: string
  finishedAt: string
  durationMs: number
  recordsRead: number | null
  recordsWritten: number | null
  errorCode: string | null
  errorMessage: string | null
  retryCount: number
  message: string | null
  details: Record<string, unknown> | null
}

export type RefreshRunExecutionResponse = {
  ok: boolean
  requestId: string
  runId: string
  runKind: RefreshRunKind
  triggerSource: RefreshTriggerSource
  dryRun: boolean
  status: 'planned' | 'success' | 'partial' | 'failed'
  startedAt: string
  finishedAt: string
  durationMs: number
  jobs: RefreshJobRunResult[]
  failedJobs: string[]
  disabledJobs: string[]
  operation: DashboardAdvisorManualOperationResponse | null
  warning: string | null
}

export type RefreshStatus = {
  requestId: string
  mode: 'demo' | 'admin'
  jobs: RefreshJobDefinition[]
  latestRun: DashboardAdvisorManualOperationResponse | null
  history: DashboardAdvisorManualOperationResponse[]
  latestTopologicalRun: RefreshRunExecutionResponse | null
  topologicalHistory: RefreshRunExecutionResponse[]
}

const nowIso = () => new Date().toISOString()

const toSafeErrorMessage = (error: unknown) => {
  const raw = error instanceof Error ? error.message : String(error)
  return raw
    .replace(/(token|secret|password|api[_-]?key|code)=([^&\s]+)/gi, '$1=[redacted]')
    .slice(0, 500)
}

const createResult = ({
  jobId,
  status,
  requestId,
  startedAtMs,
  message,
  details,
  runId = null,
  recordsRead = null,
  recordsWritten = null,
  errorCode = null,
  errorMessage = null,
  retryCount = 0,
}: {
  jobId: string
  status: RefreshJobStatus
  requestId: string
  startedAtMs: number
  message: string | null
  details?: Record<string, unknown>
  runId?: string | null
  recordsRead?: number | null
  recordsWritten?: number | null
  errorCode?: string | null
  errorMessage?: string | null
  retryCount?: number
}): RefreshJobRunResult => ({
  jobId,
  status,
  requestId,
  runId,
  startedAt: new Date(startedAtMs).toISOString(),
  finishedAt: nowIso(),
  durationMs: Date.now() - startedAtMs,
  recordsRead,
  recordsWritten,
  errorCode,
  errorMessage,
  retryCount,
  message,
  details: details ?? null,
})

class JobTimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`JOB_HARD_TIMEOUT_${timeoutMs}MS`)
    this.name = 'JobTimeoutError'
  }
}

/**
 * Hard timeout wrapper. Any underlying use-case that respects AbortSignal
 * (LLM clients, fetch, etc.) will be cancelled. If the inner promise refuses
 * to cancel, we still mark the job timed_out and return — the dangling
 * promise is logged-and-forgotten which is the right tradeoff vs. leaving
 * the run in `running` forever.
 */
export const withHardTimeout = async <T>(
  promise: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number
): Promise<T> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new JobTimeoutError(timeoutMs)), timeoutMs)
  try {
    return await promise(controller.signal)
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Pure helper: given the runtime-evaluated feature requirements for a job,
 * decide if it must be skipped before any side effect. Returns the skip
 * status + a human reason, or null when the job is allowed to run.
 *
 * This is the load-bearing piece that makes "feature enabled but no secret"
 * surface as `skipped_missing_config` instead of a confusing 500.
 */
export const evaluatePreflight = ({
  job,
  triggerSource,
  missingConfig,
  budgetExceeded,
  failedDependencyId,
}: {
  job: { id: string; enabled: boolean; manualTriggerAllowed: boolean }
  triggerSource: RefreshTriggerSource
  missingConfig?: { missingEnvNames: string[]; reason: string } | null
  budgetExceeded?: { reason: string } | null
  failedDependencyId?: string | null
}): { status: RefreshJobStatus; message: string; details: Record<string, unknown> } | null => {
  if (!job.enabled) {
    return {
      status: 'skipped_disabled',
      message: 'Job disabled by configuration.',
      details: { reason: 'flag_disabled' },
    }
  }
  if (!job.manualTriggerAllowed && triggerSource === 'manual-individual') {
    return {
      status: 'skipped',
      message: 'Manual trigger is disabled for this job.',
      details: { reason: 'manual_trigger_not_allowed' },
    }
  }
  if (missingConfig && missingConfig.missingEnvNames.length > 0) {
    return {
      status: 'skipped_missing_config',
      message: missingConfig.reason,
      details: { missingEnvNames: missingConfig.missingEnvNames },
    }
  }
  if (budgetExceeded) {
    return {
      status: 'skipped_budget',
      message: budgetExceeded.reason,
      details: { reason: 'budget_exceeded' },
    }
  }
  if (failedDependencyId) {
    return {
      status: 'skipped_dependency_failed',
      message: `Upstream dependency ${failedDependencyId} failed; skipping this job.`,
      details: { failedDependencyId },
    }
  }
  return null
}

export const createRefreshJobRegistry = ({
  runtime,
  config,
}: {
  runtime: DashboardRouteRuntime
  config: {
    externalInvestmentsEnabled: boolean
    ibkrFlexEnabled: boolean
    binanceSpotEnabled: boolean
    newsEnabled: boolean
    marketsEnabled: boolean
    advisorEnabled: boolean
    socialEnabled: boolean
  }
}) => {
  const topologicalHistory: RefreshRunExecutionResponse[] = []
  const jobs: RefreshJobDefinition[] = [
    {
      id: 'powens',
      label: 'Powens',
      description: 'Enqueue la synchronisation de toutes les connexions bancaires Powens.',
      domain: 'banking',
      dependencies: [],
      enabled: true,
      manualTriggerAllowed: true,
      scheduleGroup: 'daily-intelligence',
      timeoutMs: 90_000,
      retryPolicy: { maxAttempts: 1, backoffMs: 0 },
    },
    {
      id: 'transactions-categorization',
      label: 'Transactions & categorisation',
      description: 'Reconstruit les snapshots derives et la categorisation transactionnelle.',
      domain: 'transactions',
      dependencies: ['powens'],
      enabled: true,
      manualTriggerAllowed: true,
      scheduleGroup: 'daily-intelligence',
      timeoutMs: 120_000,
      retryPolicy: { maxAttempts: 1, backoffMs: 0 },
    },
    {
      id: 'external-investments',
      label: 'Investissements externes',
      description: 'Enqueue IBKR et Binance puis regenere le bundle investissements.',
      domain: 'investments',
      dependencies: [],
      enabled: config.externalInvestmentsEnabled,
      manualTriggerAllowed: true,
      scheduleGroup: 'daily-intelligence',
      timeoutMs: 120_000,
      retryPolicy: { maxAttempts: 1, backoffMs: 0 },
    },
    {
      id: 'ibkr',
      label: 'IBKR',
      description: 'Enqueue la recuperation Flex IBKR read-only.',
      domain: 'investments',
      dependencies: [],
      enabled: config.externalInvestmentsEnabled && config.ibkrFlexEnabled,
      manualTriggerAllowed: true,
      scheduleGroup: 'daily-intelligence',
      timeoutMs: 90_000,
      retryPolicy: { maxAttempts: 1, backoffMs: 0 },
    },
    {
      id: 'binance-crypto',
      label: 'Binance / crypto',
      description: 'Enqueue les soldes, trades et cash flows Binance Spot read-only.',
      domain: 'investments',
      dependencies: [],
      enabled: config.externalInvestmentsEnabled && config.binanceSpotEnabled,
      manualTriggerAllowed: true,
      scheduleGroup: 'daily-intelligence',
      timeoutMs: 90_000,
      retryPolicy: { maxAttempts: 1, backoffMs: 0 },
    },
    {
      id: 'news-finance',
      label: 'News finance, macro, geo, crypto, IA',
      description: 'Rafraichit le cache news multi-provider et son bundle Advisor.',
      domain: 'news',
      dependencies: [],
      enabled: config.newsEnabled,
      manualTriggerAllowed: true,
      scheduleGroup: 'daily-intelligence',
      timeoutMs: 90_000,
      retryPolicy: { maxAttempts: 1, backoffMs: 0 },
    },
    {
      id: 'news-crypto',
      label: 'News crypto',
      description: 'Couverture crypto via le pipeline news et le filtrage du bundle Advisor.',
      domain: 'news',
      dependencies: ['news-finance'],
      enabled: config.newsEnabled,
      manualTriggerAllowed: true,
      scheduleGroup: 'daily-intelligence',
      timeoutMs: 90_000,
      retryPolicy: { maxAttempts: 1, backoffMs: 0 },
    },
    {
      id: 'market-data',
      label: 'Donnees marche',
      description: 'Rafraichit watchlist, indices, ETF/actions, taux et macro.',
      domain: 'markets',
      dependencies: [],
      enabled: config.marketsEnabled,
      manualTriggerAllowed: true,
      scheduleGroup: 'daily-intelligence',
      timeoutMs: 90_000,
      retryPolicy: { maxAttempts: 1, backoffMs: 0 },
    },
    {
      id: 'tweets-finance',
      label: 'Tweets / signaux finance',
      description: 'Signaux sociaux finance quand le polling social est configure.',
      domain: 'social',
      dependencies: [],
      enabled: config.socialEnabled,
      manualTriggerAllowed: false,
      scheduleGroup: 'manual-only',
      timeoutMs: 60_000,
      retryPolicy: { maxAttempts: 1, backoffMs: 0 },
    },
    {
      id: 'tweets-ai',
      label: 'Tweets / signaux IA',
      description: 'Signaux sociaux IA quand le polling social est configure.',
      domain: 'social',
      dependencies: [],
      enabled: config.socialEnabled,
      manualTriggerAllowed: false,
      scheduleGroup: 'manual-only',
      timeoutMs: 60_000,
      retryPolicy: { maxAttempts: 1, backoffMs: 0 },
    },
    {
      id: 'advisor-context',
      label: 'AI advisor context & conseil',
      description: 'Construit le contexte compact puis lance le daily brief Advisor.',
      domain: 'advisor',
      dependencies: [
        'transactions-categorization',
        'news-finance',
        'market-data',
        'external-investments',
      ],
      enabled: config.advisorEnabled,
      manualTriggerAllowed: true,
      scheduleGroup: 'daily-intelligence',
      timeoutMs: 120_000,
      retryPolicy: { maxAttempts: 1, backoffMs: 0 },
    },
  ]

  const getJobs = () => jobs

  const getExecutionPlan = ({ includeDisabled = false }: { includeDisabled?: boolean } = {}) => {
    const byId = new Map(jobs.map(job => [job.id, job]))
    const visited = new Set<string>()
    const visiting = new Set<string>()
    const ordered: RefreshJobDefinition[] = []

    const visit = (job: RefreshJobDefinition) => {
      if (visited.has(job.id) || (!includeDisabled && !job.enabled)) {
        return
      }
      if (visiting.has(job.id)) {
        throw new Error(`REFRESH_JOB_DEPENDENCY_CYCLE:${job.id}`)
      }
      visiting.add(job.id)
      for (const dependencyId of job.dependencies) {
        const dependency = byId.get(dependencyId)
        if (dependency) {
          visit(dependency)
        }
      }
      visiting.delete(job.id)
      visited.add(job.id)
      ordered.push(job)
    }

    for (const job of jobs) {
      if (job.scheduleGroup === 'daily-intelligence') {
        visit(job)
      }
    }

    return ordered
  }

  const requireJob = (jobId: string) => {
    const job = jobs.find(item => item.id === jobId)
    if (!job) {
      throw new Error('REFRESH_JOB_NOT_FOUND')
    }
    return job
  }

  const runProvider = async ({
    provider,
    requestId,
    jobId,
  }: {
    provider: ExternalInvestmentProvider
    requestId: string
    jobId: string
  }) => {
    const startedAtMs = Date.now()
    try {
      if (!runtime.useCases.triggerExternalInvestmentProviderSync) {
        return createResult({
          jobId,
          status: 'skipped',
          requestId,
          startedAtMs,
          message: 'External investment trigger unavailable.',
        })
      }
      await runtime.useCases.triggerExternalInvestmentProviderSync({ provider, requestId })
      return createResult({
        jobId,
        status: 'queued',
        requestId,
        startedAtMs,
        message: `${provider} sync enqueued.`,
        details: { provider },
      })
    } catch (error) {
      return createResult({
        jobId,
        status: 'partial',
        requestId,
        startedAtMs,
        message: toSafeErrorMessage(error),
        details: { provider },
      })
    }
  }

  const runJob = async ({
    jobId,
    requestId,
    triggerSource,
    failedDependencyId = null,
  }: {
    jobId: string
    requestId: string
    triggerSource: RefreshTriggerSource
    failedDependencyId?: string | null
  }): Promise<RefreshJobRunResult> => {
    const job = requireJob(jobId)
    const startedAtMs = Date.now()

    const preflight = evaluatePreflight({ job, triggerSource, failedDependencyId })
    if (preflight) {
      return createResult({
        jobId,
        status: preflight.status,
        requestId,
        startedAtMs,
        message: preflight.message,
        details: preflight.details,
      })
    }

    try {
      if (jobId === 'powens') {
        const enqueued = await runtime.useCases.requestTransactionsBackgroundRefresh({ requestId })
        return createResult({
          jobId,
          status: enqueued ? 'queued' : 'skipped',
          requestId,
          startedAtMs,
          message: enqueued ? 'Powens sync enqueued.' : 'Powens sync already queued recently.',
        })
      }

      if (jobId === 'transactions-categorization') {
        const status = await runtime.useCases.runDerivedRecompute({
          requestId,
          triggerSource:
            triggerSource === 'internal' || triggerSource === 'cron' ? 'internal' : 'admin',
        })
        return createResult({
          jobId,
          status:
            status.state === 'failed'
              ? 'failed'
              : status.state === 'running'
                ? 'running'
                : 'success',
          requestId,
          startedAtMs,
          message: `Derived recompute ${status.state}.`,
          details: { state: status.state, latestRun: status.latestRun },
        })
      }

      if (jobId === 'ibkr') {
        return runProvider({ provider: 'ibkr', requestId, jobId })
      }

      if (jobId === 'binance-crypto') {
        return runProvider({ provider: 'binance', requestId, jobId })
      }

      if (jobId === 'external-investments') {
        const [ibkr, binance] = await Promise.all([
          runProvider({ provider: 'ibkr', requestId, jobId: 'ibkr' }),
          runProvider({ provider: 'binance', requestId, jobId: 'binance-crypto' }),
        ])
        const bundle = runtime.useCases.generateExternalInvestmentContextBundle
          ? await runtime.useCases.generateExternalInvestmentContextBundle({ requestId })
          : null
        const partial = [ibkr, binance].some(
          item => item.status === 'partial' || item.status === 'failed'
        )
        return createResult({
          jobId,
          status: partial ? 'partial' : 'queued',
          requestId,
          startedAtMs,
          message: partial
            ? 'External investment sync queued with degradation.'
            : 'External investment sync queued.',
          details: { providers: [ibkr, binance], bundleGenerated: Boolean(bundle) },
        })
      }

      if (jobId === 'news-finance' || jobId === 'news-crypto') {
        if (!runtime.useCases.ingestNews) {
          return createResult({
            jobId,
            status: 'skipped',
            requestId,
            startedAtMs,
            message: 'News runtime unavailable.',
          })
        }
        const result = await runtime.useCases.ingestNews({ requestId })
        const contextBundle = runtime.useCases.getNewsContextBundle
          ? await runtime.useCases.getNewsContextBundle({ requestId, range: '7d' })
          : null
        const cryptoSignals =
          contextBundle?.topSignals.filter(signal =>
            `${signal.title} ${signal.affectedEntities.join(' ')} ${signal.affectedSectors.join(' ')}`
              .toLowerCase()
              .includes('crypto')
          ) ?? []
        return createResult({
          jobId,
          status: 'success',
          requestId,
          startedAtMs,
          message: 'News refreshed.',
          details: { ...result, cryptoSignalCount: cryptoSignals.length },
        })
      }

      if (jobId === 'market-data') {
        if (!runtime.useCases.refreshMarkets) {
          return createResult({
            jobId,
            status: 'skipped',
            requestId,
            startedAtMs,
            message: 'Markets runtime unavailable.',
          })
        }
        const result = await runtime.useCases.refreshMarkets({ requestId })
        return createResult({
          jobId,
          status: result.providerResults.some(item => item.status === 'failed')
            ? 'partial'
            : 'success',
          requestId,
          startedAtMs,
          message: 'Market data refreshed.',
          details: {
            quoteCount: result.quoteCount,
            macroObservationCount: result.macroObservationCount,
            signalCount: result.signalCount,
          },
        })
      }

      if (jobId === 'advisor-context') {
        if (!runtime.useCases.runAdvisorDaily) {
          return createResult({
            jobId,
            status: 'skipped',
            requestId,
            startedAtMs,
            message: 'Advisor runtime unavailable.',
          })
        }

        // Hard-timeout race: if the advisor pipeline does not finish within
        // `timeoutMs`, we surface `timed_out` to the caller while letting the
        // underlying promise drain in the background (its catch handlers
        // still write the final run status to the DB). This is what stops
        // the user-visible "running forever" state.
        const advisorPromise = runtime.useCases.runAdvisorDaily({
          mode: 'admin',
          requestId,
          triggerSource,
        })
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new JobTimeoutError(job.timeoutMs)), job.timeoutMs)
        })
        const result = await Promise.race([advisorPromise, timeoutPromise])

        return createResult({
          jobId,
          status:
            result.run.status === 'degraded'
              ? 'partial'
              : result.run.status === 'failed'
                ? 'failed'
                : 'success',
          requestId,
          startedAtMs,
          runId: String(result.run.id),
          message: result.run.fallbackReason,
          details: { advisorRun: result.run },
        })
      }

      return createResult({
        jobId,
        status: 'skipped',
        requestId,
        startedAtMs,
        message: 'No runner is registered for this job yet.',
      })
    } catch (error) {
      const isTimeout =
        error instanceof JobTimeoutError ||
        (error instanceof Error && /JOB_HARD_TIMEOUT/.test(error.message)) ||
        // AbortController's default abort reason surfaces as DOMException AbortError
        (typeof error === 'object' &&
          error !== null &&
          'name' in error &&
          (error as { name?: string }).name === 'AbortError')

      // Provider-partial-data is a soft degradation, not a hard failure; the
      // call-site already wraps it in `partial`. Anything else with a hard
      // timeout signature surfaces as `timed_out` so the UI can offer recovery.
      return createResult({
        jobId,
        status: isTimeout ? 'timed_out' : 'partial',
        requestId,
        startedAtMs,
        message: toSafeErrorMessage(error),
        errorCode: isTimeout ? 'JOB_HARD_TIMEOUT' : 'JOB_PARTIAL_FAILURE',
        errorMessage: toSafeErrorMessage(error),
        ...(isTimeout ? { details: { reason: 'hard_timeout', timeoutMs: job.timeoutMs } } : {}),
      })
    }
  }

  const runAll = async ({
    requestId,
    triggerSource,
    runKind,
    dryRun = false,
  }: {
    requestId: string
    triggerSource: RefreshTriggerSource
    runKind: RefreshRunKind
    dryRun?: boolean
  }) => {
    const runId = `refresh-${randomUUID()}`
    const startedAtMs = Date.now()
    const startedAt = new Date(startedAtMs).toISOString()
    const plan = getExecutionPlan({ includeDisabled: true })
    const results: RefreshJobRunResult[] = []

    logApiEvent({
      level: 'info',
      msg: 'ops_refresh_topological_run_started',
      requestId,
      runId,
      runKind,
      triggerSource,
      dryRun,
      jobCount: plan.length,
    })

    if (dryRun) {
      for (const job of plan) {
        results.push(
          createResult({
            jobId: job.id,
            status: job.enabled ? 'pending' : 'disabled',
            requestId,
            startedAtMs,
            message: job.enabled
              ? 'Dry-run only: job would be scheduled.'
              : 'Dry-run only: job is disabled by configuration.',
            details: {
              dependencies: job.dependencies,
              scheduleGroup: job.scheduleGroup,
              timeoutMs: job.timeoutMs,
            },
            runId,
          })
        )
      }
      const finishedAt = nowIso()
      const response: RefreshRunExecutionResponse = {
        ok: true,
        requestId,
        runId,
        runKind: 'dry_run',
        triggerSource,
        dryRun: true,
        status: 'planned',
        startedAt,
        finishedAt,
        durationMs: Date.now() - startedAtMs,
        jobs: results,
        failedJobs: [],
        disabledJobs: results.filter(item => item.status === 'disabled').map(item => item.jobId),
        operation: null,
        warning: null,
      }
      topologicalHistory.unshift(response)
      topologicalHistory.splice(10)
      return response
    }

    const resultByJobId = new Map<string, RefreshJobRunResult>()
    const blockingStatuses = new Set<RefreshJobStatus>([
      'failed',
      'timed_out',
      'cancelled',
      'skipped_missing_config',
      'skipped_budget',
      'skipped_dependency_failed',
      'disabled',
      'skipped_disabled',
    ])

    for (const job of plan) {
      const failedDependencyId =
        job.dependencies.find(dependencyId => {
          const dependencyResult = resultByJobId.get(dependencyId)
          return dependencyResult ? blockingStatuses.has(dependencyResult.status) : false
        }) ?? null

      logApiEvent({
        level: 'info',
        msg: 'ops_refresh_job_started',
        requestId,
        runId,
        jobId: job.id,
        runKind,
        phase: 'execute',
        failedDependencyId,
      })
      const result = await runJob({
        jobId: job.id,
        requestId,
        triggerSource,
        failedDependencyId,
      })
      results.push(result)
      resultByJobId.set(job.id, result)
      logApiEvent({
        level:
          result.status === 'failed' ||
          result.status === 'timed_out' ||
          result.status === 'skipped_dependency_failed'
            ? 'error'
            : result.status === 'partial' || result.status === 'disabled'
              ? 'warn'
              : 'info',
        msg: 'ops_refresh_job_finished',
        requestId,
        runId,
        jobId: job.id,
        runKind,
        phase: 'execute',
        status: result.status,
        durationMs: result.durationMs,
      })
    }

    const failedJobs = results
      .filter(item => item.status === 'failed' || item.status === 'timed_out')
      .map(item => item.jobId)
    const disabledJobs = results
      .filter(item => item.status === 'disabled' || item.status === 'skipped_disabled')
      .map(item => item.jobId)
    const degraded = results.some(item =>
      ['partial', 'skipped_dependency_failed', 'skipped_missing_config', 'skipped_budget'].includes(
        item.status
      )
    )
    const finishedAt = nowIso()
    const response: RefreshRunExecutionResponse = {
      ok: failedJobs.length === 0,
      requestId,
      runId,
      runKind,
      triggerSource,
      dryRun: false,
      status:
        failedJobs.length > 0
          ? 'failed'
          : degraded || disabledJobs.length > 0
            ? 'partial'
            : 'success',
      startedAt,
      finishedAt,
      durationMs: Date.now() - startedAtMs,
      jobs: results,
      failedJobs,
      disabledJobs,
      operation: null,
      warning:
        'Topological run executed through refresh-registry. Legacy manual Advisor operation history remains exposed separately as latestRun/history.',
    }
    topologicalHistory.unshift(response)
    topologicalHistory.splice(10)
    logApiEvent({
      level:
        response.status === 'failed' ? 'error' : response.status === 'partial' ? 'warn' : 'info',
      msg: 'ops_refresh_topological_run_finished',
      requestId,
      runId,
      runKind,
      status: response.status,
      durationMs: response.durationMs,
      failedJobs,
      disabledJobs,
    })
    return response
  }

  const getStatus = async ({
    requestId,
    mode,
  }: {
    requestId: string
    mode: 'demo' | 'admin'
  }): Promise<RefreshStatus> => {
    if (mode === 'demo') {
      return {
        requestId,
        mode,
        jobs,
        latestRun: null,
        history: [],
        latestTopologicalRun: null,
        topologicalHistory: [],
      }
    }

    const history = runtime.useCases.listAdvisorManualOperations
      ? await runtime.useCases.listAdvisorManualOperations({ mode, requestId, limit: 10 })
      : []
    const latestRun =
      history[0] ??
      (runtime.useCases.getLatestAdvisorManualOperation
        ? await runtime.useCases.getLatestAdvisorManualOperation({ mode, requestId })
        : null)

    return {
      requestId,
      mode,
      jobs,
      latestRun,
      history: history.length > 0 ? history : latestRun ? [latestRun] : [],
      latestTopologicalRun: topologicalHistory[0] ?? null,
      topologicalHistory,
    }
  }

  return {
    getJobs,
    getExecutionPlan,
    runJob,
    runAll,
    getStatus,
  }
}
