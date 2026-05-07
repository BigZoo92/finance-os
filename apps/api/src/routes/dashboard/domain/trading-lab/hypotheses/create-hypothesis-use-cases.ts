// Manual Hypothesis Lab — minimal use-cases backed by existing Trading Lab tables.
//
// Per ADR `docs/adr/advisor-learning-loop.md` (PR3): no new table is created. A "manual
// hypothesis" is a `tradingLabStrategy` row with `strategyType = 'manual-hypothesis'`. Paper
// scenarios for a hypothesis are `tradingLabPaperScenario` rows linked via `linkedStrategyId`.
//
// This module is a thin adapter on top of the existing repository — it does not duplicate
// persistence, backtest logic, signal links, or the demo fixture surface.

import type { schema } from '@finance-os/db'
import {
  HypothesisExecutionInstructionError,
  scanForExecutionInstruction,
} from './detect-execution-instruction'

// Re-export the stable string used to identify manual hypotheses inside the strategy table.
export const MANUAL_HYPOTHESIS_TYPE = 'manual-hypothesis' as const

// Allow only paper-friendly strategy lifecycle states for hypotheses.
export const ALLOWED_HYPOTHESIS_STATUSES = ['draft', 'active-paper', 'archived'] as const
export type ManualHypothesisStatus = (typeof ALLOWED_HYPOTHESIS_STATUSES)[number]

const isAllowedStatus = (value: string): value is ManualHypothesisStatus =>
  (ALLOWED_HYPOTHESIS_STATUSES as readonly string[]).includes(value)

export class HypothesisValidationError extends Error {
  readonly code: string
  readonly field: string

  constructor({ code, field, message }: { code: string; field: string; message: string }) {
    super(message)
    this.name = 'HypothesisValidationError'
    this.code = code
    this.field = field
  }
}

export const isHypothesisValidationError = (
  error: unknown
): error is HypothesisValidationError => error instanceof HypothesisValidationError

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

type StrategyRow = typeof schema.tradingLabStrategy.$inferSelect
type ScenarioRow = typeof schema.tradingLabPaperScenario.$inferSelect

// Hypothesis-specific data lives under a stable namespaced key on the strategy's existing
// `parameters` jsonb. PR4 Post-Mortem will read these fields by structured key — they must not
// rely on string-prefix parsing of the `caveats` array.
export interface HypothesisExtras {
  thesis: string | null
  invalidationCriteria: string[]
  evidenceNotes?: string[]
  horizon?: string | null
}

export const HYPOTHESIS_PARAMETERS_KEY = 'hypothesis' as const

export interface ManualHypothesisCreateInput {
  name: string
  slug: string
  description?: string | null
  thesis?: string | null
  assumptions?: string[]
  caveats?: string[]
  // At least one invalidation criterion is required for a manual hypothesis. Persisted under
  // `parameters.hypothesis.invalidationCriteria` (structured) — never as a `caveats` prefix.
  invalidationCriteria: string[]
  evidenceNotes?: string[]
  horizon?: string | null
  entryRules?: Array<{ id: string; description: string; condition: string }>
  exitRules?: Array<{ id: string; description: string; condition: string }>
  riskRules?: Array<{ id: string; description: string; condition: string }>
  parameters?: Record<string, unknown>
  indicators?: Array<{ name: string; params: Record<string, unknown> }>
  tags?: string[]
  status?: ManualHypothesisStatus
}

export interface ManualHypothesisUpdateInput {
  name?: string
  description?: string | null
  thesis?: string | null
  assumptions?: string[]
  caveats?: string[]
  invalidationCriteria?: string[]
  evidenceNotes?: string[]
  horizon?: string | null
  entryRules?: Array<{ id: string; description: string; condition: string }>
  exitRules?: Array<{ id: string; description: string; condition: string }>
  riskRules?: Array<{ id: string; description: string; condition: string }>
  parameters?: Record<string, unknown>
  indicators?: Array<{ name: string; params: Record<string, unknown> }>
  tags?: string[]
  status?: ManualHypothesisStatus
}

export interface ManualHypothesisScenarioInput {
  name: string
  description?: string | null
  thesis?: string | null
  expectedOutcome?: string | null
  // Optional on input. When omitted, falls back to the parent hypothesis's
  // `parameters.hypothesis.invalidationCriteria` joined into a single string. The scenario row
  // still owns its own `invalidationCriteria` once persisted.
  invalidationCriteria?: string
  riskNotes?: string | null
  linkedSignalItemId?: number | null
  linkedNewsArticleId?: number | null
}

