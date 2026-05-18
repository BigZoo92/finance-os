import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { Badge } from '@finance-os/ui/components'
import { authMeQueryOptions } from '@/features/auth-query-options'
import { resolveAuthViewState } from '@/features/auth-view-state'
import {
  fetchXHealth,
  lookupXHandle,
  runXDailyPreviousDaySync,
  type XDailySyncResponse,
  type XHealthResponse,
  type XProfileLookupResponse,
} from '@/features/x-twitter-api'
import {
  capReasonLabel,
  formatCount,
  formatUsd,
  resolveBudgetTone,
  verificationStatusLabel,
} from '@/features/x-twitter-view-model'
import { PreflightBanner } from '@/features/ops-env-diagnostics/preflight-banner'
import { PageHeader } from '@/components/surfaces/page-header'
import { Panel } from '@/components/surfaces/panel'

const xHealthQueryOptions = () => ({
  queryKey: ['x-twitter', 'health'] as const,
  queryFn: fetchXHealth,
  staleTime: 30_000,
})

export const Route = createFileRoute('/_app/signaux/x-twitter')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(authMeQueryOptions())
  },
  component: XTwitterAdminPage,
})

function XTwitterAdminPage() {
  const authQuery = useQuery(authMeQueryOptions())
  const authViewState = resolveAuthViewState({
    isPending: authQuery.isPending,
    ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}),
  })
  const isAdmin = authViewState === 'admin'

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="X / Twitter — Admin"
        description="Source sociale payante, budget contrôlé. Lookup compte, dry-run et sync J-1."
      />

      {!isAdmin ? (
        <Panel>
          <p className="text-sm text-slate-300">
            Cet écran est réservé au mode admin. Connecte-toi en admin pour piloter X.
          </p>
        </Panel>
      ) : (
        <>
          <PreflightBanner flagKey="NEWS_PROVIDER_X_TWITTER_ENABLED" />
          <HealthPanel />
          <LookupPanel />
          <DailySyncPanel />
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

function HealthPanel() {
  const healthQuery = useQuery(xHealthQueryOptions())
  const health = healthQuery.data as XHealthResponse | undefined
  const tone = resolveBudgetTone(health)
  const toneBadge: 'positive' | 'warning' | 'destructive' | 'ghost' =
    tone === 'ok'
      ? 'positive'
      : tone === 'warn'
        ? 'warning'
        : tone === 'danger'
          ? 'destructive'
          : 'ghost'

  return (
    <Panel
      title="Santé / Budget X"
      actions={
        <button
          type="button"
          className="rounded border border-slate-700 px-3 py-1 text-xs hover:bg-slate-800"
          onClick={() => healthQuery.refetch()}
          data-testid="x-health-refresh"
        >
          Rafraîchir
        </button>
      }
    >
      {healthQuery.isPending && <p className="text-sm text-slate-400">Chargement…</p>}
      {healthQuery.isError && (
        <p className="text-sm text-red-400" data-testid="x-health-error">
          Erreur de chargement du statut X.
        </p>
      )}
      {health && !health.enabled && (
        <p
          className="text-sm text-amber-400"
          data-testid="x-health-disabled"
        >
          NEWS_PROVIDER_X_TWITTER_ENABLED=false — provider désactivé par configuration.
        </p>
      )}
      {health?.enabled && !health.tokenPresent && (
        <p className="text-sm text-amber-400" data-testid="x-health-no-token">
          Bearer token X absent. Configure NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN côté API.
        </p>
      )}
      {health && (
        <div className="mt-2 grid grid-cols-2 gap-3 text-xs md:grid-cols-3">
          <Stat label="Statut">
            <Badge variant={toneBadge} data-testid="x-health-status">
              {health.budgetStatus ?? 'unknown'}
            </Badge>
          </Stat>
          <Stat label="Token">
            {health.tokenPresent ? 'présent' : 'absent'}
            <span className="ml-2 text-slate-500">(jamais affiché)</span>
          </Stat>
          <Stat label="Billing">{health.billingStatus ?? '—'}</Stat>
          <Stat label="Budget jour">{formatUsd(health.dailyBudgetUsd)}</Stat>
          <Stat label="Budget mois">{formatUsd(health.monthlyBudgetUsd)}</Stat>
          <Stat label="Coût aujourd'hui">{formatUsd(health.estimatedCostToday)}</Stat>
          <Stat label="Coût mois">{formatUsd(health.estimatedCostThisMonth)}</Stat>
          <Stat label="Projection mois">
            {formatUsd(health.estimatedMonthlyCostAtCurrentRate)}
          </Stat>
          <Stat label="Reste jour">{formatUsd(health.remainingDailyBudget)}</Stat>
          <Stat label="Reste mois">{formatUsd(health.remainingMonthlyBudget)}</Stat>
          <Stat label="Post reads aujourd'hui">{formatCount(health.postReadsToday)}</Stat>
          <Stat label="User reads aujourd'hui">{formatCount(health.userReadsToday)}</Stat>
          <Stat label="Last status">
            {typeof health.lastStatusCode === 'number' ? health.lastStatusCode : '—'}
          </Stat>
          <Stat label="Last error">{health.lastErrorCode ?? 'aucune'}</Stat>
          <Stat label="Last daily run">{health.lastDailyRunStatus ?? '—'}</Stat>
          <Stat label="Tweets fetched">{formatCount(health.lastDailyRunFetchedCount)}</Stat>
          <Stat label="Pour Advisor">{formatCount(health.lastDailyRunKeptForAdvisorCount)}</Stat>
          <Stat label="Scheduler auto">
            {health.dailySyncSchedulerEnabled ? 'activé' : 'désactivé'}
          </Stat>
        </div>
      )}
    </Panel>
  )
}

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

function LookupPanel() {
  const [handle, setHandle] = useState('')
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (input: { handle: string; persist: boolean; forceRefresh: boolean }) =>
      lookupXHandle({
        handle: input.handle,
        persist: input.persist,
        forceRefresh: input.forceRefresh,
      }),
    onSuccess: () => {
      // refresh health so cost/budget panel reflects the user read.
      void queryClient.invalidateQueries({ queryKey: ['x-twitter', 'health'] })
    },
  })
  const result = mutation.data as XProfileLookupResponse | undefined
  const profile = result?.profile

  return (
    <Panel title="Lookup compte X">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={event => {
          event.preventDefault()
          if (!handle.trim()) return
          mutation.mutate({ handle: handle.trim(), persist: true, forceRefresh: false })
        }}
      >
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-slate-400">Handle</span>
          <input
            value={handle}
            onChange={event => setHandle(event.target.value)}
            placeholder="@unusual_whales"
            className="w-64 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
            data-testid="x-lookup-handle-input"
          />
        </label>
        <button
          type="submit"
          disabled={!handle.trim() || mutation.isPending}
          className="rounded bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-50"
          data-testid="x-lookup-submit"
        >
          {mutation.isPending ? 'Vérification…' : 'Vérifier le compte'}
        </button>
      </form>

      {mutation.isError && (
        <p className="mt-3 text-sm text-red-400" data-testid="x-lookup-error">
          Erreur réseau lors du lookup.
        </p>
      )}

      {result && !result.ok && (
        <div className="mt-3 rounded border border-amber-700 bg-amber-950/50 p-3 text-sm text-amber-200" data-testid="x-lookup-fail">
          <p className="font-semibold">{verificationStatusLabel(result.verificationStatus)}</p>
          <p className="mt-1 text-xs text-amber-300">
            {result.message ?? result.code ?? 'lookup failed'}
          </p>
        </div>
      )}

      {result?.ok && profile && (
        <div className="mt-4 flex items-start gap-4" data-testid="x-lookup-success">
          {profile.profileImageUrl && (
            <img
              src={profile.profileImageUrl}
              alt={`avatar de ${profile.username}`}
              className="h-16 w-16 rounded-full border border-slate-700 object-cover"
            />
          )}
          <div className="space-y-1">
            <p className="text-base font-semibold">{profile.name}</p>
            <p className="text-sm text-slate-400">@{profile.username}</p>
            {profile.description && (
              <p className="max-w-xl text-sm text-slate-300">{profile.description}</p>
            )}
            <div className="flex flex-wrap gap-3 text-xs text-slate-400">
              <span>Followers: {formatCount(profile.publicMetrics.followersCount)}</span>
              <span>Following: {formatCount(profile.publicMetrics.followingCount)}</span>
              <span>Tweets: {formatCount(profile.publicMetrics.tweetCount)}</span>
              {profile.verified && (
                <Badge variant="positive">vérifié ({profile.verifiedType ?? 'badge'})</Badge>
              )}
              {profile.protected && <Badge variant="warning">privé</Badge>}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Source: {result.source ?? '—'} · coût: {formatUsd(result.estimatedCostUsd)} ·
              persisté: {result.persisted ? 'oui' : 'non'}
            </p>
          </div>
        </div>
      )}
    </Panel>
  )
}

