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
        {advisor?.insights.map(insight => (
          <div key={insight.id} className="rounded-md border border-border/80 bg-muted/20 p-2">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">{insight.title}</p>
              <Badge variant={insight.severity === 'warning' ? 'destructive' : 'secondary'}>
                {insight.severity === 'warning' ? 'alerte' : 'insight'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{insight.detail}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
