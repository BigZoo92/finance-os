import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Badge, Button } from '@finance-os/ui/components'
import { Panel } from '@/components/surfaces/panel'
import type {
  DashboardAdvisorAssumptionResponse,
  DashboardAdvisorRecommendationResponse,
} from '@/features/dashboard-types'
import { formatDateTime } from '@/lib/format'

export type AdvisorQuestionStarter = {
  label: string
  detail: string
  prompt: string
  tone?: 'brand' | 'warning' | 'plain'
}

const confidenceLabel = (value: number) => {
  if (value >= 0.75) return 'confiance haute'
  if (value >= 0.55) return 'confiance moyenne'
  return 'confiance prudente'
}

const riskLabel: Record<DashboardAdvisorRecommendationResponse['riskLevel'], string> = {
  low: 'risque faible',
  medium: 'risque moyen',
  high: 'risque élevé',
}

const riskVariant = (riskLevel: DashboardAdvisorRecommendationResponse['riskLevel']) => {
  if (riskLevel === 'high') return 'destructive' as const
  if (riskLevel === 'medium') return 'outline' as const
  return 'secondary' as const
}

const impactSummary = (value: Record<string, unknown>) => {
  const summary = value.summary
  return typeof summary === 'string' ? summary : 'Impact estimé à vérifier dans les artefacts.'
}

const compactList = (items: string[], empty: string, limit = 3) => {
  if (items.length === 0) return [empty]
  return items.slice(0, limit)
}

