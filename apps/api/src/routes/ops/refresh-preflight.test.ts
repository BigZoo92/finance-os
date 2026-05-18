import { describe, expect, it } from 'bun:test'
import { evaluatePreflight, isFinalRefreshStatus } from './refresh-registry'

const baseJob = {
  id: 'news-finance',
  enabled: true,
  manualTriggerAllowed: true,
}

describe('evaluatePreflight', () => {
  it('returns skipped_disabled when job.enabled=false', () => {
    const result = evaluatePreflight({
      job: { ...baseJob, enabled: false },
      triggerSource: 'cron',
    })
    expect(result?.status).toBe('skipped_disabled')
  })

  it('blocks manual-individual when manualTriggerAllowed=false', () => {
    const result = evaluatePreflight({
      job: { ...baseJob, manualTriggerAllowed: false },
      triggerSource: 'manual-individual',
    })
    expect(result?.status).toBe('skipped')
  })

  it('allows manual-individual when manualTriggerAllowed=true', () => {
    const result = evaluatePreflight({
      job: baseJob,
      triggerSource: 'manual-individual',
    })
    expect(result).toBeNull()
  })

  it('returns skipped_missing_config when env names are missing', () => {
    const result = evaluatePreflight({
      job: baseJob,
      triggerSource: 'cron',
      missingConfig: {
        missingEnvNames: ['NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN'],
        reason: 'X bearer missing',
      },
    })
    expect(result?.status).toBe('skipped_missing_config')
    expect(result?.details.missingEnvNames).toEqual([
      'NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN',
    ])
  })

  it('returns skipped_budget when budgetExceeded is set', () => {
    const result = evaluatePreflight({
      job: baseJob,
      triggerSource: 'cron',
      budgetExceeded: { reason: 'monthly cap hit' },
    })
    expect(result?.status).toBe('skipped_budget')
  })

  it('returns skipped_dependency_failed when an upstream failed', () => {
    const result = evaluatePreflight({
      job: baseJob,
      triggerSource: 'cron',
      failedDependencyId: 'powens',
    })
    expect(result?.status).toBe('skipped_dependency_failed')
    expect(result?.details.failedDependencyId).toBe('powens')
  })

  it('returns null when nothing blocks the job', () => {
    const result = evaluatePreflight({
      job: baseJob,
      triggerSource: 'cron',
    })
    expect(result).toBeNull()
  })
})

describe('isFinalRefreshStatus', () => {
  it('considers queued/running as non-final (still in flight)', () => {
    expect(isFinalRefreshStatus('queued')).toBe(false)
    expect(isFinalRefreshStatus('running')).toBe(false)
  })

  it('considers all skip variants as final', () => {
    expect(isFinalRefreshStatus('skipped_disabled')).toBe(true)
    expect(isFinalRefreshStatus('skipped_missing_config')).toBe(true)
    expect(isFinalRefreshStatus('skipped_budget')).toBe(true)
    expect(isFinalRefreshStatus('skipped_dependency_failed')).toBe(true)
  })

  it('considers timed_out as final', () => {
    expect(isFinalRefreshStatus('timed_out')).toBe(true)
  })

  it('considers cancelled as final', () => {
    expect(isFinalRefreshStatus('cancelled')).toBe(true)
  })
})
