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

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge, Button, Input } from '@finance-os/ui/components'
import { Panel } from '@/components/surfaces/panel'
import type { AuthMode } from '@/features/auth-types'
import {
  archiveTradingLabHypothesis,
  postTradingLabHypothesis,
  postTradingLabHypothesisScenario,
} from '@/features/dashboard-api'
import {
  LEARNING_LOOP_INVALIDATION_KEYS,
  dashboardTradingLabHypothesesQueryOptionsWithMode,
} from '@/features/dashboard-query-options'
import type { DashboardTradingLabHypothesis } from '@/features/dashboard-types'
import { getLearningLoopUiFlags } from '@/features/learning-loop-config'
import {
  buildHypothesisCreatePayload,
  readHypothesisExtras,
  type HypothesisFormState,
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
      icon={<span aria-hidden="true">∝</span>}
      tone="plain"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
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
            <span className="text-muted-foreground">Édition réservée au mode admin.</span>
          )}
        </div>

        {creating && isAdmin ? (
          <div className="rounded-xl border border-border/50 bg-surface-1/40 p-3">
            <p className="text-sm font-medium text-foreground">Nouvelle hypothèse</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Décrire une hypothèse falsifiable. Critère(s) d&apos;invalidation requis. Aucune
              instruction d&apos;achat ou de vente.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="hypothesis-form-name"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Nom
                </label>
                <Input
                  id="hypothesis-form-name"
                  className="mt-1"
                  value={formState.name}
                  disabled={createMutation.isPending}
                  onChange={event => {
                    const next = event.target.value
                    setFormState(prev => ({ ...prev, name: next }))
                  }}
                />
              </div>
              <div>
                <label
                  htmlFor="hypothesis-form-slug"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Slug (a-z, 0-9, tirets)
                </label>
                <Input
                  id="hypothesis-form-slug"
                  className="mt-1"
                  value={formState.slug}
                  disabled={createMutation.isPending}
                  onChange={event => {
                    const next = event.target.value
                    setFormState(prev => ({ ...prev, slug: next }))
                  }}
                />
              </div>
            </div>
            <div className="mt-2">
              <label
                htmlFor="hypothesis-form-thesis"
                className="block text-xs font-medium text-muted-foreground"
              >
                Thèse (optionnelle)
              </label>
              <textarea
                id="hypothesis-form-thesis"
                className="mt-1 block w-full rounded-md border border-border/60 bg-background px-2 py-1 text-sm"
                rows={2}
                value={formState.thesis}
                disabled={createMutation.isPending}
                onChange={event => {
                  const next = event.target.value
                  setFormState(prev => ({ ...prev, thesis: next }))
                }}
              />
            </div>
            <div className="mt-2">
              <label
                htmlFor="hypothesis-form-invalidation"
                className="block text-xs font-medium text-muted-foreground"
              >
                Critères d&apos;invalidation (un par ligne) *
              </label>
              <textarea
                id="hypothesis-form-invalidation"
                className="mt-1 block w-full rounded-md border border-border/60 bg-background px-2 py-1 text-sm"
                rows={3}
                value={formState.invalidationCriteriaRaw}
                disabled={createMutation.isPending}
                onChange={event => {
                  const next = event.target.value
                  setFormState(prev => ({ ...prev, invalidationCriteriaRaw: next }))
                }}
              />
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="hypothesis-form-evidence-notes"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Notes / preuves (un par ligne)
                </label>
                <textarea
                  id="hypothesis-form-evidence-notes"
                  className="mt-1 block w-full rounded-md border border-border/60 bg-background px-2 py-1 text-sm"
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
                <label
                  htmlFor="hypothesis-form-horizon"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Horizon (libre, ex. 90d)
                </label>
                <Input
                  id="hypothesis-form-horizon"
                  className="mt-1"
                  value={formState.horizon}
                  disabled={createMutation.isPending}
                  onChange={event => {
                    const next = event.target.value
                    setFormState(prev => ({ ...prev, horizon: next }))
                  }}
                />
              </div>
            </div>
            {validationError ? (
              <p className="mt-2 text-xs text-destructive">{validationError}</p>
            ) : null}
            {createMutation.isError ? (
              <p className="mt-2 text-xs text-destructive">
                Échec de la création: {toErrorMessage(createMutation.error)}
              </p>
            ) : null}
            <div className="mt-3">
              <Button
                type="button"
                size="sm"
                onClick={handleCreate}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? 'Création…' : 'Créer (paper-only)'}
              </Button>
            </div>
          </div>
        ) : null}

        {hypotheses.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border/45 bg-surface-1/35 px-4 py-6 text-center text-sm text-muted-foreground">
            Aucune hypothèse manuelle pour l&apos;instant.
          </p>
        ) : (
          <ul className="space-y-3">
            {hypotheses.map(hypothesis => {
              const extras = readHypothesisExtras(hypothesis.parameters)
              return (
                <li
                  key={hypothesis.id}
                  className="rounded-xl border border-border/50 bg-background/40 p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-foreground">{hypothesis.name}</p>
                    <Badge variant={STATUS_VARIANT[hypothesis.status]}>
                      {STATUS_LABEL[hypothesis.status]}
                    </Badge>
                  </div>
                  {extras.thesis ? (
                    <p className="mt-1 text-xs text-muted-foreground">Thèse : {extras.thesis}</p>
                  ) : null}
                  {extras.horizon ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Horizon : {extras.horizon}
                    </p>
                  ) : null}
                  {extras.invalidationCriteria.length > 0 ? (
                    <div className="mt-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Invalidation
                      </p>
                      <ul className="mt-1 list-inside list-disc text-xs text-foreground/90">
                        {extras.invalidationCriteria.map(item => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {extras.evidenceNotes.length > 0 ? (
                    <div className="mt-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Notes / preuves
                      </p>
                      <ul className="mt-1 list-inside list-disc text-xs text-foreground/90">
                        {extras.evidenceNotes.map(item => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {hypothesis.assumptions.length > 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Hypothèses : {hypothesis.assumptions.join(' · ')}
                    </p>
                  ) : null}
                  {hypothesis.caveats.length > 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Caveats : {hypothesis.caveats.join(' · ')}
                    </p>
                  ) : null}
                  {isAdmin && hypothesis.status !== 'archived' ? (
                    <div className="mt-3 flex flex-wrap gap-2">
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
                    </div>
                  ) : null}

                  {/* PR12 — collapsible evidence-quality scorecard. Read-only. */}
                  <div className="mt-3">
                    <StrategyScorecardCard
                      strategyId={hypothesis.id}
                      mode={mode}
                      learningLoopEnabled={learningLoopEnabled}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        {scenarioMutation.isError ? (
          <p className="text-xs text-destructive">
            Échec création scénario: {toErrorMessage(scenarioMutation.error)}
          </p>
        ) : null}
      </div>
    </Panel>
  )
}
