import { useDeferredValue, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Separator } from '@finance-os/ui/components'
import { postDashboardNewsIngest } from '@/features/dashboard-api'
import { dashboardNewsQueryOptionsWithMode } from '@/features/dashboard-query-options'
import type { AuthMode } from '@/features/auth-types'
import type { DashboardNewsSignalCard } from '@/features/dashboard-types'
import { rankNewsByRelevance } from './relevance-scoring'
import { NewsSignalCard } from './news-signal-card'

const formatDateTime = (value: string | null) => {
  if (!value) {
    return 'n/a'
  }

  return new Date(value).toLocaleString()
}

const formatCompactNumber = (value: number) => {
  return new Intl.NumberFormat('fr-FR', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

const statusTone: Record<string, string> = {
  healthy: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  degraded: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  failing: 'border-destructive/30 bg-destructive/10 text-destructive',
  idle: 'border-border/60 bg-surface-1 text-muted-foreground',
}

const hasXTwitterSource = (item: DashboardNewsSignalCard) => {
  return item.sources.some(source => source.provider === 'x_twitter')
}

const computeInfluenceScore = (item: DashboardNewsSignalCard) => {
  return Math.round(item.marketImpactScore * 0.55 + item.confidence * 0.3 + item.novelty * 0.15)
}

export function NewsFeed({ mode }: { mode: AuthMode }) {
  const queryClient = useQueryClient()
  const [topic, setTopic] = useState('')
  const [source, setSource] = useState('')
  const [domain, setDomain] = useState('')
  const [eventType, setEventType] = useState('')
  const [xOnly, setXOnly] = useState(false)
  const [highInfluenceOnly, setHighInfluenceOnly] = useState(false)

  const deferredTopic = useDeferredValue(topic.trim())
  const deferredSource = useDeferredValue(source.trim())
  const deferredDomain = useDeferredValue(domain.trim())
  const deferredEventType = useDeferredValue(eventType.trim())

  const queryParams = {
    mode,
    ...(deferredTopic ? { topic: deferredTopic } : {}),
    ...(deferredSource ? { source: deferredSource } : {}),
    ...(deferredDomain ? { domain: deferredDomain } : {}),
    ...(deferredEventType ? { eventType: deferredEventType } : {}),
    limit: 24,
  } as const

  const newsQuery = useQuery(dashboardNewsQueryOptionsWithMode(queryParams))
  const payload = newsQuery.data
  const rankedItems = payload
    ? rankNewsByRelevance(payload.items, {
        topicFilter: deferredTopic,
        sourceFilter: deferredSource,
        domainFilter: deferredDomain,
        eventTypeFilter: deferredEventType,
      })
    : []
  const curatedItems = rankedItems.filter(({ item }) => {
    if (xOnly && !hasXTwitterSource(item)) {
      return false
    }
    if (highInfluenceOnly && computeInfluenceScore(item) < 75) {
      return false
    }
    return true
  })
  const xSignalCount = rankedItems.filter(({ item }) => hasXTwitterSource(item)).length
  const highInfluenceCount = rankedItems.filter(({ item }) => computeInfluenceScore(item) >= 75).length

  const ingestMutation = useMutation({
    mutationFn: postDashboardNewsIngest,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['dashboard', 'news'] })
    },
  })

  const resilience = payload?.resilience
  const showPartialState = resilience?.status === 'degraded'
  const showUnavailableState = resilience?.status === 'unavailable'
  const topSignals = payload?.contextPreview.topSignals.slice(0, 3) ?? []
  const topClusters = payload?.clusters.slice(0, 4) ?? []

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-border/60 bg-[linear-gradient(135deg,color-mix(in_oklch,var(--surface-1)_84%,white)_0%,color-mix(in_oklch,var(--surface-0)_92%,var(--primary))_100%)]">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{mode === 'admin' ? 'Admin live cache' : 'Demo deterministic'}</Badge>
                {resilience ? <Badge variant="secondary">{resilience.status}</Badge> : null}
                {payload?.dataset ? <Badge variant="ghost">{payload.dataset.source}</Badge> : null}
              </div>
              <CardTitle className="text-2xl leading-tight">
                Radar macro-financier et evenementiel
              </CardTitle>
              <CardDescription className="max-w-3xl text-sm">
                Lecture cache-first, signaux enrichis, provenance multi-source et preparation de contexte pour une future IA d'anticipation.
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" onClick={() => newsQuery.refetch()}>
                Rafraichir la lecture
              </Button>
              {mode === 'admin' ? (
                <Button
                  type="button"
                  onClick={() => ingestMutation.mutate()}
                  disabled={ingestMutation.isPending}
                >
                  {ingestMutation.isPending ? 'Ingestion...' : 'Lancer une ingestion'}
                </Button>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-border/50 bg-surface-1/90 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Fraicheur</p>
              <p className="mt-2 text-sm font-medium">{formatDateTime(payload?.lastUpdatedAt ?? null)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {payload?.staleCache ? 'Cache stale but usable' : 'Cache aligned with latest successful ingestion'}
              </p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-surface-1/90 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Top impacts</p>
              <p className="mt-2 text-lg font-semibold">{formatCompactNumber(payload?.contextPreview.mostImpactedSectors.length ?? 0)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Secteurs les plus sollicites par les signaux en cache
              </p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-surface-1/90 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Providers</p>
              <p className="mt-2 text-lg font-semibold">{payload?.providers.length ?? 0}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {payload?.providers.filter(provider => provider.status === 'healthy').length ?? 0} healthy
              </p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-surface-1/90 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Dedupe</p>
              <p className="mt-2 text-lg font-semibold">
                {Math.round((payload?.metrics.dedupeDropRate ?? 0) * 100)}%
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Fusion cross-source sur les dernieres ingestions
              </p>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card className="border-border/60 bg-surface-1/80">
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Input value={topic} placeholder="Topic exact ex: macro" onChange={event => setTopic(event.target.value)} />
            <Input value={source} placeholder="Source exacte ou provider" onChange={event => setSource(event.target.value)} />
            <Input value={domain} placeholder="Domaine exact ex: geopolitics" onChange={event => setDomain(event.target.value)} />
            <Input value={eventType} placeholder="Event type exact ex: filing_8k" onChange={event => setEventType(event.target.value)} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant={xOnly ? 'default' : 'secondary'} size="sm" onClick={() => setXOnly(value => !value)}>
              X/Twitter influent ({xSignalCount})
            </Button>
            <Button
              type="button"
              variant={highInfluenceOnly ? 'default' : 'secondary'}
              size="sm"
              onClick={() => setHighInfluenceOnly(value => !value)}
            >
              Influence {'>='} 75 ({highInfluenceCount})
            </Button>
            <p className="text-xs text-muted-foreground">
              Curation locale: score influence = 55% impact + 30% confiance + 15% nouveaute.
            </p>
          </div>
        </CardContent>
      </Card>

      {newsQuery.isLoading ? <p className="text-sm text-muted-foreground">Chargement des signaux...</p> : null}

      {showPartialState ? (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          Le mode fail-soft degrade est actif. Les signaux restent utilisables, mais un ou plusieurs providers sont en reprise.
        </div>
      ) : null}

      {showUnavailableState ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          La lecture news est temporairement indisponible. Le fallback demo ou cache minimal reste actif.
        </div>
      ) : null}

      {payload?.providerError && !showUnavailableState ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Derniere erreur provider: {payload.providerError.message}
        </div>
      ) : null}

      {ingestMutation.isError ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          L'ingestion manuelle a echoue.
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="space-y-5">
          <Card className="border-border/60 bg-surface-1">
            <CardHeader>
              <CardTitle className="text-lg">Signal leaders</CardTitle>
              <CardDescription>Les trois signaux les plus denses pour alimenter un raisonnement macro.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              {topSignals.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun signal top-level disponible.</p>
              ) : null}
              {topSignals.map(signal => (
                <div key={signal.id} className="rounded-2xl border border-border/50 bg-background/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold leading-snug">{signal.title}</p>
                    <Badge variant="secondary">{signal.direction}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{new Date(signal.publishedAt).toLocaleString()}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="outline">impact {signal.marketImpactScore}</Badge>
                    <Badge variant="outline">confidence {signal.confidence}</Badge>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {signal.whyItMatters[0] ?? 'Signal pret pour une lecture IA future.'}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-surface-1">
            <CardHeader>
              <CardTitle className="text-lg">Flux enrichi</CardTitle>
              <CardDescription>Classement UI adosse aux scores backend, puis ajuste par vos filtres actifs.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {payload && curatedItems.length === 0 ? (
                deferredTopic || deferredSource || deferredDomain || deferredEventType || xOnly || highInfluenceOnly ? (
                  <p className="text-sm text-muted-foreground">Aucun signal ne correspond aux filtres actifs.</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Aucun signal n'est encore disponible dans le cache.</p>
                )
              ) : null}

              {curatedItems.map(({ item, score, reasons }) => (
                <NewsSignalCard
                  key={item.id}
                  item={item}
                  score={score}
                  reasons={reasons}
                  influenceScore={computeInfluenceScore(item)}
                  highlightsX={hasXTwitterSource(item)}
                />
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="border-border/60 bg-surface-1">
            <CardHeader>
              <CardTitle className="text-lg">Clusters d'evenements</CardTitle>
              <CardDescription>Regroupements destines a reduire le bruit cross-source.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {topClusters.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun cluster disponible.</p>
              ) : null}
              {topClusters.map(cluster => (
                <div key={cluster.clusterId} className="rounded-2xl border border-border/50 bg-background/80 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold leading-snug">{cluster.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {cluster.signalCount} signaux / {cluster.sourceCount} sources / {new Date(cluster.latestPublishedAt).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant="outline">{cluster.direction}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {cluster.topDomains.slice(0, 3).map(domainEntry => (
                      <Badge key={`${cluster.clusterId}-${domainEntry}`} variant="ghost">{domainEntry}</Badge>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-surface-1">
            <CardHeader>
              <CardTitle className="text-lg">Sectors and entities</CardTitle>
              <CardDescription>Ce qui concentre le plus de score d'impact dans le bundle courant.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Secteurs</p>
                <div className="mt-3 space-y-2">
                  {(payload?.contextPreview.mostImpactedSectors ?? []).slice(0, 5).map(entry => (
                    <div key={entry.sector} className="flex items-center justify-between gap-3 text-sm">
                      <span>{entry.sector}</span>
                      <span className="font-medium">{entry.score}</span>
                    </div>
                  ))}
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Entites</p>
                <div className="mt-3 space-y-2">
                  {(payload?.contextPreview.mostImpactedEntities ?? []).slice(0, 5).map(entry => (
                    <div key={entry.entity} className="flex items-center justify-between gap-3 text-sm">
                      <span>{entry.entity}</span>
                      <span className="font-medium">{entry.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-surface-1">
            <CardHeader>
              <CardTitle className="text-lg">Sante des providers</CardTitle>
              <CardDescription>Diagnostics de collecte exposes cote lecture cache-only.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(payload?.providers ?? []).map(provider => (
                <div key={provider.provider} className={`rounded-2xl border px-4 py-3 ${statusTone[provider.status] ?? statusTone.idle}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">{provider.label}</p>
                    <Badge variant="outline">{provider.status}</Badge>
                  </div>
                  <p className="mt-2 text-xs">
                    last success: {formatDateTime(provider.lastSuccessAt)} / last fetched: {provider.lastFetchedCount}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
