// Advisor Post-Mortem use-cases (PR4).
//
// Retrospective analysis of expired advisor recommendations. Produces structured findings,
// calibration deltas, and learning actions. Advisory-only — never an execution directive.
//
// All LLM call sites are gated by:
//   1. demo mode → never reachable
//   2. AI_POST_MORTEM_ENABLED feature flag → off by default
//   3. computeAiBudgetState().deepAnalysisAllowed → must be true
//
// Output is validated against `postMortemJsonSchema` and run through a strict execution-directive
// scanner BEFORE any DB write. If the model emits an execution directive the run is marked
// `failed` (with `errorCode='execution_directive_emitted'`) and the learning actions are NOT
// persisted as usable.
//
// Graph ingest of LearningAction / DecisionPoint is **deferred** in PR4 (the existing
// knowledge-service advisor ingest doesn't accept those node types). This module is structured
// so that a graph-ingest hook can be wired in a future PR without changing the public contract.

import {
  EXECUTION_VOCABULARY,
  POST_MORTEM_PROMPT,
  postMortemSchemaName,
  postMortemSchemaVersion,
  type AiBudgetState,
  type PostMortemOutput,
  type StructuredCompletionRequest,
  type StructuredCompletionResult,
} from '@finance-os/ai'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type PostMortemRunStatus = 'pending' | 'completed' | 'skipped' | 'failed'

export interface ExpiredRecommendationContext {
  recommendationId: number | null
  recommendationKey: string | null
  runId: number | null
  decisionId: number | null
  decisionKind: 'accepted' | 'rejected' | 'deferred' | 'ignored' | null
  reasonCode: string | null
  decidedAt: string | null
  expectedOutcomeAt: string | null
  horizonDays: number | null
  recommendationTitle: string | null
  recommendationCategory: string | null
  recommendationConfidence: number | null
  recommendationRiskLevel: 'low' | 'medium' | 'high' | null
  evidence: string[]
  assumptions: string[]
  outcomes: Array<{
    outcomeKind: string
    observedAt: string
    learningTags: string[]
  }>
  hypothesisExtras?: {
    thesis?: string | null
    invalidationCriteria?: string[]
    horizon?: string | null
  } | null
}

export interface PersistedPostMortemRow {
  id: number
  runId: number | null
  recommendationId: number | null
  decisionId: number | null
  recommendationKey: string | null
  status: PostMortemRunStatus
  horizonDays: number | null
  evaluatedAt: string | null
  expectedOutcomeAt: string | null
  inputSummary: Record<string, unknown> | null
  findings: Record<string, unknown> | null
  learningActions: Array<Record<string, unknown>> | null
  calibration: Record<string, unknown> | null
  riskNotes: Record<string, unknown> | null
  skippedReason: string | null
  errorCode: string | null
  createdAt: string
  updatedAt: string
}

export interface PostMortemListResponse {
  items: PersistedPostMortemRow[]
}

export type PostMortemRunSummaryStatus =
  | 'completed'
  | 'skipped_disabled'
  | 'skipped_budget_blocked'
  | 'skipped_no_due_items'
  | 'failed'

export interface PostMortemRunSummary {
  status: PostMortemRunSummaryStatus
  feature: 'post_mortem'
  evaluatedAt: string
  totalDue: number
  processed: number
  remaining: number
  persistedIds: number[]
  failedItems: number
  reason: string | null
  budgetReasons: string[]
}

// ---------------------------------------------------------------------------
// Repository adapter — narrow shape; the production wiring uses the existing advisor repo.
// ---------------------------------------------------------------------------

export interface PostMortemRepositoryAdapter {
  // Reads expired recommendation contexts due for a post-mortem run. Implementations decide
  // how to determine "expired" — typically `expectedOutcomeAt <= now AND no completed
  // post-mortem row referencing the same recommendation`. The adapter is responsible for
  // returning a deterministic, bounded list.
  listExpiredContexts: (input: {
    now: Date
    horizonDays: number
    limit: number
  }) => Promise<ExpiredRecommendationContext[]>
  insertPostMortem: (input: {
    runId?: number | null
    recommendationId?: number | null
    decisionId?: number | null
    recommendationKey?: string | null
    status: PostMortemRunStatus
    horizonDays?: number | null
    evaluatedAt: Date
    expectedOutcomeAt?: Date | null
    inputSummary?: Record<string, unknown> | null
    findings?: Record<string, unknown> | null
    learningActions?: Array<Record<string, unknown>> | null
    calibration?: Record<string, unknown> | null
    riskNotes?: Record<string, unknown> | null
    skippedReason?: string | null
    errorCode?: string | null
  }) => Promise<PersistedPostMortemRow>
  listPostMortems: (input: { limit: number }) => Promise<PostMortemListResponse>
  getPostMortemById: (id: number) => Promise<PersistedPostMortemRow | null>
}

