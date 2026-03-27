import type { AuthMode } from '@/features/auth-types'
import type {
  DashboardDerivedRecomputeStatusResponse,
  DashboardRange,
  DashboardSummaryResponse,
} from '@/features/dashboard-types'
import type { PowensStatusResponse, PowensSyncRun } from '@/features/powens/types'
import { readPublicRuntimeEnv } from '@/lib/public-runtime-env'

const STALE_SYNC_THRESHOLD_MS = 36 * 60 * 60 * 1000
const DERIVED_LAG_THRESHOLD_MS = 10 * 60 * 1000

export type DashboardHealthReasonCode =
  | 'STALE_SYNC'
  | 'MISSING_SOURCE'
  | 'PARTIAL_IMPORT'
  | 'SAFE_MODE_ACTIVE'
  | 'DERIVED_FAILURE'

export type DashboardHealthStatus = 'healthy' | 'attention_required'
export type DashboardHealthDomainKey = 'sync' | 'portfolio' | 'derived'
export type DashboardHealthWidgetKey =
  | 'wealth_overview'
  | 'connections_state'
  | 'investment_positions'

export type DashboardHealthUiConfig = {
  enabled: boolean
  globalIndicatorEnabled: boolean
  widgetBadgesEnabled: boolean
}

export type DashboardHealthSignal = {
  label: string
  status: DashboardHealthStatus
  reasons: DashboardHealthReasonCode[]
  headline: string
  detail: string
}

export type DashboardHealthDomainSignal = DashboardHealthSignal & {
  key: DashboardHealthDomainKey
}

export type DashboardHealthWidgetSignal = DashboardHealthSignal & {
  key: DashboardHealthWidgetKey
  domainKey: DashboardHealthDomainKey
  badgeLabel: string | null
}

export type DashboardHealthModel = {
  isDemoFixture: boolean
  global: DashboardHealthSignal
  domains: Record<DashboardHealthDomainKey, DashboardHealthDomainSignal>
  widgets: Record<DashboardHealthWidgetKey, DashboardHealthWidgetSignal>
}

type BuildDashboardHealthModelInput = {
  mode: AuthMode
  summary?: DashboardSummaryResponse
  status?: PowensStatusResponse
  syncRuns?: PowensSyncRun[]
  derivedStatus?: DashboardDerivedRecomputeStatusResponse
  summaryUnavailable?: boolean
  statusUnavailable?: boolean
  syncRunsUnavailable?: boolean
  derivedUnavailable?: boolean
  nowMs?: number
}

type DashboardHealthEventInput = {
  mode: AuthMode
  range: DashboardRange
}

const DASHBOARD_HEALTH_EVENT_SCOPE = '[web:dashboard-health]'

const REASON_BADGE_LABEL: Record<DashboardHealthReasonCode, string> = {
  STALE_SYNC: 'Stale sync',
  MISSING_SOURCE: 'Source missing',
  PARTIAL_IMPORT: 'Partial import',
  SAFE_MODE_ACTIVE: 'Safe mode',
  DERIVED_FAILURE: 'Derived failure',
}

const REASON_DETAIL: Record<DashboardHealthReasonCode, string> = {
  STALE_SYNC: 'Freshness is older than the dashboard sync threshold.',
  MISSING_SOURCE: 'A required source is missing from the current dashboard view.',
  PARTIAL_IMPORT: 'Some sources are still syncing or only partially reflected.',
  SAFE_MODE_ACTIVE: 'External integrations are temporarily disabled by safe mode.',
  DERIVED_FAILURE: 'The latest derived snapshot refresh failed.',
}

const HEALTHY_DETAIL: Record<DashboardHealthDomainKey, string> = {
  sync: 'Powens connections and recent sync activity look aligned.',
  portfolio: 'Wealth data is populated from the expected sources.',
  derived: 'Investment positions and derived snapshot freshness look aligned.',
}

const WIDGET_LABEL: Record<DashboardHealthWidgetKey, string> = {
  wealth_overview: 'Wealth overview',
  connections_state: 'Connections state',
  investment_positions: 'Investment positions',
}

const DOMAIN_LABEL: Record<DashboardHealthDomainKey, string> = {
  sync: 'Sync health',
  portfolio: 'Wealth data',
  derived: 'Derived positions',
}

