import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Separator,
} from '@finance-os/ui/components'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useStore } from '@tanstack/react-store'
import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import { PersonalFinancialGoalsCard } from '@/components/dashboard/personal-financial-goals-card'
import { postAuthLogout } from '@/features/auth-api'
import { authMeQueryOptions, authQueryKeys } from '@/features/auth-query-options'
import type { AuthMode } from '@/features/auth-types'
import { resolveAuthViewState } from '@/features/auth-view-state'
import {
  normalizeDashboardDerivedRecomputeActionError,
  patchTransactionClassification,
  postDashboardDerivedRecompute,
} from '@/features/dashboard-api'
import { adaptDashboardSummaryLegacy } from '@/features/dashboard-legacy-adapter'
import {
  dashboardDerivedRecomputeStatusQueryOptionsWithMode,
  type DemoTransactionsScenario,
  dashboardQueryKeys,
  dashboardSummaryQueryOptionsWithMode,
  dashboardTransactionsInfiniteQueryOptionsWithMode,
} from '@/features/dashboard-query-options'
import type {
  DashboardRange,
  DashboardSummaryResponse,
  DashboardTransactionsResponse,
} from '@/features/dashboard-types'
import { financialGoalsQueryKeys } from '@/features/goals/query-options'
import { fetchPowensConnectUrl, postPowensSync } from '@/features/powens/api'
import {
  formatPowensManualSyncCountdown,
  getPowensManualSyncCooldownSnapshot,
  getPowensManualSyncCooldownUiConfig,
  getPowensManualSyncUiState,
  logPowensManualSyncBlockedUiEvent,
  type PowensManualSyncUiPhase,
  powensManualSyncCooldownStore,
  startPowensManualSyncCooldown,
} from '@/features/powens/manual-sync-cooldown'
import {
  powensAuditTrailQueryOptionsWithMode,
  powensDiagnosticsQueryOptionsWithMode,
  powensQueryKeys,
  powensStatusQueryOptionsWithMode,
  powensSyncBacklogQueryOptionsWithMode,
  powensSyncRunsQueryOptionsWithMode,
} from '@/features/powens/query-options'
import {
  clearReconnectBannerDeferredSnapshot,
  createPowensRequestId,
  createReconnectRequiredFingerprint,
  getPowensReconnectBannerUiEnabled,
  getReconnectRequiredConnectionIds,
  logReconnectBannerCtaClicked,
  logReconnectBannerDismissed,
  logReconnectBannerShown,
  readReconnectBannerDeferredSnapshot,
  writeReconnectBannerDeferredSnapshot,
  type PowensReconnectBannerUiState,
} from '@/features/powens/reconnect-banner'
import { getPowensInternalNotifications } from '@/features/powens/internal-notifications'
import { getPowensConnectionSyncBadgeModel } from '@/features/powens/sync-status'
import { pushToast } from '@/lib/toast-store'
import {
  buildDashboardHealthModel,
  getDashboardHealthUiConfig,
  logDashboardHealthSnapshotEvent,
  logDashboardHealthWidgetEvent,
} from './dashboard-health'
import { DashboardHealthPanel, DashboardWidgetHealthBadge } from './dashboard-health-panel'
import { getLatestSyncStatus } from './latest-sync-status'
import { MonthEndProjectionCard } from './month-end-projection-card'
import { MonthlyCategoryBudgetsCard } from './monthly-category-budgets-card'
import { WealthHistory } from './wealth-history'
import { ExpenseStructureCard } from './expense-structure-card'
import { getTrendDirection, summarizeCashflowDirection } from './trend-visuals'

const RANGE_OPTIONS: Array<{ label: string; value: DashboardRange }> = [
  { label: '7j', value: '7d' },
  { label: '30j', value: '30d' },
  { label: '90j', value: '90d' },
]
const DEMO_SCENARIO_OPTIONS: Array<{ label: string; value: DemoTransactionsScenario }> = [
  { label: 'Default', value: 'default' },
  { label: 'Empty', value: 'empty' },
  { label: 'Subscriptions', value: 'subscriptions' },
  { label: 'Parse fail (fallback)', value: 'parse_error' },
]

const SYNC_RUN_STATUS_VARIANT: Record<
  'running' | 'success' | 'error' | 'reconnect_required',
  'secondary' | 'outline' | 'destructive'
> = {
  running: 'outline',
  success: 'secondary',
  error: 'destructive',
  reconnect_required: 'destructive',
}

const toErrorMessage = (value: unknown) => {
  if (value instanceof Error) {
    return value.message
  }

  return String(value)
}

const formatDateTime = (value: string | null) => {
  if (!value) {
    return '-'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return '-'
  }

  return parsed.toLocaleString('fr-FR')
}

const TRANSACTION_FRESHNESS_BADGE: Record<
  DashboardTransactionsResponse['freshness']['syncStatus'],
  { label: string; variant: 'secondary' | 'outline' | 'destructive'; className?: string }
> = {
  fresh: { label: 'Fresh', variant: 'secondary' },
  'stale-but-usable': {
    label: 'Stale (usable)',
    variant: 'outline',
    className: 'border-amber-500/60 bg-amber-400/15 text-amber-700 dark:text-amber-300',
  },
  syncing: {
    label: 'Syncing',
    variant: 'outline',
    className: 'border-sky-500/60 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  },
  'sync-failed-with-safe-data': { label: 'Sync failed', variant: 'destructive' },
  'no-data-first-connect': { label: 'No data yet', variant: 'outline' },
}

const formatDuration = (startedAt: string, endedAt: string | null) => {
  const started = new Date(startedAt).getTime()
  const ended = endedAt ? new Date(endedAt).getTime() : Date.now()

  if (!Number.isFinite(started) || !Number.isFinite(ended) || ended < started) {
    return null
  }

  const seconds = Math.round((ended - started) / 1000)
  if (seconds < 60) {
    return `${seconds}s`
  }

  const minutes = Math.floor(seconds / 60)
  const remainderSeconds = seconds % 60
  if (minutes < 60) {
    return `${minutes}m ${remainderSeconds}s`
  }

  const hours = Math.floor(minutes / 60)
  const remainderMinutes = minutes % 60
  return `${hours}h ${remainderMinutes}m`
}

const formatDiagnosticMetadata = (value: Record<string, unknown> | null) => {
  if (!value) {
    return null
  }

  const entries = Object.entries(value)
    .filter(([, entryValue]) => entryValue !== null)
    .map(([key, entryValue]) => `${key}: ${String(entryValue)}`)

  if (!entries.length) {
    return null
  }

  return entries.join(' • ')
}

const formatRelativeDateTime = (value: string | null) => {
  if (!value) {
    return null
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  const diffMs = parsed.getTime() - Date.now()
  const formatter = new Intl.RelativeTimeFormat('fr-FR', {
    numeric: 'auto',
  })

  const units = [
    [60_000, 'minute'],
    [3_600_000, 'hour'],
    [86_400_000, 'day'],
  ] as const

  for (const [unitMs, unit] of units) {
    const delta = diffMs / unitMs
    if (Math.abs(delta) < (unit === 'minute' ? 60 : unit === 'hour' ? 24 : Infinity)) {
      return formatter.format(Math.round(delta), unit)
    }
  }

  return formatDateTime(value)
}

const pickLatestDate = (values: Array<string | null>) => {
  const timestamps = values
    .filter((value): value is string => Boolean(value))
    .map(value => new Date(value).getTime())
    .filter(timestamp => Number.isFinite(timestamp))

  if (!timestamps.length) {
    return null
  }

  return new Date(Math.max(...timestamps)).toISOString()
}

const formatDate = (value: string) => {
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const formatMoney = (value: number, currency = 'EUR') => {
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value)
  } catch {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 2,
    }).format(value)
  }
}

const DERIVED_RECOMPUTE_BADGE: Record<
  'idle' | 'running' | 'completed' | 'failed',
  {
    label: string
    variant: 'secondary' | 'outline' | 'destructive'
    className?: string
  }
