import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Badge, Button } from '@finance-os/ui/components'
import { z } from 'zod'
import type { AuthMode } from '@/features/auth-types'
import { authMeQueryOptions } from '@/features/auth-query-options'
import { resolveAuthViewState } from '@/features/auth-view-state'
import { dashboardSummaryQueryOptionsWithMode } from '@/features/dashboard-query-options'
import {
  externalInvestmentsCashFlowsQueryOptionsWithMode,
  externalInvestmentsPositionsQueryOptionsWithMode,
  externalInvestmentsSummaryQueryOptionsWithMode,
  externalInvestmentsTradesQueryOptionsWithMode,
} from '@/features/external-investments/query-options'
import {
  buildFiscalAccountsCsv,
  buildFiscalEventsCsv,
  buildFiscalSummaryViewModel,
  type FiscalAccountReview,
  type FiscalChecklistStatus,
  type FiscalEventReview,
  type FiscalFormHint,
  type FiscalReviewStatus,
} from '@/features/fiscalite-view-model'
import { downloadFile } from '@/lib/export'
import { formatDateTime, formatMoney } from '@/lib/format'
import { KpiTile } from '@/components/surfaces/kpi-tile'
import { PageHeader } from '@/components/surfaces/page-header'
import { Panel } from '@/components/surfaces/panel'
import {
  PersonalEmptyState,
  PersonalSectionHeading,
} from '@/components/personal/personal-ux'

const DEFAULT_FISCAL_YEAR = new Date().getFullYear()
const FISCAL_QUERY_RANGE = '90d'
const FISCAL_LIST_LIMIT = 100

const searchSchema = z.object({
  year: z
    .preprocess(value => {
      if (typeof value === 'string' && value.trim().length > 0) return Number(value)
      if (typeof value === 'number') return value
      return DEFAULT_FISCAL_YEAR
    }, z.number().int().min(2000).max(2100))
    .catch(DEFAULT_FISCAL_YEAR),
})

export const Route = createFileRoute('/_app/fiscalite')({
  validateSearch: search => searchSchema.parse(search),
  loaderDeps: ({ search }) => ({ year: search.year }),
  loader: async ({ context }) => {
    const auth = await context.queryClient.fetchQuery(authMeQueryOptions())
    const mode: AuthMode | undefined =
      auth.mode === 'admin' ? 'admin' : auth.mode === 'demo' ? 'demo' : undefined
    if (!mode) return

    await Promise.all([
      context.queryClient.ensureQueryData(
        dashboardSummaryQueryOptionsWithMode({ range: FISCAL_QUERY_RANGE, mode })
      ),
      context.queryClient.ensureQueryData(externalInvestmentsSummaryQueryOptionsWithMode({ mode })),
      context.queryClient.ensureQueryData(externalInvestmentsPositionsQueryOptionsWithMode({ mode })),
      context.queryClient.ensureQueryData(
        externalInvestmentsTradesQueryOptionsWithMode({ mode, limit: FISCAL_LIST_LIMIT })
      ),
      context.queryClient.ensureQueryData(
        externalInvestmentsCashFlowsQueryOptionsWithMode({ mode, limit: FISCAL_LIST_LIMIT })
      ),
    ])
  },
  component: FiscalitePage,
})

const yearOptions = Array.from({ length: 5 }, (_, index) => DEFAULT_FISCAL_YEAR - index)

const REVIEW_STATUS_UI: Record<
  FiscalReviewStatus,
  { label: string; variant: 'secondary' | 'outline' | 'warning' | 'positive' | 'violet' }
> = {
  not_applicable: { label: 'non concerné', variant: 'outline' },
  to_check: { label: 'à vérifier', variant: 'violet' },
  likely_relevant: { label: 'potentiellement concerné', variant: 'warning' },
  missing_data: { label: 'données insuffisantes', variant: 'warning' },
  ready_for_review: { label: 'prêt à vérifier', variant: 'positive' },
}

const CHECKLIST_STATUS_UI: Record<
  FiscalChecklistStatus,
  { label: string; variant: 'secondary' | 'outline' | 'warning' | 'positive' | 'violet' }
> = {
  todo: { label: 'à faire', variant: 'violet' },
  ready: { label: 'prêt à vérifier', variant: 'positive' },
  not_applicable: { label: 'non concerné', variant: 'outline' },
  missing_data: { label: 'données manquantes', variant: 'warning' },
  to_confirm: { label: 'à confirmer', variant: 'secondary' },
}

const FORM_HINT_LABEL: Record<FiscalFormHint, string> = {
  '3916-3916-bis': '3916 / 3916-bis',
  '2086': '2086',
  '2074': '2074',
  'pea-review': 'PEA à vérifier',
  other: 'autre point',
  unknown: 'à confirmer',
}

