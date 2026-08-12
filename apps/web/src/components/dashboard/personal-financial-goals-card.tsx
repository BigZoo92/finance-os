import {
  Button,
  CurrencyAmount,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Progress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Status,
} from '@finance-os/ui/components'
import { FlagPixelIcon } from '@finance-os/ui/icons/pixel'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { AuthMode } from '@/features/auth-types'
import {
  archiveFinancialGoal,
  createFinancialGoal,
  normalizeFinancialGoalActionError,
  updateFinancialGoal,
} from '@/features/goals/api'
import {
  financialGoalsQueryKeys,
  financialGoalsQueryOptionsWithMode,
} from '@/features/goals/query-options'
import type {
  FinancialGoal,
  FinancialGoalType,
  FinancialGoalWriteInput,
} from '@/features/goals/types'
import { calculateGoalProgress } from '@/features/goals/view-model'
import { pushToast } from '@/lib/toast-store'

const GOAL_TYPE_LABEL: Record<FinancialGoalType, string> = {
  emergency_fund: 'Épargne de précaution',
  travel: 'Voyage',
  home: 'Immobilier',
  education: 'Éducation',
  retirement: 'Retraite',
  custom: 'Personnalisé',
}

type GoalEditorState = { mode: 'create' } | { mode: 'edit'; goal: FinancialGoal }

type GoalDraft = Omit<FinancialGoalWriteInput, 'targetAmount' | 'currentAmount'> & {
  targetAmount: string
  currentAmount: string
}

const EMPTY_GOAL_DRAFT: GoalDraft = {
  name: '',
  goalType: 'custom',
  currency: 'EUR',
  targetAmount: '',
  currentAmount: '',
  targetDate: null,
  note: null,
}

type RecoverableErrorState = {
  source: 'query' | 'save' | 'archive'
  title: string
  message: string
  requestId?: string
  retryable: boolean
  offline: boolean
}

