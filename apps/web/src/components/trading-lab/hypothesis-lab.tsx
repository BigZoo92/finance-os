// PR5 — Hypothesis Lab UI surface (paper-only, advisory-only).
//
// Lists manual hypotheses (tradingLabStrategy rows with strategyType='manual-hypothesis'),
// surfaces parameters.hypothesis (thesis, invalidationCriteria, evidenceNotes, horizon), and
// lets admins create / archive hypotheses + create paper scenarios linked to them.
//
// HARD COPY RULES (PR5 prompt):
//   • "Paper only" / "Simulation" badge on every hypothesis.
//   • Never frame anything as a buy/sell instruction.
//   • Demo mode renders a deterministic read-only list — no mutations.

import { css, cva } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
import { Badge, Button, Input } from '@finance-os/ui/components'
import { FlaskIcon } from '@phosphor-icons/react/dist/csr/Flask'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Panel } from '@/components/surfaces/panel'
import type { AuthMode } from '@/features/auth-types'
import {
  archiveTradingLabHypothesis,
  postTradingLabHypothesis,
  postTradingLabHypothesisScenario,
} from '@/features/dashboard-api'
import {
  dashboardTradingLabHypothesesQueryOptionsWithMode,
  LEARNING_LOOP_INVALIDATION_KEYS,
} from '@/features/dashboard-query-options'
import type { DashboardTradingLabHypothesis } from '@/features/dashboard-types'
import { getLearningLoopUiFlags } from '@/features/learning-loop-config'
import {
  buildHypothesisCreatePayload,
  type HypothesisFormState,
  readHypothesisExtras,
} from '@/features/learning-loop-view-model'
import { toErrorMessage } from '@/lib/format'
import { StrategyScorecardCard } from './strategy-scorecard-card'

interface HypothesisLabSectionProps {
  mode: AuthMode
}

const STATUS_VARIANT: Record<
  DashboardTradingLabHypothesis['status'],
  'secondary' | 'outline' | 'destructive'
> = {
  draft: 'outline',
  'active-paper': 'secondary',
  archived: 'destructive',
}

const STATUS_LABEL: Record<DashboardTradingLabHypothesis['status'], string> = {
  draft: 'Brouillon',
  'active-paper': 'Suivi paper',
  archived: 'Archivé',
}

const initialFormState = (): HypothesisFormState => ({
  name: '',
  slug: '',
  description: '',
  thesis: '',
  invalidationCriteriaRaw: '',
  evidenceNotesRaw: '',
  horizon: '',
  status: 'draft',
})

const formCard = css({
  rounded: 'xl',
  borderWidth: '1px',
  borderColor: 'border/50',
  bg: 'surface.1/40',
  p: '3',
})

const FormGrid = styled('div', {
  base: { display: 'grid', gap: '2', sm: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } },
})

// Labels above a full-width textarea are block-level; the ones in the form grid stay inline.
const fieldLabel = cva({
  base: { textStyle: 'xs', fontWeight: 'medium', color: 'muted.foreground' },
  variants: {
    block: { true: { display: 'block' } },
  },
})

const textArea = css({
  mt: '1',
  display: 'block',
  w: 'full',
  rounded: 'md',
  borderWidth: '1px',
  borderColor: 'border/60',
  bg: 'background',
  px: '2',
  py: '1',
  textStyle: 'sm',
})

const emptyState = css({
  rounded: 'xl',
  borderWidth: '1px',
  borderStyle: 'dashed',
  borderColor: 'border/45',
  bg: 'surface.1/35',
  px: '4',
  py: '6',
  textAlign: 'center',
  textStyle: 'sm',
  color: 'muted.foreground',
})

const hypothesisCard = css({
  rounded: 'xl',
  borderWidth: '1px',
  borderColor: 'border/50',
  bg: 'background/40',
  p: '3',
  textStyle: 'sm',
})

const sectionLabel = css({
  textStyle: 'xs',
  fontWeight: 'semibold',
  textTransform: 'uppercase',
  letterSpacing: 'wide',
  color: 'muted.foreground',
})

const bulletList = css({
  mt: '1',
  listStylePosition: 'inside',
  listStyleType: 'disc',
  textStyle: 'xs',
  color: 'foreground/90',
})