> = {
  idle: {
    label: 'Idle',
    variant: 'outline',
  },
  running: {
    label: 'Running',
    variant: 'outline',
    className: 'border-sky-500/60 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  },
  completed: {
    label: 'Completed',
    variant: 'secondary',
  },
  failed: {
    label: 'Failed',
    variant: 'destructive',
  },
}

const MANUAL_SYNC_UI_BADGE: Record<
  PowensManualSyncUiPhase,
  {
    variant: 'secondary' | 'outline' | 'destructive'
    className?: string
  }
> = {
  idle: {
    variant: 'outline',
  },
  syncing: {
    variant: 'outline',
    className: 'border-sky-500/60 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  },
  cooldown: {
    variant: 'outline',
    className: 'border-amber-500/60 bg-amber-400/15 text-amber-700 dark:text-amber-300',
  },
  ready: {
    variant: 'secondary',
  },
}

const formatDerivedRecomputeStage = (value: string | null) => {
  if (!value) {
    return 'En attente'
  }

  switch (value) {
    case 'starting':
      return 'Initialisation'
    case 'reading_source':
      return 'Lecture source'
    case 'completed':
      return 'Snapshot actif'
    case 'failed':
      return 'Echec'
    default:
      return value.replaceAll('_', ' ')
  }
}

const summarizeDerivedRecomputeRowCounts = (
  value: {
    transactionMatchedCount: number
    transactionUpdatedCount: number
    rawImportTimestampUpdatedCount: number
    snapshotRowCount: number
  } | null
) => {
  if (!value) {
    return 'Compteurs indisponibles.'
  }

  return `${value.transactionUpdatedCount}/${value.transactionMatchedCount} transactions maj, ${value.rawImportTimestampUpdatedCount} timestamps raw, ${value.snapshotRowCount} lignes snapshot.`
}

const DemoWidgetBadge = ({ demo }: { demo: boolean }) => {
  if (!demo) {
    return null
  }

  return (
    <Badge
      variant="outline"
      className="border-amber-500/60 bg-amber-400/15 text-amber-700 dark:text-amber-300"
    >
      DEMO
    </Badge>
  )
}

const GuardedActionWrapper = ({
  blockedTitle,
  children,
  onBlockedClick,
}: {
  blockedTitle?: string | null
  children: ReactNode
  onBlockedClick?: (() => void) | undefined
}) => {
  const isBlockedInteractive = Boolean(blockedTitle && onBlockedClick)

  return (
    <span
      className={blockedTitle ? 'inline-flex cursor-not-allowed' : 'inline-flex'}
      title={blockedTitle ?? undefined}
      {...(isBlockedInteractive
        ? {
            role: 'button',
            tabIndex: 0,
            onClick: onBlockedClick,
            onKeyDown: (event: KeyboardEvent<HTMLSpanElement>) => {
              if (event.key !== 'Enter' && event.key !== ' ') {
                return
              }

              event.preventDefault()
              onBlockedClick?.()
            },
          }
        : {})}
    >
      {children}
    </span>
  )
}

const ASSET_TYPE_LABEL: Record<'cash' | 'investment' | 'manual', string> = {
  cash: 'Cash',
  investment: 'Investment',
  manual: 'Manual',
}

const ASSET_ORIGIN_LABEL: Record<'provider' | 'manual', string> = {
  provider: 'Provider',
  manual: 'Manual',
}

const COST_BASIS_LABEL: Record<
  DashboardSummaryResponse['positions'][number]['costBasisSource'],
  string
> = {
  minimal: 'Cout minimal',
  provider: 'Cout provider',
  manual: 'Cout manuel',
  unknown: 'Cout inconnu',
}

const formatQuantity = (value: number | null) => {
  if (value === null) {
    return '-'
  }

  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 8,
  }).format(value)
}

