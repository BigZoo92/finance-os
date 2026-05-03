import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useStore } from '@tanstack/react-store'
import { useState } from 'react'
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
import type { AuthMode } from '@/features/auth-types'
import { authMeQueryOptions } from '@/features/auth-query-options'
import { resolveAuthViewState } from '@/features/auth-view-state'
import { dashboardQueryKeys } from '@/features/dashboard-query-options'
import { financialGoalsQueryKeys } from '@/features/goals/query-options'
import {
  deletePowensConnection,
  fetchPowensConnectUrl,
  postPowensSync,
} from '@/features/powens/api'
import { getPowensDisconnectActionState } from '@/features/powens/disconnect-action-state'
import {
  getPowensManualSyncCooldownSnapshot,
  getPowensManualSyncCooldownUiConfig,
  getPowensManualSyncUiState,
  powensManualSyncCooldownStore,
  startPowensManualSyncCooldown,
} from '@/features/powens/manual-sync-cooldown'
import {
  powensDiagnosticsQueryOptionsWithMode,
  powensQueryKeys,
  powensStatusQueryOptionsWithMode,
  powensSyncRunsQueryOptionsWithMode,
  powensAuditTrailQueryOptionsWithMode,
} from '@/features/powens/query-options'
import {
  deleteExternalInvestmentCredential,
  postExternalInvestmentSync,
  putExternalInvestmentCredential,
} from '@/features/external-investments/api'
import {
  externalInvestmentsQueryKeys,
  externalInvestmentsStatusQueryOptionsWithMode,
  externalInvestmentsSyncRunsQueryOptionsWithMode,
} from '@/features/external-investments/query-options'
import type {
  ExternalInvestmentCredentialInput,
  ExternalInvestmentProvider,
} from '@/features/external-investments/types'
import { getPowensConnectionSyncBadgeModel } from '@/features/powens/sync-status'
import { pushToast } from '@/lib/toast-store'
import { formatDateTime, formatDuration, toErrorMessage } from '@/lib/format'
import { PageHeader } from '@/components/surfaces/page-header'
import { ActionDock } from '@/components/surfaces/action-dock'

const EXTERNAL_PROVIDERS: ExternalInvestmentProvider[] = ['ibkr', 'binance']

type IbkrCredentialDraft = {
  accountAlias: string
  flexToken: string
  queryIds: string
  expectedAccountIds: string
  baseUrl: string
  userAgent: string
}

type BinanceCredentialDraft = {
  accountAlias: string
  apiKey: string
  apiSecret: string
  baseUrl: string
  ipRestricted: boolean
  ipRestrictionNote: string
}

const splitCsv = (value: string) =>
  value
    .split(',')
    .map(item => item.trim())
    .filter(item => item.length > 0)

const providerLabel = (provider: ExternalInvestmentProvider) =>
  provider === 'ibkr' ? 'IBKR Flex' : 'Binance Spot'

const getMaskedRefs = (metadata: Record<string, unknown> | null) => {
  const refs = metadata?.maskedSecretRefs
  if (!refs || typeof refs !== 'object' || Array.isArray(refs)) return []
  return Object.entries(refs as Record<string, unknown>)
    .filter(([, value]) => typeof value === 'string')
    .map(([key, value]) => `${key}: ${value}`)
}

export const Route = createFileRoute('/_app/integrations')({
  loader: async ({ context }) => {
    const auth = await context.queryClient.fetchQuery(authMeQueryOptions())
    const mode: AuthMode | undefined =
      auth.mode === 'admin' ? 'admin' : auth.mode === 'demo' ? 'demo' : undefined
    if (!mode) return

    const opts = { mode }
    await Promise.all([
      context.queryClient.ensureQueryData(powensStatusQueryOptionsWithMode(opts)),
      context.queryClient.ensureQueryData(powensSyncRunsQueryOptionsWithMode(opts)),
      context.queryClient.ensureQueryData(powensDiagnosticsQueryOptionsWithMode(opts)),
      context.queryClient.ensureQueryData(externalInvestmentsStatusQueryOptionsWithMode(opts)),
      context.queryClient.ensureQueryData(externalInvestmentsSyncRunsQueryOptionsWithMode(opts)),
    ])
  },
  component: IntegrationsPage,
})

