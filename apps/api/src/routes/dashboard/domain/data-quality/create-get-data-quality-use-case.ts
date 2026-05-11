// Macro Prompt 5 — Data quality use-case factory.
//
// Read-only orchestration over already-cached state. The factory produces a
// single async function that:
//   1. Returns a deterministic demo fixture in demo mode (no DB, no provider IO).
//   2. In admin mode, gathers the closed-vocab snapshot from existing
//      repositories + the already-computed provider diagnostics response, and
//      delegates to the pure compute helper.
//
// HARD CONSTRAINTS (Macro Prompt 5):
//   - No live provider probes.
//   - No `provider.call()` invocation from this code path.
//   - No LLM, no graph call, no sync trigger.
//   - No raw provider payload exposure.
//   - No credential / config / token surfaced anywhere.

import {
  type BuildDataQualitySnapshotInput,
  buildDataQualityDimensions,
} from './build-data-quality-snapshot'
import { computeDataQuality } from './compute-data-quality'
import { buildDataQualityDemoFixtureInput } from './data-quality-demo-fixture'
import type { DataQualityResponse } from './data-quality-types'

export interface GetDataQualityUseCaseDeps {
  /**
   * Builds the closed-vocab snapshot from already-cached state. Implementations
   * MUST NOT call providers and MUST NOT include tokens, secrets, account ids,
   * or raw payloads.
   */
  readonly buildSnapshot: () => Promise<BuildDataQualitySnapshotInput>
  readonly now: () => Date
}

export interface GetDataQualityUseCaseInput {
  readonly mode: 'demo' | 'admin'
  readonly requestId: string
}

export const createGetDataQualityUseCase = (deps: GetDataQualityUseCaseDeps) => {
  return async (input: GetDataQualityUseCaseInput): Promise<DataQualityResponse> => {
    if (input.mode === 'demo') {
      const fixture = buildDataQualityDemoFixtureInput()
      return computeDataQuality({
        mode: 'demo',
        generatedAt: fixture.generatedAt,
        dimensions: fixture.dimensions,
      })
    }

    const snapshot = await deps.buildSnapshot()
    const dimensions = buildDataQualityDimensions(snapshot)
    return computeDataQuality({
      mode: 'admin',
      generatedAt: deps.now(),
      dimensions,
    })
  }
}

export type GetDataQualityUseCase = ReturnType<typeof createGetDataQualityUseCase>
