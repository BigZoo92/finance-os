import { describe, expect, it } from 'vitest'
import { OPS_CAPABILITY_DECISIONS } from './capability-decisions'
import { createOrchestrationJobs, formatOpsDuration } from './orchestration-view-model'
import type { RefreshJobDefinition, RefreshJobRunResponse, RefreshStatusResponse } from './types'

const job = (overrides: Partial<RefreshJobDefinition>): RefreshJobDefinition => ({
  id: 'market-data',
  label: 'Market data',
  description: 'Technical description',
  domain: 'markets',
  dependencies: [],
  enabled: true,
  manualTriggerAllowed: true,
  scheduleGroup: 'daily-intelligence',
  timeoutMs: 90_000,
  retryPolicy: { maxAttempts: 1, backoffMs: 0 },
  ...overrides,
})

const result = (overrides: Partial<RefreshJobRunResponse>): RefreshJobRunResponse => ({
  jobId: 'market-data',
  status: 'success',
  requestId: 'private',
  runId: 'private',
  startedAt: '2026-09-01T10:00:00.000Z',
  finishedAt: '2026-09-01T10:00:06.000Z',
  durationMs: 6000,
  recordsRead: null,
  recordsWritten: null,
  errorCode: null,
  errorMessage: null,
  retryCount: 0,
  message: null,
  details: null,
  ...overrides,
})

const status = (
  jobs: RefreshJobDefinition[],
  results: RefreshJobRunResponse[] = []
): RefreshStatusResponse => ({
  requestId: 'private',
  mode: 'admin',
  jobs,
  latestRun: null,
  history: [],
  latestTopologicalRun: results.length
    ? {
        ok: true,
        requestId: 'private',
        runId: 'private',
        runKind: 'manual',
        triggerSource: 'manual-global',
        dryRun: false,
        status: 'success',
        startedAt: '2026-09-01T10:00:00.000Z',
        finishedAt: '2026-09-01T10:00:06.000Z',
        durationMs: 6000,
        jobs: results,
        failedJobs: [],
        disabledJobs: [],
        operation: null,
        warning: null,
      }
    : null,
  topologicalHistory: [],
})

describe('orchestration view model', () => {
  it('maps rich job states to the small human vocabulary', () => {
    const states = ['success', 'partial', 'failed', 'running'] as const
    const labels = states.map(
      runStatus =>
        createOrchestrationJobs({
          status: status([job({})], [result({ status: runStatus })]),
          isAdmin: true,
          busy: false,
        })[0]?.stateLabel
    )
    expect(labels).toEqual(['Terminé', 'Attention', 'Échec', 'En cours'])
  })

  it('selects one primary action and preserves concurrency gating', () => {
    const ready = createOrchestrationJobs({
      status: status([job({})]),
      isAdmin: true,
      busy: false,
    })[0]
    const failed = createOrchestrationJobs({
      status: status([job({})], [result({ status: 'failed' })]),
      isAdmin: true,
      busy: false,
    })[0]
    const busy = createOrchestrationJobs({
      status: status([job({})]),
      isAdmin: true,
      busy: true,
    })[0]
    expect(ready?.action).toMatchObject({ kind: 'run', label: 'Lancer' })
    expect(failed?.action).toMatchObject({ kind: 'run', label: 'Relancer' })
    expect(busy?.action.kind).toBe('none')
  })

  it('keeps Admin gating and provider action ownership explicit', () => {
    const powens = job({ id: 'powens', label: 'Powens', domain: 'banking' })
    expect(
      createOrchestrationJobs({ status: status([powens]), isAdmin: true, busy: false })[0]?.action
    ).toMatchObject({ kind: 'navigate', to: '/integrations' })
    expect(
      createOrchestrationJobs({ status: status([powens]), isAdmin: false, busy: false })[0]?.action
        .kind
    ).toBe('none')
  })

  it('consolidates the shared News runner instead of faking two statuses', () => {
    const jobs = [
      job({ id: 'news-finance', domain: 'news' }),
      job({ id: 'news-crypto', domain: 'news' }),
    ]
    const models = createOrchestrationJobs({ status: status(jobs), isAdmin: true, busy: false })
    expect(models).toHaveLength(1)
    expect(models[0]?.label).toBe('News')
  })

  it('shows known duration and keeps unknown last run and duration unavailable', () => {
    expect(formatOpsDuration(6000)).toBe('6 s')
    expect(formatOpsDuration(null)).toBe('Indisponible')
    const model = createOrchestrationJobs({
      status: status([job({})]),
      isAdmin: true,
      busy: false,
    })[0]
    expect(model?.lastRunAt).toBeNull()
    expect(model?.durationMs).toBeNull()
  })

  it('keeps run detail free of raw server messages', () => {
    const model = createOrchestrationJobs({
      status: status(
        [job({})],
        [result({ status: 'failed', errorMessage: 'PRIVATE_TOKEN stack trace' })]
      ),
      isAdmin: true,
      busy: false,
    })[0]
    expect(model?.detail).not.toMatch(/token|stack|private/i)
  })

  it('records one deliberate decision for every wire-or-delete candidate', () => {
    expect(OPS_CAPABILITY_DECISIONS.map(item => item.capability)).toEqual([
      'free-firehose-estimate',
      'free-firehose-run',
      'x-daily-sync',
      'x-resolve-all',
      'x-health',
      'knowledge-enrichment-ensure',
      'derived-recompute-post',
    ])
  })
})
