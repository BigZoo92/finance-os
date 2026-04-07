import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@finance-os/ui/components'
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
  unknown: 'Permission inconnue',
  denied: 'Permission refusée',
  granted: 'Permission accordée',
}

export const PushNotificationCard = ({
  settings,
  unavailable,
  readOnly,
  onToggle,
  onRegisterSubscription,
  onSendPreview,
  busy,
}: Props) => {
  if (!settings) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications push</CardTitle>
        <CardDescription>
          Alertes critiques uniquement (phase initiale). Le mode démo reste entièrement mocké.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-3 text-sm'>
        <div className='flex flex-wrap gap-2'>
          <Badge variant={settings.optIn ? 'default' : 'outline'}>
            {settings.optIn ? 'Opt-in activé' : 'Opt-in désactivé'}
          </Badge>
          <Badge variant='outline'>{permissionLabel[settings.permission]}</Badge>
          {settings.subscriptionStale ? (
            <Badge variant='destructive'>Subscription expirée</Badge>
          ) : null}
          {settings.providerStatus === 'unavailable' ? (
            <Badge variant='outline'>Provider indisponible</Badge>
          ) : null}
        </div>

        {unavailable ? (
          <p className='rounded border border-dashed p-2 text-muted-foreground'>
            Notifications temporairement indisponibles. Interface en lecture seule.
          </p>
        ) : null}
        {readOnly ? (
          <p className='rounded border border-dashed p-2 text-muted-foreground'>
            Réglages modifiables uniquement en session admin. En démo: aperçu sobre et non bloquant.
          </p>
        ) : null}

        {settings.providerStatus === 'unavailable' ? (
          <p className='rounded border border-amber-400/50 bg-amber-50 p-2 text-amber-900'>
            Dégradé: le provider push est indisponible. Les flux restent utilisables sans blocage.
          </p>
        ) : null}

        <div className='flex flex-wrap gap-2'>
          <Button size='sm' variant='outline' onClick={onToggle} disabled={busy || unavailable || readOnly}>
            {settings.optIn ? 'Se désinscrire' : "Activer l'opt-in"}
          </Button>
          <Button
            size='sm'
            variant='outline'
            onClick={onRegisterSubscription}
            disabled={busy || unavailable || readOnly}
          >
            {settings.subscriptionStale ? 'Réactiver subscription' : 'Enregistrer subscription'}
          </Button>
          <Button size='sm' onClick={onSendPreview} disabled={busy || unavailable || readOnly}>
            Envoyer un aperçu critique
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
