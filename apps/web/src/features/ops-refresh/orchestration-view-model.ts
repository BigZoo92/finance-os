import type {
  RefreshJobDefinition,
  RefreshJobRunResponse,
  RefreshJobStatus,
  RefreshStatusResponse,
} from './types'

export type OrchestrationHumanState =
  | 'ready'
  | 'active'
  | 'success'
  | 'attention'
  | 'failure'
  | 'unavailable'
export type OrchestrationPrimaryAction =
  | { kind: 'run'; label: 'Lancer' | 'Relancer'; jobId: string }
  | { kind: 'navigate'; label: 'Gérer'; to: '/integrations' }
  | { kind: 'details'; label: 'Détails' }
  | { kind: 'none'; label: null }

export type OrchestrationJobModel = {
  id: string
  label: string
  group: 'Données' | 'Intelligence' | 'Calcul'
  memberIds: string[]
  state: OrchestrationHumanState
  stateLabel: string
  lastRunAt: string | null
  durationMs: number | null
  detail: string
  action: OrchestrationPrimaryAction
  history: RefreshJobRunResponse[]
  enabled: boolean
}

type KnownGroup = {
  id: string
  label: string
  group: OrchestrationJobModel['group']
  memberIds: string[]
  actionOwner?: 'integrations' | 'details'
}

const KNOWN_GROUPS: KnownGroup[] = [
  {
    id: 'powens',
    label: 'Powens',
    group: 'Données',
    memberIds: ['powens'],
    actionOwner: 'integrations',
  },
  {
    id: 'transactions-categorization',
    label: 'Transactions',
    group: 'Données',
    memberIds: ['transactions-categorization'],
  },
  {
    id: 'external-investments',
    label: 'Investissements externes',
    group: 'Données',
    memberIds: ['external-investments', 'ibkr', 'binance-crypto'],
    actionOwner: 'integrations',
  },
  {
    id: 'asset-valuation',
    label: 'Asset Valuation',
    group: 'Données',
    memberIds: ['asset-valuation'],
  },
  { id: 'news', label: 'News', group: 'Intelligence', memberIds: ['news-finance', 'news-crypto'] },
  { id: 'market-data', label: 'Marchés', group: 'Intelligence', memberIds: ['market-data'] },
  {
    id: 'social',
    label: 'Social et X',
    group: 'Intelligence',
    memberIds: ['tweets-finance', 'tweets-ai'],
    actionOwner: 'details',
  },
  {
    id: 'investment-learning-review',
    label: 'Revue des apprentissages',
    group: 'Calcul',
    memberIds: ['investment-learning-review'],
  },
  {
    id: 'investment-action-plan',
    label: 'Plan d’investissement',
    group: 'Calcul',
    memberIds: ['investment-action-plan'],
  },
  { id: 'advisor-context', label: 'Advisor', group: 'Calcul', memberIds: ['advisor-context'] },
]

export const describeOrchestrationStatus = (status: RefreshJobStatus | null, enabled: boolean) => {
  if (!enabled || status === 'disabled' || status === 'skipped_disabled') {
    return {
      state: 'unavailable' as const,
      label: 'Indisponible',
      detail: 'Ce job n’est pas disponible.',
    }
  }
  if (!status || status === 'pending' || status === 'skipped') {
    return { state: 'ready' as const, label: 'Prêt', detail: 'Prêt à être lancé.' }
  }
  if (status === 'queued' || status === 'running') {
    return { state: 'active' as const, label: 'En cours', detail: 'L’exécution est en cours.' }
  }
  if (status === 'success') {
    return {
      state: 'success' as const,
      label: 'Terminé',
      detail: 'La dernière exécution est terminée.',
    }
  }
  if (status === 'failed' || status === 'timed_out' || status === 'cancelled') {
    return {
      state: 'failure' as const,
      label: 'Échec',
      detail: 'La dernière exécution n’a pas abouti.',
    }
  }
  return {
    state: 'attention' as const,
    label: 'Attention',
    detail: 'La dernière exécution est incomplète.',
  }
}

const toMillis = (value: string) => {
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

const collectHistory = (
  status: RefreshStatusResponse | null | undefined,
  memberIds: string[]
): RefreshJobRunResponse[] => {
  if (!status) return []
  const runs = [status.latestTopologicalRun, ...status.topologicalHistory].filter(
    (run, index, all) => run && all.findIndex(candidate => candidate?.runId === run.runId) === index
  )
  return runs
    .flatMap(run => run?.jobs ?? [])
    .filter(result => memberIds.includes(result.jobId))
    .sort((left, right) => toMillis(right.finishedAt) - toMillis(left.finishedAt))
}

const fallbackGroup = (job: RefreshJobDefinition): KnownGroup => ({
  id: job.id,
  label: job.label,
  group:
    job.domain === 'advisor'
      ? 'Calcul'
      : job.domain === 'news' || job.domain === 'markets' || job.domain === 'social'
        ? 'Intelligence'
        : 'Données',
  memberIds: [job.id],
})

export const createOrchestrationJobs = ({
  status,
  currentResult,
  isAdmin,
  busy,
}: {
  status: RefreshStatusResponse | null | undefined
  currentResult?: RefreshJobRunResponse | null
  isAdmin: boolean
  busy: boolean
}): OrchestrationJobModel[] => {
  const jobs = status?.jobs ?? []
  const ids = new Set(jobs.map(job => job.id))
  const knownIds = new Set(KNOWN_GROUPS.flatMap(group => group.memberIds))
  const groups = [
    ...KNOWN_GROUPS.filter(group => group.memberIds.some(id => ids.has(id))),
    ...jobs.filter(job => !knownIds.has(job.id)).map(fallbackGroup),
  ]

  return groups.map(group => {
    const definitions = jobs.filter(job => group.memberIds.includes(job.id))
    const primaryDefinition = definitions.find(job => job.id === group.id) ?? definitions[0]
    const enabled = definitions.some(job => job.enabled)
    const history = collectHistory(status, group.memberIds)
    const current =
      currentResult && group.memberIds.includes(currentResult.jobId)
        ? currentResult
        : (history[0] ?? null)
    const described = describeOrchestrationStatus(current?.status ?? null, enabled)
    let action: OrchestrationPrimaryAction = { kind: 'none', label: null }
    if (isAdmin && group.actionOwner === 'integrations') {
      action = { kind: 'navigate', label: 'Gérer', to: '/integrations' }
    } else if (group.actionOwner === 'details') {
      action = isAdmin ? { kind: 'details', label: 'Détails' } : { kind: 'none', label: null }
    } else if (
      isAdmin &&
      !busy &&
      described.state !== 'active' &&
      enabled &&
      primaryDefinition?.manualTriggerAllowed
    ) {
      action = {
        kind: 'run',
        label:
          described.state === 'failure' || described.state === 'attention' ? 'Relancer' : 'Lancer',
        jobId: primaryDefinition.id,
      }
    }

    return {
      id: group.id,
      label: group.label,
      group: group.group,
      memberIds: group.memberIds,
      state: described.state,
      stateLabel: described.label,
      lastRunAt: current?.finishedAt ?? null,
      durationMs: current?.durationMs ?? null,
      detail: described.detail,
      action,
      history,
      enabled,
    }
  })
}

export const formatOpsDuration = (durationMs: number | null | undefined) => {
  if (durationMs === null || durationMs === undefined || !Number.isFinite(durationMs))
    return 'Indisponible'
  const seconds = Math.max(0, Math.round(durationMs / 1000))
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return remainder === 0 ? `${minutes} min` : `${minutes} min ${remainder} s`
}
