import { Badge, Button } from '@finance-os/ui/components'
import type { PushSettingsResponse } from '@/features/notifications/types'

type Props = {
  settings?: PushSettingsResponse
  unavailable: boolean
  readOnly: boolean
  onToggle: () => void
  onRegisterSubscription: () => void
  onSendPreview: () => void
  busy: boolean
}

const permissionLabel: Record<PushSettingsResponse['permission'], string> = {
  unknown: 'Inconnue',
  denied: 'Refusée',
  granted: 'Accordée',
}

export const PushNotificationCard = ({ settings, unavailable, readOnly, onToggle, onRegisterSubscription, onSendPreview, busy }: Props) => {
  if (!settings) return null

  const isHealthy = settings.optIn && settings.permission === 'granted' && !settings.subscriptionStale && settings.providerStatus !== 'unavailable'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground/50">
          <span className="text-base" aria-hidden="true">🔔</span> Notifications push
        </p>
        <Badge variant={isHealthy ? 'positive' : 'warning'} className="text-xs">
          {isHealthy ? '✓ actif' : '⚡ attention'}
        </Badge>
      </div>

      {/* Status grid */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatusPill label="Opt-in" value={settings.optIn ? 'Activé' : 'Désactivé'} active={settings.optIn} />
        <StatusPill label="Permission" value={permissionLabel[settings.permission]} active={settings.permission === 'granted'} />
        <StatusPill label="Provider" value={settings.providerStatus === 'unavailable' ? 'Indisponible' : 'OK'} active={settings.providerStatus !== 'unavailable'} />
      </div>

      {/* Warnings */}
      {settings.subscriptionStale && (
        <p className="rounded-xl bg-negative/5 border border-negative/15 px-4 py-2.5 text-xs text-negative">
          ⚡ Subscription expirée — réactivation nécessaire.
        </p>
      )}
      {unavailable && (
        <p className="rounded-xl bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
          Notifications temporairement indisponibles. Interface en lecture seule.
        </p>
      )}
      {readOnly && !unavailable && (
        <p className="rounded-xl bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
          Modifiable uniquement en session admin.
        </p>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onToggle} disabled={busy || unavailable || readOnly}>
          {settings.optIn ? 'Désactiver' : 'Activer'}
        </Button>
        <Button size="sm" variant="outline" onClick={onRegisterSubscription} disabled={busy || unavailable || readOnly}>
          {settings.subscriptionStale ? 'Réactiver' : 'Enregistrer'}
        </Button>
        <Button size="sm" onClick={onSendPreview} disabled={busy || unavailable || readOnly}>
          Tester l'envoi
        </Button>
      </div>
    </div>
  )
}

function StatusPill({ label, value, active }: { label: string; value: string; active: boolean }) {
  return (
    <div className={`rounded-xl border px-4 py-3 transition-colors duration-150 ${
      active ? 'border-positive/20 bg-positive/5' : 'border-border/30 bg-card/30'
    }`}>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/50">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold ${active ? 'text-positive' : 'text-muted-foreground'}`}>{value}</p>
    </div>
  )
}
