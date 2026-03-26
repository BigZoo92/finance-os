import type {
  DashboardGoalPersistenceInput,
  DashboardGoalProgressSnapshotRow,
  DashboardGoalResponse,
  DashboardGoalRow,
  DashboardGoalWriteInput,
  DashboardUseCases,
} from '../types'

const GOAL_PROGRESS_SNAPSHOT_LIMIT = 12

const toRoundedAmount = (value: number) => {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.round(value * 100) / 100
}

const toIsoString = (value: Date | null) => {
  return value ? value.toISOString() : null
}

const normalizeSnapshotHistory = (snapshots: DashboardGoalProgressSnapshotRow[]) => {
  return snapshots
    .filter(snapshot => Number.isFinite(snapshot.amount) && typeof snapshot.recordedAt === 'string')
    .slice(-GOAL_PROGRESS_SNAPSHOT_LIMIT)
    .map(snapshot => ({
      recordedAt: snapshot.recordedAt,
      amount: toRoundedAmount(snapshot.amount),
      note: snapshot.note?.trim() ? snapshot.note.trim() : null,
    }))
}

const buildSnapshotHistory = ({
  existingSnapshots,
  currentAmount,
  shouldAppendSnapshot,
}: {
  existingSnapshots: DashboardGoalProgressSnapshotRow[]
  currentAmount: number
  shouldAppendSnapshot: boolean
}) => {
  const history = normalizeSnapshotHistory(existingSnapshots)

  if (!shouldAppendSnapshot) {
    return history
  }

  return [
    ...history,
    {
      recordedAt: new Date().toISOString(),
      amount: currentAmount,
      note: null,
    },
  ].slice(-GOAL_PROGRESS_SNAPSHOT_LIMIT)
}

const normalizeWriteInput = ({
  input,
  existingSnapshots,
  shouldAppendSnapshot,
}: {
  input: DashboardGoalWriteInput
  existingSnapshots: DashboardGoalProgressSnapshotRow[]
  shouldAppendSnapshot: boolean
}): DashboardGoalPersistenceInput => {
  const normalizedCurrentAmount = toRoundedAmount(input.currentAmount)

  return {
    name: input.name.trim(),
    goalType: input.goalType,
    currency: input.currency.trim().toUpperCase(),
    targetAmount: toRoundedAmount(input.targetAmount).toFixed(2),
    currentAmount: normalizedCurrentAmount.toFixed(2),
    targetDate: input.targetDate,
    note: input.note?.trim() ? input.note.trim() : null,
    progressSnapshots: buildSnapshotHistory({
      existingSnapshots,
      currentAmount: normalizedCurrentAmount,
      shouldAppendSnapshot,
    }),
    updatedAt: new Date(),
  }
}

const toDashboardGoalResponse = (row: DashboardGoalRow): DashboardGoalResponse => {
  const targetAmount = Number(row.targetAmount)
  const currentAmount = Number(row.currentAmount)

  return {
    id: row.id,
    name: row.name,
    goalType: row.goalType,
    currency: row.currency,
    targetAmount: Number.isFinite(targetAmount) ? targetAmount : 0,
    currentAmount: Number.isFinite(currentAmount) ? currentAmount : 0,
    targetDate: row.targetDate,
    note: row.note,
    progressSnapshots: normalizeSnapshotHistory(row.progressSnapshots),
    archivedAt: toIsoString(row.archivedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export const createGetDashboardGoalsUseCase = ({
  listGoals,
}: {
  listGoals: () => Promise<DashboardGoalRow[]>
}): DashboardUseCases['getGoals'] => {
  return async () => {
    const rows = await listGoals()

    return {
      items: rows.map(toDashboardGoalResponse),
    }
  }
}

export const createCreateDashboardGoalUseCase = ({
  createGoal,
}: {
  createGoal: (input: DashboardGoalPersistenceInput) => Promise<DashboardGoalRow>
}): DashboardUseCases['createGoal'] => {
  return async input => {
    const created = await createGoal(
      normalizeWriteInput({
        input,
        existingSnapshots: [],
        shouldAppendSnapshot: true,
      })
    )

    return toDashboardGoalResponse(created)
  }
}

export const createUpdateDashboardGoalUseCase = ({
  getGoalById,
  updateGoal,
}: {
  getGoalById: (goalId: number) => Promise<DashboardGoalRow | null>
  updateGoal: (goalId: number, input: DashboardGoalPersistenceInput) => Promise<DashboardGoalRow | null>
}): DashboardUseCases['updateGoal'] => {
  return async (goalId, input) => {
    const existing = await getGoalById(goalId)
    if (!existing) {
      return null
    }

    const currentAmountChanged =
      toRoundedAmount(input.currentAmount) !== toRoundedAmount(Number(existing.currentAmount))

    const updated = await updateGoal(
      goalId,
      normalizeWriteInput({
        input,
        existingSnapshots: existing.progressSnapshots,
        shouldAppendSnapshot: currentAmountChanged || existing.progressSnapshots.length === 0,
      })
    )

    return updated ? toDashboardGoalResponse(updated) : null
  }
}

export const createArchiveDashboardGoalUseCase = ({
  archiveGoal,
}: {
  archiveGoal: (goalId: number, archivedAt: Date) => Promise<DashboardGoalRow | null>
}): DashboardUseCases['archiveGoal'] => {
  return async goalId => {
    const archived = await archiveGoal(goalId, new Date())
    return archived ? toDashboardGoalResponse(archived) : null
  }
}
