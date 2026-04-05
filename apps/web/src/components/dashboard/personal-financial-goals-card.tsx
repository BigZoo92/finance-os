import { Badge, Button, Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@finance-os/ui/components'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import type { AuthMode } from '@/features/auth-types'
import {
  archiveFinancialGoal,
  createFinancialGoal,
  normalizeFinancialGoalActionError,
  updateFinancialGoal,
} from '@/features/goals/api'
import { financialGoalsQueryKeys, financialGoalsQueryOptionsWithMode } from '@/features/goals/query-options'
import type { FinancialGoal, FinancialGoalType, FinancialGoalWriteInput } from '@/features/goals/types'
import { pushToast } from '@/lib/toast-store'

const EMPTY_GOAL_FORM: FinancialGoalWriteInput = {
  name: '',
  goalType: 'custom',
  currency: 'EUR',
  targetAmount: 0,
  currentAmount: 0,
  targetDate: null,
  note: null,
}

const GOAL_TYPE_LABEL: Record<FinancialGoalType, string> = {
  emergency_fund: 'Emergency fund',
  travel: 'Travel',
  home: 'Home',
  education: 'Education',
  retirement: 'Retirement',
  custom: 'Custom',
}

type GoalEditorState =
  | {
      mode: 'create'
    }
  | {
      mode: 'edit'
      goal: FinancialGoal
    }

type RecoverableErrorState =
  | {
      source: 'query'
      title: string
      message: string
      requestId?: string
      retryable: boolean
      offline: boolean
    }
  | {
      source: 'save'
      title: string
      message: string
      requestId?: string
      retryable: boolean
      offline: boolean
    }
  | {
      source: 'archive'
      title: string
      message: string
      requestId?: string
      retryable: boolean
      offline: boolean
    }

const formatMoney = (value: number, currency: string) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

const formatDate = (value: string | null) => {
  if (!value) {
    return 'No target date'
  }

  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const formatSnapshotDate = (value: string) => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
  })
}

const clampProgress = (goal: FinancialGoal) => {
  if (goal.targetAmount <= 0) {
    return 0
  }

  const percent = (goal.currentAmount / goal.targetAmount) * 100
  return Math.max(0, Math.min(100, Math.round(percent * 10) / 10))
}

const clampProgressFromInput = (input: FinancialGoalWriteInput) => {
  if (input.targetAmount <= 0) {
    return 0
  }

  const percent = (input.currentAmount / input.targetAmount) * 100
  return Math.max(0, Math.min(100, Math.round(percent * 10) / 10))
}

const getGoalStatus = (goal: FinancialGoal) => {
  const progress = clampProgress(goal)
  if (progress >= 100 || goal.archivedAt) {
    return {
      label: progress >= 100 ? 'Reached' : 'Archived',
      badgeClassName: progress >= 100 ? 'border-emerald-500/50 text-emerald-600' : '',
      barClassName: progress >= 100 ? 'bg-emerald-500' : 'bg-slate-500',
    }
  }

  if (!goal.targetDate) {
    return {
      label: progress >= 50 ? 'On track' : 'In progress',
      badgeClassName: progress >= 50 ? 'border-sky-500/50 text-sky-600' : '',
      barClassName: progress >= 50 ? 'bg-sky-500' : 'bg-amber-500',
    }
  }

  const targetDate = new Date(`${goal.targetDate}T00:00:00.000Z`)
  const daysUntilTarget = Math.ceil((targetDate.getTime() - Date.now()) / 86_400_000)
  if (daysUntilTarget < 0 && progress < 100) {
    return {
      label: 'Behind',
      badgeClassName: 'border-rose-500/50 text-rose-600',
      barClassName: 'bg-rose-500',
    }
  }

  if (daysUntilTarget <= 90 && progress < 60) {
    return {
      label: 'At risk',
      badgeClassName: 'border-amber-500/50 text-amber-600',
      barClassName: 'bg-amber-500',
    }
  }

  return {
    label: 'On track',
    badgeClassName: 'border-sky-500/50 text-sky-600',
    barClassName: 'bg-sky-500',
  }
}