export function DashboardAppShell({ range }: { range: DashboardRange }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const dashboardHealthUiConfig = getDashboardHealthUiConfig()
  const manualSyncCooldownUiConfig = getPowensManualSyncCooldownUiConfig()
  const manualSyncCooldownState = useStore(powensManualSyncCooldownStore)
  const manualSyncCooldownSnapshot = getPowensManualSyncCooldownSnapshot(manualSyncCooldownState)
  const dashboardHealthSnapshotLoggedRef = useRef(false)
  const dashboardHealthWidgetLoggedRef = useRef<Set<string>>(new Set())
  const reconnectBannerShownLoggedRef = useRef<Set<string>>(new Set())
  const reconnectRequestIdRef = useRef<string | null>(null)
  const reconnectBannerUiEnabled = getPowensReconnectBannerUiEnabled()
  const [demoReconnectInfoVisible, setDemoReconnectInfoVisible] = useState(false)
  const [demoTransactionsScenario, setDemoTransactionsScenario] =
    useState<DemoTransactionsScenario>('default')
  const [deferredSnapshot, setDeferredSnapshot] = useState(() =>
    readReconnectBannerDeferredSnapshot()
  )

  const authQuery = useQuery(authMeQueryOptions())
  const authViewState = resolveAuthViewState({
    isPending: authQuery.isPending,
    ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}),
  })
  const isAuthPending = authViewState === 'pending'
  const isAdmin = authViewState === 'admin'
  const isDemo = authViewState === 'demo'
  const authMode: AuthMode | undefined = isAdmin ? 'admin' : isDemo ? 'demo' : undefined
  const authModeOptions: { mode?: AuthMode } = authMode ? { mode: authMode } : {}
  const isAuthUnavailable = authQuery.data?.error === 'auth_unavailable'
  const summaryQuery = useQuery(
    dashboardSummaryQueryOptionsWithMode({
      range,
      ...authModeOptions,
    })
  )
  const transactionsQuery = useInfiniteQuery(
    dashboardTransactionsInfiniteQueryOptionsWithMode({
      range,
      limit: 30,
      ...(isDemo ? { demoScenario: demoTransactionsScenario } : {}),
      ...authModeOptions,
    })
  )
  const statusQuery = useQuery(powensStatusQueryOptionsWithMode(authModeOptions))
  const syncRunsQuery = useQuery(powensSyncRunsQueryOptionsWithMode(authModeOptions))
  const syncBacklogQuery = useQuery(powensSyncBacklogQueryOptionsWithMode(authModeOptions))
  const auditTrailQuery = useQuery(powensAuditTrailQueryOptionsWithMode(authModeOptions))
  const diagnosticsQuery = useQuery(powensDiagnosticsQueryOptionsWithMode(authModeOptions))
  const derivedRecomputeStatusQuery = useQuery(
    dashboardDerivedRecomputeStatusQueryOptionsWithMode(authModeOptions)
  )

  const connectMutation = useMutation({
    mutationFn: async ({ requestId }: { requestId?: string } = {}) => {
      if (!isAdmin) {
        throw new Error('Admin session required')
      }

      return fetchPowensConnectUrl(requestId ? { requestId } : {})
    },
    onSuccess: payload => {
      window.location.assign(payload.url)
    },
    onError: error => {
      pushToast({
        title: 'Connexion impossible',
        description: toErrorMessage(error),
        tone: 'error',
      })
    },
  })

  const syncMutation = useMutation({
    mutationFn: async ({
      connectionId,
      fullResync,
    }: {
      connectionId?: string
      fullResync?: boolean
    } = {}) => {
      if (!isAdmin) {
        throw new Error('Admin session required')
      }

      return postPowensSync({
        ...(connectionId ? { connectionId } : {}),
        ...(fullResync === true ? { fullResync: true } : {}),
      })
    },
    onSuccess: async () => {
      if (manualSyncCooldownUiConfig.enabled) {
        startPowensManualSyncCooldown(manualSyncCooldownUiConfig.durationSeconds)
      }

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: powensQueryKeys.status(),
        }),
        queryClient.invalidateQueries({
          queryKey: powensQueryKeys.syncRuns(),
        }),
        queryClient.invalidateQueries({
          queryKey: powensQueryKeys.syncBacklog(),
        }),
        queryClient.invalidateQueries({
          queryKey: powensQueryKeys.auditTrail(),
        }),
        queryClient.invalidateQueries({
          queryKey: powensQueryKeys.diagnostics(),
        }),
        queryClient.invalidateQueries({
          queryKey: financialGoalsQueryKeys.list(),
        }),
        queryClient.invalidateQueries({
          queryKey: dashboardQueryKeys.all,
        }),
      ])

      pushToast({
        title: 'Sync enfilee',
        description: 'Le worker va traiter la synchronisation.',
        tone: 'success',
      })
    },
    onError: error => {
      pushToast({
        title: 'Sync refusee',
        description: toErrorMessage(error),
        tone: 'error',
      })
    },
  })

  const derivedRecomputeMutation = useMutation({
    mutationFn: async () => {
      if (!isAdmin) {
        throw new Error('Admin session required')
      }

      return postDashboardDerivedRecompute()
    },
    onSuccess: () => {
      pushToast({
        title: 'Recompute terminee',
        description: 'Le snapshot derive actif a ete remplace.',
        tone: 'success',
      })
    },
    onError: error => {
      const normalized = normalizeDashboardDerivedRecomputeActionError(error)

      pushToast({
        title: 'Recompute echouee',
        description: normalized.message,
        tone: 'error',
      })
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: dashboardQueryKeys.all,
      })
    },
  })

  const logoutMutation = useMutation({
    mutationFn: postAuthLogout,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: authQueryKeys.me(),
        }),
        queryClient.invalidateQueries({
          queryKey: powensQueryKeys.status(),
        }),
        queryClient.invalidateQueries({
          queryKey: powensQueryKeys.syncRuns(),
        }),
        queryClient.invalidateQueries({
          queryKey: powensQueryKeys.syncBacklog(),
        }),
        queryClient.invalidateQueries({
          queryKey: powensQueryKeys.auditTrail(),
        }),
        queryClient.invalidateQueries({
          queryKey: powensQueryKeys.diagnostics(),
        }),
        queryClient.invalidateQueries({
          queryKey: dashboardQueryKeys.all,
        }),
      ])

      pushToast({
        title: 'Session fermee',
        description: 'Retour en mode demo.',
        tone: 'info',
      })
    },
    onError: error => {
      pushToast({
        title: 'Logout impossible',
        description: toErrorMessage(error),
        tone: 'error',
      })
    },
  })

  const classifyTransactionMutation = useMutation({
    mutationFn: async (transaction: DashboardTransactionsResponse['items'][number]) => {
      if (!isAdmin) {
        throw new Error('Admin session required')
      }

      const categoryInput = window.prompt(
        'Categorie personnalisée (laisser vide pour supprimer)',
        transaction.category ?? ''
      )

      if (categoryInput === null) {
        throw new Error('Edition annulee')
      }

      const subcategoryInput = window.prompt(
        'Sous-categorie (laisser vide pour supprimer)',
        transaction.subcategory ?? ''
      )

      if (subcategoryInput === null) {
        throw new Error('Edition annulee')
      }

      const tagsInput = window.prompt('Tags (separes par virgules)', transaction.tags.join(', '))

      if (tagsInput === null) {
        throw new Error('Edition annulee')
      }

      const tags = tagsInput
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0)

      const category = categoryInput.trim()
      const subcategory = subcategoryInput.trim()
      const canSetIncomeType = transaction.direction === 'income'
      const incomeTypeInput = canSetIncomeType
        ? window.prompt(
            'Type de revenu (salary, recurring, exceptional; laisser vide pour exceptionnel)',
            transaction.incomeType ?? 'exceptional'
          )
        : ''

      if (canSetIncomeType && incomeTypeInput === null) {
        throw new Error('Edition annulee')
      }

      const normalizedIncomeType = canSetIncomeType
        ? (incomeTypeInput ?? '').trim().toLowerCase()
        : ''
      const incomeType =
        !canSetIncomeType || normalizedIncomeType.length === 0
          ? null
          : normalizedIncomeType === 'salary' ||
              normalizedIncomeType === 'recurring' ||
              normalizedIncomeType === 'exceptional'
            ? normalizedIncomeType
            : null

      return patchTransactionClassification({
        transactionId: transaction.id,
        category: category.length > 0 ? category : null,
        subcategory: subcategory.length > 0 ? subcategory : null,
        incomeType,
        tags,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: dashboardQueryKeys.transactions({ range, limit: 30 }),
      })
      pushToast({
        title: 'Classification sauvegardee',
        description: 'Categorie, sous-categorie, type de revenu et tags mis a jour.',
        tone: 'success',
      })
    },
    onError: error => {
      if (error instanceof Error && error.message === 'Edition annulee') {
        return
      }

      pushToast({
        title: 'Echec de sauvegarde',
        description: toErrorMessage(error),
        tone: 'error',
      })
    },
  })

  const summary = summaryQuery.data
  const adaptedSummary = adaptDashboardSummaryLegacy({
    range,
    summary,
    ...(authMode ? { mode: authMode } : {}),
  })
  const wealthTrend = getTrendDirection({
    start: adaptedSummary.dailyWealthSnapshots[0]?.balance ?? null,
    end: adaptedSummary.dailyWealthSnapshots.at(-1)?.balance ?? null,
  })
  const cashflowDirection = summarizeCashflowDirection({
    incomes: adaptedSummary.totals.incomes,
    expenses: adaptedSummary.totals.expenses,
  })
  const diagnostics = diagnosticsQuery.data
  const diagnosticsOutcomeBadge: Record<
    "ok" | "degraded" | "timeout" | "auth_error" | "provider_error",
    { label: string; variant: "secondary" | "outline" | "destructive" }
  > = {
    ok: { label: "OK", variant: "secondary" },
    degraded: { label: "Degraded", variant: "outline" },
    timeout: { label: "Timeout", variant: "destructive" },
    auth_error: { label: "Auth issue", variant: "destructive" },
    provider_error: { label: "Provider error", variant: "destructive" },
  }

  const statusConnections = statusQuery.data?.connections ?? []
  const isIntegrationsSafeMode = statusQuery.data?.safeModeActive ?? false
  const isIntegrationsSafeModeFallback = statusQuery.data?.fallback === 'safe_mode'
  const transactions = transactionsQuery.data?.pages.flatMap(page => page.items) ?? []
  const transactionsFreshness = transactionsQuery.data?.pages[0]?.freshness
  const transactionsDemoFixture = transactionsQuery.data?.pages[0]?.demoFixture
  const transactionsFreshnessBadge = transactionsFreshness
    ? TRANSACTION_FRESHNESS_BADGE[transactionsFreshness.syncStatus]
    : null
  const statusCounts = {
    connected: statusConnections.filter(connection => connection.status === 'connected').length,
    syncing: statusConnections.filter(connection => connection.status === 'syncing').length,
    failing: statusConnections.filter(
      connection => connection.status === 'error' || connection.status === 'reconnect_required'
    ).length,
  }
  const syncStatusPersistenceEnabled = statusQuery.data?.syncStatusPersistenceEnabled ?? false
  const latestSyncAt = pickLatestDate(statusConnections.map(connection => connection.lastSyncAt))
  const latestSuccessAt = pickLatestDate(
    statusConnections.map(connection => connection.lastSuccessAt)
  )
  const syncRuns = syncRunsQuery.data?.runs ?? []
  const syncRunsByConnectionId = syncRuns.reduce((accumulator, run) => {
    const existing = accumulator.get(run.connectionId) ?? []
    existing.push(run)
    accumulator.set(run.connectionId, existing)
    return accumulator
  }, new Map<string, typeof syncRuns>())
  const recentErrorsByFingerprint = syncRuns
    .filter(run => run.result === 'error' || run.result === 'reconnect_required')
    .filter(run => run.errorFingerprint && run.errorMessage)
    .reduce<
      Array<{
        fingerprint: string
        message: string
        count: number
        latestAt: string
      }>
    >((acc, run) => {
      const fingerprint = run.errorFingerprint
      const message = run.errorMessage

      if (!fingerprint || !message) {
        return acc
      }

      const existing = acc.find(entry => entry.fingerprint === fingerprint)
      const latestAt = run.endedAt ?? run.startedAt

      if (!existing) {
        acc.push({ fingerprint, message, count: 1, latestAt })
        return acc
      }

      existing.count += 1
      if (new Date(latestAt).getTime() > new Date(existing.latestAt).getTime()) {
        existing.latestAt = latestAt
      }

      return acc
    }, [])
    .sort(
      (a, b) => b.count - a.count || new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime()
    )
    .slice(0, 6)
  const syncBacklogCount = syncBacklogQuery.data?.syncBacklogCount ?? 0
  const latestSyncStatus = getLatestSyncStatus(syncRuns)
  const powensInternalNotifications = getPowensInternalNotifications({
    connections: statusConnections,
    runs: syncRuns,
  }).slice(0, 8)
  const auditEvents = auditTrailQuery.data?.events ?? []
  const latestCallback = statusQuery.data?.lastCallback ?? null
  const latestCallbackFreshness = formatRelativeDateTime(latestCallback?.receivedAt ?? null)
  const derivedRecomputeStatus = derivedRecomputeStatusQuery.data
  const derivedRecomputeLatestRun = derivedRecomputeStatus?.latestRun ?? null
  const derivedRecomputeCurrentSnapshot = derivedRecomputeStatus?.currentSnapshot ?? null
  const derivedRecomputeState = derivedRecomputeMutation.isPending
    ? 'running'
    : (derivedRecomputeStatus?.state ?? 'idle')
  const derivedRecomputeBadge = DERIVED_RECOMPUTE_BADGE[derivedRecomputeState]
  const derivedRecomputeFeatureEnabled = derivedRecomputeStatus?.featureEnabled ?? true
  const derivedRecomputeCounts =
    derivedRecomputeLatestRun?.rowCounts ?? derivedRecomputeCurrentSnapshot?.rowCounts ?? null
  const derivedRecomputeActionLabel = derivedRecomputeMutation.isPending
    ? 'Recompute...'
    : derivedRecomputeState === 'failed'
      ? 'Reessayer la recompute'
      : 'Recompute derivee'
  const manualSyncUiState = getPowensManualSyncUiState({
    cooldownUiEnabled: manualSyncCooldownUiConfig.enabled,
    cooldownSnapshot: manualSyncCooldownSnapshot,
    isIntegrationsSafeMode,
    isSyncPending: syncMutation.isPending,
    mode: authMode,
  })
  const manualSyncUiBadge = MANUAL_SYNC_UI_BADGE[manualSyncUiState.phase]
  const manualSyncButtonLabel =
    manualSyncUiState.phase === 'cooldown'
      ? `Cooldown ${formatPowensManualSyncCountdown(manualSyncUiState.cooldownRemainingSeconds)}`
      : syncMutation.isPending
        ? 'Sync...'
        : 'Lancer une sync'
  const connectionSyncButtonLabel =
    manualSyncUiState.phase === 'cooldown'
      ? `Cooldown ${formatPowensManualSyncCountdown(manualSyncUiState.cooldownRemainingSeconds)}`
      : syncMutation.isPending
        ? 'Resync en cours...'
        : 'Sync incrementale (connexion)'
  const handleBlockedSyncClick = ({ connectionId }: { connectionId?: string } = {}) => {
    if (!manualSyncUiState.blockReason) {
      return
    }

    logPowensManualSyncBlockedUiEvent({
      blockReason: manualSyncUiState.blockReason,
      ...(connectionId ? { connectionId } : {}),
      cooldownRemainingSeconds: manualSyncUiState.cooldownRemainingSeconds,
      mode: authMode,
    })
  }

  const reconnectRequiredConnectionIds = getReconnectRequiredConnectionIds(statusQuery.data)
  const reconnectFingerprint = createReconnectRequiredFingerprint(reconnectRequiredConnectionIds)
  const reconnectStatusUnavailable = statusQuery.isError && statusQuery.data === undefined
  const reconnectRequired = reconnectRequiredConnectionIds.length > 0 || reconnectStatusUnavailable
  const reconnectDeferred =
    reconnectRequired && deferredSnapshot?.fingerprint === reconnectFingerprint
  const reconnectBannerState: PowensReconnectBannerUiState | null = !reconnectBannerUiEnabled
    ? null
    : isAuthPending || statusQuery.isPending
      ? 'loading'
      : connectMutation.isPending
        ? 'in_progress'
        : connectMutation.isError
          ? 'error_retryable'
          : demoReconnectInfoVisible
            ? 'success'
            : reconnectDeferred
              ? 'deferred'
              : reconnectRequired
                ? 'required'
                : null

  const positions = adaptedSummary.positions
  const positionsByAssetId = positions.reduce<Map<number, DashboardSummaryResponse['positions']>>(
    (acc, position) => {
      if (position.assetId === null) {
        return acc
      }

      const existing = acc.get(position.assetId) ?? []
      existing.push(position)
      acc.set(position.assetId, existing)
      return acc
    },
    new Map()
  )
  const connectionBalanceById = new Map(
    adaptedSummary.connections.map(connection => [
      connection.powensConnectionId,
      connection.balance,
    ])
  )
  const dashboardHealthReady =
    authMode !== undefined &&
    (summary !== undefined || summaryQuery.isError) &&
    (statusQuery.data !== undefined || statusQuery.isError) &&
    (syncRunsQuery.data !== undefined || syncRunsQuery.isError) &&
    (derivedRecomputeStatus !== undefined || derivedRecomputeStatusQuery.isError)
  const dashboardHealthModel =
    dashboardHealthReady && authMode
      ? buildDashboardHealthModel({
          mode: authMode,
          syncRuns,
          ...(summary ? { summary } : {}),
          ...(statusQuery.data ? { status: statusQuery.data } : {}),
          ...(derivedRecomputeStatus ? { derivedStatus: derivedRecomputeStatus } : {}),
          summaryUnavailable: summaryQuery.isError && summary === undefined,
          statusUnavailable: statusQuery.isError && statusQuery.data === undefined,
          syncRunsUnavailable: syncRunsQuery.isError && syncRunsQuery.data === undefined,
          derivedUnavailable:
            derivedRecomputeStatusQuery.isError && derivedRecomputeStatus === undefined,
        })
      : null

  useEffect(() => {
    if (!reconnectBannerUiEnabled) {
      return
    }

    if (!reconnectRequired) {
      if (deferredSnapshot) {
        clearReconnectBannerDeferredSnapshot()
        setDeferredSnapshot(null)
      }
      return
    }

    if (deferredSnapshot && deferredSnapshot.fingerprint !== reconnectFingerprint) {
      clearReconnectBannerDeferredSnapshot()
      setDeferredSnapshot(null)
    }
  }, [
    deferredSnapshot,
    reconnectBannerUiEnabled,
    reconnectFingerprint,
    reconnectRequired,
  ])

  useEffect(() => {
    if (!authMode || !reconnectBannerUiEnabled || !reconnectBannerState) {
      return
    }

    const dedupeKey = `${authMode}:${reconnectBannerState}:${reconnectFingerprint}`
    if (reconnectBannerShownLoggedRef.current.has(dedupeKey)) {
      return
    }

    logReconnectBannerShown({
      mode: authMode,
      state: reconnectBannerState,
      fingerprint: reconnectFingerprint,
      requestId: reconnectRequestIdRef.current,
      fallback: reconnectStatusUnavailable ? 'status_unavailable' : null,
    })
    reconnectBannerShownLoggedRef.current.add(dedupeKey)
  }, [
    authMode,
    reconnectBannerUiEnabled,
    reconnectBannerState,
    reconnectFingerprint,
    reconnectStatusUnavailable,
  ])

  useEffect(() => {
    if (!connectMutation.isError) {
      return
    }

    reconnectRequestIdRef.current = null
  }, [connectMutation.isError])

  useEffect(() => {
    if (!authMode || !dashboardHealthModel || !dashboardHealthUiConfig.enabled) {
      return
    }

    if (!dashboardHealthSnapshotLoggedRef.current) {
      logDashboardHealthSnapshotEvent({
        mode: authMode,
        range,
        health: dashboardHealthModel,
        uiConfig: dashboardHealthUiConfig,
      })
      dashboardHealthSnapshotLoggedRef.current = true
    }

    if (!dashboardHealthUiConfig.widgetBadgesEnabled) {
      return
    }

    for (const widget of Object.values(dashboardHealthModel.widgets)) {
      if (
        widget.status !== 'attention_required' ||
        dashboardHealthWidgetLoggedRef.current.has(widget.key)
      ) {
        continue
      }

      logDashboardHealthWidgetEvent({
        mode: authMode,
        range,
        widget,
      })
      dashboardHealthWidgetLoggedRef.current.add(widget.key)
    }
  }, [authMode, dashboardHealthModel, dashboardHealthUiConfig, range])

  const handleReconnectCta = () => {
    if (!authMode || !reconnectBannerState || reconnectBannerState === 'loading') {
      return
    }

    if (isDemo) {
      logReconnectBannerCtaClicked({
        mode: authMode,
        cta: 'reconnect',
        state: reconnectBannerState,
        fingerprint: reconnectFingerprint,
        requestId: null,
      })
      setDemoReconnectInfoVisible(true)
      return
    }

    const requestId = createPowensRequestId('reconnect')
    reconnectRequestIdRef.current = requestId

    logReconnectBannerCtaClicked({
      mode: authMode,
      cta: 'reconnect',
      state: reconnectBannerState,
      fingerprint: reconnectFingerprint,
      requestId,
    })

    connectMutation.mutate({ requestId })
  }

  const handleReconnectDefer = () => {
    if (!authMode || !reconnectBannerState) {
      return
    }

    logReconnectBannerCtaClicked({
      mode: authMode,
      cta: 'later',
      state: reconnectBannerState,
      fingerprint: reconnectFingerprint,
      requestId: reconnectRequestIdRef.current,
    })

    logReconnectBannerDismissed({
      mode: authMode,
      state: reconnectBannerState,
      fingerprint: reconnectFingerprint,
      requestId: reconnectRequestIdRef.current,
    })

    const snapshot = {
      fingerprint: reconnectFingerprint,
      deferredAt: new Date().toISOString(),
    }
    writeReconnectBannerDeferredSnapshot(snapshot)
    setDeferredSnapshot(snapshot)
    setDemoReconnectInfoVisible(false)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6">
        <header className="flex flex-col gap-4 rounded-lg border bg-card p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Finance OS Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              {isAuthPending
                ? 'Verification de la session en cours...'
                : isDemo
                  ? 'Mode demo: donnees mockees uniquement, actions sensibles desactivees.'
                  : 'Mode admin: acces complet DB + Powens.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center rounded-md border p-1">
              {RANGE_OPTIONS.map(option => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={range === option.value ? 'default' : 'ghost'}
                  onClick={() =>
                    navigate({
                      to: '/',
                      search: {
                        range: option.value,
                      },
                    })
                  }
                >
                  {option.label}
                </Button>
              ))}
            </div>

            {isAuthPending ? (
              <Button type="button" size="sm" variant="ghost" disabled>
                Session...
              </Button>
            ) : isDemo ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => navigate({ to: '/login', search: { reason: undefined } })}
              >
                Se connecter BigZoo
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
              >
                {logoutMutation.isPending ? 'Deconnexion...' : 'Logout'}
              </Button>
            )}
          </div>
        </header>

        {reconnectBannerUiEnabled && reconnectBannerState ? (
          <section
            className="rounded-lg border border-amber-500/40 bg-amber-50/80 p-4 dark:bg-amber-950/30"
            role={reconnectBannerState === 'required' || reconnectBannerState === 'error_retryable' ? 'alert' : 'status'}
            aria-live="polite"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                  {reconnectBannerState === 'loading'
                    ? "Verification de l'etat de reconnexion..."
                    : reconnectBannerState === 'in_progress'
                      ? 'Reconnexion Powens en cours...'
                      : reconnectBannerState === 'success'
                        ? 'Etape de reconnexion ouverte.'
                        : reconnectBannerState === 'error_retryable'
                          ? 'La tentative de reconnexion a echoue.'
                          : reconnectBannerState === 'deferred'
                            ? 'Reconnexion reportee pour cette alerte.'
                            : reconnectStatusUnavailable
                              ? 'Etat Powens indisponible, mais le dashboard reste utilisable.'
                              : 'Une reconnexion Powens est requise.'}
                </p>
                <p className="text-sm text-amber-800/90 dark:text-amber-200/90">
                  {reconnectBannerState === 'loading'
                    ? "Chargement de l'etat provider avec placeholders non bloquants."
                    : reconnectBannerState === 'in_progress'
                      ? 'Nous transmettons la demande de reconnexion avec un x-request-id dedie.'
                      : reconnectBannerState === 'success'
                        ? isDemo
                          ? 'Demo: ecran explicatif mock ouvert, sans appel DB/provider.'
                          : 'Redirection vers le flux provider.'
                        : reconnectBannerState === 'error_retryable'
                          ? 'Reessayez maintenant ou deferer pour continuer le dashboard.'
                          : reconnectBannerState === 'deferred'
                            ? 'Vous pouvez relancer la reconnexion plus tard depuis ce bandeau ou Ops overview.'
                            : reconnectStatusUnavailable
                              ? "Fallback texte statique actif tant que l'endpoint /integrations/powens/status est indisponible."
                              : `${reconnectRequiredConnectionIds.length} connexion(s) necessitent une reconnexion.`}
                </p>
                {demoReconnectInfoVisible ? (
                  <p className="text-xs text-amber-800/90 dark:text-amber-200/90">
                    Demo explicatif: la reconnexion reelle reste reservee au mode admin.
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  onClick={handleReconnectCta}
                  disabled={reconnectBannerState === 'loading' || reconnectBannerState === 'in_progress'}
                >
                  {reconnectBannerState === 'in_progress' ? 'Reconnexion...' : 'Reconnecter'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleReconnectDefer}
                  disabled={reconnectBannerState === 'loading' || reconnectBannerState === 'in_progress'}
                >
                  Plus tard
                </Button>
              </div>
            </div>

            {reconnectBannerState === 'loading' ? (
              <div className="mt-3 h-2 w-full animate-pulse rounded bg-amber-300/50 dark:bg-amber-700/50" />
            ) : null}
          </section>
        ) : null}

        {isDemo ? (
          <p className="text-xs text-muted-foreground">
            Actions sensibles bloquees en mode demo (sync Powens, connexion banque, callback).
          </p>
        ) : null}

        {isDemo ? (
          <Card className="border-amber-500/40 bg-[linear-gradient(120deg,rgba(245,158,11,0.18),rgba(234,88,12,0.14),rgba(245,158,11,0.1))]">
            <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                  <Badge className="bg-amber-500 text-black hover:bg-amber-500">DEMO</Badge>
                  Mode demonstration active
                </p>
                <p className="text-sm text-amber-900/95 dark:text-amber-100/90">
                  Mode demo - seul BigZoo peut voir les vraies donnees.
                </p>
                {isAuthUnavailable ? (
                  <p className="text-xs text-amber-800/90 dark:text-amber-200/90">
                    Auth indisponible temporairement: fallback demo active.
                  </p>
                ) : null}
              </div>
              <Button
                type="button"
                onClick={() => navigate({ to: '/login', search: { reason: undefined } })}
              >
                Se connecter BigZoo
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {dashboardHealthUiConfig.globalIndicatorEnabled && dashboardHealthModel ? (
          <DashboardHealthPanel demo={isDemo} health={dashboardHealthModel} />
        ) : null}

        <section>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Ops overview
                <DemoWidgetBadge demo={isDemo} />
              </CardTitle>
              <CardDescription>
                Vue admin unifiee pour la session, Powens et les operations de sync.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <div className="rounded-md border border-border/70 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Session</p>
                  <p className="font-medium">
                    {isAdmin ? 'Admin active' : isAuthPending ? 'Verification...' : 'Mode demo'}
                  </p>
                </div>
                <div className="rounded-md border border-border/70 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Safe mode</p>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={isIntegrationsSafeMode ? 'secondary' : 'outline'}
                      className={
                        isIntegrationsSafeMode
                          ? 'border-amber-500/60 bg-amber-400/15 text-amber-700 dark:text-amber-300'
                          : undefined
                      }
                    >
                      {isIntegrationsSafeMode ? 'ON' : 'OFF'}
                    </Badge>
                    {isIntegrationsSafeModeFallback ? (
                      <span className="text-xs text-muted-foreground">mock status fallback</span>
                    ) : null}
                  </div>
                </div>
                <div className="rounded-md border border-border/70 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Connexions Powens</p>
                  <p className="font-medium">{statusConnections.length}</p>
                  <p className="text-xs text-muted-foreground">
                    {statusCounts.connected} OK · {statusCounts.syncing} sync ·{' '}
                    {statusCounts.failing} a corriger
                  </p>
                </div>
                <div className="rounded-md border border-border/70 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">Dernier sync</p>
                    <Badge
                      variant={latestSyncStatus.badgeVariant}
                      className={latestSyncStatus.badgeClassName}
                    >
                      {latestSyncStatus.badgeLabel}
                    </Badge>
                  </div>
                  <p className="font-medium">{formatDateTime(latestSyncAt)}</p>
                  <p className="text-xs text-muted-foreground">{latestSyncStatus.summary}</p>
                  <p className="text-xs text-muted-foreground">{latestSyncStatus.details}</p>
                </div>
                <div className="rounded-md border border-border/70 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Dernier succes</p>
                  <p className="font-medium">{formatDateTime(latestSuccessAt)}</p>
                </div>
                <div className="rounded-md border border-border/70 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Dernier callback</p>
                  <p className="font-medium">
                    {latestCallbackFreshness ?? formatDateTime(latestCallback?.receivedAt ?? null)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {latestCallback
                      ? `${latestCallback.status} · ${formatDateTime(latestCallback.receivedAt)}`
                      : 'Aucun callback recu'}
                  </p>
                </div>
                <div className="rounded-md border border-border/70 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Etat securite</p>
                  <p className="font-medium">
                    {isIntegrationsSafeMode ? 'Safe mode actif' : 'Normal'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {latestCallback
                      ? `Request ${latestCallback.requestId}`
                      : 'Aucune reception tracee'}
                  </p>
                </div>
                <div className="rounded-md border border-border/70 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Queue backlog</p>
                  <p className="font-medium">{syncBacklogCount}</p>
                </div>
                {manualSyncCooldownUiConfig.enabled ? (
                  <div className="rounded-md border border-border/70 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">Sync guard UI</p>
                      <Badge
                        variant={manualSyncUiBadge.variant}
                        className={manualSyncUiBadge.className}
                      >
                        {manualSyncUiState.statusLabel}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {manualSyncUiState.statusMessage}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isDemo
                        ? 'Demo: timer local mocke, sans appel API.'
                        : 'Admin: garde locale non authoritative.'}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <GuardedActionWrapper
                    blockedTitle={manualSyncUiState.blockMessage}
                    onBlockedClick={
                      manualSyncUiState.blockReason ? () => handleBlockedSyncClick() : undefined
                    }
                  >
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => syncMutation.mutate({})}
                      disabled={manualSyncUiState.blocked}
                    >
                      {manualSyncButtonLabel}
                    </Button>
                  </GuardedActionWrapper>
                  <Button
                    type="button"
                    onClick={() => connectMutation.mutate({})}
                    disabled={!isAdmin || isIntegrationsSafeMode || connectMutation.isPending}
                    title={
                      !isAdmin
                        ? 'Action reservee au compte BigZoo'
                        : isIntegrationsSafeMode
                          ? 'Safe mode actif: integration externe desactivee'
                          : undefined
                    }
                  >
                    {connectMutation.isPending ? 'Ouverture...' : 'Connecter une banque'}
                  </Button>
                </div>
                {manualSyncUiState.blockMessage ? (
                  <p className="text-xs text-muted-foreground" aria-live="polite">
                    {manualSyncUiState.blockMessage}
                  </p>
                ) : null}
              </div>

              <div className="rounded-lg border border-border/70 bg-muted/15 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">Derived recompute</p>
                      <Badge
                        variant={derivedRecomputeBadge.variant}
                        className={derivedRecomputeBadge.className}
                      >
                        {derivedRecomputeBadge.label}
                      </Badge>
                      {!derivedRecomputeFeatureEnabled ? (
                        <Badge variant="outline">Flag OFF</Badge>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Recalcule les champs derives depuis `provider_raw_import` puis remplace le
                      snapshot actif de maniere atomique.
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant={derivedRecomputeState === 'failed' ? 'secondary' : 'outline'}
                    onClick={() => derivedRecomputeMutation.mutate()}
                    disabled={
                      !isAdmin ||
                      !derivedRecomputeFeatureEnabled ||
                      derivedRecomputeMutation.isPending
                    }
                    title={
                      !isAdmin
                        ? 'Action reservee au compte BigZoo'
                        : !derivedRecomputeFeatureEnabled
                          ? 'DERIVED_RECOMPUTE_ENABLED=false'
                          : undefined
                    }
                  >
                    {derivedRecomputeActionLabel}
                  </Button>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-md border border-border/70 px-3 py-2">
                    <p className="text-xs text-muted-foreground">Etat</p>
                    <p className="font-medium">{derivedRecomputeBadge.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {derivedRecomputeMutation.isPending
                        ? 'Requete admin en cours'
                        : formatDerivedRecomputeStage(derivedRecomputeLatestRun?.stage ?? null)}
                    </p>
                  </div>
                  <div className="rounded-md border border-border/70 px-3 py-2">
                    <p className="text-xs text-muted-foreground">Snapshot actif</p>
                    <p className="font-medium">
                      {derivedRecomputeCurrentSnapshot?.snapshotVersion ?? '-'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(derivedRecomputeCurrentSnapshot?.finishedAt ?? null)}
                    </p>
                  </div>
                  <div className="rounded-md border border-border/70 px-3 py-2">
                    <p className="text-xs text-muted-foreground">Dernier run</p>
                    <p className="font-medium">
                      {formatDateTime(derivedRecomputeLatestRun?.finishedAt ?? null)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {derivedRecomputeLatestRun
                        ? `${derivedRecomputeLatestRun.triggerSource} · ${derivedRecomputeLatestRun.requestId}`
                        : 'Aucun run enregistre'}
                    </p>
                  </div>
                  <div className="rounded-md border border-border/70 px-3 py-2">
                    <p className="text-xs text-muted-foreground">Comptage</p>
                    <p className="font-medium">
                      {derivedRecomputeCounts
                        ? `${derivedRecomputeCounts.transactionUpdatedCount} maj`
                        : '-'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {summarizeDerivedRecomputeRowCounts(derivedRecomputeCounts)}
                    </p>
                  </div>
                </div>

                {derivedRecomputeStatusQuery.isError ? (
                  <p className="mt-3 text-xs text-destructive">
                    {toErrorMessage(derivedRecomputeStatusQuery.error)}
                  </p>
                ) : null}

                {derivedRecomputeState === 'failed' ? (
                  <p className="mt-3 text-xs text-destructive">
                    {derivedRecomputeLatestRun?.safeErrorMessage ??
                      'Derived recompute failed. Snapshot remains unchanged.'}
                  </p>
                ) : null}

                {!derivedRecomputeFeatureEnabled ? (
                  <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
                    Kill-switch actif: `DERIVED_RECOMPUTE_ENABLED=false`. Le dernier snapshot valide
                    reste courant.
                  </p>
                ) : null}
              </div>

              {isIntegrationsSafeMode ? (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Safe mode integrations externes actif: connexions/sync Powens temporairement
                  bloquees.
                  {isIntegrationsSafeModeFallback
                    ? ' Les statuts affiches utilisent le fallback mock runtime.'
                    : ''}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Wealth overview
                <DemoWidgetBadge demo={isDemo} />
                {dashboardHealthModel ? (
                  <DashboardWidgetHealthBadge
                    enabled={dashboardHealthUiConfig.widgetBadgesEnabled}
                    widget={dashboardHealthModel.widgets.wealth_overview}
                  />
                ) : null}
              </CardTitle>
              <CardDescription>Total balance across all active connections.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {summaryQuery.isPending ? (
                <p className="text-sm text-muted-foreground">Chargement...</p>
              ) : null}
              {summaryQuery.isError ? (
                <p className="text-sm text-destructive">{toErrorMessage(summaryQuery.error)}</p>
              ) : null}
              {summary ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-3xl font-semibold">
                      {formatMoney(adaptedSummary.totals.balance)}
                    </p>
                    <Badge variant={wealthTrend === 'down' ? 'destructive' : 'secondary'}>
                      {wealthTrend === 'up'
                        ? '↑ Net worth up'
                        : wealthTrend === 'down'
                          ? '↓ Net worth down'
                          : '• Net worth flat'}
                    </Badge>
                  </div>
                  <Separator />
                  <div className="space-y-2 text-sm">
                    <p className="flex items-center justify-between">
                      <span>Income ({range})</span>
                      <span>{formatMoney(adaptedSummary.totals.incomes)}</span>
                    </p>
                    <p className="flex items-center justify-between">
                      <span>Expenses ({range})</span>
                      <span>{formatMoney(adaptedSummary.totals.expenses)}</span>
                    </p>
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Cashflow direction</span>
                        <span>
                          {cashflowDirection.direction === 'up'
                            ? '↑ Positive'
                            : cashflowDirection.direction === 'down'
                              ? '↓ Negative'
                              : '• Neutral'}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full border border-border/70 bg-muted/30">
                        <div className="flex h-full w-full">
                          <div
                            className="h-full bg-emerald-500/80"
                            style={{ width: `${cashflowDirection.incomeSharePercent}%` }}
                          />
                          <div
                            className="h-full bg-red-500/70"
                            style={{ width: `${cashflowDirection.expenseSharePercent}%` }}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Net cashflow: {formatMoney(cashflowDirection.net)}
                      </p>
                    </div>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>

          <WealthHistory
            range={range}
            snapshots={adaptedSummary.dailyWealthSnapshots}
            demo={isDemo}
          />

          <ExpenseStructureCard range={range} transactions={transactions} demo={isDemo} />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Top expense groups
                <DemoWidgetBadge demo={isDemo} />
              </CardTitle>
              <CardDescription>Top 5 groups in the selected range.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {adaptedSummary.topExpenseGroups.length ? (
                adaptedSummary.topExpenseGroups.map(group => (
                  <div
                    key={`${group.category}-${group.merchant}`}
                    className="flex items-center justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{group.label}</p>
                      <p className="text-xs text-muted-foreground">{group.count} transactions</p>
                    </div>
                    <p className="font-medium">{formatMoney(group.total)}</p>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">Aucune depense sur cette periode.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Derniers runs de sync
                <DemoWidgetBadge demo={isDemo} />
              </CardTitle>
              <CardDescription>Historique recent des synchronisations worker.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {syncRunsQuery.isPending ? (
                <p className="text-muted-foreground">Chargement...</p>
              ) : null}
              {syncRunsQuery.isError ? (
                <p className="text-destructive">{toErrorMessage(syncRunsQuery.error)}</p>
              ) : null}
              {!syncRunsQuery.isPending && syncRuns.length === 0 ? (
                <p className="text-muted-foreground">Aucun run de sync recent.</p>
              ) : null}
              {syncRuns.slice(0, 6).map(run => (
                <div key={run.id} className="rounded-md border border-border/80 bg-muted/20 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">Connection #{run.connectionId}</p>
                    <Badge
                      variant={
                        run.result === 'success'
                          ? 'secondary'
                          : run.result === 'running'
                            ? 'outline'
                            : 'destructive'
                      }
                    >
                      {run.result}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Start: {formatDateTime(run.startedAt)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    End: {formatDateTime(run.endedAt)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Notifications internes
                <DemoWidgetBadge demo={isDemo} />
              </CardTitle>
              <CardDescription>
                Alertes prioritaires pour les connexions en erreur et reconnect_required.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {statusQuery.isPending || syncRunsQuery.isPending ? (
                <p className="text-muted-foreground">Chargement...</p>
              ) : null}
              {statusQuery.isError || syncRunsQuery.isError ? (
                <p className="text-destructive">Impossible de calculer les notifications.</p>
              ) : null}
              {!statusQuery.isPending &&
              !syncRunsQuery.isPending &&
              !statusQuery.isError &&
              !syncRunsQuery.isError &&
              powensInternalNotifications.length === 0 ? (
                <p className="text-muted-foreground">Aucune notification interne active.</p>
              ) : null}
              {powensInternalNotifications.map(notification => (
                <div
                  key={notification.id}
                  className="rounded-md border border-border/80 bg-muted/20 p-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{notification.title}</p>
                    <Badge variant={notification.level === 'critical' ? 'destructive' : 'outline'}>
                      {notification.level === 'critical' ? 'critique' : 'warning'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Connexion: {notification.connectionId}
                  </p>
                  <p className="text-xs text-muted-foreground">{notification.detail}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Erreurs recentes par fingerprint
                <DemoWidgetBadge demo={isDemo} />
              </CardTitle>
              <CardDescription>
                Regroupement des echecs de sync par signature d'erreur.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {syncRunsQuery.isPending ? (
                <p className="text-muted-foreground">Chargement...</p>
              ) : null}
              {syncRunsQuery.isError ? (
                <p className="text-destructive">{toErrorMessage(syncRunsQuery.error)}</p>
              ) : null}
              {!syncRunsQuery.isPending && recentErrorsByFingerprint.length === 0 ? (
                <p className="text-muted-foreground">Aucune erreur recente avec fingerprint.</p>
              ) : null}
              {recentErrorsByFingerprint.map(entry => (
                <div
                  key={entry.fingerprint}
                  className="rounded-md border border-border/80 bg-muted/20 p-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-medium">{entry.fingerprint}</p>
                    <Badge variant="destructive">{entry.count}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Derniere occurrence: {formatDateTime(entry.latestAt)}
                  </p>
                  <p className="text-xs text-destructive">{entry.message}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Audit trail admin
                <DemoWidgetBadge demo={isDemo} />
              </CardTitle>
              <CardDescription>
                Historique des actions critiques (connect URL, sync, callback).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {auditTrailQuery.isPending ? (
                <p className="text-muted-foreground">Chargement...</p>
              ) : null}
              {auditTrailQuery.isError ? (
                <p className="text-destructive">{toErrorMessage(auditTrailQuery.error)}</p>
              ) : null}
              {!auditTrailQuery.isPending && auditEvents.length === 0 ? (
                <p className="text-muted-foreground">Aucun evenement critique recent.</p>
              ) : null}
              {auditEvents.slice(0, 10).map(event => (
                <div key={event.id} className="rounded-md border border-border/80 bg-muted/20 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">
                      {event.action} · {event.actorMode}
                    </p>
                    <Badge variant={event.result === 'allowed' ? 'secondary' : 'destructive'}>
                      {event.result}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">At: {formatDateTime(event.at)}</p>
                  <p className="text-xs text-muted-foreground">Request: {event.requestId}</p>
                  {event.connectionId ? (
                    <p className="text-xs text-muted-foreground">
                      Connection: {event.connectionId}
                    </p>
                  ) : null}
                  {event.details ? (
                    <p className="text-xs text-muted-foreground">Detail: {event.details}</p>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>


          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Diagnostic provider
                <DemoWidgetBadge demo={isDemo} />
              </CardTitle>
              <CardDescription>
                Runtime diagnostic snapshot with explicit degraded-but-usable guidance.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {diagnosticsQuery.isPending ? <p className="text-muted-foreground">Chargement...</p> : null}
              {diagnosticsQuery.isError ? (
                <p className="text-destructive">{toErrorMessage(diagnosticsQuery.error)}</p>
              ) : null}
              {diagnostics ? (
                <div className="space-y-2 rounded-md border border-border/80 bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{diagnostics.provider === 'mock' ? 'MockDiagnosticProvider' : 'PowensDiagnosticProvider'}</p>
                    <Badge variant={diagnosticsOutcomeBadge[diagnostics.outcome].variant}>
                      {diagnosticsOutcomeBadge[diagnostics.outcome].label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Last checked: {formatDateTime(diagnostics.lastCheckedAt)}</p>
                  <p className="text-xs text-muted-foreground">{diagnostics.guidance}</p>
                  {diagnostics.issueType === 'timeout' ? (
                    <p className="text-xs text-amber-700 dark:text-amber-300">Timeout reseau detecte. Les donnees restent utilisables.</p>
                  ) : null}
                  {diagnostics.issueType === 'auth' ? (
                    <p className="text-xs text-destructive">Probleme credentials/auth detecte. Reconnexion admin requise.</p>
                  ) : null}
                  {!diagnostics.enabled ? (
                    <p className="text-xs text-muted-foreground">Diagnostics temporarily disabled. UI shell remains available.</p>
                  ) : null}
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => diagnosticsQuery.refetch()}
                      disabled={diagnosticsQuery.isFetching || diagnostics.retryable === false}
                    >
                      Retry diagnostics
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Connections state
                <DemoWidgetBadge demo={isDemo} />
                {dashboardHealthModel ? (
                  <DashboardWidgetHealthBadge
                    enabled={dashboardHealthUiConfig.widgetBadgesEnabled}
                    widget={dashboardHealthModel.widgets.connections_state}
                  />
                ) : null}
              </CardTitle>
              <CardDescription>Powens statuses and last sync timestamps.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {statusQuery.isPending ? (
                <p className="text-muted-foreground">Chargement...</p>
              ) : null}
              {statusQuery.isError ? (
                <p className="text-destructive">{toErrorMessage(statusQuery.error)}</p>
              ) : null}
              {!statusQuery.isPending && statusConnections.length === 0 ? (
                <p className="text-muted-foreground">Aucune connexion Powens.</p>
              ) : null}
              {statusConnections.map(connection => {
                const syncBadge = getPowensConnectionSyncBadgeModel({
                  connection,
                  persistenceEnabled: syncStatusPersistenceEnabled,
                })

                return (
                  <div
                    key={connection.id}
                    className="space-y-2 rounded-md border border-border/80 bg-muted/20 p-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          {connection.providerInstitutionName ??
                            `Connection #${connection.powensConnectionId}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {connection.provider} • ref {connection.providerConnectionId}
                        </p>
                      </div>
                      <Badge
                        variant={syncBadge.badgeVariant}
                        className={syncBadge.badgeClassName}
                        title={syncBadge.tooltipLabel}
                      >
                        {syncBadge.badgeLabel}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{syncBadge.reasonLabel}</p>
                    <p className="text-xs text-muted-foreground">
                      Last attempt: {formatDateTime(connection.lastSyncAttemptAt)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Last sync: {formatDateTime(connection.lastSyncAt)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Last success: {formatDateTime(connection.lastSuccessAt)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Balance:{' '}
                      {formatMoney(connectionBalanceById.get(connection.powensConnectionId) ?? 0)}
                    </p>
                    {connection.lastError ? (
                      <p className="text-xs text-destructive">Error: {connection.lastError}</p>
                    ) : null}
                    <details className="rounded-md border border-border/70 bg-background/60 p-2 text-xs">
                      <summary className="cursor-pointer font-medium text-foreground">
                        Diagnostic connexion
                      </summary>
                      <div className="mt-2 space-y-2 text-muted-foreground">
                        <p>Connection ID: {connection.powensConnectionId}</p>
                        <p>Provider ID: {connection.providerConnectionId}</p>
                        <p>Source: {connection.source}</p>
                        <p>Runtime status: {connection.status}</p>
                        <p>Created: {formatDateTime(connection.createdAt)}</p>
                        <p>Updated: {formatDateTime(connection.updatedAt)}</p>
                        {formatDiagnosticMetadata(connection.syncMetadata) ? (
                          <p>Sync metadata: {formatDiagnosticMetadata(connection.syncMetadata)}</p>
                        ) : null}
                        {(() => {
                          const connectionRuns =
                            syncRunsByConnectionId.get(connection.powensConnectionId) ?? []
                          if (!connectionRuns.length) {
                            return <p>Timeline sync: aucun run recent sur cette connexion.</p>
                          }

                          return (
                            <div className="space-y-2">
                              <p className="font-medium text-foreground">Timeline sync recente</p>
                              <ol className="space-y-2">
                                {connectionRuns.slice(0, 5).map(run => (
                                  <li
                                    key={run.id}
                                    className="rounded border border-border/60 bg-background/70 p-2"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <Badge variant={SYNC_RUN_STATUS_VARIANT[run.result]}>
                                        {run.result}
                                      </Badge>
                                      <span className="text-[11px]">
                                        Debut: {formatDateTime(run.startedAt)}
                                      </span>
                                    </div>
                                    <p>
                                      Fin:{' '}
                                      {run.endedAt
                                        ? formatDateTime(run.endedAt)
                                        : 'Encore en cours'}
                                      {formatDuration(run.startedAt, run.endedAt)
                                        ? ` · Duree ${formatDuration(run.startedAt, run.endedAt)}`
                                        : ''}
                                    </p>
                                    {run.requestId ? <p>Request: {run.requestId}</p> : null}
                                    {run.errorFingerprint ? (
                                      <p>Fingerprint: {run.errorFingerprint}</p>
                                    ) : null}
                                    {run.errorMessage ? (
                                      <p className="text-destructive">Erreur: {run.errorMessage}</p>
                                    ) : null}
                                  </li>
                                ))}
                              </ol>
                            </div>
                          )
                        })()}
                      </div>
                    </details>
                    <div className="mt-2 flex justify-end">
                      <GuardedActionWrapper
                        blockedTitle={manualSyncUiState.blockMessage}
                        onBlockedClick={
                          manualSyncUiState.blockReason
                            ? () =>
                                handleBlockedSyncClick({
                                  connectionId: connection.powensConnectionId,
                                })
                            : undefined
                        }
                      >
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={manualSyncUiState.blocked}
                          onClick={() =>
                            syncMutation.mutate({
                              connectionId: connection.powensConnectionId,
                            })
                          }
                        >
                          {connectionSyncButtonLabel}
                        </Button>
                      </GuardedActionWrapper>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <PersonalFinancialGoalsCard authMode={authMode} isAdmin={isAdmin} isDemo={isDemo} />
          </div>
          <div className="lg:col-span-2">
            <MonthlyCategoryBudgetsCard
              isAdmin={isAdmin}
              isDemo={isDemo}
              transactions={transactions}
            />
          </div>
          <div className="lg:col-span-2">
            <MonthEndProjectionCard isAdmin={isAdmin} transactions={transactions} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Balance by connection
                <DemoWidgetBadge demo={isDemo} />
              </CardTitle>
              <CardDescription>Fortuneo/Revolut totals from local DB.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {adaptedSummary.connections.length ? (
                adaptedSummary.connections.map(connection => (
                  <div
                    key={connection.powensConnectionId}
                    className="flex items-center justify-between rounded-md border border-border/70 px-3 py-2"
                  >
                    <div>
                      <p className="font-medium">
                        {connection.providerInstitutionName ??
                          `Connection #${connection.powensConnectionId}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {connection.provider} • {connection.accountCount} accounts
                      </p>
                    </div>
                    <p className="font-medium">{formatMoney(connection.balance)}</p>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">Aucune connexion active.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Assets overview
                <DemoWidgetBadge demo={isDemo} />
              </CardTitle>
              <CardDescription>
                Unified assets across provider cash, investment snapshots, and manual holdings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {adaptedSummary.assets.length ? (
                adaptedSummary.assets.map(asset => {
                  const assetPositions = positionsByAssetId.get(asset.assetId) ?? []

                  return (
                    <div
                      key={asset.assetId}
                      className="space-y-2 rounded-md border border-border/70 px-3 py-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-medium">{asset.name}</p>
                            <Badge variant="outline">{ASSET_TYPE_LABEL[asset.type]}</Badge>
                            <Badge variant="secondary">{ASSET_ORIGIN_LABEL[asset.origin]}</Badge>
                            {assetPositions.length > 0 ? (
                              <Badge variant="outline">{assetPositions.length} position(s)</Badge>
                            ) : null}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {asset.providerInstitutionName ??
                              asset.providerConnectionId ??
                              (asset.origin === 'manual' ? 'Manual entry' : asset.source)}
                            {asset.powensAccountId ? ` • #${asset.powensAccountId}` : ''}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {asset.valuationAsOf
                              ? `Valuation: ${formatDateTime(asset.valuationAsOf)}`
                              : 'Valuation: snapshot manuel'}
                          </p>
                        </div>
                        <p className="whitespace-nowrap font-medium">
                          {formatMoney(asset.valuation, asset.currency)}
                        </p>
                      </div>

                      {assetPositions.length > 0 ? (
                        <div className="space-y-2 border-t border-border/60 pt-2">
                          {assetPositions.map(position => (
                            <div
                              key={position.positionId}
                              className="grid gap-2 rounded-md bg-muted/20 p-2 md:grid-cols-2 xl:grid-cols-4"
                            >
                              <div>
                                <p className="text-xs font-medium">{position.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {position.accountName ?? position.assetName ?? 'Position'}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Quantite</p>
                                <p className="font-medium">{formatQuantity(position.quantity)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">
                                  {COST_BASIS_LABEL[position.costBasisSource]}
                                </p>
                                <p className="font-medium">
                                  {position.costBasis === null
                                    ? '-'
                                    : formatMoney(position.costBasis, position.currency)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Valeur</p>
                                <p className="font-medium">
                                  {position.currentValue === null &&
                                  position.lastKnownValue === null
                                    ? '-'
                                    : formatMoney(
                                        position.currentValue ?? position.lastKnownValue ?? 0,
                                        position.currency
                                      )}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {position.valuedAt
                                    ? `Valorisee le ${formatDateTime(position.valuedAt)}`
                                    : position.lastSyncedAt
                                      ? `Derniere sync ${formatDateTime(position.lastSyncedAt)}`
                                      : 'Sans date de valorisation'}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )
                })
              ) : (
                <p className="text-muted-foreground">Aucun asset actif.</p>
              )}
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Investment positions
                <DemoWidgetBadge demo={isDemo} />
                {dashboardHealthModel ? (
                  <DashboardWidgetHealthBadge
                    enabled={dashboardHealthUiConfig.widgetBadgesEnabled}
                    widget={dashboardHealthModel.widgets.investment_positions}
                  />
                ) : null}
              </CardTitle>
              <CardDescription>
                Quantite, cout de base et derniere valeur connue pour chaque ligne d'investissement.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {summaryQuery.isPending ? (
                <p className="text-sm text-muted-foreground">Chargement...</p>
              ) : null}
              {summaryQuery.isError ? (
                <p className="text-sm text-destructive">{toErrorMessage(summaryQuery.error)}</p>
              ) : null}
              {!summaryQuery.isPending && positions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucune position d'investissement active.
                </p>
              ) : null}

              {positions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-left text-muted-foreground">
                      <tr>
                        <th className="py-2 pr-3">Position</th>
                        <th className="py-2 pr-3">Asset / compte</th>
                        <th className="py-2 pr-3 text-right">Quantite</th>
                        <th className="py-2 pr-3 text-right">Cout</th>
                        <th className="py-2 pr-3 text-right">Valeur</th>
                        <th className="py-2">Dates</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map(position => (
                        <tr
                          key={position.positionId}
                          className="border-t border-border/70 align-top"
                        >
                          <td className="py-2 pr-3">
                            <p className="font-medium">{position.name}</p>
                            <p className="text-xs text-muted-foreground">{position.positionKey}</p>
                          </td>
                          <td className="py-2 pr-3">
                            <p>{position.assetName ?? '-'}</p>
                            <p className="text-xs text-muted-foreground">
                              {position.accountName ?? '-'}
                            </p>
                          </td>
                          <td className="py-2 pr-3 text-right font-medium">
                            {formatQuantity(position.quantity)}
                          </td>
                          <td className="py-2 pr-3 text-right">
                            <p className="font-medium">
                              {position.costBasis === null
                                ? '-'
                                : formatMoney(position.costBasis, position.currency)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {COST_BASIS_LABEL[position.costBasisSource]}
                            </p>
                          </td>
                          <td className="py-2 pr-3 text-right">
                            <p className="font-medium">
                              {position.currentValue === null && position.lastKnownValue === null
                                ? '-'
                                : formatMoney(
                                    position.currentValue ?? position.lastKnownValue ?? 0,
                                    position.currency
                                  )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {position.currentValue !== null ? 'Courante' : 'Derniere connue'}
                            </p>
                          </td>
                          <td className="py-2 text-xs text-muted-foreground">
                            <p>Ouverte: {formatDateTime(position.openedAt)}</p>
                            <p>Valorisee: {formatDateTime(position.valuedAt)}</p>
                            <p>Sync: {formatDateTime(position.lastSyncedAt)}</p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Latest transactions
                <DemoWidgetBadge demo={isDemo} />
                {transactionsFreshnessBadge ? (
                  <Badge
                    variant={transactionsFreshnessBadge.variant}
                    className={transactionsFreshnessBadge.className}
                  >
                    {transactionsFreshnessBadge.label}
                  </Badge>
                ) : null}
              </CardTitle>
              <CardDescription>
                Last 30 transactions, paginated with cursor.
                {transactionsFreshness
                  ? ` Last updated: ${formatDateTime(transactionsFreshness.lastSyncedAt)}.`
                  : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {isDemo ? (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  Demo scenario
                  <select
                    className="rounded border bg-background px-2 py-1 text-xs"
                    value={demoTransactionsScenario}
                    onChange={event =>
                      setDemoTransactionsScenario(event.target.value as DemoTransactionsScenario)
                    }
                  >
                    {DEMO_SCENARIO_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {transactionsDemoFixture?.degradedFallback ? (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Demo fixture degraded to legacy fallback ({transactionsDemoFixture.degradedReason ?? 'unknown'}).
                </p>
              ) : null}
              {transactionsFreshness?.refreshRequested ? (
                <p className="text-xs text-muted-foreground">
                  Snapshot stale detected: background Powens refresh requested.
                </p>
              ) : null}
              {transactionsQuery.isPending ? (
                <p className="text-sm text-muted-foreground">Chargement...</p>
              ) : null}
              {transactionsQuery.isError ? (
                <p className="text-sm text-destructive">
                  {toErrorMessage(transactionsQuery.error)}
                </p>
              ) : null}
              {!transactionsQuery.isPending && transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucune transaction sur cette periode.
                </p>
              ) : null}

              {transactions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-left text-muted-foreground">
                      <tr>
                        <th className="py-2 pr-3">Date</th>
                        <th className="py-2 pr-3">Label</th>
                        <th className="py-2 pr-3">Account</th>
                        <th className="py-2 pr-3">Classification</th>
                        <th className="py-2 pr-3">Connection</th>
                        <th className="py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map(transaction => (
                        <tr key={transaction.id} className="border-t border-border/70">
                          <td className="py-2 pr-3 whitespace-nowrap">
                            {formatDate(transaction.bookingDate)}
                          </td>
                          <td className="py-2 pr-3">{transaction.label}</td>
                          <td className="py-2 pr-3">
                            {transaction.accountName ?? transaction.powensAccountId}
                          </td>
                          <td className="py-2 pr-3">
                            <div className="space-y-1">
                              <p className="text-xs">
                                {transaction.category ?? 'Sans categorie'}
                                {transaction.subcategory ? ` / ${transaction.subcategory}` : ''}
                              </p>
                              <div className="flex flex-wrap items-center gap-1">
                                <Badge variant="outline">
                                  {transaction.resolutionSource === 'manual_override'
                                    ? 'Manual'
                                    : transaction.resolutionSource === 'merchant_rules'
                                      ? 'Merchant Rule'
                                      : transaction.resolutionSource === 'mcc'
                                        ? 'MCC'
                                        : transaction.resolutionSource === 'counterparty'
                                          ? 'Counterparty'
                                          : 'Fallback'}
                                </Badge>
                                <details className="text-xs text-muted-foreground">
                                  <summary className="cursor-pointer">Why this category?</summary>
                                  <ul className="mt-1 space-y-0.5">
                                    {transaction.resolutionTrace.map(step => (
                                      <li key={`${transaction.id}-${step.source}-${step.rank}`}>
                                        {step.rank}. {step.source} — {step.matched ? 'matched' : 'skipped'} ({step.reason})
                                      </li>
                                    ))}
                                  </ul>
                                </details>
                              </div>
                              {transaction.direction === 'income' ? (
                                <Badge variant="secondary">
                                  Revenu {transaction.incomeType ?? 'exceptional'}
                                </Badge>
                              ) : null}
                              {transaction.tags.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {transaction.tags.map(tag => (
                                    <Badge key={`${transaction.id}-${tag}`} variant="outline">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              ) : null}
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={!isAdmin || classifyTransactionMutation.isPending}
                                onClick={() => classifyTransactionMutation.mutate(transaction)}
                              >
                                Editer
                              </Button>
                            </div>
                          </td>
                          <td className="py-2 pr-3">{transaction.powensConnectionId}</td>
                          <td
                            className={
                              transaction.direction === 'expense'
                                ? 'py-2 text-right font-medium text-destructive'
                                : 'py-2 text-right font-medium text-emerald-500'
                            }
                          >
                            {formatMoney(transaction.amount, transaction.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {transactionsQuery.hasNextPage ? (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => transactionsQuery.fetchNextPage()}
                    disabled={transactionsQuery.isFetchingNextPage}
                  >
                    {transactionsQuery.isFetchingNextPage ? 'Loading...' : 'Load more'}
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  )
}
