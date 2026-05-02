import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from '@finance-os/ui/components'
import { motion } from 'motion/react'
import type { AuthMode } from '@/features/auth-types'
import { authMeQueryOptions } from '@/features/auth-query-options'
import { resolveAuthViewState } from '@/features/auth-view-state'
import {
  dashboardManualAssetsQueryOptionsWithMode,
  dashboardQueryKeys,
  dashboardSummaryQueryOptionsWithMode,
} from '@/features/dashboard-query-options'
import {
  externalInvestmentsPositionsQueryOptionsWithMode,
  externalInvestmentsSummaryQueryOptionsWithMode,
} from '@/features/external-investments/query-options'
import {
  deleteDashboardManualAsset,
  patchDashboardManualAsset,
  postDashboardManualAsset,
} from '@/features/dashboard-api'
import type { DashboardManualAssetResponse, DashboardRange } from '@/features/dashboard-types'
import { adaptDashboardSummaryLegacy } from '@/features/dashboard-legacy-adapter'
import { getTrendDirection } from '@/components/dashboard/trend-visuals'
import { formatDateTime, formatMoney } from '@/lib/format'
import { D3Sparkline, MiniSparkline } from '@/components/ui/d3-sparkline'
import { RangePill } from '@/components/surfaces/range-pill'

const searchSchema = z.object({ range: z.enum(['7d', '30d', '90d']).optional() })
const resolveRange = (value: string | undefined): DashboardRange =>
  value === '7d' || value === '90d' ? value : '30d'

export const Route = createFileRoute('/_app/patrimoine')({
  validateSearch: search => searchSchema.parse(search),
  loaderDeps: ({ search }) => ({ range: resolveRange(search.range) }),
  loader: async ({ context, deps }) => {
    const auth = await context.queryClient.fetchQuery(authMeQueryOptions())
    const mode: AuthMode | undefined =
      auth.mode === 'admin' ? 'admin' : auth.mode === 'demo' ? 'demo' : undefined
    if (!mode) {
      return
    }

    await context.queryClient.ensureQueryData(
      dashboardSummaryQueryOptionsWithMode({
        range: deps.range,
        mode,
      })
    )
    await Promise.all([
      context.queryClient.ensureQueryData(externalInvestmentsSummaryQueryOptionsWithMode({ mode })),
      context.queryClient.ensureQueryData(externalInvestmentsPositionsQueryOptionsWithMode({ mode })),
    ])
  },
  component: PatrimoinePage,
})

const RANGES: Array<{ label: string; value: DashboardRange }> = [
  { label: '7 jours', value: '7d' },
  { label: '30 jours', value: '30d' },
  { label: '90 jours', value: '90d' },
]

const ASSET_TYPE_LABEL: Record<'cash' | 'investment' | 'manual', string> = {
  cash: 'Liquidites',
  investment: 'Investissement',
  manual: 'Manuel',
}

type ManualAssetDraft = {
  assetType: 'cash' | 'investment' | 'manual'
  name: string
  currency: string
  valuation: string
  valuationAsOf: string
  category: string
  note: string
  enabled: boolean
}

const EMPTY_MANUAL_ASSET_DRAFT: ManualAssetDraft = {
  assetType: 'manual',
  name: '',
  currency: 'EUR',
  valuation: '',
  valuationAsOf: '',
  category: '',
  note: '',
  enabled: true,
}

