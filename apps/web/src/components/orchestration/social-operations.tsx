import { css } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
import { Button, Status } from '@finance-os/ui/components'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { estimateFreeFirehose, runFreeFirehose } from '@/features/ops-refresh/free-firehose-api'
import { opsRefreshQueryKeys } from '@/features/ops-refresh/query-options'
import { xHealthQueryKeys } from '@/features/x-health-query-options'
import { resolveAllXSources, runXDailyPreviousDaySync } from '@/features/x-twitter-api'
import { pushToast } from '@/lib/toast-store'
import { ManualSocialImportDialog } from './manual-social-import-dialog'

type Confirmation = 'firehose' | 'x-sync' | 'x-resolve' | null

const operationSection = css({ borderTopWidth: '1px', borderColor: 'border/60', pt: '4' })

const sectionTitle = css({ textStyle: 'sm', fontWeight: 'semibold' })

const sectionLead = css({ mt: '1', textStyle: 'xs', color: 'muted.foreground' })

const confirmationBox = css({
  mt: '3',
  rounded: 'control',
  borderWidth: '1px',
  borderColor: 'warning/35',
  p: '3',
})

export function SocialOperations() {
  const queryClient = useQueryClient()
  const [importOpen, setImportOpen] = useState(false)
  const [confirmation, setConfirmation] = useState<Confirmation>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const invalidateSocial = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['signal-items'] }),
      queryClient.invalidateQueries({ queryKey: ['signal-runs'] }),
      queryClient.invalidateQueries({ queryKey: ['signal-sources'] }),
      queryClient.invalidateQueries({ queryKey: xHealthQueryKeys.all }),
      queryClient.invalidateQueries({ queryKey: opsRefreshQueryKeys.all }),
    ])
  }

  const estimateMutation = useMutation({
    mutationFn: estimateFreeFirehose,
    onError: () => setFeedback('L’estimation Free Firehose est indisponible.'),
  })
  const firehoseMutation = useMutation({
    mutationFn: (dryRun: boolean) => runFreeFirehose({ dryRun, confirmation: !dryRun }),
    onSuccess: async (result, dryRun) => {
      setConfirmation(null)
      setFeedback(
        dryRun
          ? `Test terminé avec ${result.estimatedMaxRecords ?? 0} enregistrements au maximum.`
          : 'Free Firehose a terminé son exécution.'
      )
      await invalidateSocial()
    },
    onError: () => {
      setConfirmation(null)
      setFeedback('Free Firehose n’a pas pu démarrer.')
    },
  })
  const xSyncMutation = useMutation({
    mutationFn: (dryRun: boolean) =>
      runXDailyPreviousDaySync(
        dryRun
          ? { runMode: 'dry_run', dryRun: true, allowBudgetOverride: false }
          : {
              runMode: 'manual_full_previous_day',
              dryRun: false,
              manualConfirm: true,
              allowBudgetOverride: false,
            }
      ),
    onSuccess: async (result, dryRun) => {
      setConfirmation(null)
      setFeedback(
        dryRun
          ? `Test X terminé. Jusqu’à ${result.estimatedPostReads ?? 0} lectures prévues.`
          : `${result.fetchedTweetCount ?? 0} publications traitées.`
      )
      await invalidateSocial()
    },
    onError: () => {
      setConfirmation(null)
      setFeedback('La synchronisation X n’a pas pu démarrer.')
    },
  })
  const resolveMutation = useMutation({
    mutationFn: () => resolveAllXSources({ force: false }),
    onSuccess: async result => {
      setConfirmation(null)
      setFeedback(
        `${result.summary?.resolved ?? 0} source${result.summary?.resolved === 1 ? '' : 's'} résolue${result.summary?.resolved === 1 ? '' : 's'}.`
      )
      await invalidateSocial()
    },
    onError: () => {
      setConfirmation(null)
      setFeedback('Les sources X n’ont pas pu être résolues.')
    },
  })
  const pending =
    estimateMutation.isPending ||
    firehoseMutation.isPending ||
    xSyncMutation.isPending ||
    resolveMutation.isPending
  const estimate = estimateMutation.data

  return (
    <styled.div spaceY="6">
      {feedback ? (
        <div aria-live="polite">
          <Status tone="neutral" label={feedback} />
        </div>
      ) : null}

      <section aria-labelledby="manual-social-title" className={operationSection}>
        <h3 id="manual-social-title" className={sectionTitle}>
          Import manuel
        </h3>
        <p className={sectionLead}>Ajoute des signaux fournis manuellement.</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          mt="3"
          disabled={pending}
          onClick={() => setImportOpen(true)}
        >
          Ouvrir l’import
        </Button>
      </section>

      <section aria-labelledby="x-sync-title" className={operationSection}>
        <h3 id="x-sync-title" className={sectionTitle}>
          Synchronisation X
        </h3>
        <p className={sectionLead}>
          Teste le volume avant de charger les publications de la veille.
        </p>
        <styled.div mt="3" display="flex" flexWrap="wrap" gap="2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => xSyncMutation.mutate(true)}
          >
            Tester sans dépense
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => setConfirmation('x-sync')}
          >
            Synchroniser la veille
          </Button>
        </styled.div>
        {confirmation === 'x-sync' ? (
          <ConfirmationPanel
            text="Cette action peut consommer le budget X disponible. Continuer ?"
            pending={xSyncMutation.isPending}
            onCancel={() => setConfirmation(null)}
            onConfirm={() => xSyncMutation.mutate(false)}
          />
        ) : null}
      </section>

      <section aria-labelledby="x-resolve-title" className={operationSection}>
        <h3 id="x-resolve-title" className={sectionTitle}>
          Sources X
        </h3>
        <p className={sectionLead}>Vérifie les comptes qui ne sont pas encore reconnus.</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          mt="3"
          disabled={pending}
          onClick={() => setConfirmation('x-resolve')}
        >
          Résoudre les sources
        </Button>
        {confirmation === 'x-resolve' ? (
          <ConfirmationPanel
            text="Cette vérification peut consommer le budget X disponible. Continuer ?"
            pending={resolveMutation.isPending}
            onCancel={() => setConfirmation(null)}
            onConfirm={() => resolveMutation.mutate()}
          />
        ) : null}
      </section>

      <section aria-labelledby="firehose-title" className={operationSection}>
        <h3 id="firehose-title" className={sectionTitle}>
          Free Firehose
        </h3>
        <p className={sectionLead}>
          Collecte les sources gratuites disponibles avec une limite hebdomadaire.
        </p>
        {!estimate ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            mt="3"
            disabled={pending}
            onClick={() => estimateMutation.mutate()}
          >
            Préparer
          </Button>
        ) : (
          <styled.div mt="3" spaceY="3">
            <styled.p fontFamily="mono" fontSize="11px" color="muted.foreground">
              Jusqu’à {estimate.maxRecords ?? 0} enregistrements. {estimate.runsLastWeek ?? 0}{' '}
              exécution cette semaine sur {estimate.weeklyCap ?? 0}.
            </styled.p>
            {estimate.wouldBeBlockedByCap ? (
              <Status tone="attention" label="Limite hebdomadaire atteinte" />
            ) : (
              <styled.div display="flex" flexWrap="wrap" gap="2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => firehoseMutation.mutate(true)}
                >
                  Tester sans enregistrer
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => setConfirmation('firehose')}
                >
                  Lancer
                </Button>
              </styled.div>
            )}
          </styled.div>
        )}
        {confirmation === 'firehose' ? (
          <ConfirmationPanel
            text="Lancer la collecte Free Firehose maintenant ?"
            pending={firehoseMutation.isPending}
            onCancel={() => setConfirmation(null)}
            onConfirm={() => firehoseMutation.mutate(false)}
          />
        ) : null}
      </section>

      <ManualSocialImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => {
          void invalidateSocial()
          pushToast({ title: 'Signaux actualisés', tone: 'success' })
        }}
      />
    </styled.div>
  )
}

function ConfirmationPanel({
  text,
  pending,
  onCancel,
  onConfirm,
}: {
  text: string
  pending: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className={confirmationBox} role="alertdialog" aria-label="Confirmer l’opération">
      <styled.p textStyle="sm">{text}</styled.p>
      <styled.div mt="3" display="flex" justifyContent="flex-end" gap="2">
        <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={onCancel}>
          Annuler
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={onConfirm}>
          {pending ? 'En cours' : 'Confirmer'}
        </Button>
      </styled.div>
    </div>
  )
}
