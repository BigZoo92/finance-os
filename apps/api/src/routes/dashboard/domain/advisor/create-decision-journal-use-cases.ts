import {
  getAdvisorDecisionJournalEntryMock,
  getAdvisorDecisionJournalMock,
} from '../../../../mocks/advisorDecisionJournal.mock'
import type {
  DashboardAdvisorDecisionJournalCreateInput,
  DashboardAdvisorDecisionJournalEntryResponse,
  DashboardAdvisorDecisionJournalListResponse,
  DashboardAdvisorDecisionOutcomeCreateInput,
  DashboardAdvisorDecisionOutcomeResponse,
} from '../../advisor-contract'
import type { DashboardAdvisorRepository } from '../../types'

const DEFAULT_DECIDED_BY = 'admin'
const FREE_NOTE_MAX_LENGTH = 2000

export class DecisionJournalValidationError extends Error {
  readonly code: string
  readonly field: string

  constructor({ code, field, message }: { code: string; field: string; message: string }) {
    super(message)
    this.name = 'DecisionJournalValidationError'
    this.code = code
    this.field = field
  }
}

export const isDecisionJournalValidationError = (
  error: unknown
): error is DecisionJournalValidationError => error instanceof DecisionJournalValidationError

const truncateFreeNote = (value: string | null | undefined): string | null => {
  if (value === undefined || value === null) {
    return null
  }
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return null
  }
  return trimmed.length > FREE_NOTE_MAX_LENGTH ? trimmed.slice(0, FREE_NOTE_MAX_LENGTH) : trimmed
}

const parseExpectedOutcome = (value: string | null | undefined): Date | null => {
  if (value === undefined || value === null || value === '') {
    return null
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new DecisionJournalValidationError({
      code: 'INVALID_EXPECTED_OUTCOME_AT',
      field: 'expectedOutcomeAt',
      message: 'expectedOutcomeAt must be a valid ISO 8601 timestamp.',
    })
  }
  return date
}

// Newest-first by decidedAt, ties broken by id descending. Mirrors the SQL ordering applied by
// the admin path (`desc(decidedAt), desc(id)`) so demo and admin responses share the same
// ordering contract.
const sortJournalEntriesNewestFirst = (
  entries: DashboardAdvisorDecisionJournalEntryResponse[]
): DashboardAdvisorDecisionJournalEntryResponse[] =>
  [...entries].sort((a, b) => {
    if (a.decidedAt !== b.decidedAt) {
      return a.decidedAt < b.decidedAt ? 1 : -1
    }
    return b.id - a.id
  })

const filterDemoList = (
  list: DashboardAdvisorDecisionJournalListResponse,
  filters: {
    recommendationId?: number | null
    runId?: number | null
    decision?: 'accepted' | 'rejected' | 'deferred' | 'ignored' | null
    limit?: number
  }
): DashboardAdvisorDecisionJournalListResponse => {
  let items = list.items
  if (typeof filters.recommendationId === 'number') {
    items = items.filter(item => item.recommendationId === filters.recommendationId)
  }
  if (typeof filters.runId === 'number') {
    items = items.filter(item => item.runId === filters.runId)
  }
  if (filters.decision) {
    items = items.filter(item => item.decision === filters.decision)
  }
  items = sortJournalEntriesNewestFirst(items)
  if (typeof filters.limit === 'number' && filters.limit > 0) {
    items = items.slice(0, Math.min(filters.limit, items.length))
  }
  return { items }
}

export const createDecisionJournalUseCases = ({
  repository,
}: {
  repository: DashboardAdvisorRepository
}) => ({
  async listAdvisorDecisionJournal(input: {
    mode: 'demo' | 'admin'
    requestId: string
    limit?: number
    recommendationId?: number | null
    runId?: number | null
    decision?: 'accepted' | 'rejected' | 'deferred' | 'ignored' | null
  }): Promise<DashboardAdvisorDecisionJournalListResponse> {
    if (input.mode === 'demo') {
      return filterDemoList(getAdvisorDecisionJournalMock(), {
        ...(input.recommendationId !== undefined
          ? { recommendationId: input.recommendationId }
          : {}),
        ...(input.runId !== undefined ? { runId: input.runId } : {}),
        ...(input.decision !== undefined ? { decision: input.decision } : {}),
        ...(input.limit !== undefined ? { limit: input.limit } : {}),
      })
    }

    return repository.listDecisionJournalEntries({
      limit: input.limit ?? 50,
      ...(input.recommendationId !== undefined
        ? { recommendationId: input.recommendationId }
        : {}),
      ...(input.runId !== undefined ? { runId: input.runId } : {}),
      ...(input.decision !== undefined ? { decision: input.decision } : {}),
      scope: 'admin',
    })
  },

  async getAdvisorDecisionJournalEntry(input: {
    mode: 'demo' | 'admin'
    requestId: string
    decisionId: number
  }): Promise<DashboardAdvisorDecisionJournalEntryResponse | null> {
    if (input.mode === 'demo') {
      return getAdvisorDecisionJournalEntryMock(input.decisionId)
    }
    return repository.getDecisionJournalEntryById(input.decisionId)
  },

  async createAdvisorDecisionJournalEntry(
    input: { mode: 'demo' | 'admin'; requestId: string } & DashboardAdvisorDecisionJournalCreateInput
  ): Promise<DashboardAdvisorDecisionJournalEntryResponse> {
    if (input.mode === 'demo') {
      throw new Error('Decision journal mutations are admin-only')
    }

    const decidedBy = input.decidedBy?.trim() || DEFAULT_DECIDED_BY
    const expectedOutcomeAt = parseExpectedOutcome(input.expectedOutcomeAt)
    const freeNote = truncateFreeNote(input.freeNote)

    return repository.createDecisionJournalEntry({
      ...(input.recommendationId !== undefined
        ? { recommendationId: input.recommendationId }
        : {}),
      ...(input.runId !== undefined ? { runId: input.runId } : {}),
      ...(input.recommendationKey !== undefined
        ? { recommendationKey: input.recommendationKey }
        : {}),
      decision: input.decision,
      reasonCode: input.reasonCode,
      freeNote,
      decidedBy,
      expectedOutcomeAt,
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      scope: 'admin',
    })
  },

  async createAdvisorDecisionOutcome(
    input: {
      mode: 'demo' | 'admin'
      requestId: string
      decisionId: number
    } & DashboardAdvisorDecisionOutcomeCreateInput
  ): Promise<DashboardAdvisorDecisionOutcomeResponse> {
    if (input.mode === 'demo') {
      throw new Error('Decision outcome mutations are admin-only')
    }

    const freeNote = truncateFreeNote(input.freeNote)

    return repository.createDecisionOutcome({
      decisionId: input.decisionId,
      outcomeKind: input.outcomeKind,
      ...(input.deltaMetrics !== undefined ? { deltaMetrics: input.deltaMetrics } : {}),
      ...(input.learningTags !== undefined ? { learningTags: input.learningTags } : {}),
      freeNote,
    })
  },
})