const DEMO_HEALTH_FIXTURE: DashboardHealthModel = {
  isDemoFixture: true,
  global: {
    label: 'Dashboard health',
    status: 'attention_required',
    reasons: ['STALE_SYNC', 'PARTIAL_IMPORT'],
    headline: 'Attention required',
    detail:
      'Demo uses a deterministic fixture matrix for sync freshness and partial-import signals.',
  },
  domains: {
    sync: {
      key: 'sync',
      label: DOMAIN_LABEL.sync,
      status: 'attention_required',
      reasons: ['STALE_SYNC'],
      headline: `${DOMAIN_LABEL.sync} needs attention`,
      detail: REASON_DETAIL.STALE_SYNC,
    },
    portfolio: {
      key: 'portfolio',
      label: DOMAIN_LABEL.portfolio,
      status: 'attention_required',
      reasons: ['PARTIAL_IMPORT'],
      headline: `${DOMAIN_LABEL.portfolio} needs attention`,
      detail: REASON_DETAIL.PARTIAL_IMPORT,
    },
    derived: {
      key: 'derived',
      label: DOMAIN_LABEL.derived,
      status: 'healthy',
      reasons: [],
      headline: `${DOMAIN_LABEL.derived} healthy`,
      detail: HEALTHY_DETAIL.derived,
    },
  },
  widgets: {
    wealth_overview: {
      key: 'wealth_overview',
      label: WIDGET_LABEL.wealth_overview,
      domainKey: 'portfolio',
      status: 'attention_required',
      reasons: ['PARTIAL_IMPORT'],
      headline: `${WIDGET_LABEL.wealth_overview} needs attention`,
      detail: REASON_DETAIL.PARTIAL_IMPORT,
      badgeLabel: REASON_BADGE_LABEL.PARTIAL_IMPORT,
    },
    connections_state: {
      key: 'connections_state',
      label: WIDGET_LABEL.connections_state,
      domainKey: 'sync',
      status: 'attention_required',
      reasons: ['STALE_SYNC'],
      headline: `${WIDGET_LABEL.connections_state} needs attention`,
      detail: REASON_DETAIL.STALE_SYNC,
      badgeLabel: REASON_BADGE_LABEL.STALE_SYNC,
    },
    investment_positions: {
      key: 'investment_positions',
      label: WIDGET_LABEL.investment_positions,
      domainKey: 'derived',
      status: 'healthy',
      reasons: [],
      headline: `${WIDGET_LABEL.investment_positions} healthy`,
      detail: HEALTHY_DETAIL.derived,
      badgeLabel: null,
    },
  },
}

const toTimestamp = (value: string | null | undefined) => {
  if (!value) {
    return Number.NEGATIVE_INFINITY
  }

  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY
}

const dedupeReasons = (reasons: DashboardHealthReasonCode[]) => {
  return [...new Set(reasons)]
}

const hasTransactionGapSignal = (value: Record<string, unknown> | null | undefined) => {
  if (!value) {
    return false
  }

  return value.transactionGapDetected === true
}

const describeReasons = (reasons: DashboardHealthReasonCode[]) => {
  return dedupeReasons(reasons)
    .map(reason => REASON_DETAIL[reason])
    .join(' ')
}

const buildSignal = ({
  key,
  label,
  reasons,
}: {
  key: DashboardHealthDomainKey | DashboardHealthWidgetKey
  label: string
  reasons: DashboardHealthReasonCode[]
}) => {
  const normalizedReasons = dedupeReasons(reasons)
  const status: DashboardHealthStatus =
    normalizedReasons.length > 0 ? 'attention_required' : 'healthy'

  return {
    key,
    label,
    status,
    reasons: normalizedReasons,
    headline: status === 'healthy' ? `${label} healthy` : `${label} needs attention`,
    detail:
      status === 'healthy'
        ? HEALTHY_DETAIL[
            (key === 'wealth_overview'
              ? 'portfolio'
              : key === 'connections_state'
                ? 'sync'
                : key === 'investment_positions'
                  ? 'derived'
                  : key) as DashboardHealthDomainKey
          ]
        : describeReasons(normalizedReasons),
  }
}

