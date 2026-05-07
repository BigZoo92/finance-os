import { describe, expect, it } from 'bun:test'
import type { AiEvalCaseSeed } from '../packages/ai/src/index'
import { runEvalsCli } from './run-evals'

const captureStdout = async (fn: () => void | Promise<void>): Promise<string> => {
  const original = console.log
  const chunks: string[] = []
  console.log = (...args: unknown[]) => {
    chunks.push(args.map(arg => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' '))
  }
  try {
    await fn()
  } finally {
    console.log = original
  }
  return chunks.join('\n')
}

const unexpectedlyFailingCase: AiEvalCaseSeed = {
  key: 'cli-unexpected-failure-fixture',
  category: 'causal_reasoning',
  description: 'fixture used by the CLI tests to exercise the unexpected-failure exit path',
  input: {
    candidateOutput: {
      whyNow: 'The drop was caused by the announcement; certainty is high.',
      evidence: ['headline'],
      alternatives: [],
      confidence: 0.95,
    },
  },
  expectation: {
    maxConfidence: 0.6,
    minEvidenceCount: 2,
    requireUncertaintyMarkers: true,
    requireAlternatives: true,
  },
}

describe('runEvalsCli', () => {
  it('exits 0 by default when the seeded scored cases meet expectations', async () => {
    let exitCode = -1
    const out = await captureStdout(() => {
      exitCode = runEvalsCli([])
    })

    expect(exitCode).toBe(0)
    expect(out).toContain('Finance-OS Advisor evals')
    expect(out).toContain('passed:')
    expect(out).toContain('failed:')
    expect(out).toContain('skipped:')
    // No failures: no "Failed case IDs:" section is emitted.
    expect(out).not.toContain('Failed case IDs:')
    // The healthy baselines are present and not in a failed list.
    expect(out).toContain('causal_reasoning')
    expect(out).toContain('strategy_quality')
    expect(out).toContain('risk_calibration')
  })

  it('emits machine-readable JSON when --json is passed', async () => {
    let exitCode = -1
    const out = await captureStdout(() => {
      exitCode = runEvalsCli(['--json'])
    })
    expect(exitCode).toBe(0)
    const parsed = JSON.parse(out) as {
      runMode: string
      triggerSource: string
      total: number
      passed: number
      failed: number
      skipped: number
      outcomes: Array<{
        caseId: string
        category: string
        status: 'passed' | 'failed' | 'skipped'
      }>
    }
    expect(parsed.runMode).toBe('cli_dry_run')
    expect(parsed.triggerSource).toBe('cli')
    expect(parsed.total).toBeGreaterThan(0)
    expect(parsed.failed).toBe(0)
    // All three scored seeded cases must be present and passing.
    const scoredOutcomes = parsed.outcomes.filter(o =>
      ['causal_reasoning', 'strategy_quality', 'risk_calibration'].includes(o.category)
    )
    expect(scoredOutcomes.length).toBe(3)
    expect(scoredOutcomes.every(o => o.status === 'passed')).toBe(true)
    // Existing categories are skipped (they require live snapshot).
    expect(
      parsed.outcomes.some(o => o.category === 'cost_control' && o.status === 'skipped')
    ).toBe(true)
  })

  it('exits 2 in --strict mode because existing categories are still skipped', async () => {
    let exitCode = -1
    await captureStdout(() => {
      exitCode = runEvalsCli(['--strict'])
    })
    expect(exitCode).toBe(2)
  })

  it('exits 1 when an unexpected scored failure is injected', async () => {
    let exitCode = -1
    const out = await captureStdout(() => {
      exitCode = runEvalsCli([], { cases: [unexpectedlyFailingCase] })
    })
    expect(exitCode).toBe(1)
    expect(out).toContain('Failed case IDs:')
    expect(out).toContain('cli-unexpected-failure-fixture')
  })

  it('--json with an injected unexpected failure surfaces it as a failed outcome', async () => {
    let exitCode = -1
    const out = await captureStdout(() => {
      exitCode = runEvalsCli(['--json'], { cases: [unexpectedlyFailingCase] })
    })
    expect(exitCode).toBe(1)
    const parsed = JSON.parse(out) as {
      failed: number
      outcomes: Array<{ caseId: string; status: string; failedExpectations: string[] }>
    }
    expect(parsed.failed).toBe(1)
    const failure = parsed.outcomes.find(o => o.caseId === 'cli-unexpected-failure-fixture')
    expect(failure).toBeDefined()
    expect(failure?.status).toBe('failed')
    expect((failure?.failedExpectations ?? []).length).toBeGreaterThan(0)
  })
})
