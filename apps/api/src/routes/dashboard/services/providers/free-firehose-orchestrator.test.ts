import { describe, expect, it } from 'bun:test'
import {
  __testing,
  estimateFreeFirehoseVolume,
  type FreeFirehoseProviderRunner,
  type FreeFirehoseRunHistory,
  runFreeFirehose,
} from './free-firehose-orchestrator'

const okResult = (insertedCount = 100) => ({
  fetchedCount: 100,
  insertedCount,
  dedupedCount: 0,
  failedCount: 0,
  errorCodes: [] as string[],
})

const stubHistory = (countLastWeek = 0): FreeFirehoseRunHistory & { calls: string[] } => {
  const calls: string[] = []
  return {
    countLastNDays: async () => countLastWeek,
    createRunRecord: async () => {
      calls.push('create')
    },
    finishRunRecord: async () => {
      calls.push('finish')
    },
    calls,
  }
}

const provider = (id: string, maxRecords = 100, result = okResult()): FreeFirehoseProviderRunner =>
  ({
    id: id as never,
    maxRecords,
    run: async () => result,
  })

describe('forbidden providers', () => {
  it('excludes X / Twitter and paid providers by ID', () => {
    const filtered = __testing.filterAllowedProviders([
      provider('gdelt'),
      provider('x_twitter'),
      provider('eodhd'),
      provider('twelvedata'),
      provider('hn'),
    ] as FreeFirehoseProviderRunner[])
    expect(filtered.map(p => p.id).sort()).toEqual(['gdelt', 'hn'])
  })

  it('FORBIDDEN_PROVIDER_IDS contains x_twitter, twitter, bluesky, openai, anthropic and paid feeds', () => {
    for (const id of ['x_twitter', 'twitter', 'bluesky', 'openai', 'anthropic', 'eodhd', 'twelvedata']) {
      expect(__testing.FORBIDDEN_PROVIDER_IDS.has(id)).toBe(true)
    }
  })
})

describe('estimateFreeFirehoseVolume', () => {
  it('sums maxRecords of allowed providers only', () => {
    const estimate = estimateFreeFirehoseVolume([
      provider('gdelt', 5000),
      provider('hn', 3000),
      provider('x_twitter', 999999),
    ] as FreeFirehoseProviderRunner[])
    expect(estimate.maxRecords).toBe(8000)
    expect(estimate.providers).toHaveLength(2)
  })
})

describe('runFreeFirehose dry-run mode', () => {
  it('does not enforce the weekly cap in dry-run mode', async () => {
    const history = stubHistory(99)
    const outcome = await runFreeFirehose({
      runId: 'r-dry',
      mode: 'dry_run',
      providers: [provider('gdelt')] as FreeFirehoseProviderRunner[],
      history,
      maxRunsPerWeek: 1,
    })
    expect(outcome.status).toBe('success')
    expect(history.calls).toEqual(['create', 'finish'])
  })

  it('passes dryRun=true to each provider', async () => {
    const received: { dryRun?: boolean } = {}
    const provider1: FreeFirehoseProviderRunner = {
      id: 'gdelt' as never,
      maxRecords: 100,
      run: async ({ dryRun }) => {
        received.dryRun = dryRun
        return okResult()
      },
    }
    await runFreeFirehose({
      runId: 'r-dry-check',
      mode: 'dry_run',
      providers: [provider1],
      history: stubHistory(),
      maxRunsPerWeek: 1,
    })
    expect(received.dryRun).toBe(true)
  })
})

describe('runFreeFirehose weekly quota', () => {
  it('returns skipped_quota when the weekly cap is reached in live mode', async () => {
    let providerInvoked = false
    const outcome = await runFreeFirehose({
      runId: 'r-blocked',
      mode: 'live',
      providers: [
        {
          id: 'gdelt' as never,
          maxRecords: 100,
          run: async () => {
            providerInvoked = true
            return okResult()
          },
        },
      ],
      history: stubHistory(1),
      maxRunsPerWeek: 1,
    })
    expect(outcome.status).toBe('skipped_quota')
    expect(outcome.errorSummary ?? '').toContain('Weekly cap')
    expect(providerInvoked).toBe(false)
  })
})

describe('runFreeFirehose live mode', () => {
  it('aggregates counts across all allowed providers', async () => {
    const outcome = await runFreeFirehose({
      runId: 'r-live',
      mode: 'live',
      providers: [
        provider('gdelt', 5000, { fetchedCount: 5000, insertedCount: 4900, dedupedCount: 50, failedCount: 0, errorCodes: [] }),
        provider('hn', 3000, { fetchedCount: 3000, insertedCount: 2950, dedupedCount: 20, failedCount: 0, errorCodes: [] }),
      ] as FreeFirehoseProviderRunner[],
      history: stubHistory(0),
      maxRunsPerWeek: 1,
    })
    expect(outcome.counts.fetched).toBe(8000)
    expect(outcome.counts.inserted).toBe(7850)
    expect(outcome.counts.deduped).toBe(70)
    expect(outcome.status).toBe('success')
  })

  it('reports partial status when at least one provider fails', async () => {
    const outcome = await runFreeFirehose({
      runId: 'r-partial',
      mode: 'live',
      providers: [
        provider('gdelt', 5000, okResult()),
        provider('hn', 3000, { fetchedCount: 0, insertedCount: 0, dedupedCount: 0, failedCount: 3, errorCodes: ['HN_500' as string] }),
      ] as FreeFirehoseProviderRunner[],
      history: stubHistory(0),
      maxRunsPerWeek: 1,
    })
    expect(outcome.status).toBe('partial')
    expect(outcome.errorSummary).toContain('HN_500')
  })

  it('reports failed status when every provider fails', async () => {
    const outcome = await runFreeFirehose({
      runId: 'r-fail',
      mode: 'live',
      providers: [
        {
          id: 'gdelt' as never,
          maxRecords: 100,
          run: async () => {
            throw new Error('boom')
          },
        },
      ],
      history: stubHistory(0),
      maxRunsPerWeek: 1,
    })
    expect(outcome.status).toBe('failed')
    expect(outcome.counts.failed).toBe(1)
  })
})
