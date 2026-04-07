import { Badge, Button, Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@finance-os/ui/components'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
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
  emergency_fund: 'Épargne de précaution',
  travel: 'Voyage',
  home: 'Immobilier',
  education: 'Éducation',
  retirement: 'Retraite',
  custom: 'Personnalisé',
}

const GOAL_TYPE_ICON: Record<FinancialGoalType, string> = {
  emergency_fund: '🛡',
  travel: '✈',
  home: '🏠',
  education: '📚',
  retirement: '🌅',
  custom: '◎',
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
      <p className="mt-2 text-xs text-muted-foreground">
        This issue is non-blocking: other dashboard modules remain available while you retry.
      </p>
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground/50">
              <span className="text-lg" aria-hidden="true">◎</span> Objectifs financiers
            </p>
            {isDemo && <Badge variant="warning" className="mt-1 text-xs">DÉMO — lecture seule</Badge>}
          </div>
          <Button type="button" size="sm" onClick={openCreateDrawer} disabled={!isAdmin}>
            + Nouvel objectif
          </Button>
        </div>

        {bannerError ? (
          <ErrorBanner
            error={bannerError}
            onRetry={retryLastAction}
            {...(bannerError.source === 'query' ? {} : { onDismiss: () => setRecoverableError(null) })}
          />
        ) : null}

        {authMode === undefined || goalsQuery.isPending ? <GoalsSkeleton /> : null}

        {/* Alerts */}
        {isAdmin && !goalsQuery.isPending && !goalsQuery.isError && goalAlerts.length > 0 ? (
          <div className="rounded-2xl border border-warning/20 bg-warning/5 px-5 py-4 text-sm">
            <p className="font-semibold text-warning">⚡ Alertes</p>
            <ul className="mt-2 space-y-1.5">
              {goalAlerts.map(alert => (
                <li key={alert.goalId} className={`text-xs ${alert.level === 'high' ? 'text-negative font-medium' : 'text-muted-foreground'}`}>
                  {alert.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Empty state */}
        {!goalsQuery.isPending && !goalsQuery.isError && activeGoals.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border/30 py-12 text-center">
            <span className="text-4xl" aria-hidden="true">◎</span>
            <div>
              <p className="text-lg font-semibold">Aucun objectif</p>
              <p className="mt-1 text-sm text-muted-foreground">Créez votre premier objectif pour suivre votre progression.</p>
            </div>
            {isAdmin && (
              <Button type="button" onClick={openCreateDrawer}>Créer un objectif</Button>
            )}
          </div>
        ) : null}

        {/* Goal cards — redesigned */}
        {!goalsQuery.isPending && !goalsQuery.isError && activeGoals.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {activeGoals.map((goal, i) => {
              const progress = clampProgress(goal)
              const remainingAmount = Math.max(goal.targetAmount - goal.currentAmount, 0)
              const status = getGoalStatus(goal)
              const icon = GOAL_TYPE_ICON[goal.goalType] ?? '◎'

              return (
                <motion.div
                  key={goal.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="group relative overflow-hidden rounded-2xl border border-border/30 bg-card/50 p-5 transition-all duration-200 hover:bg-card hover:shadow-lg"
                >
                  {/* Progress background fill */}
                  <motion.div
                    className="absolute inset-y-0 left-0 bg-primary/[0.03]"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: i * 0.08 }}
                  />

                  <div className="relative">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <motion.span
                          className="text-2xl"
                          whileHover={{ scale: 1.2, rotate: 5 }}
                          transition={{ type: 'spring', bounce: 0.5 }}
                        >
                          {icon}
                        </motion.span>
                        <div>
                          <h3 className="text-base font-bold">{goal.name}</h3>
                          <div className="mt-0.5 flex items-center gap-2">
                            <span className="text-xs text-muted-foreground/50">{GOAL_TYPE_LABEL[goal.goalType]}</span>
                            <Badge
                              variant={status.label === 'On track' || status.label === 'Reached' ? 'positive' : status.label === 'Behind' ? 'destructive' : 'warning'}
                              className="text-xs"
                            >
                              {status.label}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => openEditDrawer(goal)}
                        disabled={!isAdmin}
                        className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                      >
                        Modifier
                      </Button>
                    </div>

                    {/* Amount display — big and clear */}
                    <div className="mt-4 flex items-end justify-between gap-4">
                      <div>
                        <p className="font-financial text-2xl font-bold tracking-tight">{formatMoney(goal.currentAmount, goal.currency)}</p>
                        <p className="text-sm text-muted-foreground/60">
                          sur {formatMoney(goal.targetAmount, goal.currency)}
                          {remainingAmount > 0 && <span> · reste {formatMoney(remainingAmount, goal.currency)}</span>}
                        </p>
                      </div>
                      <motion.span
                        className="font-financial text-3xl font-black text-primary/20"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 + i * 0.08, duration: 0.5 }}
                      >
                        {progress}%
                      </motion.span>
                    </div>

                    {/* Progress bar — animated with glow */}
                    <div className="mt-3 relative h-2.5 overflow-hidden rounded-full bg-border/20">
                      <motion.div
                        className={`absolute inset-y-0 left-0 rounded-full ${status.barClassName}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: i * 0.08 }}
                      />
                      {progress > 5 && (
                        <motion.div
                          className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white/80 shadow-[0_0_8px_oklch(from_var(--primary)_l_c_h/50%)]"
                          initial={{ left: 0 }}
                          animate={{ left: `calc(${Math.min(progress, 97)}% - 8px)` }}
                          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: i * 0.08 }}
                        />
                      )}
                    </div>

                    {/* Footer — date + note */}
                    <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground/60">
                      <span>{formatDate(goal.targetDate)}</span>
                      {goal.note && <span className="truncate ml-2 italic max-w-[50%]">{goal.note}</span>}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        ) : null}

        {/* Archived */}
        {!goalsQuery.isPending && !goalsQuery.isError && archivedGoals.length > 0 ? (
          <details className="group">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground/50 hover:text-muted-foreground transition-colors">
              {archivedGoals.length} objectif{archivedGoals.length > 1 ? 's' : ''} archivé{archivedGoals.length > 1 ? 's' : ''}
            </summary>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {archivedGoals.map(goal => (
                <div key={goal.id} className="flex items-center justify-between rounded-xl border border-border/20 bg-muted/10 px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium text-muted-foreground">{goal.name}</p>
                    <p className="text-xs text-muted-foreground/50">Archivé le {formatDate(goal.archivedAt?.slice(0, 10) ?? null)}</p>
                  </div>
                  <p className="font-financial text-sm text-muted-foreground">{formatMoney(goal.currentAmount, goal.currency)}</p>
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </div>

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
