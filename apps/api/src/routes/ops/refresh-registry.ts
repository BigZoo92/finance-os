import type { ExternalInvestmentProvider } from '@finance-os/external-investments'
import type { DashboardAdvisorManualOperationResponse } from '../dashboard/advisor-contract'
import type { DashboardRouteRuntime } from '../dashboard/types'

export type RefreshJobStatus = 'queued' | 'running' | 'success' | 'partial' | 'failed' | 'skipped'
export type RefreshTriggerSource =
  | 'cron'
  | 'manual-global'
  | 'manual-individual'
  | 'internal'

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
  message: string | null
  details: Record<string, unknown> | null
}

export type RefreshStatus = {
  requestId: string
  mode: 'demo' | 'admin'
  jobs: RefreshJobDefinition[]
  latestRun: DashboardAdvisorManualOperationResponse | null
  history: DashboardAdvisorManualOperationResponse[]
}

const nowIso = () => new Date().toISOString()

const toSafeErrorMessage = (error: unknown) => {
  const raw = error instanceof Error ? error.message : String(error)
  return raw.replace(/(token|secret|password|api[_-]?key|code)=([^&\s]+)/gi, '$1=[redacted]').slice(0, 500)
}

const createResult = ({
  jobId,
  status,
  requestId,
  startedAtMs,
  message,
  details,
  runId = null,
}: {
  jobId: string
  status: RefreshJobStatus
  requestId: string
  startedAtMs: number
  message: string | null
  details?: Record<string, unknown>
  runId?: string | null
}): RefreshJobRunResult => ({
  jobId,
  status,
  requestId,
  runId,
  startedAt: new Date(startedAtMs).toISOString(),
  finishedAt: nowIso(),
  durationMs: Date.now() - startedAtMs,
  message,
  details: details ?? null,
})

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
      dependencies: ['transactions-categorization', 'news-finance', 'market-data', 'external-investments'],
      enabled: config.advisorEnabled,
      manualTriggerAllowed: true,
      scheduleGroup: 'daily-intelligence',
      timeoutMs: 120_000,
      retryPolicy: { maxAttempts: 1, backoffMs: 0 },
    },
  ]

  const getJobs = () => jobs

  const getExecutionPlan = ({
    includeDisabled = false,
  }: {
    includeDisabled?: boolean
  } = {}) => {
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
  }: {
    jobId: string
    requestId: string
    triggerSource: RefreshTriggerSource
  }): Promise<RefreshJobRunResult> => {
    const job = requireJob(jobId)
    const startedAtMs = Date.now()

    if (!job.enabled) {
      return createResult({
        jobId,
        status: 'skipped',
        requestId,
        startedAtMs,
        message: 'Job disabled by configuration.',
      })
    }

    if (!job.manualTriggerAllowed && triggerSource === 'manual-individual') {
      return createResult({
        jobId,
        status: 'skipped',
        requestId,
        startedAtMs,
        message: 'Manual trigger is disabled for this job.',
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
          triggerSource: triggerSource === 'internal' || triggerSource === 'cron' ? 'internal' : 'admin',
        })
        return createResult({
          jobId,
          status: status.state === 'failed' ? 'failed' : status.state === 'running' ? 'running' : 'success',
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
        const partial = [ibkr, binance].some(item => item.status === 'partial' || item.status === 'failed')
        return createResult({
          jobId,
          status: partial ? 'partial' : 'queued',
          requestId,
          startedAtMs,
          message: partial ? 'External investment sync queued with degradation.' : 'External investment sync queued.',
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
          status: result.providerResults.some(item => item.status === 'failed') ? 'partial' : 'success',
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
        const result = await runtime.useCases.runAdvisorDaily({
          mode: 'admin',
          requestId,
          triggerSource,
        })
        return createResult({
          jobId,
          status: result.run.status === 'degraded' ? 'partial' : result.run.status === 'failed' ? 'failed' : 'success',
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
      return createResult({
        jobId,
        status: 'partial',
        requestId,
        startedAtMs,
        message: toSafeErrorMessage(error),
      })
    }
  }

  const runAll = async ({
    requestId,
    triggerSource,
  }: {
    requestId: string
    triggerSource: RefreshTriggerSource
  }) => {
    if (!runtime.useCases.runAdvisorManualRefreshAndAnalysis) {
      throw new Error('REFRESH_ORCHESTRATOR_UNAVAILABLE')
    }

    return runtime.useCases.runAdvisorManualRefreshAndAnalysis({
      mode: 'admin',
      requestId,
      triggerSource,
    })
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
