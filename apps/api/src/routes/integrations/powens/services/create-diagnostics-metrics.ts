import type { DiagnosticOutcome } from '../domain/diagnostics'
import type { RedisClient } from '../types'

const OUTCOME_COUNTER_PREFIX = 'powens:metrics:diagnostics:outcome:'

export const createDiagnosticsMetrics = (redisClient: RedisClient) => {
  return {
    incrementOutcome: async (outcome: DiagnosticOutcome) => {
      const day = new Date().toISOString().slice(0, 10)
      await redisClient.incr(`${OUTCOME_COUNTER_PREFIX}${outcome}:${day}`)
    },
  }
}