const buildWidgetSignal = ({
  key,
  domainKey,
  reasons,
}: {
  key: DashboardHealthWidgetKey
  domainKey: DashboardHealthDomainKey
  reasons: DashboardHealthReasonCode[]
}): DashboardHealthWidgetSignal => {
  const base = buildSignal({
    key,
    label: WIDGET_LABEL[key],
    reasons,
  })

  return {
    key,
    label: base.label,
    status: base.status,
    reasons: base.reasons,
    headline: base.headline,
    detail: base.detail,
    domainKey,
    badgeLabel:
      base.status === 'attention_required' && base.reasons[0]
        ? REASON_BADGE_LABEL[base.reasons[0]]
        : null,
  }
}

const pickLatestTimestamp = (values: Array<string | null | undefined>) => {
  const latest = values.reduce(
    (max, value) => Math.max(max, toTimestamp(value)),
    Number.NEGATIVE_INFINITY
  )
  return Number.isFinite(latest) ? latest : null
}

const getLatestSyncRun = (runs: PowensSyncRun[]) => {
  return [...runs].sort(
    (left, right) => toTimestamp(right.startedAt) - toTimestamp(left.startedAt)
  )[0]
}

const isOlderThanThreshold = ({
  timestamp,
  nowMs,
  thresholdMs,
}: {
  timestamp: number | null
  nowMs: number
  thresholdMs: number
}) => {
  if (timestamp === null) {
    return false
  }

  return nowMs - timestamp > thresholdMs
}

const getSyncDomainReasons = ({
  nowMs,
  status,
  syncRuns,
  statusUnavailable,
  syncRunsUnavailable,
}: {
  nowMs: number
  status: PowensStatusResponse | undefined
  syncRuns: PowensSyncRun[]
  statusUnavailable: boolean
  syncRunsUnavailable: boolean
}) => {
  if (statusUnavailable || syncRunsUnavailable) {
    return ['MISSING_SOURCE'] satisfies DashboardHealthReasonCode[]
  }

  const connections = status?.connections ?? []
  if (connections.length === 0) {
    return ['MISSING_SOURCE'] satisfies DashboardHealthReasonCode[]
  }

  const reasons: DashboardHealthReasonCode[] = []
  const latestSuccessTimestamp = pickLatestTimestamp(
    connections.map(connection => connection.lastSuccessAt)
  )
  const failingCount = connections.filter(
    connection => connection.status === 'error' || connection.status === 'reconnect_required'
  ).length
  const syncingCount = connections.filter(connection => connection.status === 'syncing').length
  const latestRun = getLatestSyncRun(syncRuns)

  if (status?.safeModeActive) {
    reasons.push('SAFE_MODE_ACTIVE')
  }

  if (latestSuccessTimestamp === null) {
    reasons.push('MISSING_SOURCE')
  } else if (
    isOlderThanThreshold({
      timestamp: latestSuccessTimestamp,
      nowMs,
      thresholdMs: STALE_SYNC_THRESHOLD_MS,
    })
  ) {
    reasons.push('STALE_SYNC')
  }

  if (
    failingCount > 0 ||
    syncingCount > 0 ||
    latestRun?.result === 'running' ||
    latestRun?.result === 'error' ||
    latestRun?.result === 'reconnect_required' ||
    connections.some(connection => hasTransactionGapSignal(connection.syncMetadata))
  ) {
    reasons.push('PARTIAL_IMPORT')
  }

  return reasons
}

