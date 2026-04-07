import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@finance-os/ui/components'
import type { DashboardAdvisorResponse } from '@/features/dashboard-types'

export const AiAdvisorPanel = ({
  advisor,
  isPending,
  isError,
  errorMessage,
}: {
  advisor: DashboardAdvisorResponse | undefined
  isPending: boolean
  isError: boolean
  errorMessage: string | null
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          AI advisor (read-only)
          <Badge variant="outline">MVP</Badge>
        </CardTitle>
        <CardDescription>
          Commentaire contextuel sans action automatique. Les recommandations restent generiques.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {isPending ? <p className="text-muted-foreground">Chargement des conseils...</p> : null}
        {isError ? <p className="text-muted-foreground">{errorMessage ?? 'Erreur advisor non bloquante.'}</p> : null}
        {!isPending && !isError && advisor && advisor.insights.length === 0 ? (
          <p className="text-muted-foreground">Aucune donnee exploitable</p>
        ) : null}
        {advisor?.degradedMessage ? (
          <p className="text-amber-700 dark:text-amber-300">{advisor.degradedMessage}</p>
        ) : null}
        {advisor?.dataStatus.mode === 'insufficient' ? (
          <p className="text-amber-700 dark:text-amber-300">
            {advisor.dataStatus.message ?? 'Donnees insuffisantes: recommandations non bloquantes.'}
          </p>
        ) : null}
        {advisor?.insights.map(insight => (
          <div key={insight.id} className="rounded-md border border-border/80 bg-muted/20 p-2">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">{insight.title}</p>
              <Badge variant={insight.severity === 'warning' ? 'destructive' : 'secondary'}>
                {insight.severity === 'warning' ? 'alerte' : 'insight'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{insight.detail}</p>
            {insight.citations.length ? (
              <p className="pt-1 text-[11px] text-muted-foreground">
                Sources: {insight.citations.map(citation => `${citation.label}=${citation.value}`).join(' · ')}
              </p>
            ) : null}
          </div>
        ))}
        {advisor?.actions.length ? (
          <div className="space-y-2 pt-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Actions concretes proposees
            </p>
            {advisor.actions.map(action => (
              <div key={action.id} className="rounded-md border border-border/80 bg-background/80 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{action.title}</p>
                  <Badge variant="outline">impact ~{action.estimatedMonthlyImpact}/mois</Badge>
                </div>
                <p className="pt-1 text-xs text-muted-foreground">{action.detail}</p>
                <div className="pt-2 text-xs">
                  <p className="font-medium text-foreground/90">Workflow decisionnel</p>
                  <p className="text-muted-foreground">{action.decisionWorkflow.goal}</p>
                  <ul className="list-disc space-y-1 pl-4 pt-1 text-muted-foreground">
                    {action.decisionWorkflow.checkpoints.map(checkpoint => (
                      <li key={checkpoint.id}>
                        <span className="font-medium text-foreground/90">{checkpoint.label}:</span>{' '}
                        {checkpoint.rationale}
                      </li>
                    ))}
                  </ul>
                  <p className="pt-1 text-muted-foreground">Prochaine revue: {action.decisionWorkflow.nextReviewLabel}</p>
                </div>
                <div className="pt-2 text-xs text-muted-foreground">
                  <p>
                    Suivi: {action.tracking.metricLabel} · cible {action.tracking.targetLabel}
                  </p>
                  <p>Etat: {action.tracking.status} · actuel {action.tracking.currentLabel}</p>
                  {action.citations.length ? (
                    <p>Sources: {action.citations.map(citation => `${citation.label}=${citation.value}`).join(' · ')}</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
