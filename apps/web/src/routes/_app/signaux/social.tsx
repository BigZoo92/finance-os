import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { Badge } from '@finance-os/ui/components'
import { authMeQueryOptions } from '@/features/auth-query-options'
import { resolveAuthViewState } from '@/features/auth-view-state'
import {
  createSignalSource,
  deleteSignalSource,
  postManualImport,
  updateSignalSource,
  type SignalSource,
  type SignalSourceGroup,
} from '@/features/signals-api'
import {
  signalHealthQueryOptions,
  signalSourcesQueryOptions,
} from '@/features/signals-query-options'
import {
  fetchXHealth,
  lookupXHandle,
  resolveAllXSources,
  runXDailyPreviousDaySync,
  type XDailySyncResponse,
  type XHealthResponse,
  type XProfileLookupResponse,
  type XResolveAllResponse,
} from '@/features/x-twitter-api'
import {
  capReasonLabel,
  formatCount,
  formatUsd,
  resolveBudgetTone,
  verificationStatusLabel,
} from '@/features/x-twitter-view-model'
import { PageHeader } from '@/components/surfaces/page-header'
import { Panel } from '@/components/surfaces/panel'
import { StatusDot } from '@/components/surfaces/status-dot'

const xHealthQueryOptions = () => ({
  queryKey: ['x-twitter', 'health'] as const,
  queryFn: fetchXHealth,
  staleTime: 30_000,
})

export const Route = createFileRoute('/_app/signaux/social')({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(authMeQueryOptions()),
      context.queryClient.ensureQueryData(signalSourcesQueryOptions()),
      context.queryClient.ensureQueryData(signalHealthQueryOptions()),
    ])
  },
  component: SignauxSocialPage,
})

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

