// PR5 — Advisor Decision Recorder.
//
// Inline form on each recommendation card. Lets the user note what they decided to do with the
// recommendation (suivre / reporter / refuser / ignorer) with a reason code, an optional note,
// and an optional follow-up date. The recorded decision is persisted via PR1's
// /dashboard/advisor/journal POST endpoint and feeds future post-mortems.
//
// HARD COPY RULES (PR5 prompt):
//   • Never use "trade", "buy", "sell", "order", "execution".
//   • Only French copy here, advisory framing.
//   • Demo mode renders a read-only state with explanatory text — no submit.
//   • The whole component is hidden when LEARNING_LOOP_UI_ENABLED is false; the parent decides.

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Badge, Button, Input } from '@finance-os/ui/components'
import { postAdvisorDecisionJournal } from '@/features/dashboard-api'
import type {
  DashboardAdvisorDecisionJournalEntryResponse,
  DashboardAdvisorDecisionKind,
  DashboardAdvisorDecisionReasonCode,
  DashboardAdvisorRecommendationResponse,
} from '@/features/dashboard-types'
import { LEARNING_LOOP_INVALIDATION_KEYS } from '@/features/dashboard-query-options'
import {
  DECISION_FREE_NOTE_MAX_LENGTH,
  DECISION_KIND_OPTIONS,
  buildDecisionPayload,
  defaultReasonCode,
  reasonCodesForDecision,
  type DecisionRecorderFormState,
} from '@/features/learning-loop-view-model'
import { toErrorMessage } from '@/lib/format'

interface DecisionRecorderProps {
  recommendation: DashboardAdvisorRecommendationResponse
  mode: 'admin' | 'demo'
}

const initialFormState = (): DecisionRecorderFormState => ({
  decision: 'accepted',
  reasonCode: defaultReasonCode('accepted'),
  freeNote: '',
  expectedOutcomeAt: '',
})

export function DecisionRecorder({ recommendation, mode }: DecisionRecorderProps) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<DecisionRecorderFormState>(initialFormState)
  const [validationError, setValidationError] = useState<string | null>(null)
  const isDemo = mode === 'demo'

  const mutation = useMutation({
    mutationFn: postAdvisorDecisionJournal,
    onSuccess: async () => {
      setValidationError(null)
      setState(initialFormState())
      setOpen(false)
      await Promise.all(
        LEARNING_LOOP_INVALIDATION_KEYS.afterDecisionJournal().map(queryKey =>
          queryClient.invalidateQueries({ queryKey })
        )
      )
    },
  })

  const reasonOptions = reasonCodesForDecision(state.decision)

  const handleSubmit = () => {
    setValidationError(null)
    const built = buildDecisionPayload({
      recommendationId: recommendation.id,
      recommendationKey: recommendation.recommendationKey,
      runId: recommendation.runId,
      state,
    })
    if (!built.ok || !built.payload) {
      setValidationError(built.error ?? 'Payload invalide')
      return
    }
    mutation.mutate(built.payload)
  }

  if (!open) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={() => setOpen(true)}
          disabled={mutation.isPending}
        >
          Noter ma décision
        </Button>
        <span className="text-xs text-muted-foreground">
          Pour le suivi et les futures rétros — pas un ordre.
        </span>
        {mutation.isSuccess ? (
          <Badge variant="secondary">Décision enregistrée</Badge>
        ) : null}
      </div>
    )
  }

  const successData =
    mutation.data as DashboardAdvisorDecisionJournalEntryResponse | undefined

  return (
    <div className="mt-3 rounded-xl border border-border/50 bg-surface-1/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">Noter ma décision</p>
        {isDemo ? <Badge variant="outline">Démo — lecture seule</Badge> : null}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Décision enregistrée à des fins de suivi et d&apos;apprentissage. Aucun ordre n&apos;est
        passé. Aucune exécution. Aucune transmission à un courtier.
      </p>

      <div className="mt-3 space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs font-medium text-muted-foreground">
            Décision
            <select
              className="mt-1 block w-full rounded-md border border-border/60 bg-background px-2 py-1 text-sm"
              value={state.decision}
              disabled={isDemo || mutation.isPending}
              onChange={event => {
                const next = event.target.value as DashboardAdvisorDecisionKind
                setState(prev => ({
                  ...prev,
                  decision: next,
                  reasonCode: defaultReasonCode(next),
                }))
              }}
            >
              {DECISION_KIND_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            Raison
            <select
              className="mt-1 block w-full rounded-md border border-border/60 bg-background px-2 py-1 text-sm"
              value={state.reasonCode}
              disabled={isDemo || mutation.isPending}
              onChange={event => {
                const next = event.target.value as DashboardAdvisorDecisionReasonCode
                setState(prev => ({ ...prev, reasonCode: next }))
              }}
            >
              {reasonOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <label
            htmlFor={`decision-recorder-note-${recommendation.id}`}
            className="block text-xs font-medium text-muted-foreground"
          >
            Note libre (optionnelle, max {DECISION_FREE_NOTE_MAX_LENGTH} caractères)
          </label>
          <textarea
            id={`decision-recorder-note-${recommendation.id}`}
            className="mt-1 block w-full rounded-md border border-border/60 bg-background px-2 py-1 text-sm"
            rows={3}
            maxLength={DECISION_FREE_NOTE_MAX_LENGTH}
            value={state.freeNote}
            disabled={isDemo || mutation.isPending}
            placeholder="Ce qui motive cette décision (factuel, court)."
            onChange={event => {
              const next = event.target.value
              setState(prev => ({ ...prev, freeNote: next }))
            }}
          />
        </div>

        <div>
          <label
            htmlFor={`decision-recorder-date-${recommendation.id}`}
            className="block text-xs font-medium text-muted-foreground"
          >
            Date de suivi attendue (optionnelle)
          </label>
          <Input
            id={`decision-recorder-date-${recommendation.id}`}
            type="date"
            value={state.expectedOutcomeAt}
            disabled={isDemo || mutation.isPending}
            className="mt-1"
            onChange={event => {
              const next = event.target.value
              setState(prev => ({ ...prev, expectedOutcomeAt: next }))
            }}
          />
        </div>

        {validationError ? (
          <p className="text-xs text-destructive">{validationError}</p>
        ) : null}
        {mutation.isError ? (
          <p className="text-xs text-destructive">
            Échec de l&apos;enregistrement: {toErrorMessage(mutation.error)}
          </p>
        ) : null}
        {successData ? (
          <p className="text-xs text-emerald-500">
            Décision enregistrée à {successData.decidedAt}.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={isDemo || mutation.isPending}
          >
            {mutation.isPending ? 'Enregistrement…' : 'Enregistrer la décision'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setOpen(false)
              setValidationError(null)
              setState(initialFormState())
            }}
            disabled={mutation.isPending}
          >
            Annuler
          </Button>
        </div>
      </div>
    </div>
  )
}
