import { describe, expect, it } from 'bun:test'
import { schema } from '@finance-os/db'
import type { ApiDb } from '../dashboard/types'
import { recoverOrphanedManualOperationSteps } from './recover-orphaned-manual-operation-steps'

type OpRow = { id: string; status: string }
type StepRow = {
  id: number
  operationId: string
  status: string
  errorCode: string | null
  errorMessage: string | null
  finishedAt: Date | null
}

/**
 * Hand fake (house style): select returns all rows for a table — the function
 * re-filters in JS — and the step update models the orphan closure keyed off
 * the closure values the function provides (`failed` => parent failed/degraded,
 * `skipped` => parent completed).
 */
const createFakeDb = ({
  operations,
  steps,
}: {
  operations: OpRow[]
  steps: StepRow[]
}): ApiDb =>
  ({
    select: () => ({
      from: (table: unknown) => ({
        where: async () =>
          (table === schema.aiManualOperation ? operations : steps).map(row => ({ ...row })),
      }),
    }),
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          if (table !== schema.aiManualOperationStep) {
            return
          }
          const statusById = new Map(operations.map(op => [op.id, op.status]))
          for (const step of steps) {
            const parentStatus = statusById.get(step.operationId)
            const isActive = step.status === 'queued' || step.status === 'running'
            if (!isActive || !parentStatus) {
              continue
            }
            if (
              values.status === 'failed' &&
              (parentStatus === 'failed' || parentStatus === 'degraded')
            ) {
              Object.assign(step, values)
            } else if (values.status === 'skipped' && parentStatus === 'completed') {
              Object.assign(step, values)
            }
          }
        },
      }),
    }),
  }) as unknown as ApiDb

const step = (overrides: Partial<StepRow> & Pick<StepRow, 'id' | 'operationId' | 'status'>): StepRow => ({
  errorCode: null,
  errorMessage: null,
  finishedAt: null,
  ...overrides,
})

describe('recoverOrphanedManualOperationSteps', () => {
  it('closes a running child when the parent operation is already failed', async () => {
    const operations: OpRow[] = [{ id: 'op-failed', status: 'failed' }]
    const steps: StepRow[] = [step({ id: 111, operationId: 'op-failed', status: 'running' })]
    const now = new Date('2026-06-03T12:00:00.000Z')

    const result = await recoverOrphanedManualOperationSteps({
      db: createFakeDb({ operations, steps }),
      now,
    })

    expect(result).toEqual({ closed: 1, closedFailed: 1, closedSkipped: 0 })
    expect(steps[0]?.status).toBe('failed')
    expect(steps[0]?.errorCode).toBe('STALE_PARENT_OPERATION_FAILED')
    expect(steps[0]?.finishedAt).toBe(now)
  })

  it('does not leave a child active when the parent is degraded', async () => {
    const operations: OpRow[] = [{ id: 'op-degraded', status: 'degraded' }]
    const steps: StepRow[] = [step({ id: 91, operationId: 'op-degraded', status: 'queued' })]

    const result = await recoverOrphanedManualOperationSteps({
      db: createFakeDb({ operations, steps }),
    })

    expect(result.closedFailed).toBe(1)
    expect(['queued', 'running']).not.toContain(steps[0]?.status)
  })

  it('marks an orphan under a completed parent as skipped (benign)', async () => {
    const operations: OpRow[] = [{ id: 'op-done', status: 'completed' }]
    const steps: StepRow[] = [step({ id: 5, operationId: 'op-done', status: 'running' })]

    const result = await recoverOrphanedManualOperationSteps({
      db: createFakeDb({ operations, steps }),
    })

    expect(result).toEqual({ closed: 1, closedFailed: 0, closedSkipped: 1 })
    expect(steps[0]?.status).toBe('skipped')
    expect(steps[0]?.errorCode).toBe('PARENT_OPERATION_COMPLETED')
  })

  it('never touches a step whose parent is still active, nor already-terminal steps', async () => {
    const operations: OpRow[] = [
      { id: 'op-running', status: 'running' },
      { id: 'op-failed', status: 'failed' },
    ]
    const steps: StepRow[] = [
      step({ id: 1, operationId: 'op-running', status: 'running' }),
      step({ id: 2, operationId: 'op-failed', status: 'completed' }),
    ]

    const result = await recoverOrphanedManualOperationSteps({
      db: createFakeDb({ operations, steps }),
    })

    expect(result.closed).toBe(0)
    expect(steps[0]?.status).toBe('running')
    expect(steps[1]?.status).toBe('completed')
  })

  it('is idempotent: re-running after recovery closes nothing', async () => {
    const operations: OpRow[] = [{ id: 'op-failed', status: 'failed' }]
    const steps: StepRow[] = [step({ id: 111, operationId: 'op-failed', status: 'running' })]
    const db = createFakeDb({ operations, steps })

    const first = await recoverOrphanedManualOperationSteps({ db })
    const second = await recoverOrphanedManualOperationSteps({ db })

    expect(first.closed).toBe(1)
    expect(second.closed).toBe(0)
  })
})
