/**
 * PR8 — Advisor Learning Loop graph ingest.
 *
 * Best-effort enrichment of the knowledge graph with DecisionPoint and
 * LearningAction nodes derived from advisor_decision_journal and
 * advisor_post_mortem rows. Postgres is canonical; the graph is a derived
 * memory surface. Both helpers fail-soft: errors NEVER bubble up to the
 * caller and NEVER block the parent transaction.
 *
 * Hard constraints:
 *  - scope='advisory-only' is included as a tag on every node (the Python
 *    adapter also re-asserts this).
 *  - No raw provider payloads, no full prompts/responses, no secrets.
 *  - Free-form notes are clamped client-side to 480 chars before sending.
 *  - Disabled by default if KNOWLEDGE_SERVICE_ENABLED=false; gated again by
 *    ADVISOR_GRAPH_INGEST_ENABLED so ops can disable advisor graph ingest
 *    without disabling the whole service.
 */

const FREE_NOTE_MAX = 480

const clampNote = (value: string | null | undefined): string | undefined => {
  if (!value) return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return trimmed.length > FREE_NOTE_MAX ? `${trimmed.slice(0, FREE_NOTE_MAX - 1)}…` : trimmed
}

const toIso = (value: Date | string | null | undefined): string | undefined => {
  if (!value) return undefined
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toISOString()
}

export interface DecisionPointGraphInput {
  decisionId: number
  decision: 'accepted' | 'rejected' | 'deferred' | 'ignored'
  reasonCode: string
  decidedAt: Date | string
  decidedBy?: string | null
  expectedOutcomeAt?: Date | string | null
  recommendationId?: number | null
  recommendationKey?: string | null
  runId?: number | null
  freeNote?: string | null
}

export interface LearningActionGraphInput {
  postMortemId: number
  actionIndex: number
  title: string
  description?: string | null
  appliesTo?: string[]
  status: 'validates_recommendation' | 'invalidates_recommendation' | 'neutral'
  confidence?: number
  recommendationId?: number | null
  recommendationKey?: string | null
  decisionId?: number | null
  runId?: number | null
  evaluatedAt?: Date | string | null
}

export interface GraphIngestResult {
  ok: boolean
  reason?: string
}

const sendAdvisorIngest = async ({
  knowledgeServiceUrl,
  knowledgeServiceEnabled,
  ingestEnabled,
  requestId,
  body,
  timeoutMs,
}: {
  knowledgeServiceUrl: string
  knowledgeServiceEnabled: boolean
  ingestEnabled: boolean
  requestId: string
  body: Record<string, unknown>
  timeoutMs: number
}): Promise<GraphIngestResult> => {
  if (!knowledgeServiceEnabled) return { ok: false, reason: 'knowledge_service_disabled' }
  if (!ingestEnabled) return { ok: false, reason: 'graph_ingest_disabled' }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const response = await fetch(`${knowledgeServiceUrl}/knowledge/ingest/advisor`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-request-id': requestId,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (!response.ok) {
      return { ok: false, reason: `knowledge_service_status_${response.status}` }
    }
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      reason:
        error instanceof Error
          ? `knowledge_service_error:${error.message.slice(0, 60)}`
          : 'knowledge_service_error',
    }
  }
}

export const sendDecisionPointToKnowledgeGraph = async ({
  knowledgeServiceUrl,
  knowledgeServiceEnabled,
  ingestEnabled,
  requestId,
  input,
  timeoutMs = 5_000,
}: {
  knowledgeServiceUrl: string
  knowledgeServiceEnabled: boolean
  ingestEnabled: boolean
  requestId: string
  input: DecisionPointGraphInput
  timeoutMs?: number
}): Promise<GraphIngestResult> => {
  const decidedAtIso = toIso(input.decidedAt)
  if (!decidedAtIso) return { ok: false, reason: 'invalid_decided_at' }

  const compact = {
    decisionId: input.decisionId,
    decision: input.decision,
    reasonCode: input.reasonCode,
    decidedAt: decidedAtIso,
    ...(input.decidedBy !== undefined && input.decidedBy !== null
      ? { decidedBy: input.decidedBy }
      : {}),
    ...(input.expectedOutcomeAt !== undefined && input.expectedOutcomeAt !== null
      ? { expectedOutcomeAt: toIso(input.expectedOutcomeAt) }
      : {}),
    ...(input.recommendationId !== undefined && input.recommendationId !== null
      ? { recommendationId: input.recommendationId }
      : {}),
    ...(input.recommendationKey !== undefined && input.recommendationKey !== null
      ? { recommendationKey: input.recommendationKey }
      : {}),
    ...(input.runId !== undefined && input.runId !== null ? { runId: input.runId } : {}),
    ...(clampNote(input.freeNote) !== undefined
      ? { freeNoteExcerpt: clampNote(input.freeNote) }
      : {}),
  }

  return sendAdvisorIngest({
    knowledgeServiceUrl,
    knowledgeServiceEnabled,
    ingestEnabled,
    requestId,
    body: {
      mode: 'admin',
      source: 'finance-os-advisor',
      decisionPoints: [compact],
    },
    timeoutMs,
  })
}

export const sendPostMortemToKnowledgeGraph = async ({
  knowledgeServiceUrl,
  knowledgeServiceEnabled,
  ingestEnabled,
  requestId,
  actions,
  timeoutMs = 5_000,
}: {
  knowledgeServiceUrl: string
  knowledgeServiceEnabled: boolean
  ingestEnabled: boolean
  requestId: string
  actions: LearningActionGraphInput[]
  timeoutMs?: number
}): Promise<GraphIngestResult> => {
  if (actions.length === 0) return { ok: false, reason: 'no_learning_actions' }

  const compact = actions.map(action => ({
    postMortemId: action.postMortemId,
    actionIndex: action.actionIndex,
    title: clampNote(action.title) ?? action.title.slice(0, 160),
    ...(clampNote(action.description) !== undefined
      ? { description: clampNote(action.description) }
      : {}),
    appliesTo: (action.appliesTo ?? []).slice(0, 8),
    status: action.status,
    ...(action.confidence !== undefined ? { confidence: action.confidence } : {}),
    ...(action.recommendationId !== undefined && action.recommendationId !== null
      ? { recommendationId: action.recommendationId }
      : {}),
    ...(action.recommendationKey !== undefined && action.recommendationKey !== null
      ? { recommendationKey: action.recommendationKey }
      : {}),
    ...(action.decisionId !== undefined && action.decisionId !== null
      ? { decisionId: action.decisionId }
      : {}),
    ...(action.runId !== undefined && action.runId !== null ? { runId: action.runId } : {}),
    ...(action.evaluatedAt !== undefined && action.evaluatedAt !== null
      ? { evaluatedAt: toIso(action.evaluatedAt) }
      : {}),
  }))

  return sendAdvisorIngest({
    knowledgeServiceUrl,
    knowledgeServiceEnabled,
    ingestEnabled,
    requestId,
    body: {
      mode: 'admin',
      source: 'finance-os-advisor',
      learningActions: compact,
    },
    timeoutMs,
  })
}
