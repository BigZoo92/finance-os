import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
import { PageHeader } from '@/components/surfaces/page-header'
import { Panel } from '@/components/surfaces/panel'
import { StatusDot } from '@/components/surfaces/status-dot'

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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Donnees & signaux"
        icon="⊕"
        title="Comptes a surveiller"
        description="Gerez les comptes sociaux surveilles pour alimenter vos signaux financiers et IA/tech."
      />

      {/* Provider status banner */}
      <ProviderStatusBanner health={healthQuery.data} isLoading={healthQuery.isPending} />

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

  return (
    <Panel>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <StatusDot tone={source.enabled ? 'ok' : 'idle'} />
            <span className="font-medium text-text-primary truncate">{source.displayName}</span>
            <Badge variant="outline" className="text-xs shrink-0">
              {providerLabel(source.provider)}
            </Badge>
          </div>
          <p className="text-text-secondary text-sm mt-0.5">{source.handle}</p>
          {source.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {source.tags.map(tag => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
          <div className="flex gap-3 mt-1.5 text-text-tertiary text-xs">
            {source.lastFetchedAt && (
              <span>
                Dernier fetch: {new Date(source.lastFetchedAt).toLocaleDateString('fr-FR')}{' '}
                {new Date(source.lastFetchedAt).toLocaleTimeString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
            {source.lastFetchedCount != null && (
              <span>{source.lastFetchedCount} items</span>
            )}
            {source.lastError && (
              <span className="text-negative">Erreur: {source.lastError}</span>
            )}
          </div>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-1 shrink-0">
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

function AddSourceForm({
  defaultGroup,
  onCreated,
}: {
  defaultGroup: SignalSourceGroup
  onCreated: () => void
}) {
  const [provider, setProvider] = useState('x_twitter')
  const [handle, setHandle] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [group, setGroup] = useState<SignalSourceGroup>(defaultGroup)
  const [tags, setTags] = useState('')
  const [error, setError] = useState<string | null>(null)

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

  return (
    <Panel>
      <h3 className="text-sm font-medium text-text-primary mb-3">Nouveau compte</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-text-secondary block mb-1">Provider</label>
          <select
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
          <label className="text-xs text-text-secondary block mb-1">Groupe</label>
          <select
            value={group}
            onChange={e => setGroup(e.target.value as SignalSourceGroup)}
            className="w-full rounded-lg bg-surface-1 border border-surface-2 px-3 py-1.5 text-sm text-text-primary"
          >
            <option value="finance">Finance</option>
            <option value="ai_tech">IA / Tech</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-text-secondary block mb-1">Handle / identifiant</label>
          <input
            type="text"
            value={handle}
            onChange={e => setHandle(e.target.value)}
            placeholder="@example"
            className="w-full rounded-lg bg-surface-1 border border-surface-2 px-3 py-1.5 text-sm text-text-primary"
          />
        </div>
        <div>
          <label className="text-xs text-text-secondary block mb-1">Nom d'affichage</label>
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="Nom visible"
            className="w-full rounded-lg bg-surface-1 border border-surface-2 px-3 py-1.5 text-sm text-text-primary"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-text-secondary block mb-1">Tags (separes par virgule)</label>
          <input
            type="text"
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="macro, fed, rates"
            className="w-full rounded-lg bg-surface-1 border border-surface-2 px-3 py-1.5 text-sm text-text-primary"
          />
        </div>
      </div>
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