// ---------------------------------------------------------------------------
// LLM provider adapter — narrow runStructured shape so tests can plug a fake.
// ---------------------------------------------------------------------------

export interface PostMortemStructuredRunner {
  runStructured: <TOutput>(
    request: StructuredCompletionRequest
  ) => Promise<StructuredCompletionResult<TOutput>>
}

// ---------------------------------------------------------------------------
// Execution-directive scan (stricter than PR2 — see scorers/post-mortem.ts).
// We re-implement the scan locally on the parsed PostMortemOutput so we don't depend on the
// scorer module from runtime code.
// ---------------------------------------------------------------------------

const stripDiacritics = (value: string): string =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '')

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const hasExecutionTerm = (text: string, banlist: readonly string[]): string[] => {
  const haystack = stripDiacritics(text).toLowerCase()
  const matches: string[] = []
  for (const needle of banlist) {
    const pattern = new RegExp(
      `(?:^|[^\\w])${escapeRegex(stripDiacritics(needle).toLowerCase())}(?:[^\\w]|$)`,
      'i'
    )
    if (pattern.test(haystack)) matches.push(needle)
  }
  return matches
}

const collectModelTexts = (output: PostMortemOutput): string[] => {
  const texts: string[] = []
  texts.push(output.summary, output.confidenceCalibration.rationale)
  texts.push(...output.evidenceReview.supportedSignals)
  texts.push(...output.evidenceReview.contradictedSignals)
  texts.push(...output.evidenceReview.missingEvidence)
  texts.push(...output.evidenceReview.staleOrWeakEvidence)
  texts.push(...output.outcomeDrivers.likelyDrivers)
  texts.push(...output.outcomeDrivers.alternativeExplanations)
  texts.push(...output.outcomeDrivers.unknowns)
  texts.push(...output.lessons.keep, ...output.lessons.change, ...output.lessons.avoid)
  for (const action of output.learningActions) {
    texts.push(action.title, action.description, ...action.appliesTo)
  }
  // Deliberately skip output.safety.executionTerms — it's the model's self-report.
  return texts
}

const findExecutionTermsInOutput = (output: PostMortemOutput): string[] => {
  const all = new Set<string>()
  for (const text of collectModelTexts(output)) {
    for (const match of hasExecutionTerm(text, EXECUTION_VOCABULARY)) all.add(match)
  }
  return [...all]
}

// ---------------------------------------------------------------------------
// Output validation — runs after the LLM returns. Cheap structural checks first,
// then strict execution-vocabulary scan, then schema-version pin.
// ---------------------------------------------------------------------------

export class PostMortemOutputValidationError extends Error {
  readonly code: string
  readonly detail: string

  constructor({ code, detail }: { code: string; detail: string }) {
    super(`Post-mortem output validation failed: ${code} (${detail})`)
    this.name = 'PostMortemOutputValidationError'
    this.code = code
    this.detail = detail
  }
}

