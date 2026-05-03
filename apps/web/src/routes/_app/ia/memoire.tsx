import { Badge, Button, Input } from '@finance-os/ui/components'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/surfaces/page-header'
import { Panel } from '@/components/surfaces/panel'
import { StatusDot } from '@/components/surfaces/status-dot'
import { authMeQueryOptions } from '@/features/auth-query-options'
import type { AuthMode } from '@/features/auth-types'
import { resolveAuthViewState } from '@/features/auth-view-state'
import { postKnowledgeRebuild } from '@/features/knowledge-api'
import {
  knowledgeContextBundleQueryOptionsWithMode,
  knowledgeQueryKeys,
  knowledgeSchemaQueryOptionsWithMode,
  knowledgeSearchQueryOptionsWithMode,
  knowledgeStatsQueryOptionsWithMode,
} from '@/features/knowledge-query-options'
import type { KnowledgeHit, KnowledgeRetrievalMode } from '@/features/knowledge-types'
import { formatDateTime, toErrorMessage } from '@/lib/format'

const defaultQuery = 'cash drag inflation concentration risk'

export const Route = createFileRoute('/_app/ia/memoire')({
  loader: async ({ context }) => {
    const auth = await context.queryClient.fetchQuery(authMeQueryOptions())
    const mode: AuthMode | undefined =
      auth.mode === 'admin' ? 'admin' : auth.mode === 'demo' ? 'demo' : undefined
    if (!mode) return

    await Promise.all([
      context.queryClient.ensureQueryData(knowledgeStatsQueryOptionsWithMode({ mode })),
      context.queryClient.ensureQueryData(knowledgeSchemaQueryOptionsWithMode({ mode })),
      context.queryClient.ensureQueryData(
        knowledgeSearchQueryOptionsWithMode({
          mode,
          query: defaultQuery,
          retrievalMode: 'hybrid',
        })
      ),
      context.queryClient.ensureQueryData(
        knowledgeContextBundleQueryOptionsWithMode({
          mode,
          query: defaultQuery,
          retrievalMode: 'hybrid',
        })
      ),
    ])
  },
  component: MemoirePage,
})

const percent = (value: number | undefined) => `${Math.round((value ?? 0) * 100)}%`

