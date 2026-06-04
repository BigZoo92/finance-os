import {
  MANUAL_OPERATION_STEP_ACTIVE_STATUSES,
  MANUAL_OPERATION_TERMINAL_STATUSES,
  PARENT_OPERATION_COMPLETED_CODE,
  STALE_PARENT_OPERATION_FAILED_CODE,
  isManualOperationStepActiveStatus,
  isManualOperationTerminalStatus,
} from '@finance-os/ai/manual-operation-recovery'
import { schema } from '@finance-os/db'
import { and, inArray } from 'drizzle-orm'
import type { ApiDb } from '../dashboard/types'

const ACTIVE_STEP_STATUSES = [...MANUAL_OPERATION_STEP_ACTIVE_STATUSES]
const TERMINAL_OPERATION_STATUSES = [...MANUAL_OPERATION_TERMINAL_STATUSES]

export type OrphanedStepRecoveryResult = {
  closed: number
  closedFailed: number
  closedSkipped: number
}

/**
 * Close `ai_manual_operation_step` rows that are still active (`queued`/`running`)
 * while their parent `ai_manual_operation` is already terminal.
 *
 * This is the exact prod incident: parent operation `failed`, child step
 * `advisor_run` stuck `running` for ~14 days, surfacing as a phantom "en cours"
 * in the Ops UI. The write-side cascade in `updateManualOperation` prevents new
 * orphans; this sweep heals any pre-existing or in-flight ones.
 *
 * Non-destructive: only flips orphaned steps to a terminal state; never deletes
 * rows and never mutates operations or any other table. Idempotent: once orphans
 * are closed the WHERE matches zero active rows, so re-running is a no-op.
 */
export const recoverOrphanedManualOperationSteps = async ({
  db,
  now = new Date(),
}: {
  db: ApiDb
  now?: Date
}): Promise<OrphanedStepRecoveryResult> => {
  const parents = await db
    .select({
      id: schema.aiManualOperation.id,
      status: schema.aiManualOperation.status,
    })
    .from(schema.aiManualOperation)
    .where(inArray(schema.aiManualOperation.status, TERMINAL_OPERATION_STATUSES))

  const parentStatusById = new Map(
    parents
      .filter(parent => isManualOperationTerminalStatus(parent.status))
      .map(parent => [parent.id, parent.status] as const)
  )

  if (parentStatusById.size === 0) {
    return { closed: 0, closedFailed: 0, closedSkipped: 0 }
  }

  const terminalParentIds = [...parentStatusById.keys()]
  const steps = await db
    .select({
      id: schema.aiManualOperationStep.id,
      operationId: schema.aiManualOperationStep.operationId,
      status: schema.aiManualOperationStep.status,
    })
    .from(schema.aiManualOperationStep)
    .where(
      and(
        inArray(schema.aiManualOperationStep.operationId, terminalParentIds),
        inArray(schema.aiManualOperationStep.status, ACTIVE_STEP_STATUSES)
      )
    )

  const orphans = steps.filter(
    step =>
      isManualOperationStepActiveStatus(step.status) && parentStatusById.has(step.operationId)
  )
  if (orphans.length === 0) {
    return { closed: 0, closedFailed: 0, closedSkipped: 0 }
  }

  // Parent `completed` => step `skipped` (benign: never finished on a successful
  // run). Parent `failed`/`degraded` => step `failed` with the machine code.
  const failIds = orphans
    .filter(step => parentStatusById.get(step.operationId) !== 'completed')
    .map(step => step.id)
  const skipIds = orphans
    .filter(step => parentStatusById.get(step.operationId) === 'completed')
    .map(step => step.id)

  if (failIds.length > 0) {
    await db
      .update(schema.aiManualOperationStep)
      .set({
        status: 'failed',
        errorCode: STALE_PARENT_OPERATION_FAILED_CODE,
        errorMessage:
          'Step was still running while the parent operation was already terminal; closed during stale recovery.',
        finishedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          inArray(schema.aiManualOperationStep.id, failIds),
          inArray(schema.aiManualOperationStep.status, ACTIVE_STEP_STATUSES)
        )
      )
  }

  if (skipIds.length > 0) {
    await db
      .update(schema.aiManualOperationStep)
      .set({
        status: 'skipped',
        errorCode: PARENT_OPERATION_COMPLETED_CODE,
        errorMessage:
          'Step was still active while the parent operation already completed; closed during stale recovery.',
        finishedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          inArray(schema.aiManualOperationStep.id, skipIds),
          inArray(schema.aiManualOperationStep.status, ACTIVE_STEP_STATUSES)
        )
      )
  }

  return {
    closed: failIds.length + skipIds.length,
    closedFailed: failIds.length,
    closedSkipped: skipIds.length,
  }
}
