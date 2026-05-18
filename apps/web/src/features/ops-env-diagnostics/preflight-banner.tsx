import { useQuery } from '@tanstack/react-query'
import { Badge } from '@finance-os/ui/components'
import { opsEnvDiagnosticsQueryOptions } from './query-options'
import type { FeatureReport } from './types'

/**
 * Preflight banner — reads `/ops/env/diagnostics`, looks up a specific
 * `flagKey` (e.g. NEWS_PROVIDER_X_TWITTER_ENABLED) and renders a status
 * pill + remediation if the feature is enabled but cannot run.
 *
 * Renders nothing when the feature is fully OK so it stays out of the way.
 * Designed to live at the top of a feature-specific admin page (X-Twitter,
 * Free Firehose, IBKR backfill…) so the user sees "canRun=false because
 * EODHD_API_KEY missing in api" before they hit the action button.
 *
 * The actual buttons are still gated by their own dry-run / health checks;
 * this banner adds the env-level explanation without duplicating logic.
 */
export function PreflightBanner({ flagKey }: { flagKey: string }) {
  const diagnosticsQuery = useQuery(opsEnvDiagnosticsQueryOptions())
  const report = diagnosticsQuery.data
  if (!report || report.mode !== 'admin') {
    return null
  }

  const feature = report.services.flatMap(s => s.features).find(f => f.flagKey === flagKey) as
    | FeatureReport
    | undefined

  if (!feature) {
    return null
  }

  // Happy path: feature on and configured. No banner.
  if (feature.enabled && feature.canRun) {
    return null
  }

  // Disabled feature is fine — no banner. The page itself can describe it.
  if (!feature.enabled) {
    return (
      <div
        className="rounded border border-slate-700 bg-slate-900/40 p-3 text-sm"
        data-testid={`preflight-${flagKey}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-[11px]">
            désactivé
          </Badge>
          <span className="font-mono text-xs">{flagKey}=false</span>
          <span className="text-slate-400">
            La feature est désactivée par configuration. Activez-la dans Dokploy si nécessaire.
          </span>
        </div>
      </div>
    )
  }

  // Enabled but cannot run — show the reason + missing envs.
  return (
    <div
      className="rounded border border-amber-700/50 bg-amber-900/20 p-3 text-sm"
      data-testid={`preflight-${flagKey}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="destructive" className="text-[11px]">
          BLOQUÉ
        </Badge>
        <span className="font-medium text-amber-200">{feature.feature}</span>
        <span className="font-mono text-xs text-amber-300/75">{flagKey}=true</span>
      </div>
      {feature.reasonIfBlocked && (
        <p className="mt-1 text-amber-100">{feature.reasonIfBlocked}</p>
      )}
      {feature.missingRequiredSecrets.length > 0 && (
        <p className="mt-1 font-mono text-xs text-amber-200/90">
          manquants: {feature.missingRequiredSecrets.join(', ')}
        </p>
      )}
      {feature.placeholderSecrets.length > 0 && (
        <p className="mt-1 font-mono text-xs text-amber-200/90">
          placeholders: {feature.placeholderSecrets.join(', ')}
        </p>
      )}
      <p className="mt-2 text-xs text-slate-400">
        Les actions manuelles ci-dessous resteront accessibles mais échoueront tant que la
        configuration ne sera pas corrigée côté API (voir /ops-env-diagnostics).
      </p>
    </div>
  )
}