function SignauxSocialPage() {
  const authQuery = useQuery(authMeQueryOptions())
  const authViewState = resolveAuthViewState({
    isPending: authQuery.isPending,
    ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}),
  })
  const isAdmin = authViewState === 'admin'

  const [activeTab, setActiveTab] = useState<SignalSourceGroup>('finance')
  const [showAddForm, setShowAddForm] = useState(false)
  const [showManualImport, setShowManualImport] = useState(false)

  const sourcesQuery = useQuery(signalSourcesQueryOptions())
  const healthQuery = useQuery(signalHealthQueryOptions())
  const queryClient = useQueryClient()

  const sources = sourcesQuery.data?.items ?? []
  const financeSources = sources.filter(s => s.group === 'finance')
  const aiTechSources = sources.filter(s => s.group === 'ai_tech')
  const activeSources = activeTab === 'finance' ? financeSources : aiTechSources

  const counts = sourcesQuery.data?.counts ?? { finance: 0, ai_tech: 0 }
  const xSources = sources.filter(s => s.provider === 'x_twitter')
  const readiness = {
    total: xSources.length,
    verified: xSources.filter(s => s.verificationStatus === 'verified').length,
    unresolved: xSources.filter(
      s => s.verificationStatus === 'unresolved' || s.verificationStatus === undefined
    ).length,
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Intelligence & Admin"
        icon="⊕"
        title="Social Intelligence — X / Twitter & Bluesky"
        description="Page unique pour la santé du provider X, les comptes suivis, le lookup riche, et le sync J-1. Espace expert, pas routine quotidienne."
      />

      {/* Provider status banner */}
      <ProviderStatusBanner health={healthQuery.data} isLoading={healthQuery.isPending} />

      {/* X provider health (admin only) */}
      {isAdmin && <XHealthPanel />}

      {/* X readiness banner — surfaces unresolved accounts with one-click batch resolve */}
      {isAdmin && readiness.total > 0 && <XReadinessBanner readiness={readiness} />}

      {/* Tab switcher */}
      <div className="flex gap-2">
        <TabButton
          active={activeTab === 'finance'}
          onClick={() => setActiveTab('finance')}
          label="Finance"
          count={counts.finance}
        />
        <TabButton
          active={activeTab === 'ai_tech'}
          onClick={() => setActiveTab('ai_tech')}
          label="IA / Tech"
          count={counts.ai_tech}
        />
      </div>

      {/* Action buttons */}
      {isAdmin && (
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-lg bg-surface-1 px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-surface-2 transition-colors"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            {showAddForm ? 'Annuler' : '+ Ajouter un compte'}
          </button>
          <button
            type="button"
            className="rounded-lg bg-surface-1 px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-surface-2 transition-colors"
            onClick={() => setShowManualImport(!showManualImport)}
          >
            {showManualImport ? 'Annuler' : 'Import manuel'}
          </button>
        </div>
      )}

      {/* Add source form */}
      {showAddForm && isAdmin && (
        <AddSourceForm
          defaultGroup={activeTab}
          onCreated={() => {
            setShowAddForm(false)
            queryClient.invalidateQueries({ queryKey: ['signal-sources'] })
          }}
        />
      )}

      {/* Manual import panel */}
      {showManualImport && isAdmin && (
        <ManualImportPanel
          onImported={() => {
            setShowManualImport(false)
            queryClient.invalidateQueries({ queryKey: ['signal-runs'] })
          }}
        />
      )}

      {/* Source list */}
      {sourcesQuery.isPending && (
        <Panel>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 rounded-lg bg-surface-1" />
            ))}
          </div>
        </Panel>
      )}

      {sourcesQuery.isError && (
        <Panel>
          <p className="text-text-secondary text-sm">
            Erreur lors du chargement des sources. Verifiez la connexion.
          </p>
        </Panel>
      )}

      {!sourcesQuery.isPending && !sourcesQuery.isError && activeSources.length === 0 && (
        <Panel>
          <div className="py-8 text-center">
            <p className="text-text-secondary text-sm">
              {activeTab === 'finance'
                ? "Aucun compte finance surveille. Ajoutez des comptes X, Bluesky ou d'autres sources."
                : "Aucun compte IA/Tech surveille. Ajoutez des comptes pour suivre les nouveaux modeles, outils et mises a jour."}
            </p>
            {!isAdmin && (
              <p className="text-text-tertiary text-xs mt-2">
                Connectez-vous en admin pour ajouter des comptes.
              </p>
            )}
          </div>
        </Panel>
      )}

      {activeSources.length > 0 && (
        <div className="space-y-2">
          {activeSources.map(source => (
            <SourceCard key={source.id} source={source} isAdmin={isAdmin} />
          ))}
        </div>
      )}

      {/* Daily sync (X J-1) — admin only */}
      {isAdmin && <DailySyncPanel />}

      {/* Context note */}
      <p className="text-text-tertiary text-xs">
        Ces signaux alimentent l'IA Advisor et le graphe de connaissances. Ils ne sont pas des
        conseils financiers. Les donnees sociales sont normalisees, scorees et deduplicees avant
        integration.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean
  onClick: () => void
  label: string
  count: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? 'bg-primary/15 text-primary border border-primary/30'
          : 'bg-surface-1 text-text-secondary hover:bg-surface-2 border border-transparent'
      }`}
    >
      {label}
      <span className="ml-1.5 text-xs opacity-70">({count})</span>
    </button>
  )
}

function ProviderStatusBanner({
  health,
  isLoading,
}: {
  health: Awaited<ReturnType<typeof import('@/features/signals-api').fetchSignalHealth>> | undefined
  isLoading: boolean
}) {
  if (isLoading || !health) return null

  const providers = health.providers ?? {}
  const entries = Object.entries(providers)

  return (
    <Panel>
      <div className="flex flex-wrap gap-4">
        {entries.map(([key, info]) => (
          <div key={key} className="flex items-center gap-2">
            <StatusDot tone={info.configured && info.enabled ? 'ok' : info.configured ? 'idle' : 'err'} />
            <span className="text-sm text-text-secondary">{providerLabel(key)}</span>
            {!info.configured && (
              <Badge variant="outline" className="text-xs">
                Non configure
              </Badge>
            )}
            {info.configured && !info.enabled && (
              <Badge variant="outline" className="text-xs">
                Desactive
              </Badge>
            )}
          </div>
        ))}
      </div>
    </Panel>
  )
}

function providerLabel(key: string): string {
  const labels: Record<string, string> = {
    x_twitter: 'X / Twitter',
    bluesky: 'Bluesky',
    manual_import: 'Import manuel',
  }
  return labels[key] ?? key
}

function SourceCard({ source, isAdmin }: { source: SignalSource; isAdmin: boolean }) {
  const queryClient = useQueryClient()

  const toggleMutation = useMutation({
    mutationFn: () => updateSignalSource(source.id, { enabled: !source.enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['signal-sources'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteSignalSource(source.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['signal-sources'] }),
  })

  const refreshMutation = useMutation({
    mutationFn: () =>
      resolveAllXSources({ force: true, sourceIds: [source.id] }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['signal-sources'] })
      void queryClient.invalidateQueries({ queryKey: ['x-twitter', 'health'] })
    },
  })

  const isX = source.provider === 'x_twitter'
  const profile = source.profileMetadata ?? null
  const avatar = source.profileImageUrl ?? null
  const canonicalUsername = profile?.username ?? sanitizeHandleForDisplay(source.handle)
  const verificationTone: 'ok' | 'warn' | 'idle' =
    !isX
      ? 'idle'
      : source.verificationStatus === 'verified'
        ? 'ok'
        : 'warn'

  return (
    <Panel>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 gap-3">
          {avatar && (
            <img
              src={avatar}
              alt={`avatar de ${canonicalUsername}`}
              className="h-12 w-12 shrink-0 rounded-full border border-surface-3 object-cover"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusDot tone={source.enabled ? 'ok' : 'idle'} />
              <span className="truncate font-medium text-text-primary">
                {profile?.name ?? source.displayName}
              </span>
              <Badge variant="outline" className="text-xs shrink-0">
                {providerLabel(source.provider)}
              </Badge>
              {isX && (
                <Badge
                  variant={verificationTone === 'ok' ? 'positive' : 'warning'}
                  className="text-[10px]"
                  data-testid={`source-verification-${source.id}`}
                >
                  {source.verificationStatus === 'verified'
                    ? 'vérifié'
                    : 'non résolu'}
                </Badge>
              )}
              {profile?.verified && (
                <Badge variant="positive" className="text-[10px]">
                  X verified{profile.verifiedType ? ` (${profile.verifiedType})` : ''}
                </Badge>
              )}
              {profile?.protected && (
                <Badge variant="outline" className="text-[10px]">
                  privé
                </Badge>
              )}
            </div>
            <p className="text-text-secondary text-sm mt-0.5">@{canonicalUsername}</p>
            {profile?.description && (
              <p className="mt-1 line-clamp-2 max-w-2xl text-xs text-text-secondary">
                {profile.description}
              </p>
            )}
            {profile?.publicMetrics && (
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-text-tertiary">
                {profile.publicMetrics.followersCount != null && (
                  <span>
                    Followers: <strong className="text-text-secondary">
                      {profile.publicMetrics.followersCount.toLocaleString('fr-FR')}
                    </strong>
                  </span>
                )}
                {profile.publicMetrics.followingCount != null && (
                  <span>
                    Following: {profile.publicMetrics.followingCount.toLocaleString('fr-FR')}
                  </span>
                )}
                {profile.publicMetrics.tweetCount != null && (
                  <span>
                    Tweets: {profile.publicMetrics.tweetCount.toLocaleString('fr-FR')}
                  </span>
                )}
                {profile.publicMetrics.listedCount != null && (
                  <span>
                    Listed: {profile.publicMetrics.listedCount.toLocaleString('fr-FR')}
                  </span>
                )}
              </div>
            )}
            {source.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {source.tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-3 mt-1.5 text-text-tertiary text-xs">
              {source.lastFetchedAt && (
                <span>
                  Dernier fetch: {new Date(source.lastFetchedAt).toLocaleDateString('fr-FR')}{' '}
                  {new Date(source.lastFetchedAt).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}
              {source.lastFetchedCount != null && <span>{source.lastFetchedCount} items</span>}
              {source.profileCachedAt && (
                <span>
                  Profil vérifié: {new Date(source.profileCachedAt).toLocaleDateString('fr-FR')}
                </span>
              )}
              {isX && source.externalId && (
                <span className="font-mono text-[10px] opacity-70">id:{source.externalId}</span>
              )}
              {source.lastError && (
                <span className="text-negative">Erreur: {source.lastError}</span>
              )}
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="flex shrink-0 items-center gap-1">
            {isX && (
              <button
                type="button"
                onClick={() => refreshMutation.mutate()}
                disabled={refreshMutation.isPending}
                className="rounded px-2 py-1 text-xs text-text-secondary hover:bg-surface-2 transition-colors disabled:opacity-50"
                data-testid={`source-refresh-${source.id}`}
                title="Re-fetch X profile + cache metadata"
              >
                {refreshMutation.isPending ? '…' : 'Rafraîchir'}
              </button>
            )}
            <button
              type="button"
              onClick={() => toggleMutation.mutate()}
              disabled={toggleMutation.isPending}
              className="rounded px-2 py-1 text-xs text-text-secondary hover:bg-surface-2 transition-colors"
            >
              {source.enabled ? 'Desactiver' : 'Activer'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm(`Supprimer ${source.displayName} ?`)) {
                  deleteMutation.mutate()
                }
              }}
              disabled={deleteMutation.isPending}
              className="rounded px-2 py-1 text-xs text-negative hover:bg-surface-2 transition-colors"
            >
              Supprimer
            </button>
          </div>
        )}
      </div>
    </Panel>
  )
}

/**
 * Canonicalize a stored handle for display when no canonical profile metadata
 * is available yet. Strips leading `@@`-style pollution and trailing slashes
 * so the UI never shows `@@tom_doerr`. Once the source is resolved, the
 * `profileMetadata.username` field replaces this fallback entirely.
 */
function sanitizeHandleForDisplay(raw: string): string {
  return raw.trim().replace(/^@+/, '').replace(/\/+$/, '')
}

function AddSourceForm({
  defaultGroup,
  onCreated,
}: {
  defaultGroup: SignalSourceGroup
  onCreated: () => void
}) {
  const queryClient = useQueryClient()
  const [provider, setProvider] = useState('x_twitter')
  const [handle, setHandle] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [group, setGroup] = useState<SignalSourceGroup>(defaultGroup)
  const [tags, setTags] = useState('')
  const [error, setError] = useState<string | null>(null)

  const lookupMutation = useMutation({
    mutationFn: () =>
      lookupXHandle({ handle: handle.trim(), persist: false, forceRefresh: false }),
    onSuccess: data => {
      setError(null)
      // Auto-fill displayName from the profile name on first successful lookup.
      if (data.ok && data.profile && displayName.trim().length === 0) {
        setDisplayName(data.profile.name)
      }
      void queryClient.invalidateQueries({ queryKey: ['x-twitter', 'health'] })
    },
  })
  const lookupResult = lookupMutation.data as XProfileLookupResponse | undefined
  const lookupProfile = lookupResult?.profile

  const mutation = useMutation({
    mutationFn: () =>
      createSignalSource({
        provider,
        handle: handle.trim(),
        displayName: displayName.trim(),
        group,
        tags: tags
          .split(',')
          .map(t => t.trim())
          .filter(Boolean),
      }),
    onSuccess: data => {
      if (data.ok) {
        onCreated()
      } else {
        setError(data.message ?? 'Erreur inconnue')
      }
    },
    onError: () => setError('Erreur reseau'),
  })

  const isX = provider === 'x_twitter'

  return (
    <Panel>
      <h3 className="text-sm font-medium text-text-primary mb-3">Nouveau compte</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-text-secondary block mb-1" htmlFor="signal-source-provider">Provider</label>
          <select
            id="signal-source-provider"
            value={provider}
            onChange={e => setProvider(e.target.value)}
            className="w-full rounded-lg bg-surface-1 border border-surface-2 px-3 py-1.5 text-sm text-text-primary"
          >
            <option value="x_twitter">X / Twitter</option>
            <option value="bluesky">Bluesky</option>
            <option value="manual_import">Manuel</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-text-secondary block mb-1" htmlFor="signal-source-group">Groupe</label>
          <select
            id="signal-source-group"
            value={group}
            onChange={e => setGroup(e.target.value as SignalSourceGroup)}
            className="w-full rounded-lg bg-surface-1 border border-surface-2 px-3 py-1.5 text-sm text-text-primary"
          >
            <option value="finance">Finance</option>
            <option value="ai_tech">IA / Tech</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-text-secondary block mb-1" htmlFor="signal-source-handle">
            Handle / identifiant
            {isX && (
              <span className="ml-1 text-text-tertiary">
                (accepte @handle, handle, ou URL x.com/twitter.com)
              </span>
            )}
          </label>
          <input
            id="signal-source-handle"
            type="text"
            value={handle}
            onChange={e => setHandle(e.target.value)}
            placeholder="@example ou https://x.com/example"
            className="w-full rounded-lg bg-surface-1 border border-surface-2 px-3 py-1.5 text-sm text-text-primary"
          />
        </div>
        <div>
          <label className="text-xs text-text-secondary block mb-1" htmlFor="signal-source-display-name">Nom d'affichage</label>
          <input
            id="signal-source-display-name"
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="Nom visible"
            className="w-full rounded-lg bg-surface-1 border border-surface-2 px-3 py-1.5 text-sm text-text-primary"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-text-secondary block mb-1" htmlFor="signal-source-tags">Tags (separes par virgule)</label>
          <input
            id="signal-source-tags"
            type="text"
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="macro, fed, rates"
            className="w-full rounded-lg bg-surface-1 border border-surface-2 px-3 py-1.5 text-sm text-text-primary"
          />
        </div>
      </div>

      {isX && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => lookupMutation.mutate()}
            disabled={!handle.trim() || lookupMutation.isPending}
            className="rounded-lg bg-surface-2 px-3 py-1 text-xs font-medium text-text-primary hover:bg-surface-3 disabled:opacity-50"
            data-testid="x-account-verify"
          >
            {lookupMutation.isPending ? 'Vérification…' : 'Vérifier sur X'}
          </button>
          <span className="text-xs text-text-tertiary">
            Lookup payant ($0.01) — bypass cache si déjà connu.
          </span>
        </div>
      )}

      {lookupMutation.isError && (
        <p className="text-negative text-xs mt-2">Erreur réseau lors du lookup.</p>
      )}
      {lookupResult && !lookupResult.ok && (
        <div className="mt-2 rounded border border-amber-700/60 bg-amber-950/30 p-2 text-xs text-amber-200">
          <p className="font-semibold">
            {verificationStatusLabel(lookupResult.verificationStatus)}
          </p>
          <p className="mt-0.5 text-amber-300">
            {lookupResult.message ?? lookupResult.code ?? 'lookup failed'}
          </p>
        </div>
      )}
      {lookupResult?.ok && lookupProfile && (
        <div className="mt-3 flex items-start gap-3 rounded border border-positive/30 bg-positive/5 p-3">
          {lookupProfile.profileImageUrl && (
            <img
              src={lookupProfile.profileImageUrl}
              alt={`avatar de ${lookupProfile.username}`}
              className="h-12 w-12 rounded-full border border-surface-3 object-cover"
            />
          )}
          <div className="space-y-0.5 text-sm">
            <p className="font-semibold text-text-primary">{lookupProfile.name}</p>
            <p className="text-xs text-text-secondary">@{lookupProfile.username}</p>
            {lookupProfile.description && (
              <p className="max-w-xl text-xs text-text-secondary">{lookupProfile.description}</p>
            )}
            <div className="flex flex-wrap gap-2 text-xs text-text-tertiary">
              <span>Followers : {formatCount(lookupProfile.publicMetrics.followersCount)}</span>
              <span>Tweets : {formatCount(lookupProfile.publicMetrics.tweetCount)}</span>
              {lookupProfile.verified && (
                <Badge variant="positive" className="text-xs">
                  vérifié{lookupProfile.verifiedType ? ` (${lookupProfile.verifiedType})` : ''}
                </Badge>
              )}
              {lookupProfile.protected && <Badge variant="outline" className="text-xs">privé</Badge>}
            </div>
          </div>
        </div>
      )}

      {error && <p className="text-negative text-xs mt-2">{error}</p>}
      <button
        type="button"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending || !handle.trim() || !displayName.trim()}
        className="mt-3 rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {mutation.isPending ? 'Ajout...' : 'Ajouter'}
      </button>
    </Panel>
  )
}

// ---------------------------------------------------------------------------
// X readiness banner — drives the "Vérifier tous les comptes" batch action
// ---------------------------------------------------------------------------

function XReadinessBanner({
  readiness,
}: {
  readiness: { total: number; verified: number; unresolved: number }
}) {
  const queryClient = useQueryClient()
  const [result, setResult] = useState<XResolveAllResponse | null>(null)
  const mutation = useMutation({
    mutationFn: () => resolveAllXSources({}),
    onSuccess: data => {
      setResult(data)
      void queryClient.invalidateQueries({ queryKey: ['signal-sources'] })
      void queryClient.invalidateQueries({ queryKey: ['x-twitter', 'health'] })
    },
  })

  const ready = readiness.unresolved === 0
  return (
    <Panel
      title="Préparation X"
      actions={
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          data-testid="x-resolve-all"
        >
          {mutation.isPending ? 'Vérification…' : 'Vérifier tous les comptes'}
        </button>
      }
    >
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <StatusDot tone={ready ? 'ok' : 'idle'} />
          <span className="text-text-secondary">
            {ready ? 'Tous les comptes X sont prêts' : 'Comptes X à vérifier'}
          </span>
        </div>
        <Badge variant="outline" className="text-[11px]">
          Total : {readiness.total}
        </Badge>
        <Badge variant={ready ? 'positive' : 'ghost'} className="text-[11px]">
          Vérifiés : {readiness.verified}
        </Badge>
        <Badge
          variant={readiness.unresolved === 0 ? 'ghost' : 'warning'}
          className="text-[11px]"
          data-testid="x-readiness-unresolved-count"
        >
          À résoudre : {readiness.unresolved}
        </Badge>
      </div>
      <p className="mt-2 text-xs text-text-tertiary">
        X facture chaque <code>users/by</code> par compte résolu ($0.01). Le batch utilise
        l'endpoint groupé (jusqu'à 100 comptes par requête).
      </p>

      {mutation.isError && (
        <p className="mt-2 text-xs text-negative">Erreur réseau lors du batch resolve.</p>
      )}

      {result && (
        <div className="mt-3 rounded border border-surface-3 bg-surface-1/40 p-3 text-xs">
          {result.summary && (
            <div className="flex flex-wrap gap-2">
              <Badge variant="positive" className="text-[10px]">
                résolus : {result.summary.resolved}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                invalides : {result.summary.invalidHandle}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                introuvables : {result.summary.notFound}
              </Badge>
              {result.summary.rateLimited > 0 && (
                <Badge variant="warning" className="text-[10px]">
                  rate-limited : {result.summary.rateLimited}
                </Badge>
              )}
              {result.summary.forbidden > 0 && (
                <Badge variant="warning" className="text-[10px]">
                  interdits : {result.summary.forbidden}
                </Badge>
              )}
              {result.summary.tokenInvalid > 0 && (
                <Badge variant="destructive" className="text-[10px]">
                  token invalide : {result.summary.tokenInvalid}
                </Badge>
              )}
              {result.summary.providerError > 0 && (
                <Badge variant="destructive" className="text-[10px]">
                  erreurs provider : {result.summary.providerError}
                </Badge>
              )}
            </div>
          )}
          {result.providerError && (
            <p className="mt-2 text-negative">
              Provider error : {result.providerError.code}
              {result.providerError.statusCode
                ? ` (HTTP ${result.providerError.statusCode})`
                : ''}{' '}
              — {result.providerError.message}
            </p>
          )}
          {typeof result.estimatedCostUsd === 'number' && (
            <p className="mt-1 text-text-tertiary">
              Coût estimé : ${result.estimatedCostUsd.toFixed(2)} ({result.userReads} user reads)
              {result.rateLimit?.remaining != null
                ? ` · rate-limit restant : ${result.rateLimit.remaining}`
                : ''}
            </p>
          )}
        </div>
      )}
    </Panel>
  )
}

// ---------------------------------------------------------------------------
// X provider health panel
// ---------------------------------------------------------------------------

function XHealthPanel() {
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
          className="rounded border border-surface-3 px-3 py-1 text-xs hover:bg-surface-2"
          onClick={() => healthQuery.refetch()}
          data-testid="x-health-refresh"
        >
          Rafraîchir
        </button>
      }
    >
      {healthQuery.isPending && <p className="text-sm text-text-secondary">Chargement…</p>}
      {healthQuery.isError && (
        <p className="text-sm text-negative" data-testid="x-health-error">
          Erreur de chargement du statut X.
        </p>
      )}
      {health && !health.enabled && (
        <p className="text-sm text-amber-400" data-testid="x-health-disabled">
          NEWS_PROVIDER_X_TWITTER_ENABLED=false — provider désactivé par configuration.
        </p>
      )}
      {health?.enabled && !health.tokenPresent && (
        <p className="text-sm text-amber-400" data-testid="x-health-no-token">
          Bearer token X absent. Configurer NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN côté API.
        </p>
      )}
      {health && (
        <div className="mt-2 grid grid-cols-2 gap-3 text-xs md:grid-cols-3">
          <SocialStat label="Statut">
            <Badge variant={toneBadge} data-testid="x-health-status">
              {health.budgetStatus ?? 'unknown'}
            </Badge>
          </SocialStat>
          <SocialStat label="Token">
            {health.tokenPresent ? 'présent' : 'absent'}
            <span className="ml-2 text-text-tertiary">(jamais affiché)</span>
          </SocialStat>
          <SocialStat label="Billing">{health.billingStatus ?? '—'}</SocialStat>
          <SocialStat label="Budget jour">{formatUsd(health.dailyBudgetUsd)}</SocialStat>
          <SocialStat label="Budget mois">{formatUsd(health.monthlyBudgetUsd)}</SocialStat>
          <SocialStat label="Coût aujourd'hui">{formatUsd(health.estimatedCostToday)}</SocialStat>
          <SocialStat label="Reste jour">{formatUsd(health.remainingDailyBudget)}</SocialStat>
          <SocialStat label="Reste mois">{formatUsd(health.remainingMonthlyBudget)}</SocialStat>
          <SocialStat label="Post reads aujourd'hui">{formatCount(health.postReadsToday)}</SocialStat>
          <SocialStat label="User reads aujourd'hui">{formatCount(health.userReadsToday)}</SocialStat>
          <SocialStat label="Last status">
            {typeof health.lastStatusCode === 'number' ? health.lastStatusCode : '—'}
          </SocialStat>
          <SocialStat label="Last error">{health.lastErrorCode ?? 'aucune'}</SocialStat>
          <SocialStat label="Last daily run">{health.lastDailyRunStatus ?? '—'}</SocialStat>
          <SocialStat label="Tweets fetched">
            {formatCount(health.lastDailyRunFetchedCount)}
          </SocialStat>
          <SocialStat label="Pour Advisor">
            {formatCount(health.lastDailyRunKeptForAdvisorCount)}
          </SocialStat>
          <SocialStat label="Scheduler auto">
            {health.dailySyncSchedulerEnabled ? 'activé' : 'désactivé'}
          </SocialStat>
        </div>
      )}
    </Panel>
  )
}

// ---------------------------------------------------------------------------
// Daily sync (previous-day J-1)
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
      runXDailyPreviousDaySync({ runMode, manualConfirm: true, dryRun: false }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['x-twitter', 'health'] })
      void queryClient.invalidateQueries({ queryKey: ['signal-sources'] })
    },
  })
  const resolveAllMutation = useMutation({
    mutationFn: () => resolveAllXSources({}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['signal-sources'] })
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
          className="rounded border border-surface-3 px-3 py-1 text-sm hover:bg-surface-2 disabled:opacity-50"
          data-testid="x-sync-dryrun"
        >
          {dryRunMutation.isPending ? 'Estimation…' : 'Dry-run estimation'}
        </button>
        <label className="ml-4 flex items-center gap-2 text-xs">
          <span className="text-text-secondary">Mode</span>
          <select
            value={runMode}
            onChange={event => setRunMode(event.target.value as never)}
            className="rounded border border-surface-3 bg-surface-1 px-2 py-1 text-sm"
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
          className="rounded bg-positive px-3 py-1 text-sm text-white disabled:opacity-50"
          data-testid="x-sync-run"
        >
          {runMutation.isPending ? 'Lancement…' : 'Lancer sync'}
        </button>
      </div>
      <p className="mt-2 text-xs text-text-tertiary">
        Dry-run obligatoire avant le run. Le run respecte le budget : si l'estimation dépasse le
        seuil de confirmation, l'API retourne 412 et il faut renvoyer l'action.
      </p>

      {dryRun && (
        <div className="mt-3 rounded border border-surface-3 p-3 text-sm" data-testid="x-sync-dryrun-result">
          <p className="font-semibold">Estimation</p>
          <p className="text-xs text-text-tertiary">
            {dryRun.window?.windowDateLocal} ({dryRun.window?.timezone})
          </p>
          <div className="mt-1 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
            <SocialStat label="Post reads max">{formatCount(dryRun.estimatedPostReads)}</SocialStat>
            <SocialStat label="Coût estimé">{formatUsd(dryRun.estimatedCostUsd)}</SocialStat>
            <SocialStat label="Cap reason">{capReasonLabel(dryRun.capReason)}</SocialStat>
            <SocialStat label="Status">{dryRun.runStatus ?? '—'}</SocialStat>
          </div>
          {dryRun.errorMessage && (
            <p className="mt-2 text-xs text-amber-400">{dryRun.errorMessage}</p>
          )}
        </div>
      )}

      {runResult && (
        <div className="mt-3 rounded border border-surface-3 p-3 text-sm" data-testid="x-sync-run-result">
          <p className="font-semibold">Run terminé — {runResult.runStatus ?? 'inconnu'}</p>
          <div className="mt-1 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
            <SocialStat label="Fetched">{formatCount(runResult.fetchedTweetCount)}</SocialStat>
            <SocialStat label="Pour Advisor">{formatCount(runResult.keptForAdvisorCount)}</SocialStat>
            <SocialStat label="Coût réel">{formatUsd(runResult.actualCostUsd)}</SocialStat>
            <SocialStat label="Cap reason">{capReasonLabel(runResult.capReason)}</SocialStat>
            <SocialStat label="Inserted">
              {formatCount(runResult.signalItemCounts?.insertedCount)}
            </SocialStat>
            <SocialStat label="Dédupliqués">
              {formatCount(runResult.signalItemCounts?.dedupedCount)}
            </SocialStat>
          </div>
          {runResult.errorCode && (
            <p className="mt-2 text-xs text-negative">
              <span className="font-semibold">{runResult.errorCode}</span>
              {runResult.errorMessage ? ` — ${runResult.errorMessage}` : ''}
            </p>
          )}
          {runResult.errorCode === 'UNRESOLVED_HANDLE' && (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded border border-amber-700/60 bg-amber-950/30 p-2 text-xs text-amber-200">
              <span>
                Certains comptes n'ont pas de X user id. Lance un batch resolve, puis relance le
                sync.
              </span>
              <button
                type="button"
                onClick={() => resolveAllMutation.mutate()}
                disabled={resolveAllMutation.isPending}
                className="rounded bg-primary px-2 py-1 text-[11px] font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                data-testid="x-sync-cta-resolve"
              >
                {resolveAllMutation.isPending
                  ? 'Vérification…'
                  : 'Vérifier les comptes maintenant'}
              </button>
            </div>
          )}
          {runResult.autoResolve && (
            <p className="mt-2 text-[11px] text-text-tertiary" data-testid="x-sync-autoresolve">
              Auto-résolution :{' '}
              {runResult.autoResolve.enabled
                ? `${runResult.autoResolve.resolvedCount} résolu(s)` +
                  (runResult.autoResolve.failedCount > 0
                    ? `, ${runResult.autoResolve.failedCount} échec(s)`
                    : '')
                : 'désactivée'}
            </p>
          )}
          {runResult.perAuthor?.some(a => a.aborted) && (
            <details className="mt-2 text-xs text-text-secondary">
              <summary className="cursor-pointer">
                Comptes en erreur ({runResult.perAuthor.filter(a => a.aborted).length})
              </summary>
              <ul className="mt-1 space-y-0.5">
                {runResult.perAuthor
                  .filter(a => a.aborted)
                  .map(a => (
                    <li key={a.handle} className="font-mono">
                      @{a.handle} → {a.abortReason}
                      {a.errorCode ? ` / ${a.errorCode}` : ''}
                      {typeof a.errorStatusCode === 'number'
                        ? ` (HTTP ${a.errorStatusCode})`
                        : ''}
                      {a.errorMessage ? ` — ${a.errorMessage}` : ''}
                    </li>
                  ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </Panel>
  )
}

function SocialStat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded border border-surface-3 bg-surface-1/40 p-2">
      <p className="text-[10px] uppercase tracking-wide text-text-tertiary">{label}</p>
      <div className="mt-0.5 text-sm text-text-primary">{children}</div>
    </div>
  )
}

function ManualImportPanel({ onImported }: { onImported: () => void }) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ count: number } | null>(null)

  const mutation = useMutation({
    mutationFn: async () => {
      // Parse text: each line is a post, or try JSON
      let items: Array<{ text: string; author?: string; url?: string }>
      try {
        const parsed = JSON.parse(text)
        items = Array.isArray(parsed) ? parsed : [parsed]
      } catch {
        // Treat each non-empty line as a text post
        items = text
          .split('\n')
          .map(line => line.trim())
          .filter(Boolean)
          .map(line => ({ text: line }))
      }
      return postManualImport(items)
    },
    onSuccess: data => {
      if (data.ok) {
        setResult({ count: data.insertedCount ?? 0 })
        setText('')
        onImported()
      } else {
        setError(data.message ?? 'Erreur inconnue')
      }
    },
    onError: () => setError('Erreur reseau'),
  })

  return (
    <Panel>
      <h3 className="text-sm font-medium text-text-primary mb-2">Import manuel</h3>
      <p className="text-text-tertiary text-xs mb-3">
        Collez du texte (un signal par ligne) ou du JSON. Les items seront normalises et scores
        comme des signaux sociaux.
      </p>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={'Un signal par ligne, ou JSON :\n[{"text": "...", "author": "@handle"}]'}
        rows={5}
        className="w-full rounded-lg bg-surface-1 border border-surface-2 px-3 py-2 text-sm text-text-primary font-mono resize-y"
      />
      {error && <p className="text-negative text-xs mt-1">{error}</p>}
      {result && (
        <p className="text-positive text-xs mt-1">{result.count} signal(s) importe(s).</p>
      )}
      <button
        type="button"
        onClick={() => {
          setError(null)
          setResult(null)
          mutation.mutate()
        }}
        disabled={mutation.isPending || !text.trim()}
        className="mt-2 rounded-lg bg-surface-2 px-4 py-1.5 text-sm font-medium text-text-primary hover:bg-surface-3 transition-colors disabled:opacity-50"
      >
        {mutation.isPending ? 'Import...' : 'Importer'}
      </button>
    </Panel>
  )
}