const EVENT_CATEGORY_LABEL: Record<FiscalEventReview['category'], string> = {
  crypto_disposal: 'Cessions crypto',
  security_sale: 'Ventes CTO / titres',
  dividend: 'Dividendes',
  interest: 'Intérêts',
  pea_withdrawal: 'PEA',
  account_opened_closed: 'Comptes ouverts / clos',
  unknown: 'Mouvements inconnus',
}

const EVENT_CATEGORY_ORDER: FiscalEventReview['category'][] = [
  'crypto_disposal',
  'security_sale',
  'dividend',
  'interest',
  'pea_withdrawal',
  'account_opened_closed',
  'unknown',
]

function FiscalitePage() {
  const { year } = Route.useSearch()
  const navigate = Route.useNavigate()

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
      range: FISCAL_QUERY_RANGE,
      ...(authMode ? { mode: authMode } : {}),
    })
  )
  const externalSummaryQuery = useQuery(
    externalInvestmentsSummaryQueryOptionsWithMode({ ...(authMode ? { mode: authMode } : {}) })
  )
  const externalPositionsQuery = useQuery(
    externalInvestmentsPositionsQueryOptionsWithMode({ ...(authMode ? { mode: authMode } : {}) })
  )
  const externalTradesQuery = useQuery(
    externalInvestmentsTradesQueryOptionsWithMode({
      ...(authMode ? { mode: authMode } : {}),
      limit: FISCAL_LIST_LIMIT,
    })
  )
  const externalCashFlowsQuery = useQuery(
    externalInvestmentsCashFlowsQueryOptionsWithMode({
      ...(authMode ? { mode: authMode } : {}),
      limit: FISCAL_LIST_LIMIT,
    })
  )

  if (authViewState === 'pending' || !authMode) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Cockpit personnel"
          icon="§"
          title="Fiscalité"
          description="Chargement du dossier préparatoire."
        />
        <Panel title="Préparation" tone="brand">
          <div className="space-y-3">
            <div className="h-8 w-64 animate-shimmer rounded-lg" />
            <div className="h-20 animate-shimmer rounded-xl" />
          </div>
        </Panel>
      </div>
    )
  }

  const model = buildFiscalSummaryViewModel({
    year,
    mode: authMode,
    ...(summaryQuery.data ? { summary: summaryQuery.data } : {}),
    ...(externalSummaryQuery.data ? { externalSummary: externalSummaryQuery.data } : {}),
    ...(externalPositionsQuery.data ? { externalPositions: externalPositionsQuery.data } : {}),
    ...(externalTradesQuery.data ? { externalTrades: externalTradesQuery.data } : {}),
    ...(externalCashFlowsQuery.data ? { externalCashFlows: externalCashFlowsQuery.data } : {}),
  })

  const pending =
    summaryQuery.isPending ||
    externalSummaryQuery.isPending ||
    externalPositionsQuery.isPending ||
    externalTradesQuery.isPending ||
    externalCashFlowsQuery.isPending
  const degraded =
    model.meta.degraded ||
    summaryQuery.isError ||
    externalSummaryQuery.isError ||
    externalPositionsQuery.isError ||
    externalTradesQuery.isError ||
    externalCashFlowsQuery.isError

  const handleExportAccounts = () => {
    downloadFile({
      filename: `finance-os-fiscalite-checklist-${year}.csv`,
      mimeType: 'text/csv;charset=utf-8',
      content: buildFiscalAccountsCsv(model.accounts),
    })
  }

  const handleExportEvents = () => {
    downloadFile({
      filename: `finance-os-fiscalite-evenements-${year}.csv`,
      mimeType: 'text/csv;charset=utf-8',
      content: buildFiscalEventsCsv(model.events),
    })
  }

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Cockpit personnel"
        icon="§"
        title="Fiscalité"
        description="Un dossier préparatoire pour vérifier tes comptes, tes mouvements et les données manquantes avant déclaration."
        status={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="warning">ne remplace pas la déclaration officielle</Badge>
            <Badge variant="outline">ne remplace pas un professionnel</Badge>
            <Badge variant={authMode === 'demo' ? 'secondary' : 'violet'}>
              {authMode === 'demo' ? 'démo déterministe' : 'admin lecture seule'}
            </Badge>
          </div>
        }
        actions={
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Année</span>
            <select
              value={year}
              onChange={event => navigate({ search: { year: Number(event.target.value) } })}
              className="h-10 rounded-lg border border-border/60 bg-surface-1 px-3 text-sm shadow-xs"
            >
              {yearOptions.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        }
      />

      <Panel
        title="Situation fiscale personnelle"
        description="Finance-OS prépare les éléments personnels à vérifier; il ne calcule pas la déclaration du foyer."
        icon={<span aria-hidden="true">§</span>}
        tone="warning"
        actions={<Badge variant={degraded ? 'warning' : 'secondary'}>{degraded ? 'à confirmer' : 'cache prêt'}</Badge>}
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-3">
            <div className="rounded-xl border border-warning/35 bg-warning/10 p-4">
              <p className="text-sm font-semibold text-foreground">{model.householdContext.label}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {model.householdContext.description}
              </p>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Cette page sert de dossier préparatoire à vérifier ou transmettre. Elle ne se connecte pas à impots.gouv,
              ne soumet rien et ne génère aucun Cerfa officiel.
            </p>
            {model.meta.reason ? (
              <p className="rounded-lg border border-warning/35 bg-warning/10 px-3 py-2 text-sm text-warning">
                {model.meta.reason}
              </p>
            ) : null}
          </div>
          <div className="rounded-xl border border-border/50 bg-surface-1 p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Fraîcheur</p>
            <p className="mt-2 text-sm font-medium">{formatDateTime(model.meta.generatedAt)}</p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Identifiants sensibles masqués. Données brutes provider non affichées.
            </p>
          </div>
        </div>
      </Panel>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label="Comptes à vérifier"
          value={model.accounts.length}
          tone={model.accounts.length > 0 ? 'warning' : 'plain'}
          loading={pending}
          hint="Comptes potentiellement concernés ou à confirmer."
        />
        <KpiTile
          label="Événements"
          value={model.events.length}
          tone={model.events.length > 0 ? 'violet' : 'plain'}
          loading={pending}
          hint="Cessions, revenus ou points à contrôler."
        />
        <KpiTile
          label="Données manquantes"
          value={model.missingData.length}
          tone={model.missingData.length > 0 ? 'warning' : 'positive'}
          loading={pending}
          hint="Le dossier préfère signaler l'incertitude."
        />
        <KpiTile
          label="Posture"
          display="préparatoire"
          tone="brand"
          loading={pending}
          hint="Aucun dépôt, aucun conseil fiscal officiel."
        />
      </section>

      <section className="space-y-4">
        <PersonalSectionHeading
          eyebrow="Checklist annuelle"
          title="Ce qu'il faut contrôler"
          description="Chaque ligne indique un point à vérifier, à confirmer ou non concerné selon les données disponibles."
        />
        <Panel title="Checklist" icon={<span aria-hidden="true">✓</span>} tone="brand">
          <div className="grid gap-2 md:grid-cols-2">
            {model.checklist.map(item => {
              const status = CHECKLIST_STATUS_UI[item.status]
              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-border/50 bg-surface-1 px-4 py-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-snug">{item.label}</p>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                  {item.reason ? (
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.reason}</p>
                  ) : null}
                </div>
              )
            })}
          </div>
        </Panel>
      </section>

      <section className="space-y-4">
        <PersonalSectionHeading
          eyebrow="Comptes"
          title="Comptes à vérifier"
          description="Les catégories sont des indices de revue, pas des conclusions fiscales."
        />
        {model.accounts.length === 0 ? (
          <PersonalEmptyState
            title="Aucun compte à vérifier dans les données disponibles"
            description="Si des historiques provider sont absents, exporte les relevés depuis les plateformes pour confirmer."
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {model.accounts.map(account => (
              <FiscalAccountReviewCard key={account.id} account={account} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <PersonalSectionHeading
          eyebrow="Mouvements"
          title="Événements potentiellement déclarables"
          description="Finance-OS liste ce qui mérite une revue annuelle sans produire de chiffre à reprendre tel quel."
        />
        <FiscalEventGroups events={model.events} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <FiscalMissingDataPanel missingData={model.missingData} />
        <Panel
          title="Exports / dossier préparatoire"
          description="Les exports ne sont pas des formulaires officiels."
          icon={<span aria-hidden="true">⇩</span>}
          tone="violet"
        >
          <div className="space-y-3">
            {model.exports.map(item => {
              const onClick =
                item.id === 'accounts-csv'
                  ? handleExportAccounts
                  : item.id === 'events-csv'
                    ? handleExportEvents
                    : () => window.print()
              return (
                <div key={item.id} className="rounded-xl border border-border/50 bg-surface-1 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {item.reason ?? 'Document préparatoire à vérifier.'}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={item.available ? 'outline' : 'ghost'}
                      disabled={!item.available}
                      onClick={onClick}
                    >
                      {item.format === 'print' ? 'Imprimer' : 'CSV'}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </Panel>
      </section>

      <Panel
        title="Limites"
        description="Cette surface réduit les oublis possibles, sans donner de certitude fiscale."
        icon={<span aria-hidden="true">!</span>}
        tone="plain"
      >
        <ul className="grid gap-2 text-sm leading-relaxed text-muted-foreground md:grid-cols-2">
          <li>Pas de connexion à impots.gouv et aucun dépôt automatisé.</li>
          <li>Aucun Cerfa officiel n'est généré par Finance-OS.</li>
          <li>Les formulaires 3916 / 3916-bis, 2086 et 2074 sont seulement des indices de revue.</li>
          <li>Les données peuvent être incomplètes; les relevés officiels et un professionnel restent à vérifier.</li>
        </ul>
      </Panel>
    </div>
  )
}

function FiscalAccountReviewCard({ account }: { account: FiscalAccountReview }) {
  const status = REVIEW_STATUS_UI[account.status]
  return (
    <article className="rounded-2xl border border-border/55 bg-card p-4 transition-colors hover:bg-surface-1">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{account.label}</p>
          <p className="mt-0.5 text-xs uppercase tracking-[0.14em] text-muted-foreground">
            {account.provider ?? account.source} · {account.accountType}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          <Badge variant={status.variant}>{status.label}</Badge>
          {account.formHint ? (
            <Badge variant="outline">{FORM_HINT_LABEL[account.formHint]}</Badge>
          ) : null}
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{account.reason}</p>
      {account.missingData.length > 0 ? (
        <div className="mt-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground/70">
            Données à confirmer
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {account.missingData.map(item => (
              <Badge key={item} variant="warning">
                {item}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}
      <p className="mt-3 rounded-lg border border-border/45 bg-surface-1 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        {account.nextAction}
      </p>
    </article>
  )
}

function FiscalEventGroups({ events }: { events: FiscalEventReview[] }) {
  if (events.length === 0) {
    return (
      <PersonalEmptyState
        title="Aucun événement potentiellement déclarable détecté"
        description="Si tes historiques Binance ou IBKR sont incomplets, exporte les relevés depuis les plateformes pour confirmer."
      />
    )
  }

  return (
    <Panel
      title="Événements à revoir"
      description="Groupés par nature pour préparer les justificatifs."
      icon={<span aria-hidden="true">≡</span>}
      tone="violet"
      bleed
    >
      <div className="space-y-6 px-5 pb-5 md:px-6 md:pb-6">
        {EVENT_CATEGORY_ORDER.map(category => {
          const categoryEvents = events.filter(event => event.category === category)
          if (categoryEvents.length === 0) return null
          return (
            <div key={category} className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">{EVENT_CATEGORY_LABEL[category]}</h3>
                <Badge variant="outline">
                  {categoryEvents.length} point{categoryEvents.length > 1 ? 's' : ''}
                </Badge>
              </div>
              <div className="overflow-x-auto rounded-xl border border-border/50">
                <table className="min-w-[860px] w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 bg-surface-1/70 text-left text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      <th className="px-3 py-2">Événement</th>
                      <th className="px-3 py-2">Indice</th>
                      <th className="px-3 py-2">Statut</th>
                      <th className="px-3 py-2 text-right">Montant</th>
                      <th className="px-3 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryEvents.map(event => {
                      const status = REVIEW_STATUS_UI[event.status]
                      return (
                        <tr key={event.id} className="border-b border-border/40 last:border-0">
                          <td className="px-3 py-3 align-top">
                            <p className="font-medium">{event.label}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {event.source} · {event.reason}
                            </p>
                            {event.missingData.length > 0 ? (
                              <p className="mt-1 text-xs text-warning">
                                Données manquantes: {event.missingData.slice(0, 3).join(', ')}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-3 py-3 align-top">
                            <Badge variant="outline">
                              {event.formHint ? FORM_HINT_LABEL[event.formHint] : 'à confirmer'}
                            </Badge>
                          </td>
                          <td className="px-3 py-3 align-top">
                            <Badge variant={status.variant}>{status.label}</Badge>
                          </td>
                          <td className="px-3 py-3 text-right align-top">
                            <span className="font-financial">
                              {event.amount === undefined
                                ? '-'
                                : formatMoney(event.amount, event.currency ?? 'EUR')}
                            </span>
                          </td>
                          <td className="px-3 py-3 align-top text-xs leading-relaxed text-muted-foreground">
                            {event.nextAction}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

function FiscalMissingDataPanel({ missingData }: { missingData: string[] }) {
  return (
    <Panel
      title="Données manquantes"
      description="Cette section évite la fausse confiance: tout point incomplet reste visible."
      icon={<span aria-hidden="true">?</span>}
      tone={missingData.length > 0 ? 'warning' : 'positive'}
    >
      {missingData.length === 0 ? (
        <PersonalEmptyState
          title="Aucune donnée manquante critique"
          description="Le dossier reste à vérifier avec les relevés officiels."
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          {missingData.map(item => (
            <Badge key={item} variant="warning" className="max-w-full whitespace-normal text-left">
              {item}
            </Badge>
          ))}
        </div>
      )}
    </Panel>
  )
}