const validateOutputShape = (output: unknown): PostMortemOutput => {
  if (!output || typeof output !== 'object') {
    throw new PostMortemOutputValidationError({
      code: 'OUTPUT_NOT_OBJECT',
      detail: 'expected JSON object',
    })
  }
  const candidate = output as Partial<PostMortemOutput>
  if (candidate.version !== postMortemSchemaVersion) {
    throw new PostMortemOutputValidationError({
      code: 'OUTPUT_SCHEMA_VERSION_MISMATCH',
      detail: `expected ${postMortemSchemaVersion}, received ${String(candidate.version)}`,
    })
  }
  if (typeof candidate.summary !== 'string' || candidate.summary.length < 16) {
    throw new PostMortemOutputValidationError({
      code: 'OUTPUT_SUMMARY_INVALID',
      detail: 'summary missing or too short',
    })
  }
  if (
    !candidate.confidenceCalibration ||
    !candidate.evidenceReview ||
    !candidate.outcomeDrivers ||
    !candidate.lessons ||
    !Array.isArray(candidate.learningActions) ||
    !candidate.safety
  ) {
    throw new PostMortemOutputValidationError({
      code: 'OUTPUT_REQUIRED_FIELD_MISSING',
      detail: 'one or more required structured fields are missing',
    })
  }
  for (const action of candidate.learningActions) {
    if (!action || (action as { scope?: string }).scope !== 'advisory-only') {
      throw new PostMortemOutputValidationError({
        code: 'LEARNING_ACTION_SCOPE_INVALID',
        detail: 'every learning action must declare scope "advisory-only"',
      })
    }
  }
  return candidate as PostMortemOutput
}

// ---------------------------------------------------------------------------
// Configuration & public use-case factory
// ---------------------------------------------------------------------------

export interface PostMortemConfig {
  enabled: boolean
  horizonDays: number
  batchLimit: number
  model: string
  feature: string // 'post_mortem' — surfaced in cost ledger
}

export interface BudgetStateProvider {
  fetchBudgetState: () => Promise<AiBudgetState>
}

export interface PostMortemDemoFixtures {
  list: PersistedPostMortemRow[]
}

const buildInputSummary = (
  contexts: readonly ExpiredRecommendationContext[],
  config: PostMortemConfig
): Record<string, unknown> => ({
  schemaVersion: postMortemSchemaVersion,
  horizonDays: config.horizonDays,
  itemCount: contexts.length,
  items: contexts.map(ctx => ({
    recommendationKey: ctx.recommendationKey,
    decisionKind: ctx.decisionKind,
    reasonCode: ctx.reasonCode,
    expectedOutcomeAt: ctx.expectedOutcomeAt,
    horizonDays: ctx.horizonDays,
    title: ctx.recommendationTitle,
    category: ctx.recommendationCategory,
    confidence: ctx.recommendationConfidence,
    riskLevel: ctx.recommendationRiskLevel,
    evidence: ctx.evidence,
    assumptions: ctx.assumptions,
    outcomes: ctx.outcomes,
    ...(ctx.hypothesisExtras
      ? {
          hypothesis: {
            ...(ctx.hypothesisExtras.thesis !== undefined
              ? { thesis: ctx.hypothesisExtras.thesis }
              : {}),
            ...(ctx.hypothesisExtras.invalidationCriteria !== undefined
              ? { invalidationCriteria: ctx.hypothesisExtras.invalidationCriteria }
              : {}),
            ...(ctx.hypothesisExtras.horizon !== undefined
              ? { horizon: ctx.hypothesisExtras.horizon }
              : {}),
          },
        }
      : {}),
  })),
})

const renderUserPrompt = (
  template: string,
  values: { schemaVersion: string; batchId: string; horizonDays: number; contextJson: string }
): string =>
  template
    .replace(/{{schema_version}}/g, values.schemaVersion)
    .replace(/{{batch_id}}/g, values.batchId)
    .replace(/{{horizon_days}}/g, String(values.horizonDays))
    .replace(/{{context_json}}/g, values.contextJson)

const buildBatchId = (now: Date) =>
  `pm-${now.toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 8)}`

export interface PostMortemUseCases {
  runPostMortem: (input: {
    mode: 'demo' | 'admin'
    requestId: string
    triggerSource?: string
    now?: Date
  }) => Promise<PostMortemRunSummary>
  listPostMortems: (input: {
    mode: 'demo' | 'admin'
    requestId: string
    limit?: number
  }) => Promise<PostMortemListResponse>
  getPostMortemById: (input: {
    mode: 'demo' | 'admin'
    requestId: string
    postMortemId: number
  }) => Promise<PersistedPostMortemRow | null>
}

