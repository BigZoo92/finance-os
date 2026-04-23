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
  Separator,
} from '@finance-os/ui/components'
import { MiniSparkline } from '@/components/ui/d3-sparkline'
import type { AuthMode } from '@/features/auth-types'
import type {
  DashboardAdvisorAssumptionsResponse,
  DashboardAdvisorKnowledgeAnswerResponse,
  DashboardAdvisorKnowledgeTopicsResponse,
  DashboardAdvisorChatThreadResponse,
  DashboardAdvisorEvalsResponse,
  DashboardAdvisorManualOperationResponse,
  DashboardAdvisorOverviewResponse,
  DashboardAdvisorRecommendationsResponse,
  DashboardAdvisorRunsResponse,
  DashboardAdvisorSignalsResponse,
  DashboardAdvisorSpendAnalyticsResponse,
} from '@/features/dashboard-types'
import { formatDateTime, formatDuration, formatMoney } from '@/lib/format'

const readMetricNumber = (
  metrics: Record<string, unknown> | undefined,
  key: string
): number | null => {
  const value = metrics?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

const formatPercent = (value: number | null, digits = 1) => {
  if (value === null) {
    return '-'
  }

  return `${value.toFixed(digits)}%`
}

const formatConfidence = (value: number) => `${Math.round(value * 100)}%`

const recommendationRiskVariant = (riskLevel: 'low' | 'medium' | 'high') => {
  if (riskLevel === 'high') {
    return 'destructive' as const
  }

  if (riskLevel === 'medium') {
    return 'outline' as const
  }

  return 'secondary' as const
}

const runStatusVariant = (
  status: 'queued' | 'running' | 'completed' | 'failed' | 'degraded' | 'skipped'
) => {
  if (status === 'failed') {
    return 'destructive' as const
  }

  if (status === 'degraded' || status === 'running') {
    return 'outline' as const
  }

  return 'secondary' as const
}

const operationStatusVariant = (
  status: 'queued' | 'running' | 'completed' | 'failed' | 'degraded'
) => {
  if (status === 'failed') {
    return 'destructive' as const
  }

  if (status === 'running' || status === 'degraded') {
    return 'outline' as const
  }

  return 'secondary' as const
}

const statusTone = (status: DashboardAdvisorOverviewResponse['status']) => {
  if (status === 'degraded') {
    return 'destructive' as const
  }

  if (status === 'needs_run') {
    return 'outline' as const
  }

  return 'secondary' as const
}

const knowledgeConfidenceVariant = (
  label: DashboardAdvisorKnowledgeAnswerResponse['confidenceLabel']
) => {
  if (label === 'low') {
    return 'outline' as const
  }

  return 'secondary' as const
}

const knowledgeStatusVariant = (
  status: DashboardAdvisorKnowledgeAnswerResponse['status']
) => {
  if (status === 'guardrail_blocked') {
    return 'destructive' as const
  }

  if (status === 'low_confidence' || status === 'browse_only') {
    return 'outline' as const
  }

  return 'secondary' as const
}

const formatKnowledgeFallback = (
  fallbackReason: DashboardAdvisorKnowledgeAnswerResponse['fallbackReason']
) => {
  if (fallbackReason === 'provider_disable_switch') {
    return 'Retrieval coupe par le switch provider-disable. Le mode browse-only reste disponible.'
  }

  if (fallbackReason === 'retrieval_kill_switch') {
    return 'Retrieval coupe par kill-switch. Parcourez plutot les sujets du knowledge pack.'
  }

  if (fallbackReason === 'guardrail_personalized_advice') {
    return 'La question ressemble a une demande personnalisee. Le panneau reste limite a des explications educatives.'
  }

  if (fallbackReason === 'guardrail_regulatory_or_tax') {
    return 'Les questions fiscales, juridiques ou reglementaires sortent du cadre educatif de cette surface.'
  }

  if (fallbackReason === 'retrieval_error') {
    return 'Le moteur de retrieval a degrade proprement. Parcourez les sujets statiques ci-dessous.'
  }

  return 'Confiance insuffisante pour assembler une reponse nette. Parcourez plutot les sujets lies.'
}

const impactSummary = (value: Record<string, unknown>) => {
  const summary = value.summary
  return typeof summary === 'string' ? summary : 'Impact estime disponible dans les artefacts.'
}

export const AiAdvisorPanel = ({
  mode,
  overview,
  recommendations,
  assumptions,
  signals,
  spend,
  runs,
  knowledgeTopics,
  knowledgeAnswer,
  manualOperation,
  chat,
  evals,
  isPending,
  errorMessage,
  manualOperationErrorMessage,
  canTriggerRun,
  isTriggeringRun,
  onTriggerRun,
  isAskingKnowledge,
  knowledgeAnswerErrorMessage,
  onAskKnowledge,
  isSendingChat,
  onSendChat,
}: {
  mode: AuthMode | undefined
  overview: DashboardAdvisorOverviewResponse | undefined
  recommendations: DashboardAdvisorRecommendationsResponse | undefined
  assumptions: DashboardAdvisorAssumptionsResponse | undefined
  signals: DashboardAdvisorSignalsResponse | undefined
  spend: DashboardAdvisorSpendAnalyticsResponse | undefined
  runs: DashboardAdvisorRunsResponse | undefined
  knowledgeTopics: DashboardAdvisorKnowledgeTopicsResponse | undefined
  knowledgeAnswer: DashboardAdvisorKnowledgeAnswerResponse | undefined
  manualOperation: DashboardAdvisorManualOperationResponse | null | undefined
  chat: DashboardAdvisorChatThreadResponse | undefined
  evals: DashboardAdvisorEvalsResponse | undefined
  isPending: boolean
  errorMessage: string | null
  manualOperationErrorMessage: string | null
  canTriggerRun: boolean
  isTriggeringRun: boolean
  onTriggerRun: () => void
  isAskingKnowledge: boolean
  knowledgeAnswerErrorMessage: string | null
  onAskKnowledge: (question: string) => void
  isSendingChat: boolean
  onSendChat: (message: string) => void
}) => {
  const [chatDraft, setChatDraft] = useState('')
  const [knowledgeDraft, setKnowledgeDraft] = useState('')
  const [includeSocialSignals, setIncludeSocialSignals] = useState(true)

  const handleSendChat = () => {
    const normalized = chatDraft.trim()
    if (!normalized) {
      return
    }

    onSendChat(normalized)
    setChatDraft('')
  }

  const handleAskKnowledge = (overrideQuestion?: string) => {
    const normalized = (overrideQuestion ?? knowledgeDraft).trim()
    if (!normalized) {
      return
    }

    onAskKnowledge(normalized)

    if (!overrideQuestion) {
      setKnowledgeDraft('')
    } else {
      setKnowledgeDraft(normalized)
    }
  }

  const snapshotMetrics = overview?.snapshot?.metrics
  const spendSeries = spend?.daily.map(point => point.usd) ?? []

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-border/70 bg-[linear-gradient(135deg,oklch(from_var(--surface-1)_l_c_h/0.92),oklch(from_var(--surface-2)_l_c_h/0.88))]">
        <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Advisor IA & moteur quant</CardTitle>
              <Badge variant={statusTone(overview?.status ?? 'needs_run')}>
                {overview?.status ?? 'loading'}
              </Badge>
              <Badge variant="outline">{overview?.source ?? 'unknown'}</Badge>
              {mode === 'demo' ? <Badge variant="secondary">demo deterministic</Badge> : null}
            </div>
            <CardDescription>
              Brief quotidien, recommandations challengees, signaux persistants et suivi de cout
              IA.
            </CardDescription>
            {overview?.degradedMessage ? (
              <p className="text-sm text-amber-300">{overview.degradedMessage}</p>
            ) : null}
            {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
            {manualOperationErrorMessage ? (
              <p className="text-sm text-destructive">{manualOperationErrorMessage}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              Genere le {overview ? formatDateTime(overview.generatedAt) : '-'}
            </Badge>
            {canTriggerRun ? (
              <Button
                type="button"
                size="sm"
                onClick={onTriggerRun}
                disabled={isTriggeringRun}
              >
                {isTriggeringRun ? 'Mission en cours...' : 'Tout rafraichir et analyser'}
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-border/70 bg-background/60 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Cash drag</p>
            <p className="font-financial pt-2 text-2xl font-semibold">
              {formatPercent(readMetricNumber(snapshotMetrics, 'cashDragPct'), 2)}
            </p>
          </div>
          <div className="rounded-xl border border-border/70 bg-background/60 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Allocation cash</p>
            <p className="font-financial pt-2 text-2xl font-semibold">
              {formatPercent(readMetricNumber(snapshotMetrics, 'cashAllocationPct'))}
            </p>
          </div>
          <div className="rounded-xl border border-border/70 bg-background/60 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Retour attendu</p>
            <p className="font-financial pt-2 text-2xl font-semibold">
              {formatPercent(readMetricNumber(snapshotMetrics, 'expectedAnnualReturnPct'))}
            </p>
          </div>
          <div className="rounded-xl border border-border/70 bg-background/60 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Diversification</p>
            <p className="font-financial pt-2 text-2xl font-semibold">
              {readMetricNumber(snapshotMetrics, 'diversificationScore')?.toFixed(0) ?? '-'}
            </p>
          </div>
        </CardContent>
      </Card>

      {manualOperation ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Mission manuelle</CardTitle>
              <Badge variant={operationStatusVariant(manualOperation.status)}>
                {manualOperation.status}
              </Badge>
              {manualOperation.degraded ? <Badge variant="outline">degraded</Badge> : null}
              {manualOperation.currentStage ? (
                <Badge variant="outline">{manualOperation.currentStage}</Badge>
              ) : null}
            </div>
            <CardDescription>
              {manualOperation.statusMessage ?? 'Orchestration complete du refresh et de l analyse advisor.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border/70 bg-background/50 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Demarrage</p>
                <p className="pt-2 text-sm font-medium">{formatDateTime(manualOperation.startedAt)}</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-background/50 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Duree</p>
                <p className="pt-2 text-sm font-medium">
                  {formatDuration(manualOperation.startedAt, manualOperation.finishedAt) ?? '-'}
                </p>
              </div>
              <div className="rounded-lg border border-border/70 bg-background/50 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Run advisor</p>
                <p className="pt-2 text-sm font-medium">
                  {manualOperation.advisorRunId ? `#${manualOperation.advisorRunId}` : 'pas encore'}
                </p>
              </div>
            </div>
            {manualOperation.errorMessage ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {manualOperation.errorMessage}
              </div>
            ) : null}
            <div className="grid gap-3 lg:grid-cols-2">
              {manualOperation.steps.map(step => (
                <div key={step.stepKey} className="rounded-lg border border-border/70 bg-background/50 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{step.label}</p>
                    <Badge variant={runStatusVariant(step.status)}>{step.status}</Badge>
                  </div>
                  <p className="pt-2 text-xs text-muted-foreground">
                    {step.startedAt ? formatDateTime(step.startedAt) : 'en attente'}
                    {step.finishedAt ? ` · ${formatDateTime(step.finishedAt)}` : ''}
                  </p>
                  {step.errorMessage ? (
                    <p className="pt-2 text-sm text-destructive">{step.errorMessage}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {isPending && !overview ? (
        <Card>
          <CardContent className="py-10 text-sm text-muted-foreground">
            Chargement des artefacts advisor...
          </CardContent>
        </Card>
      ) : null}

      {overview?.brief ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{overview.brief.title}</CardTitle>
              {overview.brief.model ? <Badge variant="outline">{overview.brief.model}</Badge> : null}
            </div>
            <CardDescription>{overview.brief.summary}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Faits clefs</p>
              {overview.brief.keyFacts.map(item => (
                <p key={item} className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm">
                  {item}
                </p>
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Opportunites</p>
              {overview.brief.opportunities.map(item => (
                <p key={item} className="rounded-lg border border-positive/30 bg-positive/10 p-3 text-sm">
                  {item}
                </p>
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Risques & watchlist</p>
              {[...overview.brief.risks, ...overview.brief.watchItems].map(item => (
                <p key={item} className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
                  {item}
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="overflow-hidden border-border/70 bg-[linear-gradient(135deg,oklch(from_var(--surface-1)_l_c_h/0.9),oklch(from_var(--surface-0)_l_c_h/0.96))]">
        <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Q&A pedagogique</CardTitle>
              <Badge
                variant={
                  knowledgeAnswer ? knowledgeStatusVariant(knowledgeAnswer.status) : 'outline'
                }
              >
                {knowledgeAnswer?.status ?? 'ask'}
              </Badge>
              <Badge variant={knowledgeTopics?.retrievalEnabled ? 'secondary' : 'outline'}>
                {knowledgeTopics?.retrievalEnabled ? 'retrieval on' : 'browse only'}
              </Badge>
              {knowledgeAnswer ? (
                <Badge variant={knowledgeConfidenceVariant(knowledgeAnswer.confidenceLabel)}>
                  confiance {knowledgeAnswer.confidenceLabel}
                </Badge>
              ) : null}
            </div>
            <CardDescription>
              Questions educatives sur le knowledge pack finance. Pas de conseil personnalise,
              fiscal, juridique ou achat/vente.
            </CardDescription>
            <p className="text-sm text-muted-foreground">
              Les reponses restent bornees au pack de connaissances et s affichent avec citations
              explicites.
            </p>
            {knowledgeTopics?.browseOnlyReason ? (
              <p className="text-sm text-amber-300">
                {formatKnowledgeFallback(knowledgeTopics.browseOnlyReason)}
              </p>
            ) : null}
            {knowledgeAnswerErrorMessage ? (
              <p className="text-sm text-destructive">{knowledgeAnswerErrorMessage}</p>
            ) : null}
          </div>
          <div className="w-full max-w-2xl space-y-2">
            <Input
              value={knowledgeDraft}
              onChange={event => setKnowledgeDraft(event.target.value)}
              placeholder="Ex: Pourquoi diversifier un portefeuille ?"
              disabled={isAskingKnowledge}
            />
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                onClick={() => handleAskKnowledge()}
                disabled={isAskingKnowledge}
              >
                {isAskingKnowledge ? 'Recherche...' : 'Poser la question'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {knowledgeAnswer ? (
            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-4 rounded-xl border border-border/70 bg-background/50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={knowledgeStatusVariant(knowledgeAnswer.status)}>
                    {knowledgeAnswer.status}
                  </Badge>
                  <Badge variant={knowledgeConfidenceVariant(knowledgeAnswer.confidenceLabel)}>
                    {Math.round(knowledgeAnswer.confidenceScore * 100)}%
                  </Badge>
                  <Badge variant="outline">{knowledgeAnswer.source}</Badge>
                  <Badge variant="outline">
                    {knowledgeAnswer.retrieval.hitCount} hit
                    {knowledgeAnswer.retrieval.hitCount > 1 ? 's' : ''}
                  </Badge>
                </div>
                {knowledgeAnswer.answer ? (
                  <div className="space-y-4">
                    <div>
                      <p className="text-lg font-semibold">{knowledgeAnswer.answer.headline}</p>
                      <p className="pt-2 text-sm text-muted-foreground">
                        {knowledgeAnswer.answer.summary}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Points clefs
                      </p>
                      {knowledgeAnswer.answer.keyPoints.map(item => (
                        <p
                          key={item}
                          className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm"
                        >
                          {item}
                        </p>
                      ))}
                    </div>
                    <div className="rounded-lg border border-positive/30 bg-positive/10 p-3 text-sm">
                      <p className="font-medium">Etape suivante</p>
                      <p className="pt-1 text-muted-foreground">
                        {knowledgeAnswer.answer.nextStep}
                      </p>
                    </div>
                    <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-muted-foreground">
                      {knowledgeAnswer.answer.guardrail}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-warning/30 bg-warning/10 p-4">
                    <p className="font-medium">Impossible de repondre proprement a cette question</p>
                    <p className="pt-2 text-sm text-muted-foreground">
                      {formatKnowledgeFallback(knowledgeAnswer.fallbackReason)}
                    </p>
                    <p className="pt-2 text-sm text-muted-foreground">
                      Parcourez plutot les sujets ci-dessous ou utilisez une formulation plus
                      generale et pedagogique.
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-border/70 bg-background/50 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Citations
                  </p>
                  <div className="pt-3 space-y-3">
                    {knowledgeAnswer.citations.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Aucune citation exploitable. Basculez sur la navigation par sujets.
                      </p>
                    ) : null}
                    {knowledgeAnswer.citations.map(citation => (
                      <div
                        key={citation.citationId}
                        className="rounded-lg border border-border/70 bg-muted/20 p-3"
                      >
                        <p className="text-sm font-medium">{citation.label}</p>
                        <p className="pt-1 text-xs text-muted-foreground">
                          {citation.excerpt}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-border/70 bg-background/50 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Trace retrieval
                  </p>
                  <div className="pt-3 space-y-2">
                    {knowledgeAnswer.retrieval.stages.map(stage => (
                      <div
                        key={stage.stage}
                        className="flex items-start justify-between gap-3 rounded-lg border border-border/70 bg-muted/20 p-3 text-sm"
                      >
                        <div>
                          <p className="font-medium">{stage.stage}</p>
                          <p className="pt-1 text-xs text-muted-foreground">{stage.detail}</p>
                        </div>
                        <Badge variant={stage.status === 'completed' ? 'secondary' : 'outline'}>
                          {stage.status}
                        </Badge>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground">
                      Total {knowledgeAnswer.retrieval.stageLatenciesMs.total} ms · intent{' '}
                      {knowledgeAnswer.retrieval.intent}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <Separator />

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Browse topics
              </p>
              <p className="text-xs text-muted-foreground">
                {knowledgeTopics?.topics.length ?? 0} sujets disponibles
              </p>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {(knowledgeAnswer?.suggestedTopics ?? knowledgeTopics?.topics ?? []).map(topic => (
                <div
                  key={topic.topicId}
                  className="rounded-xl border border-border/70 bg-background/50 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{topic.title}</p>
                    <Badge variant="outline">{topic.difficulty}</Badge>
                    <Badge variant="secondary">{topic.estimatedReadMinutes} min</Badge>
                  </div>
                  <p className="pt-2 text-sm text-muted-foreground">{topic.summary}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {topic.tags.map(tag => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-4 space-y-2">
                    {topic.relatedQuestions.slice(0, 2).map(relatedQuestion => (
                      <Button
                        key={relatedQuestion}
                        type="button"
                        variant="outline"
                        className="h-auto w-full justify-start whitespace-normal text-left"
                        onClick={() => handleAskKnowledge(relatedQuestion)}
                        disabled={isAskingKnowledge}
                      >
                        {relatedQuestion}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Recommandations prioritaires</CardTitle>
            <CardDescription>
              Deterministic first, challenger ensuite si la base est suffisante.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(recommendations?.items ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune recommandation disponible.</p>
            ) : null}
            {recommendations?.items.map(item => (
              <div key={item.recommendationKey} className="rounded-xl border border-border/70 bg-background/50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-semibold">{item.title}</p>
                  <Badge variant={recommendationRiskVariant(item.riskLevel)}>{item.riskLevel}</Badge>
                  <Badge variant="outline">{item.category}</Badge>
                  <Badge variant="secondary">{formatConfidence(item.confidence)}</Badge>
                </div>
                <p className="pt-2 text-sm text-muted-foreground">{item.description}</p>
                <p className="pt-2 text-sm">{item.whyNow}</p>
                <div className="pt-3 text-xs text-muted-foreground">
                  <p>Impact attendu: {impactSummary(item.expectedImpact)}</p>
                  <p>Effort: {item.effort} · Reversibilite: {item.reversibility}</p>
                </div>
                {item.evidence.length > 0 ? (
                  <div className="pt-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Evidence</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.evidence.map(evidence => (
                        <Badge key={evidence} variant="outline">
                          {evidence}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
                {item.challenge ? (
                  <div className="mt-3 rounded-lg border border-warning/30 bg-warning/10 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">Challenger</p>
                      <Badge variant="outline">{item.challenge.status}</Badge>
                      {item.challenge.model ? (
                        <Badge variant="outline">{item.challenge.model}</Badge>
                      ) : null}
                    </div>
                    <p className="pt-2 text-sm text-muted-foreground">{item.challenge.summary}</p>
                    {item.challenge.contradictions.length > 0 ? (
                      <p className="pt-2 text-xs text-muted-foreground">
                        Contradictions: {item.challenge.contradictions.join(' · ')}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Signaux & hypotheses</CardTitle>
              <CardDescription>
                Faits, hypotheses et implications separent les donnees des interpretations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(signals?.newsSignals ?? []).slice(0, 5).map(signal => (
                <div key={signal.signalKey} className="rounded-lg border border-border/70 bg-background/50 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{signal.title}</p>
                    <Badge variant="outline">{signal.eventType}</Badge>
                    <Badge variant="secondary">{signal.direction}</Badge>
                  </div>
                  <p className="pt-2 text-xs text-muted-foreground">
                    {signal.whyItMatters.join(' · ') || 'Aucune implication explicite'}
                  </p>
                </div>
              ))}
              {(signals?.newsSignals ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun signal persiste pour l instant.</p>
              ) : null}
              <Separator />
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      X / Twitter signals (secondaire)
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Complements non deterministes capes par politique, jamais prioritaires sur les faits financiers.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={includeSocialSignals ? 'secondary' : 'outline'}
                    onClick={() => setIncludeSocialSignals(value => !value)}
                  >
                    {includeSocialSignals ? 'Social ON' : 'Social OFF'}
                  </Button>
                </div>
                {!includeSocialSignals ? (
                  <p className="text-sm text-muted-foreground">
                    Signaux X exclus par preference utilisateur.
                  </p>
                ) : null}
                {includeSocialSignals && (signals?.socialSignals.included ?? []).length > 0 ? (
                  (signals?.socialSignals.included ?? []).map(signal => (
                    <div key={signal.signalKey} className="rounded-lg border border-border/70 bg-background/50 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">@{signal.account.handle}</p>
                        <Badge variant="outline">{signal.account.trustTier}</Badge>
                        <Badge variant="secondary">{signal.direction}</Badge>
                        <Badge variant="outline">{formatConfidence(signal.confidence / 100)}</Badge>
                      </div>
                      <p className="pt-2 text-sm">{signal.thesisSummary}</p>
                      <p className="pt-1 text-xs text-muted-foreground">
                        Freshness {signal.freshnessState} ({signal.recencyHours}h) · why it matters:{' '}
                        {signal.inclusionReason}
                      </p>
                    </div>
                  ))
                ) : null}
                {includeSocialSignals && (signals?.socialSignals.included ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    X signals unavailable / stale / excluded by policy.
                  </p>
                ) : null}
              </div>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Hypotheses clefs</p>
                {(assumptions?.items ?? []).slice(0, 6).map(item => (
                  <div key={item.assumptionKey} className="rounded-lg border border-border/70 bg-muted/20 p-3">
                    <p className="text-sm font-medium">{item.assumptionKey}</p>
                    <p className="pt-1 text-xs text-muted-foreground">{item.justification}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cout IA</CardTitle>
              <CardDescription>Budget, anomalies et principaux moteurs de depense.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border/70 bg-background/50 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Jour</p>
                  <p className="font-financial pt-2 text-xl font-semibold">
                    {formatMoney(spend?.summary.dailyUsdSpent ?? 0, 'USD')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    budget {formatMoney(spend?.summary.dailyBudgetUsd ?? 0, 'USD')}
                  </p>
                </div>
                <div className="rounded-lg border border-border/70 bg-background/50 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Mois</p>
                  <p className="font-financial pt-2 text-xl font-semibold">
                    {formatMoney(spend?.summary.monthlyUsdSpent ?? 0, 'USD')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    budget {formatMoney(spend?.summary.monthlyBudgetUsd ?? 0, 'USD')}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/70 bg-background/50 p-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Tendance recente</p>
                  <p className="text-sm text-muted-foreground">
                    Challenger {spend?.summary.challengerAllowed ? 'autorise' : 'degrade'} · analyse
                    profonde {spend?.summary.deepAnalysisAllowed ? 'autorisee' : 'degradee'}
                  </p>
                </div>
                <MiniSparkline data={spendSeries} width={110} height={30} color="auto" />
              </div>
              {spend?.anomalies.map(item => (
                <div key={`${item.kind}-${item.message}`} className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
                  <span className="font-medium">{item.kind}</span> · {item.message}
                </div>
              ))}
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="pb-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">Par feature</p>
                  {(spend?.byFeature ?? []).slice(0, 4).map(item => (
                    <div key={item.key} className="flex items-center justify-between py-1 text-sm">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-financial">{formatMoney(item.usd, 'USD')}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="pb-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">Par modele</p>
                  {(spend?.byModel ?? []).slice(0, 4).map(item => (
                    <div key={item.key} className="flex items-center justify-between py-1 text-sm">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-financial">{formatMoney(item.usd, 'USD')}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Historique des runs</CardTitle>
            <CardDescription>Run, statut, cout et duree pour audit et replay.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(runs?.items ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun run persiste pour l instant.</p>
            ) : null}
            {runs?.items.map(item => (
              <div key={item.id} className="rounded-lg border border-border/70 bg-background/50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{item.runType}</p>
                    <Badge variant={runStatusVariant(item.status)}>{item.status}</Badge>
                    {item.degraded ? <Badge variant="outline">degraded</Badge> : null}
                  </div>
                  <p className="text-xs text-muted-foreground">{formatDateTime(item.startedAt)}</p>
                </div>
                <div className="pt-2 text-xs text-muted-foreground">
                  <p>
                    Duree {formatDuration(item.startedAt, item.finishedAt) ?? '-'} · cout{' '}
                    {formatMoney(item.usageSummary.totalCostUsd, 'USD')}
                  </p>
                  {item.fallbackReason ? <p>Fallback: {item.fallbackReason}</p> : null}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Chat grounded</CardTitle>
            <CardDescription>
              Reponses ancrees sur snapshots, recommandations, signaux et hypotheses persistants.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="max-h-80 space-y-3 overflow-auto pr-1">
              {(chat?.messages ?? []).map(message => (
                <div
                  key={message.id}
                  className={`rounded-lg border p-3 text-sm ${
                    message.role === 'assistant'
                      ? 'border-border/70 bg-background/50'
                      : 'border-primary/30 bg-primary/10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{message.role === 'assistant' ? 'Assistant' : 'Vous'}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(message.createdAt)}</p>
                  </div>
                  <p className="pt-2 whitespace-pre-wrap text-muted-foreground">{message.content}</p>
                  {message.assumptions.length > 0 ? (
                    <p className="pt-2 text-xs text-muted-foreground">
                      Hypotheses: {message.assumptions.join(' · ')}
                    </p>
                  ) : null}
                </div>
              ))}
              {(chat?.messages ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Posez une question libre. Le chat reste borne aux artefacts persistants.
                </p>
              ) : null}
            </div>
            {overview?.chatEnabled ? (
              <div className="space-y-2">
                <Input
                  value={chatDraft}
                  onChange={event => setChatDraft(event.target.value)}
                  placeholder="Ex: Que se passe-t-il si j investis 500 EUR par mois ?"
                  disabled={isSendingChat}
                />
                <div className="flex justify-end">
                  <Button type="button" size="sm" onClick={handleSendChat} disabled={isSendingChat}>
                    {isSendingChat ? 'Envoi...' : 'Envoyer'}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Le chat est desactive pour cette configuration.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Evals</CardTitle>
          <CardDescription>
            Petit socle d evaluation offline pour la prudence, le cout et la qualite.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-border/70 bg-background/50 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Cas actifs</p>
            <p className="font-financial pt-2 text-xl font-semibold">{evals?.cases.length ?? 0}</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-background/50 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Dernier statut</p>
            <p className="pt-2 text-xl font-semibold">{evals?.latestRun?.status ?? 'not_run'}</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-background/50 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Succes</p>
            <p className="font-financial pt-2 text-xl font-semibold">
              {evals?.latestRun
                ? `${evals.latestRun.passedCases}/${evals.latestRun.totalCases}`
                : '0/0'}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