function IntegrationsPage() {
  const queryClient = useQueryClient()
  const [pendingDisconnectConnectionId, setPendingDisconnectConnectionId] = useState<string | null>(
    null
  )
  const [ibkrDraft, setIbkrDraft] = useState<IbkrCredentialDraft>({
    accountAlias: '',
    flexToken: '',
    queryIds: '',
    expectedAccountIds: '',
    baseUrl: '',
    userAgent: '',
  })
  const [binanceDraft, setBinanceDraft] = useState<BinanceCredentialDraft>({
    accountAlias: '',
    apiKey: '',
    apiSecret: '',
    baseUrl: '',
    ipRestricted: true,
    ipRestrictionNote: '',
  })
  const manualSyncCooldownUiConfig = getPowensManualSyncCooldownUiConfig()
  const manualSyncCooldownState = useStore(powensManualSyncCooldownStore)
  const manualSyncCooldownSnapshot = getPowensManualSyncCooldownSnapshot(manualSyncCooldownState)

  const authQuery = useQuery(authMeQueryOptions())
  const authViewState = resolveAuthViewState({
    isPending: authQuery.isPending,
    ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}),
  })
  const isDemo = authViewState === 'demo'
  const isAdmin = authViewState === 'admin'
  const authMode: AuthMode | undefined = isAdmin ? 'admin' : isDemo ? 'demo' : undefined

  const statusQuery = useQuery(powensStatusQueryOptionsWithMode(authMode ? { mode: authMode } : {}))
  const syncRunsQuery = useQuery(
    powensSyncRunsQueryOptionsWithMode(authMode ? { mode: authMode } : {})
  )
  const diagnosticsQuery = useQuery(
    powensDiagnosticsQueryOptionsWithMode(authMode ? { mode: authMode } : {})
  )
  const auditTrailQuery = useQuery(
    powensAuditTrailQueryOptionsWithMode(authMode ? { mode: authMode } : {})
  )
  const externalStatusQuery = useQuery(
    externalInvestmentsStatusQueryOptionsWithMode(authMode ? { mode: authMode } : {})
  )
  const externalSyncRunsQuery = useQuery(
    externalInvestmentsSyncRunsQueryOptionsWithMode(authMode ? { mode: authMode } : {})
  )

  const statusConnections = statusQuery.data?.connections ?? []
  const externalConnections = externalStatusQuery.data?.connections ?? []
  const externalHealth = externalStatusQuery.data?.health ?? []
  const isIntegrationsSafeMode = statusQuery.data?.safeModeActive ?? false
  const isExternalSafeMode = externalStatusQuery.data?.safeModeActive ?? false
  const syncStatusPersistenceEnabled = statusQuery.data?.syncStatusPersistenceEnabled ?? false
  const syncRuns = syncRunsQuery.data?.runs ?? []
  const externalSyncRuns = externalSyncRunsQuery.data?.items ?? []
  const diagnostics = diagnosticsQuery.data
  const auditEvents = auditTrailQuery.data?.events ?? []

  const manualSyncUiState = getPowensManualSyncUiState({
    cooldownUiEnabled: manualSyncCooldownUiConfig.enabled,
    cooldownSnapshot: manualSyncCooldownSnapshot,
    isIntegrationsSafeMode,
    isSyncPending: false,
    mode: authMode,
  })

  const connectMutation = useMutation({
    mutationFn: async () => {
      if (!isAdmin) throw new Error('Admin session required')
      return fetchPowensConnectUrl({})
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
    mutationFn: async ({ connectionId }: { connectionId?: string } = {}) => {
      if (!isAdmin) throw new Error('Admin session required')
      return postPowensSync(connectionId ? { connectionId } : {})
    },
    onSuccess: async () => {
      if (manualSyncCooldownUiConfig.enabled) {
        startPowensManualSyncCooldown(manualSyncCooldownUiConfig.durationSeconds)
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: powensQueryKeys.status() }),
        queryClient.invalidateQueries({ queryKey: powensQueryKeys.syncRuns() }),
        queryClient.invalidateQueries({ queryKey: powensQueryKeys.diagnostics() }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: financialGoalsQueryKeys.list() }),
      ])
      pushToast({
        title: 'Sync enfilée',
        description: 'Le worker va traiter la synchronisation.',
        tone: 'success',
      })
    },
    onError: error => {
      pushToast({ title: 'Sync refusée', description: toErrorMessage(error), tone: 'error' })
    },
  })

  const disconnectMutation = useMutation({
    mutationFn: async ({ connectionId }: { connectionId: string }) => {
      if (!isAdmin) throw new Error('Admin session required')
      return deletePowensConnection(connectionId)
    },
    onSuccess: async payload => {
      setPendingDisconnectConnectionId(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: powensQueryKeys.status() }),
        queryClient.invalidateQueries({ queryKey: powensQueryKeys.syncRuns() }),
        queryClient.invalidateQueries({ queryKey: powensQueryKeys.diagnostics() }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: financialGoalsQueryKeys.list() }),
      ])
      pushToast({
        title: payload.disconnected ? 'Connexion retiree' : 'Connexion deja retiree',
        description: 'Les comptes lies sont caches des vues actives.',
        tone: 'success',
      })
    },
    onError: error => {
      pushToast({ title: 'Retrait refuse', description: toErrorMessage(error), tone: 'error' })
    },
  })

  const invalidateExternalInvestments = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: externalInvestmentsQueryKeys.all }),
      queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.all }),
    ])
  }

  const externalSyncMutation = useMutation({
    mutationFn: async ({ provider }: { provider?: ExternalInvestmentProvider } = {}) => {
      if (!isAdmin) throw new Error('Admin session required')
      return postExternalInvestmentSync(provider)
    },
    onSuccess: async payload => {
      await invalidateExternalInvestments()
      pushToast({
        title: 'Sync investissements enfilee',
        description: `${payload.enqueued.length} provider${payload.enqueued.length !== 1 ? 's' : ''} en file worker.`,
        tone: 'success',
      })
    },
    onError: error => {
      pushToast({ title: 'Sync refusee', description: toErrorMessage(error), tone: 'error' })
    },
  })

  const credentialMutation = useMutation({
    mutationFn: async (input: ExternalInvestmentCredentialInput) => {
      if (!isAdmin) throw new Error('Admin session required')
      return putExternalInvestmentCredential(input)
    },
    onSuccess: async payload => {
      await invalidateExternalInvestments()
      if (payload.provider === 'ibkr') {
        setIbkrDraft(current => ({ ...current, flexToken: '' }))
      } else {
        setBinanceDraft(current => ({ ...current, apiKey: '', apiSecret: '' }))
      }
      pushToast({
        title: 'Identifiants enregistres',
        description: `${providerLabel(payload.provider)} configure sans exposer les secrets.`,
        tone: 'success',
      })
    },
    onError: error => {
      pushToast({ title: 'Configuration refusee', description: toErrorMessage(error), tone: 'error' })
    },
  })

  const deleteExternalCredentialMutation = useMutation({
    mutationFn: async (provider: ExternalInvestmentProvider) => {
      if (!isAdmin) throw new Error('Admin session required')
      return deleteExternalInvestmentCredential(provider)
    },
    onSuccess: async payload => {
      await invalidateExternalInvestments()
      pushToast({
        title: payload.deleted ? 'Identifiants retires' : 'Identifiants absents',
        description: `${providerLabel(payload.provider)} ne sera pas appele sans nouvelle configuration.`,
        tone: 'success',
      })
    },
    onError: error => {
      pushToast({ title: 'Retrait refuse', description: toErrorMessage(error), tone: 'error' })
    },
  })

  const submitIbkrCredential = () => {
    const queryIds = splitCsv(ibkrDraft.queryIds)
    if (ibkrDraft.flexToken.trim().length === 0 || queryIds.length === 0) return
    credentialMutation.mutate({
      provider: 'ibkr',
      flexToken: ibkrDraft.flexToken.trim(),
      queryIds,
      ...(ibkrDraft.accountAlias.trim()
        ? { accountAlias: ibkrDraft.accountAlias.trim() }
        : {}),
      ...(splitCsv(ibkrDraft.expectedAccountIds).length > 0
        ? { expectedAccountIds: splitCsv(ibkrDraft.expectedAccountIds) }
        : {}),
      ...(ibkrDraft.baseUrl.trim() ? { baseUrl: ibkrDraft.baseUrl.trim() } : {}),
      ...(ibkrDraft.userAgent.trim() ? { userAgent: ibkrDraft.userAgent.trim() } : {}),
    })
  }

  const submitBinanceCredential = () => {
    if (binanceDraft.apiKey.trim().length === 0 || binanceDraft.apiSecret.trim().length === 0) return
    credentialMutation.mutate({
      provider: 'binance',
      apiKey: binanceDraft.apiKey.trim(),
      apiSecret: binanceDraft.apiSecret.trim(),
      permissionsMetadata: {
        canRead: true,
        tradingEnabled: false,
        withdrawEnabled: false,
        ipRestricted: binanceDraft.ipRestricted,
      },
      ...(binanceDraft.accountAlias.trim()
        ? { accountAlias: binanceDraft.accountAlias.trim() }
        : {}),
      ...(binanceDraft.baseUrl.trim() ? { baseUrl: binanceDraft.baseUrl.trim() } : {}),
      ...(binanceDraft.ipRestrictionNote.trim()
        ? { ipRestrictionNote: binanceDraft.ipRestrictionNote.trim() }
        : {}),
    })
  }

  const diagnosticsOutcomeBadge: Record<
    string,
    { label: string; variant: 'secondary' | 'outline' | 'destructive' }
  > = {
    ok: { label: 'OK', variant: 'secondary' },
    degraded: { label: 'Dégradé', variant: 'outline' },
    timeout: { label: 'Timeout', variant: 'destructive' },
    auth_error: { label: 'Auth', variant: 'destructive' },
    provider_error: { label: 'Erreur', variant: 'destructive' },
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Intelligence & Admin"
        icon="⊞"
        title="Intégrations"
        description="Connexions, synchronisations et diagnostics provider. Le cockpit reste utilisable si une source est dégradée."
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => syncMutation.mutate({})}
              disabled={manualSyncUiState.blocked || syncMutation.isPending}
            >
              <span aria-hidden="true">⟳</span>
              {syncMutation.isPending ? 'Sync…' : 'Lancer une sync'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="aurora"
              onClick={() => connectMutation.mutate()}
              disabled={!isAdmin || isIntegrationsSafeMode || connectMutation.isPending}
            >
              {connectMutation.isPending ? 'Ouverture…' : 'Connecter une banque'}
            </Button>
          </>
        }
      />

      {isIntegrationsSafeMode && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="p-4 text-sm text-warning">
            Safe mode actif : connexions et synchronisations Powens temporairement bloquées.
          </CardContent>
        </Card>
      )}

      {isExternalSafeMode && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="p-4 text-sm text-warning">
            Safe mode investissements actif : IBKR et Binance ne seront pas appeles par le worker.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Investissements externes</CardTitle>
              <CardDescription>
                Configuration admin chiffree pour IBKR Flex et Binance Spot en lecture seule.
              </CardDescription>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!isAdmin || isExternalSafeMode || externalSyncMutation.isPending}
              onClick={() => externalSyncMutation.mutate({})}
            >
              <span aria-hidden="true">↻</span>
              {externalSyncMutation.isPending && !externalSyncMutation.variables?.provider
                ? 'Sync...'
                : 'Sync IBKR + Binance'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 lg:grid-cols-2">
            {EXTERNAL_PROVIDERS.map(provider => {
              const connection = externalConnections.find(item => item.provider === provider)
              const health = externalHealth.find(item => item.provider === provider)
              const maskedRefs = getMaskedRefs(connection?.maskedMetadata ?? null)
              const configured = connection?.credentialStatus === 'configured'
              const isProviderSyncPending =
                externalSyncMutation.isPending &&
                externalSyncMutation.variables?.provider === provider
              return (
                <div key={provider} className="rounded-lg border border-border/50 bg-surface-1 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{providerLabel(provider)}</p>
                      <p className="text-xs text-muted-foreground">
                        {provider === 'ibkr'
                          ? 'Flex Web Service reporting; aucun endpoint trading.'
                          : 'Spot USER_DATA / Wallet GET; trading, transfert et retrait interdits.'}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Dernier succes : {formatDateTime(health?.lastSuccessAt ?? connection?.lastSuccessAt ?? null)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Badge variant={configured ? 'positive' : 'outline'}>
                        {configured ? 'configure' : 'manquant'}
                      </Badge>
                      <Badge
                        variant={
                          health?.status === 'healthy'
                            ? 'positive'
                            : health?.status === 'failing'
                              ? 'destructive'
                              : health?.status === 'degraded'
                                ? 'warning'
                                : 'outline'
                        }
                      >
                        {health?.status ?? 'idle'}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-xs"
                      disabled={!isAdmin || !configured || isExternalSafeMode || isProviderSyncPending}
                      onClick={() => externalSyncMutation.mutate({ provider })}
                    >
                      {isProviderSyncPending ? 'Sync...' : 'Synchroniser'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      disabled={!isAdmin || !configured || deleteExternalCredentialMutation.isPending}
                      onClick={() => deleteExternalCredentialMutation.mutate(provider)}
                    >
                      Retirer
                    </Button>
                  </div>
                  {maskedRefs.length > 0 && (
                    <div className="mt-3 rounded-lg border border-border/40 bg-surface-0 p-2 text-xs text-muted-foreground">
                      {maskedRefs.map(ref => (
                        <p key={ref} className="font-mono">
                          {ref}
                        </p>
                      ))}
                    </div>
                  )}
                  {connection?.lastErrorMessage && (
                    <p className="mt-2 text-xs text-destructive">{connection.lastErrorMessage}</p>
                  )}
                  {health?.lastRequestId && (
                    <p className="mt-2 truncate font-mono text-[11px] text-muted-foreground">
                      request {health.lastRequestId}
                    </p>
                  )}
                </div>
              )
            })}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-border/50 bg-surface-1 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Configurer IBKR Flex</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Token Flex et Query IDs uniquement; le worker genere puis recupere les statements.
                  </p>
                </div>
                <Badge variant="outline">read-only</Badge>
              </div>
              <div className="mt-4 grid gap-3">
                <label className="space-y-2 text-sm" htmlFor="ibkr-account-alias">
                  <span className="text-muted-foreground">Alias compte</span>
                  <Input
                    id="ibkr-account-alias"
                    value={ibkrDraft.accountAlias}
                    onChange={event =>
                      setIbkrDraft(current => ({ ...current, accountAlias: event.target.value }))
                    }
                    placeholder="IBKR Flex"
                  />
                </label>
                <label className="space-y-2 text-sm" htmlFor="ibkr-flex-token">
                  <span className="text-muted-foreground">Flex token</span>
                  <Input
                    id="ibkr-flex-token"
                    type="password"
                    value={ibkrDraft.flexToken}
                    onChange={event =>
                      setIbkrDraft(current => ({ ...current, flexToken: event.target.value }))
                    }
                    placeholder="Stocke chiffre; jamais renvoye au navigateur"
                  />
                </label>
                <label className="space-y-2 text-sm" htmlFor="ibkr-query-ids">
                  <span className="text-muted-foreground">Query IDs Flex</span>
                  <Input
                    id="ibkr-query-ids"
                    value={ibkrDraft.queryIds}
                    onChange={event =>
                      setIbkrDraft(current => ({ ...current, queryIds: event.target.value }))
                    }
                    placeholder="123456, 789012"
                  />
                </label>
                <label className="space-y-2 text-sm" htmlFor="ibkr-expected-account-ids">
                  <span className="text-muted-foreground">Comptes attendus (optionnel)</span>
                  <Input
                    id="ibkr-expected-account-ids"
                    value={ibkrDraft.expectedAccountIds}
                    onChange={event =>
                      setIbkrDraft(current => ({
                        ...current,
                        expectedAccountIds: event.target.value,
                      }))
                    }
                    placeholder="U****123, U****456"
                  />
                </label>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-2 text-sm" htmlFor="ibkr-base-url">
                    <span className="text-muted-foreground">Base URL optionnelle</span>
                    <Input
                      id="ibkr-base-url"
                      value={ibkrDraft.baseUrl}
                      onChange={event =>
                        setIbkrDraft(current => ({ ...current, baseUrl: event.target.value }))
                      }
                      placeholder="Defaut serveur"
                    />
                  </label>
                  <label className="space-y-2 text-sm" htmlFor="ibkr-user-agent">
                    <span className="text-muted-foreground">User-Agent optionnel</span>
                    <Input
                      id="ibkr-user-agent"
                      value={ibkrDraft.userAgent}
                      onChange={event =>
                        setIbkrDraft(current => ({ ...current, userAgent: event.target.value }))
                      }
                      placeholder="Defaut serveur"
                    />
                  </label>
                </div>
                <Button
                  type="button"
                  variant="aurora"
                  disabled={
                    !isAdmin ||
                    credentialMutation.isPending ||
                    ibkrDraft.flexToken.trim().length === 0 ||
                    splitCsv(ibkrDraft.queryIds).length === 0
                  }
                  onClick={submitIbkrCredential}
                >
                  Enregistrer IBKR
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-border/50 bg-surface-1 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Configurer Binance Spot</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Cle API lecture seule. Les permissions trading, transfert et retrait sont refusees.
                  </p>
                </div>
                <Badge variant="warning">no trade</Badge>
              </div>
              <div className="mt-4 grid gap-3">
                <label className="space-y-2 text-sm" htmlFor="binance-account-alias">
                  <span className="text-muted-foreground">Alias compte</span>
                  <Input
                    id="binance-account-alias"
                    value={binanceDraft.accountAlias}
                    onChange={event =>
                      setBinanceDraft(current => ({
                        ...current,
                        accountAlias: event.target.value,
                      }))
                    }
                    placeholder="Binance Spot"
                  />
                </label>
                <label className="space-y-2 text-sm" htmlFor="binance-api-key">
                  <span className="text-muted-foreground">API key</span>
                  <Input
                    id="binance-api-key"
                    type="password"
                    value={binanceDraft.apiKey}
                    onChange={event =>
                      setBinanceDraft(current => ({ ...current, apiKey: event.target.value }))
                    }
                    placeholder="Masquee apres enregistrement"
                  />
                </label>
                <label className="space-y-2 text-sm" htmlFor="binance-api-secret">
                  <span className="text-muted-foreground">API secret</span>
                  <Input
                    id="binance-api-secret"
                    type="password"
                    value={binanceDraft.apiSecret}
                    onChange={event =>
                      setBinanceDraft(current => ({ ...current, apiSecret: event.target.value }))
                    }
                    placeholder="Chiffre cote serveur"
                  />
                </label>
                <label className="space-y-2 text-sm" htmlFor="binance-base-url">
                  <span className="text-muted-foreground">Base URL optionnelle</span>
                  <Input
                    id="binance-base-url"
                    value={binanceDraft.baseUrl}
                    onChange={event =>
                      setBinanceDraft(current => ({ ...current, baseUrl: event.target.value }))
                    }
                    placeholder="https://api.binance.com"
                  />
                </label>
                <label className="flex items-start gap-3 rounded-lg border border-border/40 bg-surface-0 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={binanceDraft.ipRestricted}
                    onChange={event =>
                      setBinanceDraft(current => ({
                        ...current,
                        ipRestricted: event.target.checked,
                      }))
                    }
                  />
                  <span>
                    Cle IP-restreinte
                    <span className="block text-xs text-muted-foreground">
                      Recommande; aucune permission trade/withdraw ne doit etre active.
                    </span>
                  </span>
                </label>
                <label className="space-y-2 text-sm" htmlFor="binance-ip-restriction-note">
                  <span className="text-muted-foreground">Note restriction IP</span>
                  <Input
                    id="binance-ip-restriction-note"
                    value={binanceDraft.ipRestrictionNote}
                    onChange={event =>
                      setBinanceDraft(current => ({
                        ...current,
                        ipRestrictionNote: event.target.value,
                      }))
                    }
                    placeholder="Adresse worker / Dokploy / VPN..."
                  />
                </label>
                <Button
                  type="button"
                  variant="aurora"
                  disabled={
                    !isAdmin ||
                    credentialMutation.isPending ||
                    binanceDraft.apiKey.trim().length === 0 ||
                    binanceDraft.apiSecret.trim().length === 0
                  }
                  onClick={submitBinanceCredential}
                >
                  Enregistrer Binance
                </Button>
              </div>
            </div>
          </div>

          {externalSyncRuns.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Derniers runs investissements
              </p>
              {externalSyncRuns.slice(0, 4).map(run => (
                <div
                  key={run.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-surface-1 px-4 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {providerLabel(run.provider)} · {run.triggerSource}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(run.startedAt)}
                      {formatDuration(run.startedAt, run.finishedAt)
                        ? ` · ${formatDuration(run.startedAt, run.finishedAt)}`
                        : ''}
                    </p>
                    {run.errorMessage && (
                      <p className="truncate text-xs text-destructive">{run.errorMessage}</p>
                    )}
                  </div>
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
                  >
                    {run.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connections */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connexions</CardTitle>
          <CardDescription>
            {statusConnections.length} connexion{statusConnections.length !== 1 ? 's' : ''}{' '}
            enregistrée{statusConnections.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {statusQuery.isPending ? (
            <div className="space-y-3">
              {Array.from(
                { length: 2 },
                (_, index) => `integration-status-skeleton-${index + 1}`
              ).map(key => (
                <div key={key} className="h-20 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : statusConnections.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Aucune connexion Powens.
            </p>
          ) : (
            statusConnections.map(connection => {
              const syncBadge = getPowensConnectionSyncBadgeModel({
                connection,
                persistenceEnabled: syncStatusPersistenceEnabled,
              })
              const isConfirmingDisconnect =
                pendingDisconnectConnectionId === connection.powensConnectionId
              const isDisconnectPending =
                disconnectMutation.isPending &&
                disconnectMutation.variables?.connectionId === connection.powensConnectionId
              const disconnectAction = getPowensDisconnectActionState({
                isAdmin,
                isConfirming: isConfirmingDisconnect,
                isPending: isDisconnectPending,
              })
              return (
                <div
                  key={connection.id}
                  className="rounded-lg border border-border/50 bg-surface-1 p-4 transition-colors hover:bg-surface-2"
                  style={{ transitionDuration: 'var(--duration-fast)' }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-sm">
                        {connection.providerInstitutionName ??
                          `Connexion #${connection.powensConnectionId}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {connection.provider} · ref {connection.providerConnectionId}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Dernière sync : {formatDateTime(connection.lastSyncAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={syncBadge.badgeVariant}
                        className={syncBadge.badgeClassName}
                        title={syncBadge.tooltipLabel}
                      >
                        {syncBadge.badgeLabel}
                      </Badge>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-xs"
                        disabled={
                          manualSyncUiState.blocked || syncMutation.isPending || isDisconnectPending
                        }
                        onClick={() =>
                          syncMutation.mutate({ connectionId: connection.powensConnectionId })
                        }
                      >
                        Sync
                      </Button>
                      {disconnectAction.showConfirmation ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-xs"
                            disabled={!disconnectAction.canCancel}
                            onClick={() => setPendingDisconnectConnectionId(null)}
                          >
                            Annuler
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            className="text-xs"
                            disabled={!disconnectAction.canConfirm}
                            onClick={() =>
                              disconnectMutation.mutate({
                                connectionId: connection.powensConnectionId,
                              })
                            }
                          >
                            {isDisconnectPending ? 'Retrait...' : 'Confirmer'}
                          </Button>
                        </>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          disabled={!disconnectAction.canStart}
                          onClick={() =>
                            setPendingDisconnectConnectionId(connection.powensConnectionId)
                          }
                        >
                          Retirer
                        </Button>
                      )}
                    </div>
                  </div>
                  {connection.lastError && (
                    <p className="mt-2 text-xs text-destructive">{connection.lastError}</p>
                  )}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {/* Sync runs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Derniers runs de synchronisation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {syncRunsQuery.isPending ? (
            <div className="space-y-2">
              {Array.from(
                { length: 3 },
                (_, index) => `integration-sync-skeleton-${index + 1}`
              ).map(key => (
                <div key={key} className="h-12 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : syncRuns.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Aucun run récent.</p>
          ) : (
            syncRuns.slice(0, 10).map(run => (
              <div
                key={run.id}
                className="flex items-center justify-between rounded-lg border border-border/50 bg-surface-1 px-4 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">#{run.connectionId}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {formatDateTime(run.startedAt)}
                    </span>
                    {formatDuration(run.startedAt, run.endedAt) && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        · {formatDuration(run.startedAt, run.endedAt)}
                      </span>
                    )}
                  </p>
                  {run.errorMessage && (
                    <p className="text-xs text-destructive truncate">{run.errorMessage}</p>
                  )}
                </div>
                <Badge
                  variant={
                    run.result === 'success'
                      ? 'secondary'
                      : run.result === 'running'
                        ? 'outline'
                        : 'destructive'
                  }
                  className="text-xs"
                >
                  {run.result}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Diagnostics */}
      {diagnostics && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Diagnostic provider</CardTitle>
              <Badge variant={diagnosticsOutcomeBadge[diagnostics.outcome]?.variant ?? 'outline'}>
                {diagnosticsOutcomeBadge[diagnostics.outcome]?.label ?? diagnostics.outcome}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">{diagnostics.guidance}</p>
            <p className="text-xs text-muted-foreground">
              Dernière vérification : {formatDateTime(diagnostics.lastCheckedAt)}
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => diagnosticsQuery.refetch()}
              disabled={diagnosticsQuery.isFetching}
              className="text-xs"
            >
              Re-vérifier
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Audit trail */}
      {auditEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Audit trail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {auditEvents.slice(0, 10).map(event => (
              <div
                key={event.id}
                className="flex items-center justify-between rounded-lg border border-border/50 bg-surface-1 px-4 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {event.action} · {event.actorMode}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(event.at)}</p>
                </div>
                <Badge
                  variant={event.result === 'allowed' ? 'secondary' : 'destructive'}
                  className="text-xs"
                >
                  {event.result}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Action dock */}
      <ActionDock
        items={[
          {
            icon: <span aria-hidden="true">⊞</span>,
            label: 'Connecter banque',
            tone: 'brand',
            disabled: !isAdmin || isIntegrationsSafeMode || connectMutation.isPending,
            onClick: () => connectMutation.mutate(),
          },
          {
            icon: <span aria-hidden="true">⟳</span>,
            label: 'Sync immédiate',
            tone: 'violet',
            disabled: manualSyncUiState.blocked || syncMutation.isPending,
            onClick: () => syncMutation.mutate({}),
          },
          {
            icon: <span aria-hidden="true">♡</span>,
            label: 'Diagnostiquer',
            tone: 'positive',
            disabled: diagnosticsQuery.isFetching,
            onClick: () => diagnosticsQuery.refetch(),
          },
          {
            icon: <span aria-hidden="true">▣</span>,
            label: 'Audit trail',
            tone: 'plain',
            disabled: auditEvents.length === 0,
            onClick: () => {
              const target = document.querySelector('[data-section="audit"]')
              target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            },
          },
        ]}
        className="mt-6"
      />
    </div>
  )
}
