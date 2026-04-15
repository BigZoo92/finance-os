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
  deleteDashboardManualAsset,
  patchDashboardManualAsset,
  postDashboardManualAsset,
} from '@/features/dashboard-api'
import type { DashboardManualAssetResponse, DashboardRange } from '@/features/dashboard-types'
import { adaptDashboardSummaryLegacy } from '@/features/dashboard-legacy-adapter'
import { getTrendDirection } from '@/components/dashboard/trend-visuals'
import { formatDateTime, formatMoney } from '@/lib/format'
import { D3Sparkline } from '@/components/ui/d3-sparkline'
import { RangePill } from '@/components/surfaces/range-pill'
import { CircularEmblem } from '@/components/brand/circular-emblem'
import ShapeBlur from '@/components/reactbits/shape-blur'

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

  return (
    <div className="space-y-10">
      {/* Hero — balance display with ShapeBlur backdrop + CircularEmblem orbit */}
      <section className="relative isolate overflow-hidden rounded-[28px] border border-border/60 px-5 py-8 md:px-10 md:py-10" style={{ background: 'var(--surface-0)' }}>
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <ShapeBlur
            variation={3}
            shapeSize={1.4}
            roundness={0.5}
            borderSize={0.04}
            circleSize={0.5}
            circleEdge={1}
          />
        </div>
        <div className="pointer-events-none absolute -right-12 -bottom-16 hidden h-72 w-72 rounded-full opacity-50 md:block" style={{ background: 'radial-gradient(circle, oklch(from var(--accent-2) l c h / 28%), transparent 65%)' }} />

        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="min-w-0"
          >
            <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-primary/85">
              <span aria-hidden="true">◊</span>
              Patrimoine
            </p>
            <h2 className="mt-1 text-4xl font-bold tracking-tighter md:text-6xl">
              {summaryQuery.isPending ? (
                <span className="inline-block h-10 w-48 animate-shimmer rounded-xl" />
              ) : (
                <span className="font-financial text-aurora">{formatMoney(adapted.totals.balance)}</span>
              )}
            </h2>
            {!summaryQuery.isPending ? (
              <div className="mt-2 flex items-center gap-2">
                <Badge
                  variant={
                    trend === 'up' ? 'positive' : trend === 'down' ? 'destructive' : 'outline'
                  }
                  className="text-xs"
                >
                  {trend === 'up'
                    ? `+${formatMoney(delta)}`
                    : trend === 'down'
                      ? formatMoney(delta)
                      : 'stable'}
                </Badge>
                <span className="text-xs text-muted-foreground/55">
                  sur {range === '7d' ? '7 jours' : range === '90d' ? '90 jours' : '30 jours'}
                </span>
              </div>
            ) : null}
          </motion.div>

          <div className="flex items-center gap-6">
            <CircularEmblem text="· PATRIMOINE · NET · ACTIFS · LIQUIDES " size={132}>
              <span className="font-mono text-2xl text-primary" aria-hidden="true">◊</span>
            </CircularEmblem>
            <RangePill
              layoutId="patrimoine-range"
              ariaLabel="Période"
              options={RANGES.map(r => ({ label: r.label, value: r.value }))}
              value={range}
              onChange={next => navigate({ search: { range: next } })}
            />
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground/50">Evolution patrimoine</p>
        </div>
        {sparkData.length > 1 ? (
          <D3Sparkline
            data={sparkData}
            height={180}
            showArea
            showTooltip
            showDots
            animate
            formatValue={value => formatMoney(value)}
          />
        ) : (
          <div className="flex h-[160px] items-center justify-center rounded-2xl border border-dashed border-border/30">
            <span className="font-mono text-xs text-muted-foreground/40">
              [ donnees insuffisantes ]
            </span>
          </div>
        )}
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
                  <label className="space-y-2 text-sm">
                    <span className="text-muted-foreground">Devise</span>
                    <Input
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

                <label className="space-y-2 text-sm">
                  <span className="text-muted-foreground">Nom</span>
                  <Input
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
                  <label className="space-y-2 text-sm">
                    <span className="text-muted-foreground">Valorisation</span>
                    <Input
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
                  <label className="space-y-2 text-sm">
                    <span className="text-muted-foreground">Valorisation au</span>
                    <Input
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
                  <label className="space-y-2 text-sm">
                    <span className="text-muted-foreground">Categorie</span>
                    <Input
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