function MemoirePage() {
  const queryClient = useQueryClient()
  const [query, setQuery] = useState(defaultQuery)
  const [submittedQuery, setSubmittedQuery] = useState(defaultQuery)
  const [retrievalMode, setRetrievalMode] = useState<KnowledgeRetrievalMode>('hybrid')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const authQuery = useQuery(authMeQueryOptions())
  const authViewState = resolveAuthViewState({
    isPending: authQuery.isPending,
    ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}),
  })
  const isDemo = authViewState === 'demo'
  const isAdmin = authViewState === 'admin'
  const authMode: AuthMode | undefined = isAdmin ? 'admin' : isDemo ? 'demo' : undefined

  const modeOptions = authMode ? { mode: authMode } : {}
  const statsQuery = useQuery(knowledgeStatsQueryOptionsWithMode(modeOptions))
  const schemaQuery = useQuery(knowledgeSchemaQueryOptionsWithMode(modeOptions))
  const searchQuery = useQuery(
    knowledgeSearchQueryOptionsWithMode({
      ...modeOptions,
      query: submittedQuery,
      retrievalMode,
    })
  )
  const bundleQuery = useQuery(
    knowledgeContextBundleQueryOptionsWithMode({
      ...modeOptions,
      query: submittedQuery,
      retrievalMode,
    })
  )

  const rebuildMutation = useMutation({
    mutationFn: postKnowledgeRebuild,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: knowledgeQueryKeys.stats() }),
        queryClient.invalidateQueries({ queryKey: knowledgeQueryKeys.schema() }),
        queryClient.invalidateQueries({
          queryKey: knowledgeQueryKeys.query(submittedQuery, retrievalMode),
        }),
        queryClient.invalidateQueries({
          queryKey: knowledgeQueryKeys.contextBundle(submittedQuery, retrievalMode),
        }),
      ])
    },
  })

  useEffect(() => {
    const firstHit = searchQuery.data?.hits[0]?.entity.id
    if (!selectedId && firstHit) {
      setSelectedId(firstHit)
    }
  }, [searchQuery.data?.hits, selectedId])

  const selectedHit = useMemo(
    () =>
      searchQuery.data?.hits.find(hit => hit.entity.id === selectedId) ??
      searchQuery.data?.hits[0] ??
      null,
    [searchQuery.data?.hits, selectedId]
  )
  const topTypes = Object.entries(statsQuery.data?.entityTypeCounts ?? {})
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)

  const degraded =
    statsQuery.data?.degraded || searchQuery.data?.degraded || bundleQuery.data?.degraded || false

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalized = query.trim()
    if (normalized.length > 0) {
      setSubmittedQuery(normalized)
      setSelectedId(null)
    }
  }

  const errorMessage =
    statsQuery.error || schemaQuery.error || searchQuery.error || bundleQuery.error
      ? toErrorMessage(
          statsQuery.error ?? schemaQuery.error ?? searchQuery.error ?? bundleQuery.error
        )
      : null

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Advisor IA · Mémoire"
        icon="[#]"
        title="Mémoire & connaissances"
        description="Inspection de ce que l'Advisor utilise pour expliquer ses conseils. Visualisation graphe 3D prévue plus tard."
      />

      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="Entités" value={statsQuery.data?.entityCount ?? 0} loading={statsQuery.isPending} />
        <Metric label="Relations" value={statsQuery.data?.relationCount ?? 0} loading={statsQuery.isPending} />
        <Metric label="Contradictions" value={statsQuery.data?.contradictionCount ?? 0} loading={statsQuery.isPending} />
        <Metric label="Latence query" value={`${Math.round(statsQuery.data?.queryLatencyMs ?? 0)} ms`} loading={statsQuery.isPending} />
      </section>

      {errorMessage ? (
        <Panel tone="warning" title="Surface dégradée" icon={<StatusDot tone="warn" size={8} pulse />}>
          <p className="text-sm text-muted-foreground">{errorMessage}</p>
        </Panel>
      ) : null}

      <Panel
        tone={degraded ? 'warning' : 'brand'}
        title="Recherche hybride"
        description="Recherche, temporalité, confiance et provenance. Surface d'inspection, pas une source de vérité financière."
        icon={<span aria-hidden="true">[#]</span>}
        actions={
          <div className="flex items-center gap-2 text-xs">
            <StatusDot tone={degraded ? 'warn' : 'ok'} size={7} pulse={degraded} />
            <span className="text-muted-foreground">{degraded ? 'fallback' : (authMode ?? '...')}</span>
          </div>
        }
      >
        <form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleSubmit}>
          <Input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="cash drag, inflation, AI model release, backtesting bias..."
            className="min-h-11 flex-1"
          />
          <div className="flex gap-2">
            {(['hybrid', 'graph', 'fulltext', 'vector'] as const).map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => setRetrievalMode(mode)}
                className={`min-h-11 rounded-lg border px-3 text-xs font-medium transition-colors ${
                  retrievalMode === mode
                    ? 'border-primary/50 bg-primary/12 text-primary'
                    : 'border-border/60 bg-surface-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground'
                }`}
              >
                {mode}
              </button>
            ))}
            <Button type="submit" className="min-h-11">Chercher</Button>
          </div>
        </form>
      </Panel>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <Panel title="Concepts trouvés" tone="violet" icon={<span aria-hidden="true">::</span>}>
          <div className="space-y-2">
            {searchQuery.isPending ? (
              <p className="py-8 text-sm text-muted-foreground">Chargement...</p>
            ) : searchQuery.data?.hits.length ? (
              searchQuery.data.hits.map(hit => (
                <KnowledgeHitButton
                  key={hit.entity.id}
                  hit={hit}
                  selected={hit.entity.id === selectedHit?.entity.id}
                  onSelect={() => setSelectedId(hit.entity.id)}
                />
              ))
            ) : (
              <p className="py-8 text-sm text-muted-foreground">
                Aucun concept suffisamment proche. Le bundle signalera les inconnues.
              </p>
            )}
          </div>
        </Panel>

        <Panel title="Inspection" tone="brand" icon={<span aria-hidden="true">[]</span>}>
          {selectedHit ? (
            <div className="space-y-5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{selectedHit.entity.type}</Badge>
                  <Badge variant="secondary">{percent(selectedHit.entity.confidence)} confiance</Badge>
                  <Badge variant="secondary">{selectedHit.entity.scope}</Badge>
                </div>
                <h2 className="mt-3 text-xl font-semibold tracking-tight">{selectedHit.entity.label}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{selectedHit.entity.description}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Score label="BM25" value={selectedHit.score.fulltext} />
                <Score label="Vector" value={selectedHit.score.vector} />
                <Score label="Graphe" value={selectedHit.score.graph} />
              </div>

              <div className="rounded-xl border border-border/60 bg-surface-1 p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary/75">pourquoi ce contexte</p>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {selectedHit.why.map(reason => (
                    <li key={reason} className="flex gap-2">
                      <span className="text-primary">-</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Temporal label="Observé" value={selectedHit.entity.observedAt ?? null} />
                <Temporal label="Valide depuis" value={selectedHit.entity.validFrom ?? null} />
                <Temporal label="Valide jusque" value={selectedHit.entity.validTo ?? null} />
                <Temporal label="Ingestion" value={selectedHit.entity.ingestionTimestamp} />
              </div>

              <div>
                <p className="text-sm font-medium">Relations</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedHit.relations.length ? (
                    selectedHit.relations.slice(0, 10).map(relation => (
                      <Badge key={relation.id} variant="outline" className="max-w-full truncate">{relation.type}</Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">Aucune relation proche dans cette réponse.</span>
                  )}
                </div>
              </div>

              {selectedHit.contradictoryEvidence.length ? (
                <div className="rounded-xl border border-warning/30 bg-warning/8 p-4">
                  <p className="text-sm font-medium text-warning">Contradictions / garde-fous</p>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {selectedHit.contradictoryEvidence.map(item => (
                      <li key={item.id}>{item.label}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="py-8 text-sm text-muted-foreground">Sélectionnez un concept.</p>
          )}
        </Panel>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Panel title="Context bundle AI Advisor" tone="positive" icon={<span aria-hidden="true">AI</span>}>
          {bundleQuery.data ? (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-muted-foreground">{bundleQuery.data.summary}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <Score label="Confiance" value={bundleQuery.data.confidence} />
                <Score label="Récence" value={bundleQuery.data.recency} />
                <div className="rounded-xl bg-surface-1 p-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">tokens</p>
                  <p className="mt-1 font-financial text-lg font-semibold">{bundleQuery.data.tokenEstimate}</p>
                </div>
              </div>
              {bundleQuery.data.unknowns.length ? (
                <div className="rounded-xl border border-border/60 bg-surface-1 p-4">
                  <p className="text-sm font-medium">Inconnues explicites</p>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {bundleQuery.data.unknowns.map(item => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="py-8 text-sm text-muted-foreground">Aucun bundle disponible.</p>
          )}
        </Panel>

        <Panel title="Schema & rebuild" tone="plain" icon={<span aria-hidden="true">{'{}'}</span>}>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Backend: <span className="text-foreground">{statsQuery.data?.backend ?? '-'}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Vector: <span className="text-foreground">{statsQuery.data?.vectorBackend ?? '-'}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Dernier rebuild:{' '}
                <span className="text-foreground">{formatDateTime(statsQuery.data?.lastSuccessfulRebuildAt ?? null)}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Schema: <span className="text-foreground">{schemaQuery.data?.schemaVersion ?? '-'}</span>
              </p>
            </div>

            {statsQuery.data?.backendHealth ? (
              <div className="rounded-xl border border-border/60 bg-surface-1 p-3 text-xs">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary/75">backends</p>
                <div className="mt-2 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Neo4j</span>
                    <span className="flex items-center gap-1.5">
                      <StatusDot size={6} tone={statsQuery.data.backendHealth.neo4j.available ? 'ok' : 'warn'} />
                      <span className="text-foreground">
                        {statsQuery.data.backendHealth.neo4j.available
                          ? statsQuery.data.backendHealth.neo4j.database
                          : (statsQuery.data.backendHealth.neo4j.lastError ?? 'unavailable')}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Qdrant</span>
                    <span className="flex items-center gap-1.5">
                      <StatusDot size={6} tone={statsQuery.data.backendHealth.qdrant.available ? 'ok' : 'warn'} />
                      <span className="text-foreground">
                        {statsQuery.data.backendHealth.qdrant.available
                          ? statsQuery.data.backendHealth.qdrant.collection
                          : (statsQuery.data.backendHealth.qdrant.lastError ?? 'unavailable')}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Production</span>
                    <span className="text-foreground">
                      {statsQuery.data.backendHealth.productionActive ? 'active' : 'fallback (local cache)'}
                    </span>
                  </div>
                  {statsQuery.data.backendHealth.degradedReasons.length ? (
                    <p className="text-warning">
                      {statsQuery.data.backendHealth.degradedReasons.slice(0, 3).join(' · ')}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {topTypes.map(([type, count]) => (
                <Badge key={type} variant="outline">{type}: {count}</Badge>
              ))}
            </div>

            <Button
              type="button"
              disabled={!isAdmin || rebuildMutation.isPending}
              onClick={() => rebuildMutation.mutate()}
              className="w-full"
            >
              {rebuildMutation.isPending ? 'Rebuild...' : 'Rebuild seed graph'}
            </Button>
            {!isAdmin ? (
              <p className="text-xs text-muted-foreground">Mode démo: consultation déterministe uniquement, aucune mutation.</p>
            ) : null}
            {rebuildMutation.error ? (
              <p className="text-xs text-negative">{toErrorMessage(rebuildMutation.error)}</p>
            ) : null}
          </div>
        </Panel>
      </section>
    </div>
  )
}

function Metric({ label, value, loading }: { label: string; value: number | string; loading: boolean }) {
  return (
    <Panel tone="plain" bodyClassName="p-4">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-financial text-2xl font-semibold">{loading ? '-' : value}</p>
    </Panel>
  )
}

function KnowledgeHitButton({ hit, selected, onSelect }: { hit: KnowledgeHit; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border p-4 text-left transition-colors ${
        selected ? 'border-primary/40 bg-primary/10' : 'border-border/60 bg-surface-1 hover:bg-surface-2'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{hit.entity.label}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{hit.entity.description}</p>
        </div>
        <span className="font-financial text-sm text-primary">{percent(hit.score.total)}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {hit.entity.tags.slice(0, 4).map(tag => (
          <span key={tag} className="rounded bg-background px-2 py-1 text-[11px] text-muted-foreground">{tag}</span>
        ))}
      </div>
    </button>
  )
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-surface-1 p-3">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-financial text-lg font-semibold">{percent(value)}</p>
      <div className="mt-2 h-1.5 rounded-full bg-background">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} />
      </div>
    </div>
  )
}

function Temporal({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-xl border border-border/50 bg-surface-1 p-3">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm text-foreground">{formatDateTime(value)}</p>
    </div>
  )
}
