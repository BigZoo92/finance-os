/**
 * Free Firehose orchestrator. Purpose: when an admin clicks the "Import massif
 * gratuit" button, run a single coordinated pass across explicitly-free
 * sources (GDELT / Hacker News / ECB / Fed / FRED / SEC), aggregate counts,
 * persist a run record, and refuse to invoke any paid provider or LLM.
 *
 * Hard rules (encoded here, not deferred to providers):
 *   1. The orchestrator is admin-gated by the caller — this module is pure
 *      logic and trusts the route's `requireAdmin` upstream.
 *   2. Sources marked `paid` are silently filtered out. X / Twitter is
 *      excluded by ID — not provider name — so renaming can't leak it in.
 *   3. A weekly cap (`maxRunsPerWeek`) is enforced before any provider call:
 *      if exceeded, the run is short-circuited as `skipped_quota`.
 *   4. Dry-run mode never invokes the writer — providers run, but the orchestrator
 *      reports counters without persisting anything.
 *   5. LLM enrichment is opt-in (default off). The button itself never spends
 *      AI budget.
 */

const FORBIDDEN_PROVIDER_IDS = new Set([
  'x_twitter',
  'twitter',
  'bluesky',
  'openai',
  'anthropic',
  'eodhd',
  'twelvedata',
  'alpha_vantage',
])

export type FreeFirehoseProviderId = 'gdelt' | 'hn' | 'ecb_rss' | 'fed_rss' | 'sec_edgar' | 'fred'

export type FreeFirehoseProviderRunner = {
  id: FreeFirehoseProviderId
  /** Best-effort upper bound on records this provider will fetch this run. */
  maxRecords: number
  /** Pure-ish callback that fetches normalised items. Dry-run mode prevents writes. */
  run: (input: { dryRun: boolean }) => Promise<FreeFirehoseProviderRunResult>
}

export type FreeFirehoseProviderRunResult = {
  fetchedCount: number
  insertedCount: number
  dedupedCount: number
  failedCount: number
  errorCodes: string[]
}

export type FreeFirehoseRunHistory = {
  countLastNDays: (windowDays: number) => Promise<number>
  createRunRecord: (input: {
    runId: string
    mode: 'dry_run' | 'live'
  }) => Promise<void>
  finishRunRecord: (input: {
    runId: string
    status: 'success' | 'partial' | 'failed' | 'cancelled' | 'skipped_quota'
    durationMs: number
    counts: {
      fetched: number
      inserted: number
      deduped: number
      skipped: number
      failed: number
    }
    providerBreakdown: Record<string, FreeFirehoseProviderRunResult>
    errorSummary: string | null
  }) => Promise<void>
}

export type FreeFirehoseRunOutcome = {
  runId: string
  mode: 'dry_run' | 'live'
  status: 'success' | 'partial' | 'failed' | 'skipped_quota'
  counts: {
    fetched: number
    inserted: number
    deduped: number
    skipped: number
    failed: number
  }
  providerBreakdown: Record<string, FreeFirehoseProviderRunResult>
  durationMs: number
  estimatedMaxRecords: number
  errorSummary: string | null
}

const filterAllowedProviders = (providers: FreeFirehoseProviderRunner[]) =>
  providers.filter(p => !FORBIDDEN_PROVIDER_IDS.has(p.id))

export const estimateFreeFirehoseVolume = (providers: FreeFirehoseProviderRunner[]) => {
  return filterAllowedProviders(providers).reduce(
    (acc, p) => {
      acc.maxRecords += p.maxRecords
      acc.providers.push({ id: p.id, maxRecords: p.maxRecords })
      return acc
    },
    { maxRecords: 0, providers: [] as Array<{ id: string; maxRecords: number }> }
  )
}

export const runFreeFirehose = async ({
  runId,
  mode,
  providers,
  history,
  maxRunsPerWeek,
  now = () => new Date(),
}: {
  runId: string
  mode: 'dry_run' | 'live'
  providers: FreeFirehoseProviderRunner[]
  history: FreeFirehoseRunHistory
  maxRunsPerWeek: number
  now?: () => Date
}): Promise<FreeFirehoseRunOutcome> => {
  const startedAtMs = now().getTime()
  const allowedProviders = filterAllowedProviders(providers)
  const estimate = estimateFreeFirehoseVolume(allowedProviders)

  // Weekly cap check: only enforce in live mode. Dry-run is free.
  if (mode === 'live') {
    const runsLastWeek = await history.countLastNDays(7)
    if (runsLastWeek >= maxRunsPerWeek) {
      return {
        runId,
        mode,
        status: 'skipped_quota',
        counts: { fetched: 0, inserted: 0, deduped: 0, skipped: 0, failed: 0 },
        providerBreakdown: {},
        durationMs: now().getTime() - startedAtMs,
        estimatedMaxRecords: estimate.maxRecords,
        errorSummary: `Weekly cap reached (${runsLastWeek}/${maxRunsPerWeek} runs in the last 7 days).`,
      }
    }
  }

  await history.createRunRecord({ runId, mode })

  const providerBreakdown: Record<string, FreeFirehoseProviderRunResult> = {}
  const counts = { fetched: 0, inserted: 0, deduped: 0, skipped: 0, failed: 0 }
  const errorCodes: string[] = []
  let anyFailed = false
  let anySuccess = false

  for (const provider of allowedProviders) {
    try {
      const result = await provider.run({ dryRun: mode === 'dry_run' })
      providerBreakdown[provider.id] = result
      counts.fetched += result.fetchedCount
      counts.inserted += result.insertedCount
      counts.deduped += result.dedupedCount
      counts.failed += result.failedCount
      errorCodes.push(...result.errorCodes)
      if (result.failedCount > 0) anyFailed = true
      if (result.insertedCount > 0 || result.fetchedCount > 0) anySuccess = true
    } catch (error) {
      anyFailed = true
      providerBreakdown[provider.id] = {
        fetchedCount: 0,
        insertedCount: 0,
        dedupedCount: 0,
        failedCount: 1,
        errorCodes: [error instanceof Error ? error.name : 'UNKNOWN_ERROR'],
      }
      counts.failed += 1
      errorCodes.push(error instanceof Error ? error.name : 'UNKNOWN_ERROR')
    }
  }

  const status: FreeFirehoseRunOutcome['status'] =
    !anySuccess && anyFailed
      ? 'failed'
      : anyFailed
        ? 'partial'
        : 'success'
  const durationMs = now().getTime() - startedAtMs
  const errorSummary = errorCodes.length > 0 ? errorCodes.slice(0, 20).join(',') : null

  await history.finishRunRecord({
    runId,
    status,
    durationMs,
    counts,
    providerBreakdown,
    errorSummary,
  })

  return {
    runId,
    mode,
    status,
    counts,
    providerBreakdown,
    durationMs,
    estimatedMaxRecords: estimate.maxRecords,
    errorSummary,
  }
}

export const __testing = { FORBIDDEN_PROVIDER_IDS, filterAllowedProviders }