export function AdvisorRecommendationCard({
  recommendation,
}: {
  recommendation: DashboardAdvisorRecommendationResponse
}) {
  const confidencePct = Math.round(recommendation.confidence * 100)
  const missingOrBlocking = [
    ...recommendation.blockingFactors,
    ...(recommendation.challenge?.missingSignals ?? []),
  ]

  return (
    <article className="rounded-2xl border border-border/60 bg-surface-1/55 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{recommendation.category}</Badge>
            <Badge variant={riskVariant(recommendation.riskLevel)}>
              {riskLabel[recommendation.riskLevel]}
            </Badge>
            <Badge variant="secondary">{confidencePct}%</Badge>
          </div>
          <h3 className="mt-3 text-base font-semibold tracking-tight text-foreground">
            {recommendation.title}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {recommendation.description}
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/ia/chat">Clarifier</Link>
        </Button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <RecommendationBlock title="Pourquoi maintenant">
          <p>{recommendation.whyNow || 'Pas de déclencheur explicite enregistré.'}</p>
        </RecommendationBlock>
        <RecommendationBlock title="Données utilisées">
          <ul className="space-y-1">
            {compactList(
              [...recommendation.evidence, ...recommendation.deterministicMetricsUsed],
              'Aucune donnée détaillée exposée pour cette recommandation.'
            ).map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </RecommendationBlock>
        <RecommendationBlock title="Hypothèses">
          <ul className="space-y-1">
            {compactList(
              recommendation.assumptions,
              'Aucune hypothèse explicite enregistrée.'
            ).map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </RecommendationBlock>
        <RecommendationBlock title="Risques / limites">
          <ul className="space-y-1">
            {compactList(
              missingOrBlocking,
              recommendation.riskLevel === 'high'
                ? 'Risque élevé: vérifier les données et ton profil avant toute décision.'
                : 'Pas de facteur bloquant explicite, mais cela reste une aide à la décision.'
            ).map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </RecommendationBlock>
      </div>

      <div className="mt-4 rounded-xl border border-border/55 bg-background/55 p-3 text-sm">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Confiance
            </p>
            <p className="mt-1 font-medium">{confidenceLabel(recommendation.confidence)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Impact attendu
            </p>
            <p className="mt-1 text-muted-foreground">{impactSummary(recommendation.expectedImpact)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Prochaine action
            </p>
            <p className="mt-1 text-muted-foreground">
              Poser une question, vérifier les données, puis décider manuellement.
            </p>
          </div>
        </div>
      </div>

      {recommendation.challenge ? (
        <div className="mt-3 rounded-xl border border-warning/30 bg-warning/8 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-warning">Critique Advisor</p>
            <Badge variant="outline">{recommendation.challenge.status}</Badge>
          </div>
          <p className="mt-2 leading-relaxed text-muted-foreground">
            {recommendation.challenge.summary}
          </p>
          {recommendation.challenge.contradictions.length > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Contradictions: {recommendation.challenge.contradictions.join(' · ')}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

function RecommendationBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border/45 bg-background/45 p-3 text-sm text-muted-foreground">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-foreground">
        {title}
      </p>
      {children}
    </div>
  )
}

export function AdvisorQuestionStarters({
  questions,
  onSelect,
}: {
  questions: AdvisorQuestionStarter[]
  onSelect?: (prompt: string) => void
}) {
  return (
    <div className="grid gap-2">
      {questions.map(question => {
        const className =
          'group rounded-xl border border-border/45 bg-surface-1/45 px-3 py-3 text-left transition-colors hover:border-primary/30 hover:bg-surface-1'
        const content = (
          <>
            <span className="block text-sm font-medium text-foreground group-hover:text-primary">
              {question.label}
            </span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
              {question.detail}
            </span>
          </>
        )

        return onSelect ? (
          <button
            key={question.prompt}
            type="button"
            className={className}
            onClick={() => onSelect(question.prompt)}
          >
            {content}
          </button>
        ) : (
          <Link key={question.prompt} to="/ia/chat" className={className}>
            {content}
          </Link>
        )
      })}
    </div>
  )
}

export function AdvisorAssumptionsPanel({
  assumptions,
  missingItems,
}: {
  assumptions: DashboardAdvisorAssumptionResponse[]
  missingItems: string[]
}) {
  return (
    <Panel
      title="Hypothèses & limites"
      description="Ce que l'Advisor utilise, et ce qui manque pour conseiller proprement."
      icon={<span aria-hidden="true">?</span>}
      tone={missingItems.length > 0 ? 'warning' : 'plain'}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Hypothèses utilisées
          </p>
          <div className="mt-2 space-y-2">
            {assumptions.length > 0 ? (
              assumptions.slice(0, 5).map(assumption => (
                <div
                  key={assumption.id}
                  className="rounded-xl border border-border/45 bg-surface-1/45 px-3 py-2 text-sm"
                >
                  <p className="font-medium text-foreground">{assumption.assumptionKey}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {assumption.justification}
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-xl border border-border/45 bg-surface-1/45 px-3 py-3 text-sm text-muted-foreground">
                Aucune hypothèse explicite enregistrée pour l'instant.
              </p>
            )}
          </div>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            À vérifier avant décision
          </p>
          <div className="mt-2 space-y-2">
            {missingItems.length > 0 ? (
              missingItems.slice(0, 7).map(item => (
                <p
                  key={item}
                  className="rounded-xl border border-warning/30 bg-warning/8 px-3 py-2 text-sm text-warning"
                >
                  {item}
                </p>
              ))
            ) : (
              <p className="rounded-xl border border-border/45 bg-surface-1/45 px-3 py-3 text-sm text-muted-foreground">
                Aucune limite bloquante exposée par les artefacts actuels.
              </p>
            )}
          </div>
        </div>
      </div>
    </Panel>
  )
}

export function AdvisorDecisionJournal({
  recommendations,
}: {
  recommendations: DashboardAdvisorRecommendationResponse[]
}) {
  return (
    <Panel
      title="Journal de décisions"
      description="Surface préparée pour suivre ce que tu décides et pourquoi. Aucune persistance n'est simulée ici."
      icon={<span aria-hidden="true">[]</span>}
      tone="plain"
    >
      <div className="space-y-3">
        <div className="rounded-xl border border-border/45 bg-surface-1/45 p-4">
          <p className="text-sm font-medium text-foreground">Pas encore de journal persistant.</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Le futur modèle pourra stocker: recommandation revue, décision, raison, date,
            données liées et statut de suivi. Pour l'instant, cette page ne prétend pas sauvegarder.
          </p>
        </div>
        {recommendations.slice(0, 3).map(recommendation => (
          <div
            key={recommendation.id}
            className="rounded-xl border border-border/45 bg-background/45 px-3 py-3 text-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-foreground">{recommendation.title}</p>
              <Badge variant="outline">{formatDateTime(recommendation.createdAt)}</Badge>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              À documenter plus tard: accepté, ignoré, retardé, fait ou à revoir.
            </p>
          </div>
        ))}
      </div>
    </Panel>
  )
}
