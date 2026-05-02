import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@finance-os/ui/components'
import { motion } from 'motion/react'
import type { AuthMode } from '@/features/auth-types'
import { authMeQueryOptions } from '@/features/auth-query-options'
import { resolveAuthViewState } from '@/features/auth-view-state'
import { dashboardDerivedRecomputeStatusQueryOptionsWithMode, dashboardSummaryQueryOptionsWithMode } from '@/features/dashboard-query-options'
import {
  powensDiagnosticsQueryOptionsWithMode,
  powensStatusQueryOptionsWithMode,
  powensSyncRunsQueryOptionsWithMode,
} from '@/features/powens/query-options'
import {
  externalInvestmentsStatusQueryOptionsWithMode,
  externalInvestmentsSyncRunsQueryOptionsWithMode,
} from '@/features/external-investments/query-options'
import type { ExternalInvestmentProvider } from '@/features/external-investments/types'
import { pushSettingsQueryOptionsWithMode } from '@/features/notifications/query-options'
import { getLatestSyncStatus } from '@/components/dashboard/latest-sync-status'
import { formatDateTime, formatDuration } from '@/lib/format'
import { AsciiStatusLine, AsciiDivider } from '@/components/ui/ascii-brand'
import { PageHeader } from '@/components/surfaces/page-header'
import { useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import PixelBlast from '@/components/reactbits/pixel-blast'

const providerLabel = (provider: ExternalInvestmentProvider) =>
  provider === 'ibkr' ? 'IBKR' : 'Binance'

export const Route = createFileRoute('/_app/sante')({
  loader: async ({ context }) => {
    const auth = await context.queryClient.fetchQuery(authMeQueryOptions())
    const mode: AuthMode | undefined = auth.mode === 'admin' ? 'admin' : auth.mode === 'demo' ? 'demo' : undefined
    if (!mode) return
    const opts = { mode }
    await Promise.all([
      context.queryClient.ensureQueryData(powensStatusQueryOptionsWithMode(opts)),
      context.queryClient.ensureQueryData(powensSyncRunsQueryOptionsWithMode(opts)),
      context.queryClient.ensureQueryData(powensDiagnosticsQueryOptionsWithMode(opts)),
      context.queryClient.ensureQueryData(externalInvestmentsStatusQueryOptionsWithMode(opts)),
      context.queryClient.ensureQueryData(externalInvestmentsSyncRunsQueryOptionsWithMode(opts)),
      context.queryClient.ensureQueryData(dashboardDerivedRecomputeStatusQueryOptionsWithMode(opts)),
      context.queryClient.ensureQueryData(dashboardSummaryQueryOptionsWithMode({ range: '30d', ...opts })),
      context.queryClient.ensureQueryData(pushSettingsQueryOptionsWithMode(opts)),
    ])
  },
  component: SantePage,
})

type HealthSignal = {
  label: string
  status: 'ok' | 'warning' | 'error' | 'unknown'
  detail: string
}

function SantePage() {
  const prefersReducedMotion = useReducedMotion()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const authQuery = useQuery(authMeQueryOptions())
  const authViewState = resolveAuthViewState({
    isPending: authQuery.isPending,
    ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}),
  })
  const isDemo = authViewState === 'demo'
  const isAdmin = authViewState === 'admin'
  const authMode: AuthMode | undefined = isAdmin ? 'admin' : isDemo ? 'demo' : undefined

  const statusQuery = useQuery(powensStatusQueryOptionsWithMode(authMode ? { mode: authMode } : {}))
  const syncRunsQuery = useQuery(powensSyncRunsQueryOptionsWithMode(authMode ? { mode: authMode } : {}))
  const diagnosticsQuery = useQuery(powensDiagnosticsQueryOptionsWithMode(authMode ? { mode: authMode } : {}))
  const externalStatusQuery = useQuery(externalInvestmentsStatusQueryOptionsWithMode(authMode ? { mode: authMode } : {}))
  const externalSyncRunsQuery = useQuery(externalInvestmentsSyncRunsQueryOptionsWithMode(authMode ? { mode: authMode } : {}))
  const derivedQuery = useQuery(dashboardDerivedRecomputeStatusQueryOptionsWithMode(authMode ? { mode: authMode } : {}))
  const summaryQuery = useQuery(dashboardSummaryQueryOptionsWithMode({ range: '30d', ...(authMode ? { mode: authMode } : {}) }))
  const pushQuery = useQuery(pushSettingsQueryOptionsWithMode(authMode ? { mode: authMode } : {}))

  const connections = statusQuery.data?.connections ?? []
  const syncRuns = syncRunsQuery.data?.runs ?? []
  const diagnostics = diagnosticsQuery.data
  const externalConnections = externalStatusQuery.data?.connections ?? []
  const externalHealth = externalStatusQuery.data?.health ?? []
  const externalSyncRuns = externalSyncRunsQuery.data?.items ?? []
  const externalSafeModeActive = externalStatusQuery.data?.safeModeActive ?? false
  const derived = derivedQuery.data
  const latestSync = getLatestSyncStatus(syncRuns)
  const safeModeActive = statusQuery.data?.safeModeActive ?? false

  // Build health signals
  const signals: HealthSignal[] = [
    {
      label: 'Connexions Powens',
      status: connections.some(c => c.status === 'error' || c.status === 'reconnect_required')
        ? 'error' : connections.length > 0 ? 'ok' : 'unknown',
      detail: `${connections.filter(c => c.status === 'connected').length}/${connections.length} connectées`,
    },
    {
      label: 'Dernière sync',
      status: latestSync.badgeVariant === 'destructive' ? 'error'
        : latestSync.badgeVariant === 'outline' ? 'warning' : 'ok',
      detail: latestSync.summary,
    },
    {
      label: 'Diagnostic provider',
      status: !diagnostics ? 'unknown'
        : diagnostics.outcome === 'ok' ? 'ok'
        : diagnostics.outcome === 'degraded' ? 'warning' : 'error',
      detail: diagnostics?.guidance ?? 'Chargement…',
    },
    {
      label: 'Derived recompute',
      status: !derived ? 'unknown'
        : derived.state === 'completed' ? 'ok'
        : derived.state === 'failed' ? 'error' : 'warning',
      detail: derived?.latestRun ? formatDateTime(derived.latestRun.finishedAt) : 'Aucun run',
    },
    {
      label: 'Safe mode',
      status: safeModeActive ? 'warning' : 'ok',
      detail: safeModeActive ? 'Actif — intégrations bloquées' : 'Inactif',
    },
    {
      label: 'Investissements externes',
      status: externalHealth.some(item => item.status === 'failing')
        ? 'error'
        : externalHealth.some(item => item.status === 'degraded')
          ? 'warning'
          : externalConnections.length > 0
            ? 'ok'
            : 'unknown',
      detail: `${externalConnections.filter(item => item.credentialStatus === 'configured').length}/${externalConnections.length} providers configures`,
    },
    {
      label: 'Safe mode investissements',
      status: externalSafeModeActive ? 'warning' : 'ok',
      detail: externalSafeModeActive ? 'Actif - providers non appeles' : 'Inactif',
    },
    {
      label: 'Notifications push',
      status: pushQuery.data?.featureEnabled ? 'ok' : 'warning',
      detail: pushQuery.data?.optIn ? 'Opt-in actif' : 'Non activées',
    },
    {
      label: 'Données summary',
      status: summaryQuery.isError ? 'error' : summaryQuery.data ? 'ok' : 'unknown',
      detail: summaryQuery.isError ? 'Erreur de chargement' : summaryQuery.data ? 'Disponible' : 'Chargement…',
    },
  ]

  const overallStatus = signals.some(s => s.status === 'error') ? 'error'
    : signals.some(s => s.status === 'warning') ? 'warning' : 'ok'

  const STATUS_GLYPH = { ok: '✓', warning: '⚡', error: '✗', unknown: '?' } as const
  const STATUS_COLOR = {
    ok: 'text-positive',
    warning: 'text-warning',
    error: 'text-negative',
    unknown: 'text-muted-foreground',
  } as const

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Diagnostics"
        icon="♡"
        title="Santé"
        description="État consolidé des intégrations, de la synchronisation et du pipeline dérivé."
      />

      {/* Overall status hero — PixelBlast in the OK state, calm gradient otherwise */}
      <Card
        className={`relative overflow-hidden ${
          overallStatus === 'error'
            ? 'border-negative/30 bg-negative/5'
            : overallStatus === 'warning'
              ? 'border-warning/30 bg-warning/5'
              : 'border-positive/30 bg-positive/5'
        }`}
      >
        {/* PixelBlast WebGL layer — only when system is OK and motion allowed */}
        {overallStatus === 'ok' && mounted && !prefersReducedMotion && (
          <div className="pointer-events-none absolute inset-0 opacity-60">
            <PixelBlast
              variant="circle"
              pixelSize={6}
              color="#5fe39d"
              patternScale={3}
              patternDensity={1.0}
              pixelSizeJitter={0.4}
              enableRipples
              rippleSpeed={0.4}
              rippleThickness={0.12}
              rippleIntensityScale={1.5}
              liquid
              liquidStrength={0.06}
              liquidRadius={1.0}
              liquidWobbleSpeed={5}
              speed={0.5}
              edgeFade={0.35}
              transparent
            />
          </div>
        )}
        <CardContent className="relative flex items-center gap-4 p-6">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', bounce: 0.4, duration: 0.5 }}
            className={`flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-bold ${STATUS_COLOR[overallStatus]} bg-background shadow-sm`}
          >
            {STATUS_GLYPH[overallStatus]}
          </motion.div>
          <div>
            <p className="text-lg font-semibold">
              {overallStatus === 'ok' ? 'Système opérationnel' : overallStatus === 'warning' ? 'Attention requise' : 'Problème détecté'}
            </p>
            <p className="text-sm text-muted-foreground">
              {signals.filter(s => s.status === 'ok').length}/{signals.length} sous-systèmes OK
            </p>
          </div>
        </CardContent>
      </Card>

      <AsciiDivider variant="bold" />

      {/* Signal grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {signals.map((signal, i) => (
          <motion.div
            key={signal.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <Card className="h-full">
              <CardContent className="flex items-start gap-3 p-5">
                <span className={`mt-0.5 text-lg ${STATUS_COLOR[signal.status]}`}>
                  {STATUS_GLYPH[signal.status]}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{signal.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground truncate">{signal.detail}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Recent sync runs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dernières synchronisations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {syncRuns.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Aucun run récent.</p>
          ) : (
            syncRuns.slice(0, 8).map(run => (
              <div
                key={run.id}
                className="flex items-center justify-between rounded-lg border border-border/40 bg-surface-1 px-4 py-2.5 transition-colors duration-150 hover:bg-surface-2"
              >
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">#{run.connectionId}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{formatDateTime(run.startedAt)}</span>
                    {formatDuration(run.startedAt, run.endedAt) && (
                      <span className="ml-2 text-xs text-muted-foreground">· {formatDuration(run.startedAt, run.endedAt)}</span>
                    )}
                  </p>
                  {run.errorMessage && <p className="text-xs text-negative truncate">{run.errorMessage}</p>}
                </div>
                <Badge
                  variant={run.result === 'success' ? 'positive' : run.result === 'running' ? 'outline' : 'destructive'}
                  className="text-xs"
                >
                  {run.result}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Synchronisations investissements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {externalSyncRuns.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Aucun run IBKR/Binance recent.
            </p>
          ) : (
            externalSyncRuns.slice(0, 8).map(run => (
              <div
                key={run.id}
                className="rounded-lg border border-border/40 bg-surface-1 px-4 py-2.5 transition-colors duration-150 hover:bg-surface-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">{providerLabel(run.provider)}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {formatDateTime(run.startedAt)}
                      </span>
                      {formatDuration(run.startedAt, run.finishedAt) && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          · {formatDuration(run.startedAt, run.finishedAt)}
                        </span>
                      )}
                    </p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">
                      request {run.requestId ?? '-'}
                    </p>
                    {run.errorMessage && (
                      <p className="truncate text-xs text-negative">{run.errorMessage}</p>
                    )}
                    {run.degradedReasons.length > 0 && (
                      <p className="truncate text-xs text-warning">
                        {run.degradedReasons.join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge
                      variant={
                        run.status === 'success'
                          ? 'positive'
                          : run.status === 'running'
                            ? 'outline'
                            : run.status === 'degraded'
                              ? 'warning'
                              : 'destructive'
                      }
                      className="text-xs"
                    >
                      {run.status}
                    </Badge>
                    {run.rowCounts && (
                      <span className="text-[11px] text-muted-foreground">
                        {Object.entries(run.rowCounts)
                          .map(([key, value]) => `${key}:${value}`)
                          .join(' · ')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Health providers investissements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {externalHealth.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Aucun diagnostic IBKR/Binance disponible.
            </p>
          ) : (
            externalHealth.map(item => (
              <div
                key={item.provider}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-surface-1 px-4 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{providerLabel(item.provider)}</p>
                  <p className="text-xs text-muted-foreground">
                    Dernier appel {formatDateTime(item.lastAttemptAt)} · succes {formatDateTime(item.lastSuccessAt)}
                  </p>
                  {item.lastErrorMessage && (
                    <p className="truncate text-xs text-negative">{item.lastErrorMessage}</p>
                  )}
                </div>
                <div className="text-right">
                  <Badge
                    variant={
                      item.status === 'healthy'
                        ? 'positive'
                        : item.status === 'failing'
                          ? 'destructive'
                          : item.status === 'degraded'
                            ? 'warning'
                            : 'outline'
                    }
                    className="text-xs"
                  >
                    {item.status}
                  </Badge>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    raw {item.lastRawImportCount} · rows {item.lastNormalizedRowCount}
                  </p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* ASCII footer accent */}
      <AsciiStatusLine
        items={[
          { label: 'mode', value: authMode ?? '…' },
          { label: 'conn', value: `${connections.length}`, tone: connections.length > 0 ? 'positive' : 'neutral' },
          { label: 'sync', value: latestSync.badgeLabel, tone: latestSync.badgeVariant === 'destructive' ? 'negative' : 'positive' },
          { label: 'derived', value: derived?.state ?? '…' },
        ]}
      />
    </div>
  )
}
