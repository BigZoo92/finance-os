import { describe, expect, it } from 'bun:test'
import {
  isAiRunActiveStatus,
  isAiRunStatus,
  isAiRunTerminalStatus,
  type AiRunStatus,
} from './run-status'

describe('ai_run status helpers', () => {
  it('matches the PostgreSQL ai_run_status terminal taxonomy', () => {
    const terminal: AiRunStatus[] = ['completed', 'failed', 'degraded', 'skipped']
    const active: AiRunStatus[] = ['queued', 'running']

    for (const status of terminal) {
      expect(isAiRunTerminalStatus(status)).toBe(true)
      expect(isAiRunActiveStatus(status)).toBe(false)
    }

    for (const status of active) {
      expect(isAiRunTerminalStatus(status)).toBe(false)
      expect(isAiRunActiveStatus(status)).toBe(true)
    }
  })

  it('rejects statuses from other domains', () => {
    for (const status of ['success', 'pending', 'processing', 'cancelled']) {
      expect(isAiRunStatus(status)).toBe(false)
    }
  })
})
