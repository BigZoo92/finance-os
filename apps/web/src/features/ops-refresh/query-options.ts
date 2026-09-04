import { queryOptions } from '@tanstack/react-query'
import type { AuthMode } from '@/features/auth-types'
import { fetchRefreshJobs, fetchRefreshStatus } from './api'
import type { RefreshJobDefinition, RefreshJobsResponse, RefreshStatusResponse } from './types'
import { isRefreshStatusActive } from './view-state'

export const opsRefreshQueryKeys = {
  all: ['ops-refresh'] as const,
  jobs: (mode?: AuthMode) => [...opsRefreshQueryKeys.all, 'jobs', ...(mode ? [mode] : [])] as const,
  status: (mode?: AuthMode) =>
    [...opsRefreshQueryKeys.all, 'status', ...(mode ? [mode] : [])] as const,
}

const DEMO_JOB_INPUTS: Array<
  Pick<RefreshJobDefinition, 'id' | 'label' | 'domain' | 'dependencies'>
> = [
  { id: 'powens', label: 'Powens', domain: 'banking', dependencies: [] },
  {
    id: 'transactions-categorization',
    label: 'Transactions',
    domain: 'transactions',
    dependencies: ['powens'],
  },
  {
    id: 'external-investments',
    label: 'Investissements externes',
    domain: 'investments',
    dependencies: [],
  },
  { id: 'ibkr', label: 'IBKR', domain: 'investments', dependencies: [] },
  { id: 'binance-crypto', label: 'Binance', domain: 'investments', dependencies: [] },
  {
    id: 'asset-valuation',
    label: 'Valorisation des actifs',
    domain: 'investments',
    dependencies: ['market-data', 'external-investments'],
  },
  { id: 'news-finance', label: 'News finance', domain: 'news', dependencies: [] },
  { id: 'news-crypto', label: 'News crypto', domain: 'news', dependencies: ['news-finance'] },
  { id: 'market-data', label: 'Marchés', domain: 'markets', dependencies: [] },
  { id: 'tweets-finance', label: 'Signaux finance', domain: 'social', dependencies: [] },
  { id: 'tweets-ai', label: 'Signaux IA', domain: 'social', dependencies: [] },
  {
    id: 'investment-learning-review',
    label: 'Revue des apprentissages',
    domain: 'advisor',
    dependencies: ['market-data', 'external-investments'],
  },
  {
    id: 'investment-action-plan',
    label: 'Plan d’investissement',
    domain: 'advisor',
    dependencies: ['investment-learning-review', 'market-data'],
  },
  {
    id: 'advisor-context',
    label: 'Advisor',
    domain: 'advisor',
    dependencies: ['transactions-categorization', 'news-finance', 'market-data'],
  },
]

const getDemoJobs = (): RefreshJobsResponse => ({
  requestId: 'demo-ops-refresh',
  mode: 'demo',
  jobs: DEMO_JOB_INPUTS.map(job => ({
    ...job,
    description: 'Donnée de démonstration déterministe.',
    enabled: true,
    manualTriggerAllowed: false,
    scheduleGroup: 'daily-intelligence',
    timeoutMs: 90_000,
    retryPolicy: { maxAttempts: 1, backoffMs: 0 },
  })),
})

const getDemoStatus = (): RefreshStatusResponse => ({
  ...getDemoJobs(),
  latestRun: null,
  history: [],
  latestTopologicalRun: null,
  topologicalHistory: [],
})

export const opsRefreshJobsQueryOptionsWithMode = ({ mode }: { mode?: AuthMode | undefined }) =>
  queryOptions({
    queryKey: opsRefreshQueryKeys.jobs(mode),
    queryFn: () => (mode === 'demo' ? getDemoJobs() : fetchRefreshJobs()),
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 30_000,
  })

export const opsRefreshStatusQueryOptionsWithMode = ({ mode }: { mode?: AuthMode | undefined }) =>
  queryOptions({
    queryKey: opsRefreshQueryKeys.status(mode),
    queryFn: () => (mode === 'demo' ? getDemoStatus() : fetchRefreshStatus()),
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 0,
    refetchInterval: query => {
      if (mode !== 'admin') {
        return false
      }
      const latest = query.state.data?.latestRun
      return latest && isRefreshStatusActive(latest.status) ? 3000 : false
    },
  })
