import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@finance-os/ui/components'
import { authMeQueryOptions } from '@/features/auth-query-options'
import { resolveAuthViewState } from '@/features/auth-view-state'
import { opsEnvDiagnosticsQueryOptions } from '@/features/ops-env-diagnostics/query-options'
import type {
  EnvIssue,
  FeatureReport,
  ServiceDiagnosticsReport,
} from '@/features/ops-env-diagnostics/types'
import { PageHeader } from '@/components/surfaces/page-header'

export const Route = createFileRoute('/_app/ops-env-diagnostics')({
  loader: async ({ context }) => {
    const auth = await context.queryClient.fetchQuery(authMeQueryOptions())
    if (auth.mode !== 'admin') return
    await context.queryClient.ensureQueryData(opsEnvDiagnosticsQueryOptions())
  },
  component: OpsEnvDiagnosticsPage,
})

/**
 * Page admin-only — surfaces le rapport `/ops/env/diagnostics` produit par
 * packages/env/src/diagnostics.ts. Aucun secret n'est exposé: seuls les noms
 * de variables, les raisons "blocked", et les statuts feature.
 *
 * Lecture rapide:
 *   - chaque section = un service (api / worker / web / knowledge-service /
 *     quant-service / ops-alerts)
 *   - chaque ligne feature = un drapeau (`*_ENABLED`) avec `enabled` /
 *     `canRun` + raison si bloquée
 *   - issues en bas du service = leaks (`FORBIDDEN_KEY_LEAKED_TO_SERVICE`),
 *     valeurs placeholder, etc.
 */

const SERVICE_LABEL: Record<ServiceDiagnosticsReport['service'], string> = {
  api: 'API',
  worker: 'Worker',
  web: 'Web (client)',
  'knowledge-service': 'Knowledge service',
  'quant-service': 'Quant service',
  'ops-alerts': 'Ops alerts',
}

const featureBadge = (feature: FeatureReport) => {
  if (!feature.enabled) return { label: 'désactivé', variant: 'outline' as const }
  if (feature.canRun) return { label: 'OK', variant: 'positive' as const }
  return { label: 'BLOQUÉ', variant: 'destructive' as const }
}

const issueBadge = (level: EnvIssue['level']) => {
  if (level === 'error') return { label: 'error', variant: 'destructive' as const }
  if (level === 'warning') return { label: 'warning', variant: 'warning' as const }
  return { label: 'info', variant: 'outline' as const }
}

function OpsEnvDiagnosticsPage() {
  const queryClient = useQueryClient()
  const authQuery = useQuery(authMeQueryOptions())
  const authViewState = resolveAuthViewState({
    isPending: authQuery.isPending,
    ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}),
  })
  const isAdmin = authViewState === 'admin'
  const diagnosticsQuery = useQuery(opsEnvDiagnosticsQueryOptions())
  const report = diagnosticsQuery.data

  if (!isAdmin) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Intelligence & Admin"
          icon="⚙"
          title="Env diagnostics"
          description="Lecture admin-only des drapeaux et secrets par service."
        />
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-4 text-sm text-muted-foreground">
            Accès admin requis. Cette page liste les variables d'environnement attendues par chaque
            service sans jamais exposer les secrets.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Intelligence & Admin"
        icon="⚙"
        title="Env diagnostics"
        description="Drapeaux feature, secrets requis et leaks détectés par service. Aucune valeur sensible exposée."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: ['ops', 'env-diagnostics'] })
            }
          >
            Rafraîchir
          </Button>
        }
      />

      {report?.totals && (
        <section className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Erreurs</p>
              <p className="mt-2 font-financial text-lg font-semibold text-negative">
                {report.totals.errorCount}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Warnings</p>
              <p className="mt-2 font-financial text-lg font-semibold">
                {report.totals.warningCount}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Généré</p>
              <p className="mt-2 text-sm">{new Date(report.generatedAt).toLocaleString()}</p>
            </CardContent>
          </Card>
        </section>
      )}

      {report?.services.map(serviceReport => (
        <Card key={serviceReport.service}>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">{SERVICE_LABEL[serviceReport.service]}</CardTitle>
            <div className="flex gap-2">
              {serviceReport.errorCount > 0 && (
                <Badge variant="destructive" className="text-[11px]">
                  {serviceReport.errorCount} erreur(s)
                </Badge>
              )}
              {serviceReport.warningCount > 0 && (
                <Badge variant="warning" className="text-[11px]">
                  {serviceReport.warningCount} warning(s)
                </Badge>
              )}
              {serviceReport.errorCount === 0 && serviceReport.warningCount === 0 && (
                <Badge variant="positive" className="text-[11px]">
                  OK
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {serviceReport.features.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Aucun drapeau feature ne dépend de ce service.
              </p>
            )}
            {serviceReport.features.map(feature => {
              const badge = featureBadge(feature)
              return (
                <div
                  key={feature.flagKey}
                  className="rounded-lg border border-border/50 bg-surface-1 px-4 py-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={badge.variant} className="text-[11px]">
                      {badge.label}
                    </Badge>
                    <p className="font-medium">{feature.feature}</p>
                    <span className="font-mono text-[11px] text-muted-foreground/75">
                      {feature.flagKey}={String(feature.enabled)}
                    </span>
                  </div>
                  {feature.reasonIfBlocked && (
                    <p className="mt-1 text-sm text-warning">{feature.reasonIfBlocked}</p>
                  )}
                  {feature.missingRequiredSecrets.length > 0 && (
                    <p className="mt-1 font-mono text-[11px] text-negative">
                      manquants: {feature.missingRequiredSecrets.join(', ')}
                    </p>
                  )}
                  {feature.missingOptionalSecrets.length > 0 && (
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                      optionnels manquants: {feature.missingOptionalSecrets.join(', ')}
                    </p>
                  )}
                  {feature.placeholderSecrets.length > 0 && (
                    <p className="mt-1 font-mono text-[11px] text-negative">
                      placeholders détectés: {feature.placeholderSecrets.join(', ')}
                    </p>
                  )}
                </div>
              )
            })}
            {serviceReport.issues.length > 0 && (
              <div className="mt-3 space-y-1">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Issues détectées
                </p>
                {serviceReport.issues.map(issue => {
                  const badge = issueBadge(issue.level)
                  return (
                    <div
                      key={`${issue.envName}-${issue.code}`}
                      className="flex flex-col gap-1 rounded-md border border-border/40 bg-surface-1/60 px-3 py-2"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={badge.variant} className="text-[10px]">
                          {badge.label}
                        </Badge>
                        <span className="font-mono text-[12px]">{issue.envName}</span>
                        <span className="font-mono text-[10px] text-muted-foreground/75">
                          {issue.code}
                        </span>
                      </div>
                      <p className="text-sm">{issue.message}</p>
                      {issue.remediation && (
                        <p className="text-xs text-muted-foreground">{issue.remediation}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Source de vérité</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            Les règles affichées ici proviennent de
            <span className="font-mono"> packages/env/src/diagnostics.ts</span> (FEATURE_REQUIREMENTS,
            FORBIDDEN_KEYS_BY_SERVICE). Toute modification d'un service ownership doit y être
            répercutée. Voir
            <span className="font-mono"> docs/ops/env-production.md</span> pour la liste opérateur.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