// Safe reader for the structured hypothesis sub-object on a strategy's parameters. Returns
// well-typed defaults when fields are missing or malformed.
export const readHypothesisExtras = (
  parameters: Record<string, unknown> | null | undefined
): HypothesisExtras => {
  const raw = parameters?.[HYPOTHESIS_PARAMETERS_KEY] as Record<string, unknown> | undefined
  const thesis = typeof raw?.thesis === 'string' ? raw.thesis : null
  const invalidationCriteria = Array.isArray(raw?.invalidationCriteria)
    ? raw.invalidationCriteria.filter((v): v is string => typeof v === 'string')
    : []
  const evidenceNotes = Array.isArray(raw?.evidenceNotes)
    ? raw.evidenceNotes.filter((v): v is string => typeof v === 'string')
    : undefined
  const horizon = typeof raw?.horizon === 'string' ? raw.horizon : null
  const out: HypothesisExtras = { thesis, invalidationCriteria }
  if (evidenceNotes !== undefined) out.evidenceNotes = evidenceNotes
  if (horizon !== null) out.horizon = horizon
  return out
}

// ---------------------------------------------------------------------------
// Repository contract — narrow shape tied to existing methods on the trading-lab repository.
// We keep this as an interface so tests can supply a fake without touching DB code.
// ---------------------------------------------------------------------------

export interface HypothesesRepositoryAdapter {
  listStrategies: (opts?: {
    status?: string
    limit?: number
  }) => Promise<StrategyRow[]>
  getStrategy: (id: number) => Promise<StrategyRow | null>
  createStrategy: (input: {
    name: string
    slug: string
    description?: string
    strategyType?: string
    status?: string
    enabled?: boolean
    tags?: string[]
    parameters?: Record<string, unknown>
    indicators?: Array<{ name: string; params: Record<string, unknown> }>
    entryRules?: Array<{ id: string; description: string; condition: string }>
    exitRules?: Array<{ id: string; description: string; condition: string }>
    riskRules?: Array<{ id: string; description: string; condition: string }>
    assumptions?: string[]
    caveats?: string[]
  }) => Promise<StrategyRow>
  updateStrategy: (
    id: number,
    input: Record<string, unknown>
  ) => Promise<StrategyRow | null>
  archiveStrategy: (id: number) => Promise<StrategyRow | null>
  createScenario: (input: {
    name: string
    description?: string
    linkedSignalItemId?: number
    linkedNewsArticleId?: number
    linkedStrategyId?: number
    thesis?: string
    expectedOutcome?: string
    invalidationCriteria?: string
    riskNotes?: string
  }) => Promise<ScenarioRow>
}

// ---------------------------------------------------------------------------
// Validation helpers (input-side, deterministic)
// ---------------------------------------------------------------------------

const NAME_MAX = 120
const DESCRIPTION_MAX = 4000
const THESIS_MAX = 2000
const RULE_DESCRIPTION_MAX = 400
const STRING_LIST_ITEM_MAX = 400
const STRING_LIST_MAX_ITEMS = 32
const SCENARIO_INVALIDATION_MAX = 1200

const requireText = ({ field, value, max }: { field: string; value: string; max: number }) => {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    throw new HypothesisValidationError({
      code: 'EMPTY_FIELD',
      field,
      message: `${field} must not be empty.`,
    })
  }
  if (trimmed.length > max) {
    throw new HypothesisValidationError({
      code: 'FIELD_TOO_LONG',
      field,
      message: `${field} exceeds maximum length of ${max} characters.`,
    })
  }
  return trimmed
}

const validateStringList = (
  field: string,
  values: readonly string[] | undefined,
  { max = STRING_LIST_MAX_ITEMS, itemMax = STRING_LIST_ITEM_MAX }: { max?: number; itemMax?: number } = {}
): string[] => {
  const list = (values ?? []).map(v => v.trim()).filter(v => v.length > 0)
  if (list.length > max) {
    throw new HypothesisValidationError({
      code: 'FIELD_TOO_LONG',
      field,
      message: `${field} exceeds maximum item count of ${max}.`,
    })
  }
  for (const item of list) {
    if (item.length > itemMax) {
      throw new HypothesisValidationError({
        code: 'FIELD_TOO_LONG',
        field,
        message: `${field} contains an item exceeding ${itemMax} characters.`,
      })
    }
  }
  return list
}