const toGoalFormInput = (goal: FinancialGoal): FinancialGoalWriteInput => {
  return {
    name: goal.name,
    goalType: goal.goalType,
    currency: goal.currency,
    targetAmount: goal.targetAmount,
    currentAmount: goal.currentAmount,
    targetDate: goal.targetDate,
    note: goal.note,
  }
}

const parseAmount = (value: string) => {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
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

const GoalsSkeleton = () => {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map(index => (
        <div
          key={index}
          className="rounded-xl border border-border/70 bg-muted/20 p-4"
        >
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="h-2 w-full rounded bg-muted" />
            <div className="grid gap-2 md:grid-cols-3">
              <div className="h-10 rounded bg-muted" />
              <div className="h-10 rounded bg-muted" />
              <div className="h-10 rounded bg-muted" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

const ErrorBanner = ({
  error,
  onRetry,
  onDismiss,
}: {
  error: RecoverableErrorState
  onRetry: () => void
  onDismiss?: () => void
}) => {
  return (
    <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
      <p className="font-semibold text-destructive">{error.title}</p>
      <p className="mt-1 text-destructive/90">{error.message}</p>
      {error.offline ? (
        <p className="mt-2 text-xs text-destructive/90">
          Offline or API unreachable. Retry once the connection is back.
        </p>
      ) : null}
      {error.requestId ? (
        <p className="mt-2 text-xs text-muted-foreground">Request ID: {error.requestId}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRetry}
          disabled={!error.retryable}
        >
          Retry
        </Button>
        {onDismiss ? (
          <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
            Dismiss
          </Button>
        ) : null}
      </div>
    </div>
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
  const goalsQuery = useQuery(
    financialGoalsQueryOptionsWithMode({
      mode: authMode,
    })
  )
  const [editorState, setEditorState] = useState<GoalEditorState | null>(null)
  const [formState, setFormState] = useState<FinancialGoalWriteInput>(EMPTY_GOAL_FORM)
  const [recoverableError, setRecoverableError] = useState<RecoverableErrorState | null>(null)

  const invalidateGoals = async () => {
    await queryClient.invalidateQueries({
      queryKey: financialGoalsQueryKeys.list(),
    })
  }

  const saveGoalMutation = useMutation({
    mutationFn: async (
      input:
        | {
            mode: 'create'
            input: FinancialGoalWriteInput
          }
        | {
            mode: 'edit'
            goalId: number
            input: FinancialGoalWriteInput
          }
    ) => {
      if (input.mode === 'create') {
        return createFinancialGoal(input.input)
      }

      return updateFinancialGoal({
        goalId: input.goalId,
        input: input.input,
      })
    },
    onSuccess: async (_, variables) => {
      await invalidateGoals()
      setRecoverableError(null)
      setEditorState(null)
      setFormState(EMPTY_GOAL_FORM)
      pushToast({
        title: variables.mode === 'create' ? 'Goal created' : 'Goal updated',
        description: 'Progress and targets are now up to date.',
        tone: 'success',
      })
    },
    onError: error => {
      const nextError = createRecoverableError({
        source: 'save',
        title: 'Unable to save this goal',
        error,
      })

      setRecoverableError(nextError)
      pushToast({
        title: 'Goal save failed',
        description: nextError.message,
        tone: 'error',
      })
    },
  })

  const archiveGoalMutation = useMutation({
    mutationFn: archiveFinancialGoal,
    onSuccess: async () => {
      await invalidateGoals()
      setRecoverableError(null)
      setEditorState(null)
      pushToast({
        title: 'Goal archived',
        description: 'The goal was moved out of the active list.',
        tone: 'success',
      })
    },
    onError: error => {
      const nextError = createRecoverableError({
        source: 'archive',
        title: 'Unable to archive this goal',
        error,
      })

      setRecoverableError(nextError)
      pushToast({
        title: 'Archive failed',
        description: nextError.message,
        tone: 'error',
      })
    },
  })

  const openCreateDrawer = () => {
    setRecoverableError(null)
    setFormState(EMPTY_GOAL_FORM)
    setEditorState({
      mode: 'create',
    })
  }

  const openEditDrawer = (goal: FinancialGoal) => {
    setRecoverableError(null)
    setFormState(toGoalFormInput(goal))
    setEditorState({
      mode: 'edit',
      goal,
    })
  }

  const closeDrawer = () => {
    if (saveGoalMutation.isPending || archiveGoalMutation.isPending) {
      return
    }

    setEditorState(null)
    setRecoverableError(null)
  }

  const submitCurrentForm = () => {
    if (!editorState || !isAdmin) {
      return
    }

    setRecoverableError(null)

    if (editorState.mode === 'create') {
      saveGoalMutation.mutate({
        mode: 'create',
        input: formState,
      })
      return
    }

    saveGoalMutation.mutate({
      mode: 'edit',
      goalId: editorState.goal.id,
      input: formState,
    })
  }

  const retryLastAction = () => {
    if (recoverableError?.source === 'query') {
      void goalsQuery.refetch()
      return
    }

    if (recoverableError?.source === 'save') {
      submitCurrentForm()
      return
    }

    if (recoverableError?.source === 'archive' && editorState?.mode === 'edit') {
      archiveGoalMutation.mutate(editorState.goal.id)
    }
  }

  const queryError = goalsQuery.isError
    ? createRecoverableError({
        source: 'query',
        title: 'Unable to load goals',
        error: goalsQuery.error,
      })
    : null

  const bannerError = recoverableError ?? queryError
  const goals = goalsQuery.data?.items ?? []
  const activeGoals = goals.filter(goal => goal.archivedAt === null)
  const archivedGoals = goals.filter(goal => goal.archivedAt !== null)

  const goalAlerts = useMemo(() => {
    return activeGoals
      .map(goal => {
        const progress = clampProgress(goal)
        const remainingAmount = Math.max(goal.targetAmount - goal.currentAmount, 0)

        if (!goal.targetDate) {
          return null
        }

        const targetDate = new Date(`${goal.targetDate}T00:00:00.000Z`)
        const daysUntilTarget = Math.ceil((targetDate.getTime() - Date.now()) / 86_400_000)

        if (daysUntilTarget < 0 && remainingAmount > 0) {
          return {
            goalId: goal.id,
            level: 'high' as const,
            message: `${goal.name}: objectif depasse de ${Math.abs(daysUntilTarget)}j, reste ${formatMoney(remainingAmount, goal.currency)} a epargner.`,
          }
        }

        if (daysUntilTarget <= 90 && progress < 60) {
          return {
            goalId: goal.id,
            level: 'medium' as const,
            message: `${goal.name}: echeance dans ${Math.max(daysUntilTarget, 0)}j avec ${progress}% finance.`,
          }
        }

        return null
      })
      .filter(item => item !== null)
  }, [activeGoals])

  return (
    <>
      <Card>
        <CardHeader>
          <div className="space-y-2">
            <CardTitle className="flex items-center gap-2">
              Personal Financial Goals
              {isDemo ? (
                <Badge variant="outline" className="border-amber-500/60 text-amber-700">
                  DEMO
                </Badge>
              ) : null}
            </CardTitle>
            <CardDescription>
              List-first tracking for your savings goals, so monthly budget decisions can stay tied to
              concrete objective progress.
            </CardDescription>
          </div>
          <CardAction>
            <Button type="button" size="sm" onClick={openCreateDrawer} disabled={!isAdmin}>
              New goal
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4">
          {isDemo ? (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-950 dark:text-amber-100">
              Demo mode keeps this module read-only and uses deterministic snapshots only.
            </div>
          ) : null}

          {bannerError ? (
            <ErrorBanner
              error={bannerError}
              onRetry={retryLastAction}
              {...(bannerError.source === 'query'
                ? {}
                : {
                    onDismiss: () => setRecoverableError(null),
                  })}
            />
          ) : null}

          {authMode === undefined || goalsQuery.isPending ? <GoalsSkeleton /> : null}

          {isAdmin && !goalsQuery.isPending && !goalsQuery.isError && goalAlerts.length > 0 ? (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-950 dark:text-amber-100">
              <p className="font-medium">Alertes objectif</p>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                {goalAlerts.map(alert => (
                  <li key={alert.goalId} className={alert.level === 'high' ? 'font-medium' : ''}>
                    {alert.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {!goalsQuery.isPending && !goalsQuery.isError && activeGoals.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/80 bg-muted/10 p-6 text-center">
              <p className="text-lg font-semibold">No goals yet</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Add the first goal to start tracking contribution progress and target dates.
              </p>
              {isAdmin ? (
                <div className="mt-4">
                  <Button type="button" onClick={openCreateDrawer}>
                    Create the first goal
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          {!goalsQuery.isPending && !goalsQuery.isError && activeGoals.length > 0 ? (
            <div className="space-y-3">
              {activeGoals.map(goal => {
                const progress = clampProgress(goal)
                const remainingAmount = Math.max(goal.targetAmount - goal.currentAmount, 0)
                const status = getGoalStatus(goal)
                const latestSnapshot = goal.progressSnapshots[goal.progressSnapshots.length - 1]

                return (
                  <div
                    key={goal.id}
                    className="rounded-xl border border-border/70 bg-card/70 p-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold">{goal.name}</h3>
                          <Badge variant="outline">{GOAL_TYPE_LABEL[goal.goalType]}</Badge>
                          <Badge variant="outline" className={status.badgeClassName}>
                            {status.label}
                          </Badge>
                        </div>
                        <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-3">
                          <div className="rounded-lg border border-border/70 px-3 py-2">
                            <p className="text-xs uppercase tracking-wide">Saved</p>
                            <p className="mt-1 font-medium text-foreground">
                              {formatMoney(goal.currentAmount, goal.currency)}
                            </p>
                          </div>
                          <div className="rounded-lg border border-border/70 px-3 py-2">
                            <p className="text-xs uppercase tracking-wide">Target</p>
                            <p className="mt-1 font-medium text-foreground">
                              {formatMoney(goal.targetAmount, goal.currency)}
                            </p>
                          </div>
                          <div className="rounded-lg border border-border/70 px-3 py-2">
                            <p className="text-xs uppercase tracking-wide">Remaining</p>
                            <p className="mt-1 font-medium text-foreground">
                              {formatMoney(remainingAmount, goal.currency)}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <p className="font-medium">{progress}% funded</p>
                            <p className="text-muted-foreground">{formatDate(goal.targetDate)}</p>
                          </div>
                          <div className="h-2 rounded-full bg-muted">
                            <div
                              className={`h-2 rounded-full transition-[width] ${status.barClassName}`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {goal.progressSnapshots.length > 0 ? (
                            goal.progressSnapshots.slice(-3).map(snapshot => (
                              <span
                                key={`${goal.id}-${snapshot.recordedAt}`}
                                className="rounded-full border border-border/70 px-2.5 py-1 text-xs text-muted-foreground"
                              >
                                {formatSnapshotDate(snapshot.recordedAt)} ·{' '}
                                {formatMoney(snapshot.amount, goal.currency)}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">No progress snapshots yet.</span>
                          )}
                        </div>
                        {goal.note ? <p className="text-sm text-muted-foreground">{goal.note}</p> : null}
                        {latestSnapshot ? (
                          <p className="text-xs text-muted-foreground">
                            Latest update: {formatSnapshotDate(latestSnapshot.recordedAt)}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-start gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDrawer(goal)}
                          disabled={!isAdmin}
                        >
                          Edit
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : null}

          {!goalsQuery.isPending && !goalsQuery.isError && archivedGoals.length > 0 ? (
            <details className="rounded-xl border border-border/70 bg-muted/10 p-4">
              <summary className="cursor-pointer text-sm font-medium">
                Archived goals ({archivedGoals.length})
              </summary>
              <div className="mt-3 space-y-2">
                {archivedGoals.map(goal => (
                  <div
                    key={goal.id}
                    className="flex flex-col gap-2 rounded-lg border border-border/70 bg-background/80 px-3 py-3 text-sm md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="font-medium">{goal.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Archived on {formatDate(goal.archivedAt?.slice(0, 10) ?? null)}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Final value {formatMoney(goal.currentAmount, goal.currency)}
                    </p>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </CardContent>
      </Card>

      {editorState ? (
        <div
          className="fixed inset-0 z-50 bg-black/45 p-4 backdrop-blur-sm"
          onClick={closeDrawer}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="goal-editor-title"
            className="ml-auto flex h-full w-full max-w-xl flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="border-b border-border/70 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {editorState.mode === 'create' ? 'Create' : 'Edit'}
                  </p>
                  <h2 id="goal-editor-title" className="mt-1 text-lg font-semibold">
                    {editorState.mode === 'create'
                      ? 'New personal goal'
                      : `Edit ${editorState.goal.name}`}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Keep the list compact and reveal the full form only when editing.
                  </p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={closeDrawer}>
                  Close
                </Button>
              </div>
            </div>

            <form
              className="flex min-h-0 flex-1 flex-col"
              onSubmit={event => {
                event.preventDefault()
                submitCurrentForm()
              }}
            >
              <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
                {recoverableError?.source === 'save' || recoverableError?.source === 'archive' ? (
                  <ErrorBanner
                    error={recoverableError}
                    onRetry={retryLastAction}
                    onDismiss={() => setRecoverableError(null)}
                  />
                ) : null}

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="goal-name">
                    Goal name
                  </label>
                  <Input
                    id="goal-name"
                    value={formState.name}
                    onChange={event =>
                      setFormState(current => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Emergency runway"
                    required
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="goal-type">
                      Goal type
                    </label>
                    <select
                      id="goal-type"
                      className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                      value={formState.goalType}
                      onChange={event =>
                        setFormState(current => ({
                          ...current,
                          goalType: event.target.value as FinancialGoalType,
                        }))
                      }
                    >
                      {Object.entries(GOAL_TYPE_LABEL).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="goal-currency">
                      Currency
                    </label>
                    <Input
                      id="goal-currency"
                      value={formState.currency}
                      onChange={event =>
                        setFormState(current => ({
                          ...current,
                          currency: event.target.value.toUpperCase().slice(0, 8),
                        }))
                      }
                      maxLength={8}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="goal-target-amount">
                      Target amount
                    </label>
                    <Input
                      id="goal-target-amount"
                      type="number"
                      min={0}
                      step="0.01"
                      value={String(formState.targetAmount)}
                      onChange={event =>
                        setFormState(current => ({
                          ...current,
                          targetAmount: parseAmount(event.target.value),
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="goal-current-amount">
                      Current amount
                    </label>
                    <Input
                      id="goal-current-amount"
                      type="number"
                      min={0}
                      step="0.01"
                      value={String(formState.currentAmount)}
                      onChange={event =>
                        setFormState(current => ({
                          ...current,
                          currentAmount: parseAmount(event.target.value),
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="goal-target-date">
                    Target date
                  </label>
                  <Input
                    id="goal-target-date"
                    type="date"
                    value={formState.targetDate ?? ''}
                    onChange={event =>
                      setFormState(current => ({
                        ...current,
                        targetDate: event.target.value || null,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="goal-note">
                    Note
                  </label>
                  <textarea
                    id="goal-note"
                    className="min-h-28 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                    value={formState.note ?? ''}
                    onChange={event =>
                      setFormState(current => ({
                        ...current,
                        note: event.target.value ? event.target.value.slice(0, 280) : null,
                      }))
                    }
                    placeholder="Keep this aligned with the next big cash need."
                  />
                </div>

                <div className="rounded-xl border border-border/70 bg-muted/10 p-4">
                  <p className="text-sm font-medium">Preview</p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                    <p className="font-medium">
                      {formatMoney(formState.currentAmount, formState.currency || 'EUR')} saved
                    </p>
                    <p className="text-muted-foreground">
                      {clampProgressFromInput(formState)}% funded
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-border/70 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    {editorState.mode === 'edit' ? (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (!window.confirm(`Archive "${editorState.goal.name}"?`)) {
                            return
                          }

                          setRecoverableError(null)
                          archiveGoalMutation.mutate(editorState.goal.id)
                        }}
                        disabled={archiveGoalMutation.isPending || saveGoalMutation.isPending}
                      >
                        {archiveGoalMutation.isPending ? 'Archiving...' : 'Archive goal'}
                      </Button>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="ghost" onClick={closeDrawer}>
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={saveGoalMutation.isPending || archiveGoalMutation.isPending}
                    >
                      {saveGoalMutation.isPending
                        ? 'Saving...'
                        : editorState.mode === 'create'
                          ? 'Create goal'
                          : 'Save changes'}
                    </Button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