const getPortfolioDomainReasons = ({
  nowMs,
  summary,
  status,
  summaryUnavailable,
}: {
  nowMs: number
  summary: DashboardSummaryResponse | undefined
  status: PowensStatusResponse | undefined
  summaryUnavailable: boolean
}) => {
  if (summaryUnavailable) {
    return ['MISSING_SOURCE'] satisfies DashboardHealthReasonCode[]
  }

  const assets = summary?.assets ?? []
  const positions = summary?.positions ?? []
  const summaryConnections = summary?.connections ?? []
  const statusConnections = status?.connections ?? []
  const providerAssets = assets.filter(asset => asset.origin === 'provider')
  const visibleProviderConnectionIds = new Set(
    providerAssets.flatMap(asset => (asset.powensConnectionId ? [asset.powensConnectionId] : []))
  )
  const trackedConnectionIds = new Set(
    summaryConnections.map(connection => connection.powensConnectionId)
  )
  const reasons: DashboardHealthReasonCode[] = []

  if (
    statusConnections.length > 0 &&
    assets.length === 0 &&
    positions.length === 0 &&
    summaryConnections.length === 0
  ) {
    reasons.push('MISSING_SOURCE')
  }

  if (assets.length === 0 && positions.length === 0 && statusConnections.length === 0) {
    reasons.push('MISSING_SOURCE')
  }

  const missingTrackedConnections = statusConnections.some(
    connection => !trackedConnectionIds.has(connection.powensConnectionId)
  )
  const missingVisibleAssets = statusConnections.some(
    connection => !visibleProviderConnectionIds.has(connection.powensConnectionId)
  )
  if (missingTrackedConnections || missingVisibleAssets) {
    reasons.push('MISSING_SOURCE')
  }

  if (
    statusConnections.some(
      connection =>
        connection.status === 'syncing' ||
        connection.status === 'error' ||
        connection.status === 'reconnect_required'
    )
  ) {
    reasons.push('PARTIAL_IMPORT')
  }

  const latestValuationTimestamp = pickLatestTimestamp([
    ...providerAssets.map(asset => asset.valuationAsOf),
    ...positions.map(position => position.valuedAt ?? position.lastSyncedAt),
  ])
  if (
    isOlderThanThreshold({
      timestamp: latestValuationTimestamp,
      nowMs,
      thresholdMs: STALE_SYNC_THRESHOLD_MS,
    })
  ) {
    reasons.push('STALE_SYNC')
  }

  return reasons
}

const getDerivedDomainReasons = ({
  nowMs,
  derivedStatus,
  status,
  derivedUnavailable,
}: {
  nowMs: number
  derivedStatus: DashboardDerivedRecomputeStatusResponse | undefined
  status: PowensStatusResponse | undefined
  derivedUnavailable: boolean
}) => {
  if (derivedUnavailable) {
    return ['MISSING_SOURCE'] satisfies DashboardHealthReasonCode[]
  }

  const reasons: DashboardHealthReasonCode[] = []
  const currentSnapshot = derivedStatus?.currentSnapshot ?? null
  const latestRun = derivedStatus?.latestRun ?? null

  if (!currentSnapshot) {
    reasons.push('MISSING_SOURCE')
    return reasons
  }

  if (derivedStatus?.state === 'failed' || latestRun?.status === 'failed') {
    reasons.push('DERIVED_FAILURE')
  }

  const latestSuccessTimestamp = pickLatestTimestamp(
    status?.connections.map(connection => connection.lastSuccessAt) ?? []
  )
  const currentSnapshotTimestamp = toTimestamp(currentSnapshot.finishedAt)

  if (
    latestSuccessTimestamp !== null &&
    Number.isFinite(currentSnapshotTimestamp) &&
    latestSuccessTimestamp - currentSnapshotTimestamp > DERIVED_LAG_THRESHOLD_MS
  ) {
    reasons.push('PARTIAL_IMPORT')
  }

  if (
    isOlderThanThreshold({
      timestamp: Number.isFinite(currentSnapshotTimestamp) ? currentSnapshotTimestamp : null,
      nowMs,
      thresholdMs: STALE_SYNC_THRESHOLD_MS,
    })
  ) {
    reasons.push('STALE_SYNC')
  }

  return reasons
}

const buildGlobalSignal = (
  domains: Record<DashboardHealthDomainKey, DashboardHealthDomainSignal>
): DashboardHealthSignal => {
  const impactedDomains = Object.values(domains).filter(
    domain => domain.status === 'attention_required'
  )
  const reasons = dedupeReasons(impactedDomains.flatMap(domain => domain.reasons))

  if (impactedDomains.length === 0) {
    return {
      label: 'Dashboard health',
      status: 'healthy',
      reasons: [],
      headline: 'Healthy',
      detail: 'Global summary and inline health signals are aligned.',
    }
  }

  return {
    label: 'Dashboard health',
    status: 'attention_required',
    reasons,
    headline: 'Attention required',
    detail: `Impacted domains: ${impactedDomains.map(domain => domain.label).join(', ')}.`,
  }
}