const validateRules = (
  field: string,
  rules: readonly { id: string; description: string; condition: string }[] | undefined
): Array<{ id: string; description: string; condition: string }> => {
  const list = rules ?? []
  if (list.length > STRING_LIST_MAX_ITEMS) {
    throw new HypothesisValidationError({
      code: 'FIELD_TOO_LONG',
      field,
      message: `${field} exceeds maximum rule count of ${STRING_LIST_MAX_ITEMS}.`,
    })
  }
  return list.map((rule, index) => {
    const id = requireText({
      field: `${field}[${index}].id`,
      value: rule.id,
      max: 80,
    })
    const description = requireText({
      field: `${field}[${index}].description`,
      value: rule.description,
      max: RULE_DESCRIPTION_MAX,
    })
    const condition = requireText({
      field: `${field}[${index}].condition`,
      value: rule.condition,
      max: RULE_DESCRIPTION_MAX,
    })
    return { id, description, condition }
  })
}

// Collect every text field from a payload so the execution-instruction scanner can scan all of
// them in one pass. Numbers, booleans, structured objects with non-text fields are skipped.
const collectTextsForScan = (input: Record<string, unknown>): string[] => {
  const out: string[] = []
  const visit = (node: unknown): void => {
    if (typeof node === 'string') {
      if (node.trim().length > 0) out.push(node)
    } else if (Array.isArray(node)) {
      for (const v of node) visit(v)
    } else if (node && typeof node === 'object') {
      for (const v of Object.values(node)) visit(v)
    }
  }
  visit(input)
  return out
}

const ensureNoExecutionInstruction = (input: Record<string, unknown>): void => {
  const result = scanForExecutionInstruction(collectTextsForScan(input))
  if (result.rejected) {
    throw new HypothesisExecutionInstructionError(result.matches)
  }
}

// ---------------------------------------------------------------------------
// Use-case factory
// ---------------------------------------------------------------------------