const toDatetimeLocalValue = (value: string | null) => {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

const toIsoDateTimeOrNull = (value: string) => {
  const normalized = value.trim()
  if (!normalized) {
    return null
  }

  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const normalizeOptionalText = (value: string) => {
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

const toManualAssetDraft = (asset: DashboardManualAssetResponse): ManualAssetDraft => ({
  assetType: asset.type,
  name: asset.name,
  currency: asset.currency,
  valuation: String(asset.valuation),
  valuationAsOf: toDatetimeLocalValue(asset.valuationAsOf),
  category: asset.category ?? '',
  note: asset.note ?? '',
  enabled: asset.enabled,
})

function PatrimoinePage() {
  const { range: searchRange } = Route.useSearch()
  const range = resolveRange(searchRange)
  const navigate = Route.useNavigate()
  const queryClient = useQueryClient()
  const [manualAssetDraft, setManualAssetDraft] =
    useState<ManualAssetDraft>(EMPTY_MANUAL_ASSET_DRAFT)
  const [editingManualAssetId, setEditingManualAssetId] = useState<number | null>(null)

  const authQuery = useQuery(authMeQueryOptions())
  const authViewState = resolveAuthViewState({
    isPending: authQuery.isPending,
    ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}),
  })
  const isDemo = authViewState === 'demo'
  const isAdmin = authViewState === 'admin'
  const authMode: AuthMode | undefined = isAdmin ? 'admin' : isDemo ? 'demo' : undefined

  const summaryQuery = useQuery(
    dashboardSummaryQueryOptionsWithMode({
      range,
      ...(authMode ? { mode: authMode } : {}),
    })
  )
  const manualAssetsQuery = useQuery(
    dashboardManualAssetsQueryOptionsWithMode({
      ...(isAdmin && authMode ? { mode: authMode } : {}),
    })
  )
  const externalSummaryQuery = useQuery(
    externalInvestmentsSummaryQueryOptionsWithMode({
      ...(authMode ? { mode: authMode } : {}),
    })
  )
  const externalPositionsQuery = useQuery(
    externalInvestmentsPositionsQueryOptionsWithMode({
      ...(authMode ? { mode: authMode } : {}),
    })
  )
  const adapted = adaptDashboardSummaryLegacy({
    range,
    summary: summaryQuery.data,
    ...(authMode ? { mode: authMode } : {}),
  })

  const sparkData = adapted.dailyWealthSnapshots.map(snapshot => ({
    date: snapshot.date,
    value: snapshot.balance,
  }))
  const trend = getTrendDirection({
    start: sparkData[0]?.value ?? null,
    end: sparkData.at(-1)?.value ?? null,
  })
  const delta = (sparkData.at(-1)?.value ?? 0) - (sparkData[0]?.value ?? 0)
  const manualAssets = manualAssetsQuery.data?.items ?? []
  const externalBundle = externalSummaryQuery.data?.bundle ?? null
  const externalPositions = externalPositionsQuery.data?.items ?? []
  const externalKnownValue = externalBundle?.totalKnownValue ?? 0
  const externalUnknownCount = externalBundle?.unknownValuePositionCount ?? 0

  const resetManualAssetForm = () => {
    setManualAssetDraft(EMPTY_MANUAL_ASSET_DRAFT)
    setEditingManualAssetId(null)
  }

  const invalidateManualAssetQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.manualAssets() }),
      queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.summary(range) }),
    ])
  }

  const saveManualAssetMutation = useMutation({
    mutationFn: async () => {
      const valuation = Number(manualAssetDraft.valuation)
      const payload = {
        assetType: manualAssetDraft.assetType,
        name: manualAssetDraft.name.trim(),
        currency: manualAssetDraft.currency.trim().toUpperCase(),
        valuation: Number.isFinite(valuation) ? valuation : 0,
        valuationAsOf: toIsoDateTimeOrNull(manualAssetDraft.valuationAsOf),
        note: normalizeOptionalText(manualAssetDraft.note),
        category: normalizeOptionalText(manualAssetDraft.category),
        enabled: manualAssetDraft.enabled,
      } as const

      return editingManualAssetId === null
        ? postDashboardManualAsset(payload)
        : patchDashboardManualAsset({
            assetId: editingManualAssetId,
            ...payload,
          })
    },
    onSuccess: async () => {
      resetManualAssetForm()
      await invalidateManualAssetQueries()
    },
  })

  const deleteManualAssetMutation = useMutation({
    mutationFn: deleteDashboardManualAsset,
    onSuccess: async (_result, assetId) => {
      if (editingManualAssetId === assetId) {
        resetManualAssetForm()
      }

      await invalidateManualAssetQueries()
    },
  })

  const handleManualAssetSubmit = () => {
    if (
      manualAssetDraft.name.trim().length === 0 ||
      manualAssetDraft.currency.trim().length === 0 ||
      manualAssetDraft.valuation.trim().length === 0
    ) {
      return
    }

    saveManualAssetMutation.mutate()
  }

  const rangeLabel = range === '7d' ? '7 jours' : range === '90d' ? '90 jours' : '30 jours'
  const firstBalance = adapted.dailyWealthSnapshots[0]?.balance ?? adapted.totals.balance
  const deltaPct = firstBalance > 0 ? (delta / firstBalance) * 100 : 0
  const miniTrendData = sparkData.map(p => p.value)

  return (
    <div className="space-y-10">
      {/* ──────────────────────────────────────────────────────────────────
         HERO — portfolio viewer card.
         Structure:
           · subtle aurora mesh + dotted grid behind
           · top row : eyebrow (left) · RangePill (right)
           · main    : BIG balance (solid rose, premium drop-shadow)
                      + delta pill + mini trend inline
           · bottom  : full-width sparkline that contextualises the amount
         The card is bordered and rounded like a hardware-style viewer.
         ────────────────────────────────────────────────────────────────── */}
      <section
        className="relative isolate overflow-hidden rounded-[28px] border border-border/60"
        style={{ background: 'var(--surface-0)' }}
      >
        {/* Layer 1 — aurora wash + dotted grid, soft and fading to clean */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-aurora-mesh-soft opacity-90" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              'radial-gradient(circle, oklch(from var(--foreground) l c h / 7%) 1px, transparent 1px)',
            backgroundSize: '26px 26px',
            maskImage: 'linear-gradient(180deg, black 0%, transparent 60%)',
            WebkitMaskImage: 'linear-gradient(180deg, black 0%, transparent 60%)',
          }}
        />
        {/* Layer 2 — bottom fade so the sparkline sits on a clean base */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-40"
          style={{
            background:
              'linear-gradient(180deg, transparent 0%, oklch(from var(--surface-0) l c h / 80%) 45%, var(--surface-0) 100%)',
          }}
        />

        {/* Content grid */}
        <div className="relative px-5 pt-6 md:px-10 md:pt-8">
          {/* Top row — eyebrow + RangePill */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.24em] text-primary/85">
              <span aria-hidden="true" className="text-base leading-none">◊</span>
              Patrimoine <span className="text-muted-foreground/40">·</span> net
            </p>
            <RangePill
              layoutId="patrimoine-range"
              ariaLabel="Période"
              options={RANGES.map(r => ({ label: r.label, value: r.value }))}
              value={range}
              onChange={next => navigate({ search: { range: next } })}
            />
          </div>

          {/* Main — balance + delta + mini trend */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="mt-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-6"
          >
            <div className="min-w-0">
              {summaryQuery.isPending ? (
                <span className="block h-14 w-60 animate-shimmer rounded-xl md:h-20" />
              ) : (
                <h2
                  className="font-financial text-[44px] font-semibold leading-[1.05] tracking-tighter text-foreground md:text-[72px]"
                  style={{
                    textShadow:
                      '0 1px 0 oklch(from var(--primary) l c h / 18%), 0 0 40px oklch(from var(--primary) l c h / 14%)',
                  }}
                >
                  {formatMoney(adapted.totals.balance)}
                </h2>
              )}

              {!summaryQuery.isPending && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge
                    variant={trend === 'up' ? 'positive' : trend === 'down' ? 'destructive' : 'outline'}
                    className="gap-1 text-[11px]"
                  >
                    <span aria-hidden="true">
                      {trend === 'up' ? '▲' : trend === 'down' ? '▼' : '●'}
                    </span>
                    {trend === 'up'
                      ? `+${formatMoney(delta)}`
                      : trend === 'down'
                        ? formatMoney(delta)
                        : 'stable'}
                  </Badge>
                  {Math.abs(deltaPct) > 0.01 && trend !== 'neutral' && (
                    <span
                      className={`font-financial text-[12px] font-medium ${
                        trend === 'up' ? 'text-positive' : 'text-negative'
                      }`}
                    >
                      {trend === 'up' ? '+' : ''}
                      {deltaPct.toFixed(2)} %
                    </span>
                  )}
                  <span className="text-[11.5px] text-muted-foreground/70">· sur {rangeLabel}</span>
                </div>
              )}
            </div>

            {/* Right — mini sparkline in a framed mono readout */}
            {miniTrendData.length > 1 && (
              <div className="inline-flex items-center gap-3 rounded-xl border border-border/50 bg-card/60 px-3 py-2 backdrop-blur">
                <div className="flex flex-col">
                  <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/70">
                    trend
                  </span>
                  <span
                    className={`font-mono text-[11px] ${
                      trend === 'up' ? 'text-positive' : trend === 'down' ? 'text-negative' : 'text-foreground/80'
                    }`}
                  >
                    {rangeLabel}
                  </span>
                </div>
                <MiniSparkline
                  data={miniTrendData}
                  width={108}
                  height={32}
                  color={trend === 'up' ? 'var(--positive)' : trend === 'down' ? 'var(--negative)' : 'var(--primary)'}
                />
              </div>
            )}
          </motion.div>
        </div>

        {/* Bottom — full-width D3 sparkline integrated in the hero */}
        <div className="relative mt-6 px-2 pb-2 md:px-4 md:pb-3">
          {sparkData.length > 1 ? (
            <D3Sparkline
              data={sparkData}
              height={120}
              showArea
              showTooltip
              animate
              color="var(--primary)"
              gradientFrom="var(--primary)"
              gradientTo="transparent"
              formatValue={v => formatMoney(v)}
            />
          ) : (
            <div className="flex h-[120px] items-center justify-center rounded-2xl border border-dashed border-border/40 bg-surface-1/60">
              <span className="font-mono text-xs text-muted-foreground/50">
                [ données insuffisantes pour afficher la tendance ]
              </span>
            </div>
          )}
        </div>
      </section>

      <section>
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground/50">
          Soldes par connexion
        </p>
        <div className="space-y-2">
          {adapted.connections.length > 0 ? (
            adapted.connections.map((connection, index) => (
              <motion.div
                key={connection.powensConnectionId}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className="flex items-center justify-between rounded-xl px-4 py-3 transition-colors duration-150 hover:bg-card"
              >
                <div>
                  <p className="text-sm font-medium">
                    {connection.providerInstitutionName ?? `#${connection.powensConnectionId}`}
                  </p>
                  <p className="text-sm text-muted-foreground/60">
                    {connection.provider} · {connection.accountCount} compte
                    {connection.accountCount > 1 ? 's' : ''}
                  </p>
                </div>
                <p className="font-financial text-sm font-bold">
                  {formatMoney(connection.balance)}
                </p>
              </motion.div>
            ))
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground/40">
              Aucune connexion.
            </p>
          )}
        </div>
      </section>

      <section>
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground/50">
          Actifs
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {adapted.assets.length > 0 ? (
            adapted.assets.map((asset, index) => (
              <motion.div
                key={asset.assetId}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.04, duration: 0.25 }}
                className="rounded-2xl border border-border/30 bg-card/50 p-4 transition-all duration-200 hover:bg-card hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">{asset.name}</p>
                      <Badge variant="outline" className="text-xs">
                        {ASSET_TYPE_LABEL[asset.type]}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground/60">
                      {asset.providerInstitutionName ?? asset.source}
                    </p>
                  </div>
                  <p className="font-financial whitespace-nowrap text-sm font-bold">
                    {formatMoney(asset.valuation, asset.currency)}
                  </p>
                </div>
              </motion.div>
            ))
          ) : (
            <p className="col-span-full py-6 text-center text-sm text-muted-foreground/40">
              Aucun actif.
            </p>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground/50">
              Investissements externes
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              IBKR et Binance sont lus depuis les snapshots persistants. Aucun provider n est appele par cette vue.
            </p>
          </div>
          <Badge variant={externalSummaryQuery.isError ? 'destructive' : externalUnknownCount > 0 ? 'outline' : 'secondary'}>
            {externalSummaryQuery.isPending
              ? 'chargement'
              : externalUnknownCount > 0
                ? `${externalUnknownCount} valuation inconnue`
                : 'cache pret'}
          </Badge>
        </div>

        <div className="grid gap-3 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-2xl border border-border/40 bg-card/55 p-4">
            <p className="text-sm font-medium">Valeur externe connue</p>
            <p className="mt-2 font-financial text-3xl font-semibold">
              {externalSummaryQuery.isPending ? '...' : formatMoney(externalKnownValue)}
            </p>
            <div className="mt-4 space-y-2">
              {(externalBundle?.providerCoverage ?? []).map(provider => (
                <div key={provider.provider} className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        provider.status === 'healthy'
                          ? 'bg-positive'
                          : provider.status === 'degraded'
                            ? 'bg-warning'
                            : provider.status === 'failing'
                              ? 'bg-negative'
                              : 'bg-muted-foreground'
                      }`}
                    />
                    <span className="uppercase">{provider.provider}</span>
                  </div>
                  <span className="text-muted-foreground">
                    {provider.stale ? 'stale' : provider.configured ? 'configure' : 'manquant'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border/40 bg-card/55 p-4">
            <p className="text-sm font-medium">Allocation externe</p>
            <div className="mt-4 space-y-3">
              {(externalBundle?.allocationByAssetClass ?? []).map(item => (
                <div key={item.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="uppercase tracking-[0.12em] text-muted-foreground">{item.key}</span>
                    <span className="font-financial">{formatMoney(item.value)} · {item.weightPct.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-0">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, item.weightPct)}%` }} />
                  </div>
                </div>
              ))}
              {!externalSummaryQuery.isPending && (externalBundle?.allocationByAssetClass.length ?? 0) === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">Aucun snapshot externe importe.</p>
              ) : null}
            </div>
          </div>
        </div>

        {(externalBundle?.missingMarketDataWarnings.length ?? 0) > 0 ||
        (externalBundle?.unknownCostBasisWarnings.length ?? 0) > 0 ? (
          <div className="rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning">
            {[...(externalBundle?.missingMarketDataWarnings ?? []), ...(externalBundle?.unknownCostBasisWarnings ?? [])]
              .slice(0, 3)
              .map(item => (
                <p key={item}>{item}</p>
              ))}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          {externalPositions.slice(0, 4).map(position => (
            <div key={position.positionKey} className="rounded-2xl border border-border/40 bg-surface-1 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{position.name}</p>
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    {position.provider} · {position.assetClass}
                  </p>
                </div>
                <p className="font-financial text-sm font-semibold">
                  {position.normalizedValue === null
                    ? 'Valeur inconnue'
                    : formatMoney(position.normalizedValue, position.valueCurrency ?? position.currency ?? 'EUR')}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {isAdmin ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground/50">
                Actifs manuels admin
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Aucun actif manuel n est injecte par defaut. Seuls les actifs provider et ceux
                que tu crees ici apparaissent.
              </p>
            </div>
            <Badge variant="outline">
              {manualAssets.length} manuel{manualAssets.length > 1 ? 's' : ''}
            </Badge>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <Card className="border-border/40 bg-card/60">
              <CardHeader>
                <CardTitle>
                  {editingManualAssetId === null
                    ? 'Ajouter un actif manuel'
                    : 'Modifier un actif manuel'}
                </CardTitle>
                <CardDescription>
                  Persistance en base sur le systeme d actifs existant, sans fixture admin
                  hardcodee.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-2 text-sm">
                    <span className="text-muted-foreground">Type</span>
                    <select
                      value={manualAssetDraft.assetType}
                      onChange={event =>
                        setManualAssetDraft(current => ({
                          ...current,
                          assetType: event.target.value as ManualAssetDraft['assetType'],
                        }))
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs"
                    >
                      <option value="manual">Manuel</option>
                      <option value="cash">Cash</option>
                      <option value="investment">Investissement</option>
                    </select>
                  </label>
                  <label className="space-y-2 text-sm" htmlFor="manual-asset-currency">
                    <span className="text-muted-foreground">Devise</span>
                    <Input
                      id="manual-asset-currency"
                      value={manualAssetDraft.currency}
                      onChange={event =>
                        setManualAssetDraft(current => ({
                          ...current,
                          currency: event.target.value,
                        }))
                      }
                      placeholder="EUR"
                      maxLength={8}
                    />
                  </label>
                </div>

                <label className="space-y-2 text-sm" htmlFor="manual-asset-name">
                  <span className="text-muted-foreground">Nom</span>
                  <Input
                    id="manual-asset-name"
                    value={manualAssetDraft.name}
                    onChange={event =>
                      setManualAssetDraft(current => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="PEA perso, immobilier, private equity..."
                    maxLength={120}
                  />
                </label>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-2 text-sm" htmlFor="manual-asset-valuation">
                    <span className="text-muted-foreground">Valorisation</span>
                    <Input
                      id="manual-asset-valuation"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={manualAssetDraft.valuation}
                      onChange={event =>
                        setManualAssetDraft(current => ({
                          ...current,
                          valuation: event.target.value,
                        }))
                      }
                      placeholder="0.00"
                    />
                  </label>
                  <label className="space-y-2 text-sm" htmlFor="manual-asset-valuation-as-of">
                    <span className="text-muted-foreground">Valorisation au</span>
                    <Input
                      id="manual-asset-valuation-as-of"
                      type="datetime-local"
                      value={manualAssetDraft.valuationAsOf}
                      onChange={event =>
                        setManualAssetDraft(current => ({
                          ...current,
                          valuationAsOf: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-2 text-sm" htmlFor="manual-asset-category">
                    <span className="text-muted-foreground">Categorie</span>
                    <Input
                      id="manual-asset-category"
                      value={manualAssetDraft.category}
                      onChange={event =>
                        setManualAssetDraft(current => ({
                          ...current,
                          category: event.target.value,
                        }))
                      }
                      placeholder="Immobilier, cash reserve..."
                      maxLength={64}
                    />
                  </label>
                  <label className="flex items-center gap-3 rounded-xl border border-border/40 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={manualAssetDraft.enabled}
                      onChange={event =>
                        setManualAssetDraft(current => ({
                          ...current,
                          enabled: event.target.checked,
                        }))
                      }
                    />
                    <span>Actif visible dans les vues patrimoine</span>
                  </label>
                </div>

                <label className="space-y-2 text-sm">
                  <span className="text-muted-foreground">Note</span>
                  <textarea
                    value={manualAssetDraft.note}
                    onChange={event =>
                      setManualAssetDraft(current => ({
                        ...current,
                        note: event.target.value,
                      }))
                    }
                    placeholder="Contexte, hypothese de valorisation, source..."
                    maxLength={280}
                    rows={4}
                    className="flex min-h-28 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs"
                  />
                </label>

                <div className="flex flex-wrap justify-end gap-2">
                  {editingManualAssetId !== null ? (
                    <Button type="button" variant="outline" onClick={resetManualAssetForm}>
                      Annuler
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    onClick={handleManualAssetSubmit}
                    disabled={
                      saveManualAssetMutation.isPending ||
                      manualAssetDraft.name.trim().length === 0 ||
                      manualAssetDraft.currency.trim().length === 0 ||
                      manualAssetDraft.valuation.trim().length === 0
                    }
                  >
                    {saveManualAssetMutation.isPending
                      ? 'Enregistrement...'
                      : editingManualAssetId === null
                        ? 'Ajouter'
                        : 'Enregistrer'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/40 bg-card/60">
              <CardHeader>
                <CardTitle>Mes actifs manuels</CardTitle>
                <CardDescription>
                  Historique editable. Aucun actif manuel admin n est precharge.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {manualAssetsQuery.isPending ? (
                  <p className="text-sm text-muted-foreground">
                    Chargement des actifs manuels...
                  </p>
                ) : null}
                {!manualAssetsQuery.isPending && manualAssets.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/40 px-4 py-8 text-center text-sm text-muted-foreground">
                    Aucun actif manuel admin. Ajoute ton premier actif pour l inclure au cockpit.
                  </div>
                ) : null}
                {manualAssets.map(asset => (
                  <div
                    key={asset.assetId}
                    className="rounded-2xl border border-border/40 bg-background/40 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{asset.name}</p>
                          <Badge variant="outline">{ASSET_TYPE_LABEL[asset.type]}</Badge>
                          {!asset.enabled ? <Badge variant="outline">masque</Badge> : null}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatMoney(asset.valuation, asset.currency)}
                          {asset.valuationAsOf ? ` · ${formatDateTime(asset.valuationAsOf)}` : ''}
                        </p>
                        {asset.category ? (
                          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                            {asset.category}
                          </p>
                        ) : null}
                        {asset.note ? (
                          <p className="text-sm text-muted-foreground">{asset.note}</p>
                        ) : null}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingManualAssetId(asset.assetId)
                            setManualAssetDraft(toManualAssetDraft(asset))
                          }}
                        >
                          Modifier
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => deleteManualAssetMutation.mutate(asset.assetId)}
                          disabled={deleteManualAssetMutation.isPending}
                        >
                          Supprimer
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </section>
      ) : null}
    </div>
  )
}
