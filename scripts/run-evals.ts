#!/usr/bin/env bun
/**
 * Deterministic Advisor evals CLI runner.
 *
 * Runs the seeded eval cases from `packages/ai/src/evals/default-eval-cases.ts` through the
 * deterministic scorers. Designed to run in safe local mode with no provider keys, no LLM
 * calls, no graph calls, no DB writes.
 *
 * PR2 limitation: this is a dry-run. It does not persist to `ai_eval_run`. Live eval persistence
 * still happens through the advisor pipeline (`apps/api/src/routes/dashboard/domain/advisor/
 * run-advisor-evals.ts`). PR3+ may extend this CLI to write with `triggerSource = 'cli'`.
 *
 * Usage:
 *   pnpm evals:run                  # run all cases, exit 0 if all scored cases pass
 *   pnpm evals:run -- --json        # emit machine-readable JSON instead of human summary
 *   pnpm evals:run -- --strict      # exit non-zero if any case fails OR is skipped
 */

import {
  DEFAULT_AI_EVAL_CASES,
  isScoredCategory,
  scoreCase,
  type AiEvalCaseSeed,
  type AiEvalCategory,
  type ScoringResult,
} from '../packages/ai/src/index'

interface CliOptions {
  json: boolean
  strict: boolean
}

interface CaseOutcome {
  caseId: string
  category: AiEvalCategory
  status: 'passed' | 'failed' | 'skipped'
  failedExpectations: string[]
  skipReason: string | null
}

const parseArgs = (argv: readonly string[]): CliOptions => ({
  json: argv.includes('--json'),
  strict: argv.includes('--strict'),
})

const evaluateCase = (caseSeed: AiEvalCaseSeed): CaseOutcome => {
  if (isScoredCategory(caseSeed.category)) {
    const result = scoreCase(caseSeed) as ScoringResult
    return {
      caseId: caseSeed.key,
      category: caseSeed.category,
      status: result.passed ? 'passed' : 'failed',
      failedExpectations: result.failedExpectations,
      skipReason: null,
    }
  }
  // Existing categories require a live advisor snapshot; the CLI does not run the advisor
  // pipeline. We surface them as skipped with a deterministic reason rather than fabricate data.
  return {
    caseId: caseSeed.key,
    category: caseSeed.category,
    status: 'skipped',
    failedExpectations: [],
    skipReason: 'requires_live_advisor_snapshot',
  }
}

const groupByCategory = (
  outcomes: readonly CaseOutcome[]
): Map<AiEvalCategory, { passed: number; failed: number; skipped: number; total: number }> => {
  const out = new Map<AiEvalCategory, {
    passed: number
    failed: number
    skipped: number
    total: number
  }>()
  for (const outcome of outcomes) {
    const bucket = out.get(outcome.category) ?? {
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0,
    }
    bucket.total += 1
    bucket[outcome.status] += 1
    out.set(outcome.category, bucket)
  }
  return out
}

const formatHumanSummary = (outcomes: readonly CaseOutcome[]): string => {
  const lines: string[] = []
  const total = outcomes.length
  const passed = outcomes.filter(o => o.status === 'passed').length
  const failed = outcomes.filter(o => o.status === 'failed').length
  const skipped = outcomes.filter(o => o.status === 'skipped').length

  lines.push('Finance-OS Advisor evals (deterministic CLI dry-run)')
  lines.push(`  total:   ${total}`)
  lines.push(`  passed:  ${passed}`)
  lines.push(`  failed:  ${failed}`)
  lines.push(`  skipped: ${skipped}  (require live advisor snapshot)`)
  lines.push('')
  lines.push('By category:')
  for (const [category, counts] of groupByCategory(outcomes)) {
    lines.push(
      `  ${category.padEnd(28)} passed=${counts.passed} failed=${counts.failed} skipped=${counts.skipped} total=${counts.total}`
    )
  }
  const failedCases = outcomes.filter(o => o.status === 'failed')
  if (failedCases.length > 0) {
    lines.push('')
    lines.push('Failed case IDs:')
    for (const outcome of failedCases) {
      lines.push(`  - ${outcome.caseId} [${outcome.category}]`)
      for (const reason of outcome.failedExpectations) {
        lines.push(`      • ${reason}`)
      }
    }
  }
  return lines.join('\n')
}

const main = (
  argv: readonly string[],
  options?: { cases?: readonly AiEvalCaseSeed[] }
): number => {
  const flags = parseArgs(argv)
  const cases = options?.cases ?? DEFAULT_AI_EVAL_CASES
  const outcomes = cases.map(evaluateCase)
  const failedCount = outcomes.filter(o => o.status === 'failed').length
  const skippedCount = outcomes.filter(o => o.status === 'skipped').length

  if (flags.json) {
    const payload = {
      runMode: 'cli_dry_run',
      triggerSource: 'cli',
      total: outcomes.length,
      passed: outcomes.filter(o => o.status === 'passed').length,
      failed: failedCount,
      skipped: skippedCount,
      outcomes,
    }
    console.log(JSON.stringify(payload, null, 2))
  } else {
    console.log(formatHumanSummary(outcomes))
  }

  if (failedCount > 0) return 1
  if (flags.strict && skippedCount > 0) return 2
  return 0
}

if (typeof require !== 'undefined' && require.main === module) {
  process.exit(main(process.argv.slice(2)))
}

export { main as runEvalsCli }
export type { CaseOutcome }