export const createHypothesisUseCases = ({
  repository,
}: {
  repository: HypothesesRepositoryAdapter
}) => {
  const isManualHypothesis = (row: StrategyRow): boolean =>
    row.strategyType === MANUAL_HYPOTHESIS_TYPE

  const ensureManualHypothesis = (row: StrategyRow | null): StrategyRow | null => {
    if (!row) return null
    if (!isManualHypothesis(row)) return null
    return row
  }

  return {
    async listManualHypotheses(opts?: {
      status?: ManualHypothesisStatus
      limit?: number
    }): Promise<StrategyRow[]> {
      const all = await repository.listStrategies({
        ...(opts?.status ? { status: opts.status } : {}),
        ...(typeof opts?.limit === 'number' ? { limit: opts.limit } : {}),
      })
      return all.filter(isManualHypothesis)
    },

    async getManualHypothesisById(id: number): Promise<StrategyRow | null> {
      return ensureManualHypothesis(await repository.getStrategy(id))
    },

    async createManualHypothesis(input: ManualHypothesisCreateInput): Promise<StrategyRow> {
      const name = requireText({ field: 'name', value: input.name, max: NAME_MAX })
      const slug = requireText({ field: 'slug', value: input.slug, max: NAME_MAX })

      // Reject obvious execution-instruction payloads before anything else.
      ensureNoExecutionInstruction({
        name,
        slug,
        description: input.description ?? '',
        thesis: input.thesis ?? '',
        assumptions: input.assumptions ?? [],
        caveats: input.caveats ?? [],
        invalidationCriteria: input.invalidationCriteria,
        evidenceNotes: input.evidenceNotes ?? [],
        horizon: input.horizon ?? '',
        entryRules: input.entryRules ?? [],
        exitRules: input.exitRules ?? [],
        riskRules: input.riskRules ?? [],
        tags: input.tags ?? [],
      })

      const description =
        input.description !== undefined && input.description !== null
          ? requireText({ field: 'description', value: input.description, max: DESCRIPTION_MAX })
          : undefined
      const thesis =
        input.thesis !== undefined && input.thesis !== null
          ? requireText({ field: 'thesis', value: input.thesis, max: THESIS_MAX })
          : null

      const assumptions = validateStringList('assumptions', input.assumptions)
      const caveats = validateStringList('caveats', input.caveats)

      const invalidationCriteria = validateStringList(
        'invalidationCriteria',
        input.invalidationCriteria
      )
      if (invalidationCriteria.length === 0) {
        throw new HypothesisValidationError({
          code: 'INVALIDATION_CRITERIA_REQUIRED',
          field: 'invalidationCriteria',
          message: 'A manual hypothesis requires at least one invalidation criterion.',
        })
      }

      const evidenceNotes =
        input.evidenceNotes !== undefined
          ? validateStringList('evidenceNotes', input.evidenceNotes)
          : undefined
      const horizon =
        input.horizon !== undefined && input.horizon !== null
          ? requireText({ field: 'horizon', value: input.horizon, max: 240 })
          : null

      const entryRules = validateRules('entryRules', input.entryRules)
      const exitRules = validateRules('exitRules', input.exitRules)
      const riskRules = validateRules('riskRules', input.riskRules)
      const tags = validateStringList('tags', input.tags, { max: 24, itemMax: 80 })

      const status = input.status ?? 'draft'
      if (!isAllowedStatus(status)) {
        throw new HypothesisValidationError({
          code: 'INVALID_STATUS',
          field: 'status',
          message: `status must be one of: ${ALLOWED_HYPOTHESIS_STATUSES.join(', ')}.`,
        })
      }

      // Hypothesis-specific data lives in `parameters.hypothesis` (structured), preserving any
      // user-supplied parameter keys alongside it. Caveats remain free-form and human-readable.
      const hypothesisExtras: HypothesisExtras = {
        thesis,
        invalidationCriteria,
        ...(evidenceNotes !== undefined ? { evidenceNotes } : {}),
        ...(horizon !== null ? { horizon } : {}),
      }
      const persistedParameters: Record<string, unknown> = {
        ...(input.parameters ?? {}),
        [HYPOTHESIS_PARAMETERS_KEY]: hypothesisExtras,
      }

      return repository.createStrategy({
        name,
        slug,
        ...(description !== undefined ? { description } : {}),
        strategyType: MANUAL_HYPOTHESIS_TYPE,
        status,
        tags,
        parameters: persistedParameters,
        ...(input.indicators ? { indicators: input.indicators } : {}),
        entryRules,
        exitRules,
        riskRules,
        assumptions,
        caveats,
      })
    },

    async updateManualHypothesis(
      id: number,
      input: ManualHypothesisUpdateInput
    ): Promise<StrategyRow | null> {
      const existing = await repository.getStrategy(id)
      if (!existing || !isManualHypothesis(existing)) {
        return null
      }

      ensureNoExecutionInstruction({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined && input.description !== null
          ? { description: input.description }
          : {}),
        ...(input.thesis !== undefined && input.thesis !== null ? { thesis: input.thesis } : {}),
        ...(input.assumptions !== undefined ? { assumptions: input.assumptions } : {}),
        ...(input.caveats !== undefined ? { caveats: input.caveats } : {}),
        ...(input.invalidationCriteria !== undefined
          ? { invalidationCriteria: input.invalidationCriteria }
          : {}),
        ...(input.evidenceNotes !== undefined ? { evidenceNotes: input.evidenceNotes } : {}),
        ...(input.horizon !== undefined && input.horizon !== null ? { horizon: input.horizon } : {}),
        ...(input.entryRules !== undefined ? { entryRules: input.entryRules } : {}),
        ...(input.exitRules !== undefined ? { exitRules: input.exitRules } : {}),
        ...(input.riskRules !== undefined ? { riskRules: input.riskRules } : {}),
        ...(input.tags !== undefined ? { tags: input.tags } : {}),
      })

      const patch: Record<string, unknown> = {}

      if (input.name !== undefined) {
        patch.name = requireText({ field: 'name', value: input.name, max: NAME_MAX })
      }
      if (input.description !== undefined) {
        patch.description =
          input.description === null
            ? null
            : requireText({
                field: 'description',
                value: input.description,
                max: DESCRIPTION_MAX,
              })
      }
      if (input.assumptions !== undefined) {
        patch.assumptions = validateStringList('assumptions', input.assumptions)
      }
      if (input.entryRules !== undefined) {
        patch.entryRules = validateRules('entryRules', input.entryRules)
      }
      if (input.exitRules !== undefined) {
        patch.exitRules = validateRules('exitRules', input.exitRules)
      }
      if (input.riskRules !== undefined) {
        patch.riskRules = validateRules('riskRules', input.riskRules)
      }
      if (input.tags !== undefined) {
        patch.tags = validateStringList('tags', input.tags, { max: 24, itemMax: 80 })
      }
      if (input.indicators !== undefined) {
        patch.indicators = input.indicators
      }
      if (input.caveats !== undefined) {
        // Caveats are now strictly free-form, human-readable strings — no `invalidation: ` prefix.
        patch.caveats = validateStringList('caveats', input.caveats)
      }

      // Parameters merge: start from existing params, layer user-supplied non-hypothesis keys,
      // then layer any hypothesis-specific input on top of `parameters.hypothesis`.
      const hypothesisFieldsTouched =
        input.thesis !== undefined ||
        input.invalidationCriteria !== undefined ||
        input.evidenceNotes !== undefined ||
        input.horizon !== undefined
      if (input.parameters !== undefined || hypothesisFieldsTouched) {
        const baseParams: Record<string, unknown> = {
          ...((existing.parameters as Record<string, unknown> | null | undefined) ?? {}),
        }
        if (input.parameters !== undefined) {
          // Shallow-merge user keys; protect the reserved hypothesis sub-object — hypothesis
          // edits go through the dedicated input fields, never via raw `parameters.hypothesis`.
          for (const [k, v] of Object.entries(input.parameters)) {
            if (k === HYPOTHESIS_PARAMETERS_KEY) continue
            baseParams[k] = v
          }
        }
        if (hypothesisFieldsTouched) {
          const existingExtras = readHypothesisExtras(
            existing.parameters as Record<string, unknown> | null | undefined
          )
          const nextThesis =
            input.thesis === undefined
              ? existingExtras.thesis
              : input.thesis === null
                ? null
                : requireText({ field: 'thesis', value: input.thesis, max: THESIS_MAX })

          let nextInvalidation: string[]
          if (input.invalidationCriteria !== undefined) {
            const validated = validateStringList(
              'invalidationCriteria',
              input.invalidationCriteria
            )
            if (validated.length === 0) {
              throw new HypothesisValidationError({
                code: 'INVALIDATION_CRITERIA_REQUIRED',
                field: 'invalidationCriteria',
                message: 'A manual hypothesis requires at least one invalidation criterion.',
              })
            }
            nextInvalidation = validated
          } else {
            nextInvalidation = existingExtras.invalidationCriteria
          }

          const nextEvidenceNotes =
            input.evidenceNotes === undefined
              ? existingExtras.evidenceNotes
              : validateStringList('evidenceNotes', input.evidenceNotes)
          const nextHorizon =
            input.horizon === undefined
              ? (existingExtras.horizon ?? null)
              : input.horizon === null
                ? null
                : requireText({ field: 'horizon', value: input.horizon, max: 240 })

          const merged: HypothesisExtras = {
            thesis: nextThesis,
            invalidationCriteria: nextInvalidation,
            ...(nextEvidenceNotes !== undefined && nextEvidenceNotes.length > 0
              ? { evidenceNotes: nextEvidenceNotes }
              : {}),
            ...(nextHorizon !== null ? { horizon: nextHorizon } : {}),
          }
          baseParams[HYPOTHESIS_PARAMETERS_KEY] = merged
        } else {
          // No hypothesis-specific edits in this update — preserve existing hypothesis sub-object.
          const existingExtras = readHypothesisExtras(
            existing.parameters as Record<string, unknown> | null | undefined
          )
          baseParams[HYPOTHESIS_PARAMETERS_KEY] = {
            thesis: existingExtras.thesis,
            invalidationCriteria: existingExtras.invalidationCriteria,
            ...(existingExtras.evidenceNotes !== undefined && existingExtras.evidenceNotes.length > 0
              ? { evidenceNotes: existingExtras.evidenceNotes }
              : {}),
            ...(existingExtras.horizon !== null && existingExtras.horizon !== undefined
              ? { horizon: existingExtras.horizon }
              : {}),
          } satisfies HypothesisExtras
        }
        patch.parameters = baseParams
      }

      if (input.status !== undefined) {
        if (!isAllowedStatus(input.status)) {
          throw new HypothesisValidationError({
            code: 'INVALID_STATUS',
            field: 'status',
            message: `status must be one of: ${ALLOWED_HYPOTHESIS_STATUSES.join(', ')}.`,
          })
        }
        patch.status = input.status
      }

      if (Object.keys(patch).length === 0) {
        return existing
      }

      return repository.updateStrategy(id, patch)
    },

    async archiveManualHypothesis(id: number): Promise<StrategyRow | null> {
      const existing = await repository.getStrategy(id)
      if (!existing || !isManualHypothesis(existing)) {
        return null
      }
      return repository.archiveStrategy(id)
    },

    async createScenarioForHypothesis(
      hypothesisId: number,
      input: ManualHypothesisScenarioInput
    ): Promise<ScenarioRow | null> {
      const existing = await repository.getStrategy(hypothesisId)
      if (!existing || !isManualHypothesis(existing)) {
        return null
      }

      ensureNoExecutionInstruction({
        name: input.name,
        ...(input.description !== undefined && input.description !== null
          ? { description: input.description }
          : {}),
        ...(input.thesis !== undefined && input.thesis !== null ? { thesis: input.thesis } : {}),
        ...(input.expectedOutcome !== undefined && input.expectedOutcome !== null
          ? { expectedOutcome: input.expectedOutcome }
          : {}),
        ...(input.riskNotes !== undefined && input.riskNotes !== null
          ? { riskNotes: input.riskNotes }
          : {}),
        ...(input.invalidationCriteria !== undefined
          ? { invalidationCriteria: input.invalidationCriteria }
          : {}),
      })

      const name = requireText({ field: 'name', value: input.name, max: NAME_MAX })

      // If the scenario doesn't supply its own invalidation criteria, fall back to the parent
      // hypothesis's structured `parameters.hypothesis.invalidationCriteria`. The scenario row
      // still owns its own value once persisted.
      const explicitInvalidation = input.invalidationCriteria?.trim()
      let invalidationCriteria: string
      if (explicitInvalidation && explicitInvalidation.length > 0) {
        invalidationCriteria = requireText({
          field: 'invalidationCriteria',
          value: explicitInvalidation,
          max: SCENARIO_INVALIDATION_MAX,
        })
      } else {
        const inherited = readHypothesisExtras(
          existing.parameters as Record<string, unknown> | null | undefined
        ).invalidationCriteria
        if (inherited.length === 0) {
          throw new HypothesisValidationError({
            code: 'INVALIDATION_CRITERIA_REQUIRED',
            field: 'invalidationCriteria',
            message:
              'Scenario invalidationCriteria is required when the parent hypothesis has none configured.',
          })
        }
        const joined = inherited.join('; ')
        invalidationCriteria =
          joined.length > SCENARIO_INVALIDATION_MAX
            ? joined.slice(0, SCENARIO_INVALIDATION_MAX)
            : joined
      }

      const description =
        input.description !== undefined && input.description !== null
          ? requireText({ field: 'description', value: input.description, max: DESCRIPTION_MAX })
          : undefined
      const thesis =
        input.thesis !== undefined && input.thesis !== null
          ? requireText({ field: 'thesis', value: input.thesis, max: THESIS_MAX })
          : undefined
      const expectedOutcome =
        input.expectedOutcome !== undefined && input.expectedOutcome !== null
          ? requireText({
              field: 'expectedOutcome',
              value: input.expectedOutcome,
              max: THESIS_MAX,
            })
          : undefined
      const riskNotes =
        input.riskNotes !== undefined && input.riskNotes !== null
          ? requireText({ field: 'riskNotes', value: input.riskNotes, max: THESIS_MAX })
          : undefined

      return repository.createScenario({
        name,
        ...(description !== undefined ? { description } : {}),
        linkedStrategyId: hypothesisId,
        ...(typeof input.linkedSignalItemId === 'number'
          ? { linkedSignalItemId: input.linkedSignalItemId }
          : {}),
        ...(typeof input.linkedNewsArticleId === 'number'
          ? { linkedNewsArticleId: input.linkedNewsArticleId }
          : {}),
        ...(thesis !== undefined ? { thesis } : {}),
        ...(expectedOutcome !== undefined ? { expectedOutcome } : {}),
        invalidationCriteria,
        ...(riskNotes !== undefined ? { riskNotes } : {}),
      })
    },
  }
}

export type HypothesisUseCases = ReturnType<typeof createHypothesisUseCases>