const formatDate = (value: string | null) => {
  if (!value) return 'Sans échéance'
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

const toGoalDraft = (goal: FinancialGoal): GoalDraft => ({
  name: goal.name,
  goalType: goal.goalType,
  currency: goal.currency,
  targetAmount: String(goal.targetAmount),
  currentAmount: String(goal.currentAmount),
  targetDate: goal.targetDate,
  note: goal.note,
})

const toGoalInput = (draft: GoalDraft): FinancialGoalWriteInput | null => {
  const targetAmount = Number(draft.targetAmount)
  const currentAmount = Number(draft.currentAmount)
  if (
    draft.name.trim().length === 0 ||
    draft.currency.trim().length === 0 ||
    !Number.isFinite(targetAmount) ||
    targetAmount <= 0 ||
    !Number.isFinite(currentAmount) ||
    currentAmount < 0
  ) {
    return null
  }
  return {
    name: draft.name.trim(),
    goalType: draft.goalType,
    currency: draft.currency.trim().toUpperCase(),
    targetAmount,
    currentAmount,
    targetDate: draft.targetDate,
    note: draft.note,
  }
}

const createRecoverableError = ({
  source,
  title,
  error,
}: {
  source: RecoverableErrorState['source']
  title: string
  error: unknown
}): RecoverableErrorState => {
  const normalized = normalizeFinancialGoalActionError(error)
  return {
    source,
    title,
    message: normalized.message,
    ...(normalized.requestId ? { requestId: normalized.requestId } : {}),
    retryable: normalized.retryable,
    offline: normalized.offline,
  }
}

const getGoalStatus = (goal: FinancialGoal) => {
  const progress = calculateGoalProgress(goal.currentAmount, goal.targetAmount)
  if (progress === null) return { tone: 'neutral' as const, label: 'Indisponible' }
  if (progress >= 100) return { tone: 'positive' as const, label: 'Atteint' }
  if (!goal.targetDate) return { tone: 'neutral' as const, label: 'En cours' }

  const targetDate = new Date(`${goal.targetDate}T00:00:00.000Z`)
  const daysUntilTarget = Math.ceil((targetDate.getTime() - Date.now()) / 86_400_000)
  if (daysUntilTarget < 0) return { tone: 'negative' as const, label: 'En retard' }
  if (daysUntilTarget <= 90 && progress < 60) {
    return { tone: 'attention' as const, label: 'À surveiller' }
  }
  return { tone: 'positive' as const, label: 'Sur la bonne voie' }
}

function ErrorBanner({
  error,
  onRetry,
  onDismiss,
}: {
  error: RecoverableErrorState
  onRetry: () => void
  onDismiss?: () => void
}) {
  return (
    <div role="alert" className="border border-negative/35 bg-negative/8 p-4 text-sm">
      <p className="font-semibold text-negative">{error.title}</p>
      <p className="mt-1 text-foreground">{error.message}</p>
      {error.offline ? (
        <p className="mt-2 text-xs text-muted-foreground">Connexion indisponible</p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRetry}
          disabled={!error.retryable}
        >
          Réessayer
        </Button>
        {onDismiss ? (
          <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
            Fermer
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function GoalSurface({
  goal,
  canEdit,
  onEdit,
}: {
  goal: FinancialGoal
  canEdit: boolean
  onEdit: () => void
}) {
  const progress = calculateGoalProgress(goal.currentAmount, goal.targetAmount)
  const status = getGoalStatus(goal)
  const remaining = Math.max(goal.targetAmount - goal.currentAmount, 0)

  return (
    <article className="grid gap-5 border-b border-border py-6 md:grid-cols-[minmax(180px,0.8fr)_minmax(240px,1.25fr)_minmax(150px,0.65fr)_auto] md:items-center md:gap-8">
      <div className="min-w-0">
        <h3 className="truncate text-base font-medium text-foreground">{goal.name}</h3>
        <p className="mt-1 font-mono text-[11px] text-muted-foreground">
          Échéance {formatDate(goal.targetDate)}
        </p>
        <Status tone={status.tone} label={status.label} className="mt-2" />
      </div>
      <div>
        <Progress value={progress} label={goal.name} showValue />
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">
          Reste <CurrencyAmount value={remaining} currency={goal.currency} decimals={0} />
        </p>
      </div>
      <div className="md:text-right">
        <CurrencyAmount
          value={goal.currentAmount}
          currency={goal.currency}
          decimals={0}
          className="text-lg font-medium text-foreground"
        />
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          sur <CurrencyAmount value={goal.targetAmount} currency={goal.currency} decimals={0} />
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onEdit}
        disabled={!canEdit}
        className="min-h-11 w-full md:min-h-0 md:w-auto"
      >
        Modifier
      </Button>
    </article>
  )
}

function GoalEditor({
  state,
  draft,
  setDraft,
  validationError,
  savePending,
  archivePending,
  archiveArmed,
  onArchiveArmed,
  onClose,
  onSave,
  onArchive,
}: {
  state: GoalEditorState
  draft: GoalDraft
  setDraft: React.Dispatch<React.SetStateAction<GoalDraft>>
  validationError: string | null
  savePending: boolean
  archivePending: boolean
  archiveArmed: boolean
  onArchiveArmed: () => void
  onClose: () => void
  onSave: () => void
  onArchive: () => void
}) {
  const previewCurrent = draft.currentAmount === '' ? null : Number(draft.currentAmount)
  const previewTarget = draft.targetAmount === '' ? null : Number(draft.targetAmount)
  const previewProgress =
    previewCurrent === null || previewTarget === null
      ? null
      : calculateGoalProgress(previewCurrent, previewTarget)

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-[440px] max-sm:bottom-0 max-sm:left-0 max-sm:top-auto max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-frame">
        <DialogHeader>
          <DialogTitle>
            {state.mode === 'create' ? 'Ajouter un objectif' : "Modifier l'objectif"}
          </DialogTitle>
          <DialogDescription>Montant, progression et échéance</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={event => {
            event.preventDefault()
            onSave()
          }}
        >
          {validationError ? (
            <p role="alert" className="text-sm text-negative">
              {validationError}
            </p>
          ) : null}
          <div className="space-y-2">
            <label htmlFor="goal-name" className="text-sm font-medium">
              Nom
            </label>
            <Input
              id="goal-name"
              value={draft.name}
              onChange={event => setDraft(current => ({ ...current, name: event.target.value }))}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="goal-target-amount" className="text-sm font-medium">
                Montant cible
              </label>
              <Input
                id="goal-target-amount"
                type="number"
                min={0.01}
                step="0.01"
                value={draft.targetAmount}
                onChange={event =>
                  setDraft(current => ({ ...current, targetAmount: event.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="goal-current-amount" className="text-sm font-medium">
                Montant actuel
              </label>
              <Input
                id="goal-current-amount"
                type="number"
                min={0}
                step="0.01"
                value={draft.currentAmount}
                onChange={event =>
                  setDraft(current => ({ ...current, currentAmount: event.target.value }))
                }
                required
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="goal-type" className="text-sm font-medium">
                Type
              </label>
              <Select
                value={draft.goalType}
                onValueChange={value =>
                  setDraft(current => ({ ...current, goalType: value as FinancialGoalType }))
                }
              >
                <SelectTrigger id="goal-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(GOAL_TYPE_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label htmlFor="goal-currency" className="text-sm font-medium">
                Devise
              </label>
              <Input
                id="goal-currency"
                value={draft.currency}
                maxLength={8}
                onChange={event =>
                  setDraft(current => ({ ...current, currency: event.target.value.toUpperCase() }))
                }
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="goal-target-date" className="text-sm font-medium">
              Échéance
            </label>
            <Input
              id="goal-target-date"
              type="date"
              value={draft.targetDate ?? ''}
              onChange={event =>
                setDraft(current => ({ ...current, targetDate: event.target.value || null }))
              }
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="goal-note" className="text-sm font-medium">
              Note
            </label>
            <textarea
              id="goal-note"
              className="min-h-20 w-full rounded-control border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
              value={draft.note ?? ''}
              onChange={event =>
                setDraft(current => ({
                  ...current,
                  note: event.target.value ? event.target.value.slice(0, 280) : null,
                }))
              }
            />
          </div>
          <div className="border-y border-border py-3">
            <Progress value={previewProgress} label="Aperçu de la progression" showValue />
          </div>
          <DialogFooter className="sm:items-center sm:justify-between">
            <div>
              {state.mode === 'edit' ? (
                <Button
                  type="button"
                  variant={archiveArmed ? 'destructive' : 'outline'}
                  size="sm"
                  onClick={archiveArmed ? onArchive : onArchiveArmed}
                  disabled={archivePending || savePending}
                >
                  {archivePending
                    ? 'Archivage'
                    : archiveArmed
                      ? 'Confirmer l’archivage'
                      : 'Archiver'}
                </Button>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Annuler
              </Button>
              <Button type="submit" disabled={savePending || archivePending}>
                {savePending ? 'Enregistrement' : 'Enregistrer'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function PersonalFinancialGoalsCard({
  authMode,
  isAdmin,
  isDemo,
}: {
  authMode: AuthMode | undefined
  isAdmin: boolean
  isDemo: boolean
}) {
  const queryClient = useQueryClient()
  const goalsQuery = useQuery(financialGoalsQueryOptionsWithMode({ mode: authMode }))
  const [editorState, setEditorState] = useState<GoalEditorState | null>(null)
  const [draft, setDraft] = useState<GoalDraft>(EMPTY_GOAL_DRAFT)
  const [recoverableError, setRecoverableError] = useState<RecoverableErrorState | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [archiveArmed, setArchiveArmed] = useState(false)

  const invalidateGoals = () =>
    queryClient.invalidateQueries({ queryKey: financialGoalsQueryKeys.list() })
  const saveGoalMutation = useMutation({
    mutationFn: async (
      input:
        | { mode: 'create'; input: FinancialGoalWriteInput }
        | { mode: 'edit'; goalId: number; input: FinancialGoalWriteInput }
    ) =>
      input.mode === 'create'
        ? createFinancialGoal(input.input)
        : updateFinancialGoal({ goalId: input.goalId, input: input.input }),
    onSuccess: async (_, variables) => {
      await invalidateGoals()
      setRecoverableError(null)
      setEditorState(null)
      setDraft(EMPTY_GOAL_DRAFT)
      pushToast({
        title: variables.mode === 'create' ? 'Objectif créé' : 'Objectif mis à jour',
        description: 'Progression mise à jour.',
        tone: 'success',
      })
    },
    onError: error => {
      const next = createRecoverableError({ source: 'save', title: 'Sauvegarde impossible', error })
      setRecoverableError(next)
      pushToast({ title: next.title, description: next.message, tone: 'error' })
    },
  })
  const archiveGoalMutation = useMutation({
    mutationFn: archiveFinancialGoal,
    onSuccess: async () => {
      await invalidateGoals()
      setRecoverableError(null)
      setEditorState(null)
      pushToast({
        title: 'Objectif archivé',
        description: 'Objectif retiré de la liste active.',
        tone: 'success',
      })
    },
    onError: error => {
      const next = createRecoverableError({
        source: 'archive',
        title: 'Archivage impossible',
        error,
      })
      setRecoverableError(next)
      pushToast({ title: next.title, description: next.message, tone: 'error' })
    },
  })

  const openCreate = () => {
    setDraft(EMPTY_GOAL_DRAFT)
    setEditorState({ mode: 'create' })
    setValidationError(null)
    setRecoverableError(null)
  }
  const openEdit = (goal: FinancialGoal) => {
    setDraft(toGoalDraft(goal))
    setEditorState({ mode: 'edit', goal })
    setValidationError(null)
    setRecoverableError(null)
  }
  const closeEditor = () => {
    if (saveGoalMutation.isPending || archiveGoalMutation.isPending) return
    setEditorState(null)
    setRecoverableError(null)
    setArchiveArmed(false)
  }
  const submitCurrentForm = () => {
    if (!editorState || !isAdmin) return
    const input = toGoalInput(draft)
    if (!input) {
      setValidationError('Renseignez un nom, une devise et des montants valides.')
      return
    }
    setValidationError(null)
    setRecoverableError(null)
    if (editorState.mode === 'create') saveGoalMutation.mutate({ mode: 'create', input })
    else saveGoalMutation.mutate({ mode: 'edit', goalId: editorState.goal.id, input })
  }
  const retryLastAction = () => {
    if (recoverableError?.source === 'query') void goalsQuery.refetch()
    else if (recoverableError?.source === 'save') submitCurrentForm()
    else if (recoverableError?.source === 'archive' && editorState?.mode === 'edit')
      archiveGoalMutation.mutate(editorState.goal.id)
  }

  const queryError = goalsQuery.isError
    ? createRecoverableError({
        source: 'query',
        title: 'Chargement impossible',
        error: goalsQuery.error,
      })
    : null
  const bannerError = recoverableError ?? queryError
  const goals = goalsQuery.data?.items ?? []
  const activeGoals = goals.filter(goal => goal.archivedAt === null)
  const archivedGoals = goals.filter(goal => goal.archivedAt !== null)

  return (
    <>
      <section aria-labelledby="active-goals-title">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
          <div>
            <h2
              id="active-goals-title"
              className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground"
            >
              Objectifs actifs
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {activeGoals.length} objectif{activeGoals.length > 1 ? 's' : ''}
            </p>
          </div>
          <Button
            type="button"
            onClick={openCreate}
            disabled={!isAdmin}
            className="min-h-11 sm:min-h-0"
          >
            Ajouter un objectif
          </Button>
        </div>

        {isDemo ? (
          <Status tone="neutral" label="Lecture seule en mode démo" className="mt-4" />
        ) : null}
        {bannerError ? (
          <div className="mt-5">
            <ErrorBanner
              error={bannerError}
              onRetry={retryLastAction}
              {...(bannerError.source === 'query'
                ? {}
                : { onDismiss: () => setRecoverableError(null) })}
            />
          </div>
        ) : null}
        {authMode === undefined || goalsQuery.isPending ? (
          <Status tone="progress" label="Chargement" className="mt-6" />
        ) : null}

        {!goalsQuery.isPending && !goalsQuery.isError && activeGoals.length === 0 ? (
          <div className="mt-6 border border-dashed border-border px-6 py-10 text-center">
            <FlagPixelIcon size={28} className="mx-auto text-primary" aria-hidden="true" />
            <p className="mt-4 text-sm text-muted-foreground">Aucun objectif pour le moment.</p>
            {isAdmin ? (
              <Button type="button" className="mt-4" onClick={openCreate}>
                Ajouter un objectif
              </Button>
            ) : null}
          </div>
        ) : null}

        {!goalsQuery.isPending && !goalsQuery.isError
          ? activeGoals.map(goal => (
              <GoalSurface
                key={goal.id}
                goal={goal}
                canEdit={isAdmin}
                onEdit={() => openEdit(goal)}
              />
            ))
          : null}
      </section>

      {archivedGoals.length > 0 ? (
        <details className="border-b border-border py-5">
          <summary className="min-h-11 cursor-pointer py-3 text-sm text-muted-foreground">
            Objectifs archivés ({archivedGoals.length})
          </summary>
          <div className="divide-y divide-border border-t border-border">
            {archivedGoals.map(goal => (
              <div key={goal.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                <span className="text-muted-foreground">{goal.name}</span>
                <CurrencyAmount
                  value={goal.currentAmount}
                  currency={goal.currency}
                  decimals={0}
                  className="text-muted-foreground"
                />
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {editorState ? (
        <GoalEditor
          state={editorState}
          draft={draft}
          setDraft={setDraft}
          validationError={validationError}
          savePending={saveGoalMutation.isPending}
          archivePending={archiveGoalMutation.isPending}
          archiveArmed={archiveArmed}
          onArchiveArmed={() => setArchiveArmed(true)}
          onClose={closeEditor}
          onSave={submitCurrentForm}
          onArchive={() =>
            editorState.mode === 'edit' && archiveGoalMutation.mutate(editorState.goal.id)
          }
        />
      ) : null}
    </>
  )
}