export const createPostMortemUseCases = ({
  repository,
  runner,
  budget,
  config,
  demoFixtures,
}: {
  repository: PostMortemRepositoryAdapter
  runner: PostMortemStructuredRunner
  budget: BudgetStateProvider
  config: PostMortemConfig
  demoFixtures: PostMortemDemoFixtures
}): PostMortemUseCases => {
  const buildSkipped = (
    status: PostMortemRunSummaryStatus,
    reason: string,
    extras?: Partial<PostMortemRunSummary>
  ): PostMortemRunSummary => ({
    status,
    feature: 'post_mortem',
    evaluatedAt: new Date().toISOString(),
    totalDue: 0,
    processed: 0,
    remaining: 0,
    persistedIds: [],
    failedItems: 0,
    reason,
    budgetReasons: [],
    ...extras,
  })

  return {
    async listPostMortems(input) {
      if (input.mode === 'demo') {
        return {
          items: demoFixtures.list.map(row => ({
            ...row,
            learningActions: row.learningActions ? [...row.learningActions] : null,
          })),
        }
      }
      return repository.listPostMortems({ limit: input.limit ?? 50 })
    },

    async getPostMortemById(input) {
      if (input.mode === 'demo') {
        const found = demoFixtures.list.find(row => row.id === input.postMortemId)
        if (!found) return null
        return { ...found, learningActions: found.learningActions ? [...found.learningActions] : null }
      }
      return repository.getPostMortemById(input.postMortemId)
    },

    async runPostMortem(input) {
      if (input.mode === 'demo') {
        // Defensive — the route layer also blocks demo POST, but the use-case stays demo-safe.
        throw new Error('Post-mortem runs are admin-only')
      }
      const now = input.now ?? new Date()

      // 1. Feature flag — short-circuit BEFORE budget read or DB read.
      if (!config.enabled) {
        return buildSkipped('skipped_disabled', 'AI_POST_MORTEM_ENABLED is false')
      }

      // 2. Budget gate.
      const budgetState = await budget.fetchBudgetState()
      if (!budgetState.deepAnalysisAllowed) {
        return buildSkipped('skipped_budget_blocked', 'deep_analysis_budget_guard', {
          budgetReasons: [...budgetState.reasons],
        })
      }

      // 3. Pull due contexts. Bounded.
      const limit = Math.max(1, Math.min(config.batchLimit, 100))
      const contexts = await repository.listExpiredContexts({
        now,
        horizonDays: config.horizonDays,
        limit,
      })
      if (contexts.length === 0) {
        return buildSkipped('skipped_no_due_items', 'no_recommendations_due_for_post_mortem')
      }

      const inputSummary = buildInputSummary(contexts, config)
      const userPrompt = renderUserPrompt(POST_MORTEM_PROMPT.userPromptTemplate, {
        schemaVersion: postMortemSchemaVersion,
        batchId: buildBatchId(now),
        horizonDays: config.horizonDays,
        contextJson: JSON.stringify(inputSummary),
      })

      // 4. ONE LLM call for the batch.
      let result: StructuredCompletionResult<unknown>
      try {
        result = await runner.runStructured<unknown>({
          feature: config.feature,
          model: config.model,
          systemPrompt: POST_MORTEM_PROMPT.systemPrompt,
          userPrompt,
          schemaName: postMortemSchemaName,
          schema: POST_MORTEM_PROMPT.schema,
          maxOutputTokens: 4000,
          promptCache: true,
        })
      } catch (error) {
        // Persist a single `failed` row covering the whole batch so the journal stays auditable.
        const evaluatedAt = new Date()
        const persistedIds: number[] = []
        for (const ctx of contexts) {
          const row = await repository.insertPostMortem({
            runId: ctx.runId,
            recommendationId: ctx.recommendationId,
            decisionId: ctx.decisionId,
            recommendationKey: ctx.recommendationKey,
            status: 'failed',
            horizonDays: ctx.horizonDays,
            evaluatedAt,
            expectedOutcomeAt: ctx.expectedOutcomeAt ? new Date(ctx.expectedOutcomeAt) : null,
            inputSummary,
            errorCode: 'llm_call_failed',
            riskNotes: {
              error: error instanceof Error ? error.name : 'unknown',
            },
          })
          persistedIds.push(row.id)
        }
        return {
          status: 'failed',
          feature: 'post_mortem',
          evaluatedAt: evaluatedAt.toISOString(),
          totalDue: contexts.length,
          processed: 0,
          remaining: 0,
          persistedIds,
          failedItems: contexts.length,
          reason: 'llm_call_failed',
          budgetReasons: [],
        }
      }

      // 5. Validate output shape.
      let parsed: PostMortemOutput
      try {
        parsed = validateOutputShape(result.output)
      } catch (error) {
        const code =
          error instanceof PostMortemOutputValidationError ? error.code : 'output_validation_failed'
        const evaluatedAt = new Date()
        const persistedIds: number[] = []
        for (const ctx of contexts) {
          const row = await repository.insertPostMortem({
            runId: ctx.runId,
            recommendationId: ctx.recommendationId,
            decisionId: ctx.decisionId,
            recommendationKey: ctx.recommendationKey,
            status: 'failed',
            horizonDays: ctx.horizonDays,
            evaluatedAt,
            expectedOutcomeAt: ctx.expectedOutcomeAt ? new Date(ctx.expectedOutcomeAt) : null,
            inputSummary,
            errorCode: code.toLowerCase(),
          })
          persistedIds.push(row.id)
        }
        return {
          status: 'failed',
          feature: 'post_mortem',
          evaluatedAt: evaluatedAt.toISOString(),
          totalDue: contexts.length,
          processed: 0,
          remaining: 0,
          persistedIds,
          failedItems: contexts.length,
          reason: code.toLowerCase(),
          budgetReasons: [],
        }
      }

      // 6. Strict execution-directive scan on parsed output.
      const executionTerms = findExecutionTermsInOutput(parsed)
      if (executionTerms.length > 0) {
        const evaluatedAt = new Date()
        const persistedIds: number[] = []
        for (const ctx of contexts) {
          const row = await repository.insertPostMortem({
            runId: ctx.runId,
            recommendationId: ctx.recommendationId,
            decisionId: ctx.decisionId,
            recommendationKey: ctx.recommendationKey,
            status: 'failed',
            horizonDays: ctx.horizonDays,
            evaluatedAt,
            expectedOutcomeAt: ctx.expectedOutcomeAt ? new Date(ctx.expectedOutcomeAt) : null,
            inputSummary,
            // We deliberately do NOT persist learningActions — they're tainted.
            riskNotes: {
              executionTerms,
              detectedBy: 'post_mortem_strict_banlist',
            },
            errorCode: 'execution_directive_emitted',
          })
          persistedIds.push(row.id)
        }
        return {
          status: 'failed',
          feature: 'post_mortem',
          evaluatedAt: evaluatedAt.toISOString(),
          totalDue: contexts.length,
          processed: 0,
          remaining: 0,
          persistedIds,
          failedItems: contexts.length,
          reason: 'execution_directive_emitted',
          budgetReasons: [],
        }
      }

      // 7. Happy path. Persist one row per due item with the same findings/calibration.
      const evaluatedAt = new Date()
      const persistedIds: number[] = []
      for (const ctx of contexts) {
        const row = await repository.insertPostMortem({
          runId: ctx.runId,
          recommendationId: ctx.recommendationId,
          decisionId: ctx.decisionId,
          recommendationKey: ctx.recommendationKey,
          status: 'completed',
          horizonDays: ctx.horizonDays,
          evaluatedAt,
          expectedOutcomeAt: ctx.expectedOutcomeAt ? new Date(ctx.expectedOutcomeAt) : null,
          inputSummary,
          findings: {
            summary: parsed.summary,
            overallOutcome: parsed.overallOutcome,
            evidenceReview: parsed.evidenceReview,
            outcomeDrivers: parsed.outcomeDrivers,
            lessons: parsed.lessons,
          },
          calibration: parsed.confidenceCalibration as unknown as Record<string, unknown>,
          learningActions: parsed.learningActions as unknown as Array<Record<string, unknown>>,
          riskNotes: {
            // PR4 ships persistence only; graph ingest of LearningAction / DecisionPoint is
            // deferred. The persisted row is the source of truth for now.
            graphIngest: 'deferred',
            scope: 'advisory-only',
          },
        })
        persistedIds.push(row.id)
      }

      return {
        status: 'completed',
        feature: 'post_mortem',
        evaluatedAt: evaluatedAt.toISOString(),
        totalDue: contexts.length,
        processed: contexts.length,
        remaining: 0,
        persistedIds,
        failedItems: 0,
        reason: null,
        budgetReasons: [],
      }
    },
  }
}