// ---------------------------------------------------------------------------
// Daily sync
// ---------------------------------------------------------------------------

function DailySyncPanel() {
  const queryClient = useQueryClient()
  const [dryRun, setDryRun] = useState<XDailySyncResponse | undefined>(undefined)
  const [runMode, setRunMode] = useState<'automatic_capped' | 'manual_full_previous_day'>(
    'automatic_capped'
  )
  const dryRunMutation = useMutation({
    mutationFn: () => runXDailyPreviousDaySync({ runMode: 'dry_run' }),
    onSuccess: data => setDryRun(data),
  })
  const runMutation = useMutation({
    mutationFn: () =>
      runXDailyPreviousDaySync({
        runMode,
        manualConfirm: true,
        dryRun: false,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['x-twitter', 'health'] })
    },
  })
  const runResult = runMutation.data as XDailySyncResponse | undefined

  return (
    <Panel title="Sync J-1 (previous-day)">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={dryRunMutation.isPending}
          onClick={() => dryRunMutation.mutate()}
          className="rounded border border-slate-700 px-3 py-1 text-sm hover:bg-slate-800 disabled:opacity-50"
          data-testid="x-sync-dryrun"
        >
          {dryRunMutation.isPending ? 'Estimation…' : 'Dry-run estimation'}
        </button>
        <label className="ml-4 flex items-center gap-2 text-xs">
          <span className="text-slate-400">Mode</span>
          <select
            value={runMode}
            onChange={event => setRunMode(event.target.value as never)}
            className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
            data-testid="x-sync-mode"
          >
            <option value="automatic_capped">automatic_capped</option>
            <option value="manual_full_previous_day">manual_full_previous_day</option>
          </select>
        </label>
        <button
          type="button"
          disabled={!dryRun?.ok || runMutation.isPending}
          onClick={() => runMutation.mutate()}
          className="rounded bg-emerald-600 px-3 py-1 text-sm text-white disabled:opacity-50"
          data-testid="x-sync-run"
        >
          {runMutation.isPending ? 'Lancement…' : 'Lancer sync'}
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Dry-run obligatoire avant le run. Le run respecte le budget : si l'estimation dépasse le
        seuil de confirmation, l'API retourne 412 et il faut renvoyer l'action.
      </p>

      {dryRun && (
        <div className="mt-3 rounded border border-slate-800 p-3 text-sm" data-testid="x-sync-dryrun-result">
          <p className="font-semibold">Estimation</p>
          <p className="text-xs text-slate-400">
            {dryRun.window?.windowDateLocal} ({dryRun.window?.timezone})
          </p>
          <div className="mt-1 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
            <Stat label="Post reads max">{formatCount(dryRun.estimatedPostReads)}</Stat>
            <Stat label="Coût estimé">{formatUsd(dryRun.estimatedCostUsd)}</Stat>
            <Stat label="Cap reason">{capReasonLabel(dryRun.capReason)}</Stat>
            <Stat label="Status">{dryRun.runStatus ?? '—'}</Stat>
          </div>
          {dryRun.errorMessage && (
            <p className="mt-2 text-xs text-amber-400">{dryRun.errorMessage}</p>
          )}
        </div>
      )}

      {runResult && (
        <div className="mt-3 rounded border border-slate-800 p-3 text-sm" data-testid="x-sync-run-result">
          <p className="font-semibold">Run terminé — {runResult.runStatus ?? 'inconnu'}</p>
          <div className="mt-1 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
            <Stat label="Fetched">{formatCount(runResult.fetchedTweetCount)}</Stat>
            <Stat label="Pour Advisor">{formatCount(runResult.keptForAdvisorCount)}</Stat>
            <Stat label="Coût réel">{formatUsd(runResult.actualCostUsd)}</Stat>
            <Stat label="Cap reason">{capReasonLabel(runResult.capReason)}</Stat>
            <Stat label="Inserted">{formatCount(runResult.signalItemCounts?.insertedCount)}</Stat>
            <Stat label="Dédupliqués">{formatCount(runResult.signalItemCounts?.dedupedCount)}</Stat>
          </div>
          {runResult.errorMessage && (
            <p className="mt-2 text-xs text-amber-400">{runResult.errorMessage}</p>
          )}
        </div>
      )}
    </Panel>
  )
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded border border-slate-800 bg-slate-950/40 p-2">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-0.5 text-sm text-slate-100">{children}</div>
    </div>
  )
}