export const getDashboardHealthUiConfig = (): DashboardHealthUiConfig => {
  const parseBooleanUiFlag = (value: string | undefined) => {
    const normalized = value?.trim().toLowerCase()

    if (!normalized) {
      return undefined
    }

    if (
      normalized === '1' ||
      normalized === 'true' ||
      normalized === 'yes' ||
      normalized === 'on'
    ) {
      return true
    }

    if (
      normalized === '0' ||
      normalized === 'false' ||
      normalized === 'no' ||
      normalized === 'off'
    ) {
      return false
    }

    return undefined
  }

  const enabled =
    parseBooleanUiFlag(readPublicRuntimeEnv('VITE_DASHBOARD_HEALTH_SIGNALS_ENABLED')) ?? true
  const globalIndicatorEnabled =
    parseBooleanUiFlag(readPublicRuntimeEnv('VITE_DASHBOARD_HEALTH_GLOBAL_INDICATOR_ENABLED')) ??
    true
  const widgetBadgesEnabled =
    parseBooleanUiFlag(readPublicRuntimeEnv('VITE_DASHBOARD_HEALTH_WIDGET_BADGES_ENABLED')) ?? true

  return {
    enabled,
    globalIndicatorEnabled: enabled && globalIndicatorEnabled,
    widgetBadgesEnabled: enabled && widgetBadgesEnabled,
  }
}

export const buildDashboardHealthModel = ({
  mode,
  summary,
  status,
  syncRuns = [],
  derivedStatus,
  summaryUnavailable = false,
  statusUnavailable = false,
  syncRunsUnavailable = false,
  derivedUnavailable = false,
  nowMs = Date.now(),
}: BuildDashboardHealthModelInput): DashboardHealthModel => {
  if (mode === 'demo') {
    return DEMO_HEALTH_FIXTURE
  }

  const domains: Record<DashboardHealthDomainKey, DashboardHealthDomainSignal> = {
    sync: {
      ...buildSignal({
        key: 'sync',
        label: DOMAIN_LABEL.sync,
        reasons: getSyncDomainReasons({
          nowMs,
          status,
          syncRuns,
          statusUnavailable,
          syncRunsUnavailable,
        }),
      }),
      key: 'sync',
    },
    portfolio: {
      ...buildSignal({
        key: 'portfolio',
        label: DOMAIN_LABEL.portfolio,
        reasons: getPortfolioDomainReasons({
          nowMs,
          summary,
          status,
          summaryUnavailable,
        }),
      }),
      key: 'portfolio',
    },
    derived: {
      ...buildSignal({
        key: 'derived',
        label: DOMAIN_LABEL.derived,
        reasons: getDerivedDomainReasons({
          nowMs,
          derivedStatus,
          status,
          derivedUnavailable,
        }),
      }),
      key: 'derived',
    },
  }

  return {
    isDemoFixture: false,
    global: buildGlobalSignal(domains),
    domains,
    widgets: {
      wealth_overview: buildWidgetSignal({
        key: 'wealth_overview',
        domainKey: 'portfolio',
        reasons: domains.portfolio.reasons,
      }),
      connections_state: buildWidgetSignal({
        key: 'connections_state',
        domainKey: 'sync',
        reasons: domains.sync.reasons,
      }),
      investment_positions: buildWidgetSignal({
        key: 'investment_positions',
        domainKey: 'derived',
        reasons: domains.derived.reasons,
      }),
    },
  }
}

export const logDashboardHealthSnapshotEvent = ({
  mode,
  range,
  health,
  uiConfig,
}: DashboardHealthEventInput & {
  health: DashboardHealthModel
  uiConfig: DashboardHealthUiConfig
}) => {
  console.info(DASHBOARD_HEALTH_EVENT_SCOPE, {
    event: 'health_snapshot',
    mode,
    range,
    status: health.global.status,
    reasonCodes: health.global.reasons,
    globalIndicatorEnabled: uiConfig.globalIndicatorEnabled,
    widgetBadgesEnabled: uiConfig.widgetBadgesEnabled,
    domains: Object.fromEntries(
      Object.entries(health.domains).map(([key, value]) => [
        key,
        {
          status: value.status,
          reasonCodes: value.reasons,
        },
      ])
    ),
    timestamp: new Date().toISOString(),
  })
}

export const logDashboardHealthWidgetEvent = ({
  mode,
  range,
  widget,
}: DashboardHealthEventInput & {
  widget: DashboardHealthWidgetSignal
}) => {
  console.info(DASHBOARD_HEALTH_EVENT_SCOPE, {
    event: 'health_widget_attention',
    mode,
    range,
    widget: widget.key,
    domain: widget.domainKey,
    status: widget.status,
    reasonCodes: widget.reasons,
    timestamp: new Date().toISOString(),
  })
}