export function HypothesisLabSection({ mode }: HypothesisLabSectionProps) {
  const queryClient = useQueryClient()
  const { data } = useQuery(dashboardTradingLabHypothesesQueryOptionsWithMode({ mode }))
  const [creating, setCreating] = useState(false)
  const [formState, setFormState] = useState<HypothesisFormState>(initialFormState)
  const [validationError, setValidationError] = useState<string | null>(null)
  const isAdmin = mode === 'admin'

  const createMutation = useMutation({
    mutationFn: postTradingLabHypothesis,
    onSuccess: async () => {
      setCreating(false)
      setFormState(initialFormState())
      setValidationError(null)
      await Promise.all(
        LEARNING_LOOP_INVALIDATION_KEYS.afterHypothesisChange().map(queryKey =>
          queryClient.invalidateQueries({ queryKey })
        )
      )
    },
  })

  const archiveMutation = useMutation({
    mutationFn: archiveTradingLabHypothesis,
    onSuccess: async () => {
      await Promise.all(
        LEARNING_LOOP_INVALIDATION_KEYS.afterHypothesisChange().map(queryKey =>
          queryClient.invalidateQueries({ queryKey })
        )
      )
    },
  })

  const scenarioMutation = useMutation({
    mutationFn: postTradingLabHypothesisScenario,
    onSuccess: async () => {
      await Promise.all(
        LEARNING_LOOP_INVALIDATION_KEYS.afterHypothesisChange().map(queryKey =>
          queryClient.invalidateQueries({ queryKey })
        )
      )
    },
  })

  const handleCreate = () => {
    setValidationError(null)
    const built = buildHypothesisCreatePayload(formState)
    if (!built.ok || !built.payload) {
      setValidationError(built.error ?? 'Payload invalide')
      return
    }
    const { evidenceNotes, ...rest } = built.payload
    createMutation.mutate({
      ...rest,
      ...(evidenceNotes !== undefined ? { evidenceNotes } : {}),
    })
  }

  const hypotheses = data?.hypotheses ?? []
  const learningLoopEnabled = getLearningLoopUiFlags().enabled

  return (
    <Panel
      title="Hypothèses (Paper only)"
      description="Hypothèses manuelles tenues en paper trading. Pas d'exécution. Pas d'ordre."
      icon={<FlaskIcon size={16} />}
      tone="plain"
    >
      <styled.div spaceY="4">
        <styled.div display="flex" flexWrap="wrap" alignItems="center" gap="2" textStyle="xs">
          <Badge variant="outline">Paper only</Badge>
          <Badge variant="outline">Simulation</Badge>
          {isAdmin ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setCreating(prev => !prev)}
              disabled={createMutation.isPending}
            >
              {creating ? 'Annuler' : 'Nouvelle hypothèse'}
            </Button>
          ) : (
            <styled.span color="muted.foreground">Édition réservée au mode admin.</styled.span>
          )}
        </styled.div>

        {creating && isAdmin ? (
          <div className={formCard}>
            <styled.p textStyle="sm" fontWeight="medium" color="foreground">
              Nouvelle hypothèse
            </styled.p>
            <styled.p mt="1" textStyle="xs" color="muted.foreground">
              Décrire une hypothèse falsifiable. Critère(s) d&apos;invalidation requis. Aucune
              instruction d&apos;achat ou de vente.
            </styled.p>
            <FormGrid mt="3">
              <div>
                <label htmlFor="hypothesis-form-name" className={fieldLabel()}>
                  Nom
                </label>
                <Input
                  id="hypothesis-form-name"
                  mt="1"
                  value={formState.name}
                  disabled={createMutation.isPending}
                  onChange={event => {
                    const next = event.target.value
                    setFormState(prev => ({ ...prev, name: next }))
                  }}
                />
              </div>
              <div>
                <label htmlFor="hypothesis-form-slug" className={fieldLabel()}>
                  Slug (a-z, 0-9, tirets)
                </label>
                <Input
                  id="hypothesis-form-slug"
                  mt="1"
                  value={formState.slug}
                  disabled={createMutation.isPending}
                  onChange={event => {
                    const next = event.target.value
                    setFormState(prev => ({ ...prev, slug: next }))
                  }}
                />
              </div>
            </FormGrid>
            <styled.div mt="2">
              <label htmlFor="hypothesis-form-thesis" className={fieldLabel({ block: true })}>
                Thèse (optionnelle)
              </label>
              <textarea
                id="hypothesis-form-thesis"
                className={textArea}
                rows={2}
                value={formState.thesis}
                disabled={createMutation.isPending}
                onChange={event => {
                  const next = event.target.value
                  setFormState(prev => ({ ...prev, thesis: next }))
                }}
              />
            </styled.div>
            <styled.div mt="2">
              <label htmlFor="hypothesis-form-invalidation" className={fieldLabel({ block: true })}>
                Critères d&apos;invalidation (un par ligne) *
              </label>
              <textarea
                id="hypothesis-form-invalidation"
                className={textArea}
                rows={3}
                value={formState.invalidationCriteriaRaw}
                disabled={createMutation.isPending}
                onChange={event => {
                  const next = event.target.value
                  setFormState(prev => ({ ...prev, invalidationCriteriaRaw: next }))
                }}
              />
            </styled.div>
            <FormGrid mt="2">
              <div>
                <label htmlFor="hypothesis-form-evidence-notes" className={fieldLabel()}>
                  Notes / preuves (un par ligne)
                </label>
                <textarea
                  id="hypothesis-form-evidence-notes"
                  className={textArea}
                  rows={2}
                  value={formState.evidenceNotesRaw}
                  disabled={createMutation.isPending}
                  onChange={event => {
                    const next = event.target.value
                    setFormState(prev => ({ ...prev, evidenceNotesRaw: next }))
                  }}
                />
              </div>
              <div>
                <label htmlFor="hypothesis-form-horizon" className={fieldLabel()}>
                  Horizon (libre, ex. 90d)
                </label>
                <Input
                  id="hypothesis-form-horizon"
                  mt="1"
                  value={formState.horizon}
                  disabled={createMutation.isPending}
                  onChange={event => {
                    const next = event.target.value
                    setFormState(prev => ({ ...prev, horizon: next }))
                  }}
                />
              </div>
            </FormGrid>
            {validationError ? (
              <styled.p mt="2" textStyle="xs" color="destructive">
                {validationError}
              </styled.p>
            ) : null}
            {createMutation.isError ? (
              <styled.p mt="2" textStyle="xs" color="destructive">
                Échec de la création: {toErrorMessage(createMutation.error)}
              </styled.p>
            ) : null}
            <styled.div mt="3">
              <Button
                type="button"
                size="sm"
                onClick={handleCreate}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? 'Création…' : 'Créer (paper-only)'}
              </Button>
            </styled.div>
          </div>
        ) : null}

        {hypotheses.length === 0 ? (
          <p className={emptyState}>Aucune hypothèse manuelle pour l&apos;instant.</p>
        ) : (
          <styled.ul spaceY="3">
            {hypotheses.map(hypothesis => {
              const extras = readHypothesisExtras(hypothesis.parameters)
              return (
                <li key={hypothesis.id} className={hypothesisCard}>
                  <styled.div
                    display="flex"
                    flexWrap="wrap"
                    alignItems="center"
                    justifyContent="space-between"
                    gap="2"
                  >
                    <styled.p fontWeight="medium" color="foreground">
                      {hypothesis.name}
                    </styled.p>
                    <Badge variant={STATUS_VARIANT[hypothesis.status]}>
                      {STATUS_LABEL[hypothesis.status]}
                    </Badge>
                  </styled.div>
                  {extras.thesis ? (
                    <styled.p mt="1" textStyle="xs" color="muted.foreground">
                      Thèse : {extras.thesis}
                    </styled.p>
                  ) : null}
                  {extras.horizon ? (
                    <styled.p mt="1" textStyle="xs" color="muted.foreground">
                      Horizon : {extras.horizon}
                    </styled.p>
                  ) : null}
                  {extras.invalidationCriteria.length > 0 ? (
                    <styled.div mt="2">
                      <p className={sectionLabel}>Invalidation</p>
                      <ul className={bulletList}>
                        {extras.invalidationCriteria.map(item => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </styled.div>
                  ) : null}
                  {extras.evidenceNotes.length > 0 ? (
                    <styled.div mt="2">
                      <p className={sectionLabel}>Notes / preuves</p>
                      <ul className={bulletList}>
                        {extras.evidenceNotes.map(item => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </styled.div>
                  ) : null}
                  {hypothesis.assumptions.length > 0 ? (
                    <styled.p mt="2" textStyle="xs" color="muted.foreground">
                      Hypothèses : {hypothesis.assumptions.join(', ')}
                    </styled.p>
                  ) : null}
                  {hypothesis.caveats.length > 0 ? (
                    <styled.p mt="1" textStyle="xs" color="muted.foreground">
                      Caveats : {hypothesis.caveats.join(', ')}
                    </styled.p>
                  ) : null}
                  {isAdmin && hypothesis.status !== 'archived' ? (
                    <styled.div mt="3" display="flex" flexWrap="wrap" gap="2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={archiveMutation.isPending}
                        onClick={() => archiveMutation.mutate(hypothesis.id)}
                      >
                        {archiveMutation.isPending ? 'Archivage…' : 'Archiver'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={scenarioMutation.isPending}
                        onClick={() =>
                          scenarioMutation.mutate({
                            hypothesisId: hypothesis.id,
                            input: {
                              name: `Scénario manuel ${hypothesis.slug} ${new Date().toISOString().slice(0, 10)}`,
                              // Backend falls back to hypothesis.invalidationCriteria.join('; ')
                              // when the input field is omitted.
                            },
                          })
                        }
                      >
                        {scenarioMutation.isPending ? 'Création…' : 'Créer un scénario paper'}
                      </Button>
                    </styled.div>
                  ) : null}

                  {/* PR12 — collapsible evidence-quality scorecard. Read-only. */}
                  <styled.div mt="3">
                    <StrategyScorecardCard
                      strategyId={hypothesis.id}
                      mode={mode}
                      learningLoopEnabled={learningLoopEnabled}
                    />
                  </styled.div>
                </li>
              )
            })}
          </styled.ul>
        )}
        {scenarioMutation.isError ? (
          <styled.p textStyle="xs" color="destructive">
            Échec création scénario: {toErrorMessage(scenarioMutation.error)}
          </styled.p>
        ) : null}
      </styled.div>
    </Panel>
  )
}
