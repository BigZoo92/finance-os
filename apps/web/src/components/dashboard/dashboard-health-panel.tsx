import { Badge, Card, CardContent } from '@finance-os/ui/components'
import type {
  DashboardHealthModel,
  DashboardHealthReasonCode,
  DashboardHealthWidgetSignal,
} from './dashboard-health'

const REASON_LABEL: Record<DashboardHealthReasonCode, string> = {
  STALE_SYNC: 'STALE_SYNC',
  MISSING_SOURCE: 'MISSING_SOURCE',
  PARTIAL_IMPORT: 'PARTIAL_IMPORT',
  SAFE_MODE_ACTIVE: 'SAFE_MODE_ACTIVE',
  DERIVED_FAILURE: 'DERIVED_FAILURE',
}

const REASON_TITLE: Record<DashboardHealthReasonCode, string> = {
  STALE_SYNC: 'Freshness is older than the dashboard sync threshold.',
  MISSING_SOURCE: 'A required source is missing from the current dashboard view.',
  PARTIAL_IMPORT: 'Some sources are still syncing or only partially reflected.',
  SAFE_MODE_ACTIVE: 'External integrations are temporarily disabled by safe mode.',
  DERIVED_FAILURE: 'The latest derived snapshot refresh failed.',
}

const ATTENTION_CARD_CLASS =
  'border-amber-500/40 bg-[linear-gradient(120deg,rgba(245,158,11,0.16),rgba(251,191,36,0.1),rgba(245,158,11,0.08))]'
const HEALTHY_CARD_CLASS =
  'border-emerald-500/35 bg-[linear-gradient(120deg,rgba(16,185,129,0.16),rgba(16,185,129,0.08),rgba(52,211,153,0.08))]'

const STATUS_BADGE_CLASS = {
  healthy: 'border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  attention_required: 'border-amber-500/60 bg-amber-400/15 text-amber-700 dark:text-amber-300',
} as const

const formatStatusLabel = (status: 'healthy' | 'attention_required') => {
  return status === 'healthy' ? 'Healthy' : 'Attention required'
}

export const DashboardWidgetHealthBadge = ({
  enabled,
  widget,
}: {
  enabled: boolean
  widget: DashboardHealthWidgetSignal
}) => {
  if (!enabled || widget.status !== 'attention_required' || !widget.badgeLabel) {
    return null
  }

  return (
    <Badge
      variant="outline"
      className={STATUS_BADGE_CLASS.attention_required}
      title={widget.reasons.map(reason => REASON_TITLE[reason]).join(' ')}
    >
      {widget.badgeLabel}
    </Badge>
  )
}

export const DashboardHealthPanel = ({
  demo,
  health,
}: {
  demo: boolean
  health: DashboardHealthModel
}) => {
  return (
    <Card
      className={
        health.global.status === 'attention_required' ? ATTENTION_CARD_CLASS : HEALTHY_CARD_CLASS
      }
    >
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={health.global.status === 'healthy' ? 'secondary' : 'outline'}
                className={STATUS_BADGE_CLASS[health.global.status]}
              >
                {formatStatusLabel(health.global.status)}
              </Badge>
              {demo ? (
                <Badge
                  variant="outline"
                  className="border-amber-500/60 bg-amber-500 text-black hover:bg-amber-500"
                >
                  DEMO matrix
                </Badge>
              ) : null}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold">{health.global.headline}</p>
              <p className="text-sm text-muted-foreground">{health.global.detail}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {Object.values(health.domains).map(domain => (
              <Badge
                key={domain.key}
                variant="outline"
                className={STATUS_BADGE_CLASS[domain.status]}
              >
                {domain.label}: {formatStatusLabel(domain.status)}
              </Badge>
            ))}
          </div>
        </div>

        {health.global.reasons.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {health.global.reasons.map(reason => (
              <Badge key={reason} variant="outline" title={REASON_TITLE[reason]}>
                {REASON_LABEL[reason]}
              </Badge>
            ))}
          </div>
        ) : null}

        <details className="rounded-lg border border-border/70 bg-background/70 p-3">
          <summary className="cursor-pointer text-sm font-medium text-foreground">
            Open diagnosis drawer
          </summary>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            {Object.values(health.domains).map(domain => (
              <div key={domain.key} className="rounded-md border border-border/70 bg-muted/20 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{domain.label}</p>
                    <p className="text-xs text-muted-foreground">{domain.headline}</p>
                  </div>
                  <Badge
                    variant={domain.status === 'healthy' ? 'secondary' : 'outline'}
                    className={STATUS_BADGE_CLASS[domain.status]}
                  >
                    {formatStatusLabel(domain.status)}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{domain.detail}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {domain.reasons.length > 0 ? (
                    domain.reasons.map(reason => (
                      <Badge key={reason} variant="outline" title={REASON_TITLE[reason]}>
                        {REASON_LABEL[reason]}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="secondary">Healthy</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </details>
      </CardContent>
    </Card>
  )
}
