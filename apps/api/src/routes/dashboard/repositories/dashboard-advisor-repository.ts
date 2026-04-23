import { computeAiBudgetState } from '@finance-os/ai'
import { schema } from '@finance-os/db'
import { desc, eq, gte, inArray, sql, type SQL } from 'drizzle-orm'
import type {
  DashboardAdvisorAssumptionsResponse,
  DashboardAdvisorChatPostResponse,
  DashboardAdvisorDailyBriefResponse,
  DashboardAdvisorEvalRunResponse,
  DashboardAdvisorEvalsResponse,
  DashboardAdvisorManualOperationResponse,
  DashboardAdvisorRecommendationChallengeResponse,
  DashboardAdvisorRecommendationsResponse,
  DashboardAdvisorRunSummaryResponse,
  DashboardAdvisorSignalsResponse,
  DashboardAdvisorSpendAnalyticsResponse,
  DashboardAdvisorSnapshotResponse,
  DashboardAdvisorTransactionLabelSuggestionResponse,
  DashboardAdvisorUsageSummaryResponse,
} from '../advisor-contract'
import type { ApiDb, DashboardAdvisorRepository } from '../types'

const toNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

const toNumericString = (value: number, digits = 6) => value.toFixed(digits)

const toIsoString = (value: Date | null | undefined) => value?.toISOString() ?? null

const startOfToday = () => {
  const now = new Date()
  now.setUTCHours(0, 0, 0, 0)
  return now
}

const startOfMonth = () => {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

const formatDateOnly = (value: Date) => value.toISOString().slice(0, 10)

const buildUsageSummary = async ({
  db,
  runId,
}: {
  db: ApiDb
  runId: number
}): Promise<DashboardAdvisorUsageSummaryResponse> => {
  const [row] = await db
    .select({
      totalCalls: sql<number>`count(*)::int`,
      totalInputTokens: sql<number>`coalesce(sum(${schema.aiModelUsage.inputTokens}), 0)::int`,
      totalOutputTokens: sql<number>`coalesce(sum(${schema.aiModelUsage.outputTokens}), 0)::int`,
      totalCostUsd: sql<string>`coalesce(sum(${schema.aiModelUsage.estimatedCostUsd}), 0)::text`,
      totalCostEur: sql<string>`coalesce(sum(${schema.aiModelUsage.estimatedCostEur}), 0)::text`,
    })
    .from(schema.aiModelUsage)
    .where(eq(schema.aiModelUsage.runId, runId))

  return {
    totalCalls: row?.totalCalls ?? 0,
    totalInputTokens: row?.totalInputTokens ?? 0,
    totalOutputTokens: row?.totalOutputTokens ?? 0,
    totalCostUsd: toNumber(row?.totalCostUsd),
    totalCostEur: toNumber(row?.totalCostEur),
  }
}

const getBudgetState = async ({
  db,
  dailyBudgetUsd,
  monthlyBudgetUsd,
  challengerDisableRatio,
  deepAnalysisDisableRatio,
}: {
  db: ApiDb
  dailyBudgetUsd: number
  monthlyBudgetUsd: number
  challengerDisableRatio: number
  deepAnalysisDisableRatio: number
}) => {
  const [dailyRow, monthlyRow] = await Promise.all([
    db
      .select({
        amountUsd: sql<string>`coalesce(sum(${schema.aiCostLedger.amountUsd}), 0)::text`,
      })
      .from(schema.aiCostLedger)
      .where(eq(schema.aiCostLedger.ledgerDate, formatDateOnly(startOfToday()))),
    db
      .select({
        amountUsd: sql<string>`coalesce(sum(${schema.aiCostLedger.amountUsd}), 0)::text`,
      })
      .from(schema.aiCostLedger)
      .where(gte(schema.aiCostLedger.createdAt, startOfMonth())),
  ])

  return computeAiBudgetState({
    dailyUsdSpent: toNumber(dailyRow[0]?.amountUsd),
    monthlyUsdSpent: toNumber(monthlyRow[0]?.amountUsd),
    dailyBudgetUsd,
    monthlyBudgetUsd,
    challengerDisableRatio,
    deepAnalysisDisableRatio,
  })
}

const mapRunSummary = async ({
  db,
  row,
}: {
  db: ApiDb
  row: {
    id: number
    runType: 'daily' | 'chat' | 'relabel' | 'eval'
    status: 'queued' | 'running' | 'completed' | 'failed' | 'degraded' | 'skipped'
    triggerSource: string
    requestId: string
    startedAt: Date
    finishedAt: Date | null
    durationMs: number | null
    degraded: boolean
    fallbackReason: string | null
    errorCode: string | null
    errorMessage: string | null
    budgetState: Record<string, unknown> | null
  }
}): Promise<DashboardAdvisorRunSummaryResponse> => ({
  id: row.id,
  runType: row.runType,
  status: row.status,
  triggerSource: row.triggerSource,
  requestId: row.requestId,
  startedAt: row.startedAt.toISOString(),
  finishedAt: toIsoString(row.finishedAt),
  durationMs: row.durationMs,
  degraded: row.degraded,
  fallbackReason: row.fallbackReason,
  errorCode: row.errorCode,
  errorMessage: row.errorMessage,
  budgetState: row.budgetState as DashboardAdvisorRunSummaryResponse['budgetState'],
  usageSummary: await buildUsageSummary({
    db,
    runId: row.id,
  }),
})

const mapManualOperationStepRows = (rows: Array<{
  id: number
  stepKey: string
  label: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'degraded' | 'skipped'
  startedAt: Date | null
  finishedAt: Date | null
  durationMs: number | null
  errorCode: string | null
  errorMessage: string | null
  details: Record<string, unknown> | null
}>) =>
  rows.map(row => ({
    id: row.id,
    stepKey: row.stepKey as DashboardAdvisorManualOperationResponse['steps'][number]['stepKey'],
    label: row.label,
    status: row.status,
    startedAt: toIsoString(row.startedAt),
    finishedAt: toIsoString(row.finishedAt),
    durationMs: row.durationMs,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    details: row.details,
  }))

const getManualOperationByPredicate = async ({
  db,
  whereClause,
}: {
  db: ApiDb
  whereClause: SQL<unknown>
}) => {
  const [row] = await db
    .select({
      id: schema.aiManualOperation.id,
      status: schema.aiManualOperation.status,
      requestId: schema.aiManualOperation.requestId,
      currentStage: schema.aiManualOperation.currentStage,
      statusMessage: schema.aiManualOperation.statusMessage,
      triggerSource: schema.aiManualOperation.triggerSource,
      startedAt: schema.aiManualOperation.startedAt,
      finishedAt: schema.aiManualOperation.finishedAt,
      durationMs: schema.aiManualOperation.durationMs,
      degraded: schema.aiManualOperation.degraded,
      errorCode: schema.aiManualOperation.errorCode,
      errorMessage: schema.aiManualOperation.errorMessage,
      advisorRunId: schema.aiManualOperation.advisorRunId,
      outputDigest: schema.aiManualOperation.outputDigest,
    })
    .from(schema.aiManualOperation)
    .where(whereClause)
    .orderBy(desc(schema.aiManualOperation.startedAt), desc(schema.aiManualOperation.id))
    .limit(1)

  if (!row) {
    return null
  }

  const [stepRows, advisorRunRow] = await Promise.all([
    db
      .select({
        id: schema.aiManualOperationStep.id,
        stepKey: schema.aiManualOperationStep.stepKey,
        label: schema.aiManualOperationStep.label,
        status: schema.aiManualOperationStep.status,
        startedAt: schema.aiManualOperationStep.startedAt,
        finishedAt: schema.aiManualOperationStep.finishedAt,
        durationMs: schema.aiManualOperationStep.durationMs,
        errorCode: schema.aiManualOperationStep.errorCode,
        errorMessage: schema.aiManualOperationStep.errorMessage,
        details: schema.aiManualOperationStep.details,
      })
      .from(schema.aiManualOperationStep)
      .where(eq(schema.aiManualOperationStep.operationId, row.id))
      .orderBy(schema.aiManualOperationStep.id),
    row.advisorRunId === null
      ? Promise.resolve(null)
      : db
          .select({
            id: schema.aiRun.id,
            runType: schema.aiRun.runType,
            status: schema.aiRun.status,
            triggerSource: schema.aiRun.triggerSource,
            requestId: schema.aiRun.requestId,
            startedAt: schema.aiRun.startedAt,
            finishedAt: schema.aiRun.finishedAt,
            durationMs: schema.aiRun.durationMs,
            degraded: schema.aiRun.degraded,
            fallbackReason: schema.aiRun.fallbackReason,
            errorCode: schema.aiRun.errorCode,
            errorMessage: schema.aiRun.errorMessage,
            budgetState: schema.aiRun.budgetState,
          })
          .from(schema.aiRun)
          .where(eq(schema.aiRun.id, row.advisorRunId))
          .limit(1)
          .then(rows => rows[0] ?? null),
  ])

  return {
    operationId: row.id,
    requestId: row.requestId,
    status: row.status,
    currentStage: row.currentStage as DashboardAdvisorManualOperationResponse['currentStage'],
    statusMessage: row.statusMessage,
    triggerSource: row.triggerSource,
    startedAt: row.startedAt.toISOString(),
    finishedAt: toIsoString(row.finishedAt),
    durationMs: row.durationMs,
    degraded: row.degraded,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    advisorRunId: row.advisorRunId,
    advisorRun: advisorRunRow
      ? await mapRunSummary({
          db,
          row: advisorRunRow,
        })
      : null,
    steps: mapManualOperationStepRows(stepRows),
    outputDigest: row.outputDigest,
  } satisfies DashboardAdvisorManualOperationResponse
}

const getLatestDailyRunRow = async (db: ApiDb) => {
  const [row] = await db
    .select({
      id: schema.aiRun.id,
      runType: schema.aiRun.runType,
      status: schema.aiRun.status,
      triggerSource: schema.aiRun.triggerSource,
      requestId: schema.aiRun.requestId,
      startedAt: schema.aiRun.startedAt,
      finishedAt: schema.aiRun.finishedAt,
      durationMs: schema.aiRun.durationMs,
      degraded: schema.aiRun.degraded,
      fallbackReason: schema.aiRun.fallbackReason,
      errorCode: schema.aiRun.errorCode,
      errorMessage: schema.aiRun.errorMessage,
      budgetState: schema.aiRun.budgetState,
    })
    .from(schema.aiRun)
    .where(eq(schema.aiRun.runType, 'daily'))
    .orderBy(desc(schema.aiRun.startedAt), desc(schema.aiRun.id))
    .limit(1)

  return row ?? null
}

const getSnapshotByRunId = async ({
  db,
  runId,
}: {
  db: ApiDb
  runId: number
}): Promise<DashboardAdvisorSnapshotResponse | null> => {
  const [row] = await db
    .select()
    .from(schema.aiPortfolioSnapshot)
    .where(eq(schema.aiPortfolioSnapshot.runId, runId))
    .limit(1)

  if (!row) {
    return null
  }

  return {
    id: row.id,
    runId: row.runId,
    asOfDate: row.asOfDate,
    range: row.range as DashboardAdvisorSnapshotResponse['range'],
    currency: row.currency,
    riskProfile: row.riskProfile,
    metrics: row.metrics,
    allocationBuckets: row.allocationBuckets,
    assetClassAllocations: row.assetClassAllocations,
    driftSignals: row.driftSignals,
    scenarios: row.scenarios,
    diagnostics: row.diagnostics,
  }
}

const getDailyBriefByRunId = async ({
  db,
  runId,
}: {
  db: ApiDb
  runId: number
}): Promise<DashboardAdvisorDailyBriefResponse | null> => {
  const [row] = await db
    .select()
    .from(schema.aiDailyBrief)
    .where(eq(schema.aiDailyBrief.runId, runId))
    .orderBy(desc(schema.aiDailyBrief.createdAt), desc(schema.aiDailyBrief.id))
    .limit(1)

  if (!row) {
    return null
  }

  return {
    id: row.id,
    runId: row.runId,
    title: row.title,
    summary: row.summary,
    keyFacts: row.keyFacts,
    opportunities: row.opportunities,
    risks: row.risks,
    watchItems: row.watchItems,
    recommendationNotes: row.recommendationNotes,
    provider: row.provider ?? null,
    model: row.model ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}

const getChallengesByRecommendationIds = async ({
  db,
  recommendationIds,
}: {
  db: ApiDb
  recommendationIds: number[]
}) => {
  if (recommendationIds.length === 0) {
    return new Map<number, DashboardAdvisorRecommendationChallengeResponse>()
  }

  const rows = await db
    .select()
    .from(schema.aiRecommendationChallenge)
    .where(inArray(schema.aiRecommendationChallenge.recommendationId, recommendationIds))

  return new Map(
    rows.map(row => [
      row.recommendationId,
      {
        id: row.id,
        status: row.status,
        summary: row.summary,
        contradictions: row.contradictions,
        missingSignals: row.missingSignals,
        confidenceAdjustment: toNumber(row.confidenceAdjustment),
        provider: row.provider ?? null,
        model: row.model ?? null,
        createdAt: row.createdAt.toISOString(),
      } satisfies DashboardAdvisorRecommendationChallengeResponse,
    ])
  )
}

const getRecommendationsByRunId = async ({
  db,
  runId,
  limit,
}: {
  db: ApiDb
  runId: number
  limit: number
}): Promise<DashboardAdvisorRecommendationsResponse> => {
  const rows = await db
    .select()
    .from(schema.aiRecommendation)
    .where(eq(schema.aiRecommendation.runId, runId))
    .orderBy(desc(schema.aiRecommendation.priorityScore), desc(schema.aiRecommendation.id))
    .limit(limit)

  const challengesByRecommendationId = await getChallengesByRecommendationIds({
    db,
    recommendationIds: rows.map(row => row.id),
  })

  return {
    items: rows.map(row => ({
      id: row.id,
      runId: row.runId,
      recommendationKey: row.recommendationKey,
      type: row.type,
      category: row.category,
      title: row.title,
      description: row.description,
      whyNow: row.whyNow,
      evidence: row.evidence,
      assumptions: row.assumptions,
      confidence: toNumber(row.confidence),
      riskLevel: row.riskLevel,
      expectedImpact: row.expectedImpact,
      effort: row.effort,
      reversibility: row.reversibility,
      blockingFactors: row.blockingFactors,
      alternatives: row.alternatives,
      deterministicMetricsUsed: row.deterministicMetricsUsed,
      llmModelsUsed: row.llmModelsUsed,
      challengerStatus: row.challengerStatus,
      priorityScore: row.priorityScore,
      expiresAt: toIsoString(row.expiresAt),
      createdAt: row.createdAt.toISOString(),
      challenge: challengesByRecommendationId.get(row.id) ?? null,
    })),
  }
}

const getAssumptionsByRunId = async ({
  db,
  runId,
  limit,
}: {
  db: ApiDb
  runId: number
  limit: number
}) => {
  const rows = await db
    .select()
    .from(schema.aiAssumptionLog)
    .where(eq(schema.aiAssumptionLog.runId, runId))
    .orderBy(desc(schema.aiAssumptionLog.id))
    .limit(limit)

  return {
    items: rows.map(row => ({
      id: row.id,
      runId: row.runId,
      assumptionKey: row.assumptionKey,
      source: row.source,
      value: row.value,
      justification: row.justification,
      createdAt: row.createdAt.toISOString(),
    })),
  } satisfies DashboardAdvisorAssumptionsResponse
}

const getSignalsByRunId = async ({
  db,
  runId,
  limit,
}: {
  db: ApiDb
  runId: number
  limit: number
}): Promise<DashboardAdvisorSignalsResponse> => {
  const [macroRows, newsRows] = await Promise.all([
    db
      .select()
      .from(schema.aiMacroSignal)
      .where(eq(schema.aiMacroSignal.runId, runId))
      .orderBy(desc(schema.aiMacroSignal.severity), desc(schema.aiMacroSignal.id))
      .limit(limit),
    db
      .select()
      .from(schema.aiNewsSignal)
      .where(eq(schema.aiNewsSignal.runId, runId))
      .orderBy(desc(schema.aiNewsSignal.severity), desc(schema.aiNewsSignal.id))
      .limit(limit),
  ])

  return {
    macroSignals: macroRows.map(row => ({
      id: row.id,
      runId: row.runId,
      signalKey: row.signalKey,
      title: row.title,
      direction: row.direction,
      severity: row.severity,
      confidence: row.confidence,
      facts: row.facts,
      hypotheses: row.hypotheses,
      implications: row.implications,
      sourceRefs: row.sourceRefs,
      createdAt: row.createdAt.toISOString(),
    })),
    newsSignals: newsRows.map(row => ({
      id: row.id,
      runId: row.runId,
      signalKey: row.signalKey,
      title: row.title,
      eventType: row.eventType,
      direction: row.direction,
      severity: row.severity,
      confidence: row.confidence,
      publishedAt: toIsoString(row.publishedAt),
      supportingUrls: row.supportingUrls,
      affectedEntities: row.affectedEntities,
      affectedSectors: row.affectedSectors,
      whyItMatters: row.whyItMatters,
      createdAt: row.createdAt.toISOString(),
    })),
    socialSignals: {
      mode: 'off',
      usedInAdvisorContext: false,
      droppedReason: 'policy_off',
      freshnessState: 'empty',
      deterministicFactsPriority: true,
      maxSignalsPerRun: 0,
      maxExternalSharePct: 0,
      included: [],
      excluded: [],
      exclusionSummary: {},
      decisionLedger: {
        xSignalCandidates: 0,
        xSignalIncluded: 0,
        xSignalExcluded: 0,
        advisorSocialSharePct: 0,
        xSignalCapHit: false,
        trustTierContribution: {},
        freshnessHistogram: {},
        inclusionScoreBreakdown: {
          total: 0,
          trust: 0,
          recency: 0,
          convergence: 0,
          novelty: 0,
          curation: 0,
        },
        exclusionReasonBreakdown: {},
      },
    },
  }
}

const buildAnomalies = ({
  budgetState,
  dailySeries,
}: {
  budgetState: DashboardAdvisorSpendAnalyticsResponse['summary']
  dailySeries: DashboardAdvisorSpendAnalyticsResponse['daily']
}) => {
  const anomalies: DashboardAdvisorSpendAnalyticsResponse['anomalies'] = []

  if (budgetState.dailyUsdSpent >= budgetState.dailyBudgetUsd && budgetState.dailyBudgetUsd > 0) {
    anomalies.push({
      severity: 'critical',
      kind: 'daily_budget',
      message: 'Le budget IA journalier est depasse. Les runs profonds doivent se degrader.',
    })
  } else if (
    budgetState.dailyBudgetUsd > 0 &&
    budgetState.dailyUsdSpent / budgetState.dailyBudgetUsd >= 0.8
  ) {
    anomalies.push({
      severity: 'warning',
      kind: 'daily_budget',
      message: 'Le budget IA journalier approche du seuil d alerte.',
    })
  }

  if (
    budgetState.monthlyUsdSpent >= budgetState.monthlyBudgetUsd &&
    budgetState.monthlyBudgetUsd > 0
  ) {
    anomalies.push({
      severity: 'critical',
      kind: 'monthly_budget',
      message: 'Le budget IA mensuel est depasse. Les features IA doivent se degrader.',
    })
  } else if (
    budgetState.monthlyBudgetUsd > 0 &&
    budgetState.monthlyUsdSpent / budgetState.monthlyBudgetUsd >= 0.8
  ) {
    anomalies.push({
      severity: 'warning',
      kind: 'monthly_budget',
      message: 'Le budget IA mensuel approche du seuil d alerte.',
    })
  }

  if (dailySeries.length >= 7) {
    const today = dailySeries[dailySeries.length - 1]?.usd ?? 0
    const history = dailySeries.slice(-8, -1)
    const average = history.reduce((sum, item) => sum + item.usd, 0) / Math.max(history.length, 1)
    if (average > 0 && today > average * 1.8) {
      anomalies.push({
        severity: 'warning',
        kind: 'usage_spike',
        message: 'Le spend IA du jour est nettement au-dessus de la moyenne recente.',
      })
    }
  }

  return anomalies
}

export const createDashboardAdvisorRepository = ({
  db,
}: {
  db: ApiDb
}): DashboardAdvisorRepository => {
  return {
    async createRun(input) {
      const [created] = await db
        .insert(schema.aiRun)
        .values({
          runType: input.runType,
          status: input.status,
          mode: input.mode,
          triggerSource: input.triggerSource,
          requestId: input.requestId,
          degraded: input.degraded,
          ...(input.fallbackReason !== undefined ? { fallbackReason: input.fallbackReason } : {}),
          ...(input.inputDigest !== undefined ? { inputDigest: input.inputDigest } : {}),
          ...(input.budgetState !== undefined ? { budgetState: input.budgetState } : {}),
          ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
        })
        .returning({ id: schema.aiRun.id })

      if (!created) {
        throw new Error('Failed to create AI run')
      }

      return created.id
    },

    async updateRun(input) {
      await db
        .update(schema.aiRun)
        .set({
          status: input.status,
          degraded: input.degraded,
          ...(input.finishedAt !== undefined ? { finishedAt: input.finishedAt } : {}),
          ...(input.durationMs !== undefined ? { durationMs: input.durationMs } : {}),
          ...(input.fallbackReason !== undefined ? { fallbackReason: input.fallbackReason } : {}),
          ...(input.errorCode !== undefined ? { errorCode: input.errorCode } : {}),
          ...(input.errorMessage !== undefined ? { errorMessage: input.errorMessage } : {}),
          ...(input.outputDigest !== undefined ? { outputDigest: input.outputDigest } : {}),
          ...(input.budgetState !== undefined ? { budgetState: input.budgetState } : {}),
          ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
          updatedAt: new Date(),
        })
        .where(eq(schema.aiRun.id, input.runId))
    },

    async upsertPromptTemplate(input) {
      await db
        .insert(schema.aiPromptTemplate)
        .values({
          templateKey: input.templateKey,
          version: input.version,
          description: input.description,
          schemaName: input.schemaName,
          systemPrompt: input.systemPrompt,
          userPromptTemplate: input.userPromptTemplate,
          schema: input.schema,
        })
        .onConflictDoUpdate({
          target: [schema.aiPromptTemplate.templateKey, schema.aiPromptTemplate.version],
          set: {
            description: sql`excluded.description`,
            schemaName: sql`excluded.schema_name`,
            systemPrompt: sql`excluded.system_prompt`,
            userPromptTemplate: sql`excluded.user_prompt_template`,
            schema: sql`excluded.schema`,
            active: true,
            updatedAt: new Date(),
          },
        })
    },

    async upsertEvalCases(cases) {
      if (cases.length === 0) {
        return
      }

      for (const item of cases) {
        await db
          .insert(schema.aiEvalCase)
          .values({
            caseKey: item.caseKey,
            category: item.category,
            description: item.description,
            input: item.input,
            expectation: item.expectation,
          })
          .onConflictDoUpdate({
            target: schema.aiEvalCase.caseKey,
            set: {
              category: sql`excluded.category`,
              description: sql`excluded.description`,
              input: sql`excluded.input`,
              expectation: sql`excluded.expectation`,
              active: true,
              updatedAt: new Date(),
            },
          })
      }
    },

    async createRunStep(input) {
      const [created] = await db
        .insert(schema.aiRunStep)
        .values({
          runId: input.runId,
          stepKey: input.stepKey,
          status: input.status,
          ...(input.provider ? { provider: input.provider } : {}),
          ...(input.model ? { model: input.model } : {}),
          ...(input.promptTemplateKey ? { promptTemplateKey: input.promptTemplateKey } : {}),
          ...(input.promptTemplateVersion
            ? { promptTemplateVersion: input.promptTemplateVersion }
            : {}),
          ...(input.startedAt ? { startedAt: input.startedAt } : {}),
          ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
        })
        .returning({ id: schema.aiRunStep.id })

      if (!created) {
        throw new Error('Failed to create AI run step')
      }

      return created.id
    },

    async updateRunStep(input) {
      await db
        .update(schema.aiRunStep)
        .set({
          status: input.status,
          ...(input.finishedAt !== undefined ? { finishedAt: input.finishedAt } : {}),
          ...(input.latencyMs !== undefined ? { latencyMs: input.latencyMs } : {}),
          ...(input.errorCode !== undefined ? { errorCode: input.errorCode } : {}),
          ...(input.errorMessage !== undefined ? { errorMessage: input.errorMessage } : {}),
          ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
        })
        .where(eq(schema.aiRunStep.id, input.stepId))
    },

    async insertModelUsage(input) {
      const createdAt = input.createdAt ?? new Date()
      const [created] = await db
        .insert(schema.aiModelUsage)
        .values({
          ...(input.runId !== undefined ? { runId: input.runId } : {}),
          ...(input.runStepId !== undefined ? { runStepId: input.runStepId } : {}),
          provider: input.provider,
          model: input.model,
          endpointType: input.endpointType,
          feature: input.feature,
          status: input.status,
          inputTokens: input.inputTokens,
          outputTokens: input.outputTokens,
          cachedInputTokens: input.cachedInputTokens,
          cacheWriteTokens: input.cacheWriteTokens,
          ...(input.cacheDuration ? { cacheDuration: input.cacheDuration } : {}),
          batch: input.batch,
          latencyMs: input.latencyMs,
          ...(input.requestId ? { requestId: input.requestId } : {}),
          ...(input.responseId ? { responseId: input.responseId } : {}),
          pricingVersion: input.pricingVersion,
          estimatedCostUsd: toNumericString(input.estimatedCostUsd),
          estimatedCostEur: toNumericString(input.estimatedCostEur),
          usdToEurRate: toNumericString(input.usdToEurRate),
          ...(input.rawUsage !== undefined ? { rawUsage: input.rawUsage } : {}),
          createdAt,
        })
        .returning({ id: schema.aiModelUsage.id })

      await db.insert(schema.aiCostLedger).values({
        ...(input.runId !== undefined ? { runId: input.runId } : {}),
        ...(created ? { modelUsageId: created.id } : {}),
        ledgerDate: formatDateOnly(createdAt),
        provider: input.provider,
        model: input.model,
        feature: input.feature,
        amountUsd: toNumericString(input.estimatedCostUsd),
        amountEur: toNumericString(input.estimatedCostEur),
        pricingVersion: input.pricingVersion,
        createdAt,
      })
    },

    async saveDailyArtifacts(input) {
      await db.transaction(async tx => {
        const [snapshotRow] = await tx
          .insert(schema.aiPortfolioSnapshot)
          .values({
            runId: input.runId,
            asOfDate: input.snapshot.asOfDate,
            range: input.snapshot.range,
            currency: input.snapshot.currency,
            riskProfile: input.snapshot.riskProfile,
            metrics: input.snapshot.metrics,
            allocationBuckets: input.snapshot.allocationBuckets,
            assetClassAllocations: input.snapshot.assetClassAllocations,
            driftSignals: input.snapshot.driftSignals,
            scenarios: input.snapshot.scenarios,
            diagnostics: input.snapshot.diagnostics,
          })
          .returning({ id: schema.aiPortfolioSnapshot.id })

        if (!snapshotRow) {
          throw new Error('Failed to persist AI snapshot')
        }

        if (input.assumptions.length > 0) {
          await tx.insert(schema.aiAssumptionLog).values(
            input.assumptions.map(item => ({
              runId: input.runId,
              snapshotId: snapshotRow.id,
              assumptionKey: item.assumptionKey,
              source: item.source,
              value: item.value,
              justification: item.justification,
            }))
          )
        }

        if (input.brief) {
          await tx.insert(schema.aiDailyBrief).values({
            runId: input.runId,
            snapshotId: snapshotRow.id,
            title: input.brief.title,
            summary: input.brief.summary,
            keyFacts: input.brief.keyFacts,
            opportunities: input.brief.opportunities,
            risks: input.brief.risks,
            watchItems: input.brief.watchItems,
            recommendationNotes: input.brief.recommendationNotes,
            ...(input.brief.provider ? { provider: input.brief.provider } : {}),
            ...(input.brief.model ? { model: input.brief.model } : {}),
            ...(input.brief.promptTemplateKey
              ? { promptTemplateKey: input.brief.promptTemplateKey }
              : {}),
            ...(input.brief.promptTemplateVersion
              ? { promptTemplateVersion: input.brief.promptTemplateVersion }
              : {}),
          })
        }

        for (const item of input.recommendations) {
          const [created] = await tx
            .insert(schema.aiRecommendation)
            .values({
              runId: input.runId,
              snapshotId: snapshotRow.id,
              recommendationKey: item.recommendationKey,
              type: item.type,
              category: item.category,
              title: item.title,
              description: item.description,
              whyNow: item.whyNow,
              evidence: item.evidence,
              assumptions: item.assumptions,
              confidence: toNumericString(item.confidence, 4),
              riskLevel: item.riskLevel,
              expectedImpact: item.expectedImpact,
              effort: item.effort,
              reversibility: item.reversibility,
              blockingFactors: item.blockingFactors,
              alternatives: item.alternatives,
              deterministicMetricsUsed: item.deterministicMetricsUsed,
              llmModelsUsed: item.llmModelsUsed,
              challengerStatus: item.challengerStatus,
              priorityScore: item.priorityScore,
              ...(item.expiresAt ? { expiresAt: item.expiresAt } : {}),
            })
            .returning({ id: schema.aiRecommendation.id })

          if (created && item.challenge) {
            await tx.insert(schema.aiRecommendationChallenge).values({
              recommendationId: created.id,
              runId: input.runId,
              status: item.challenge.status,
              summary: item.challenge.summary,
              contradictions: item.challenge.contradictions,
              missingSignals: item.challenge.missingSignals,
              confidenceAdjustment: toNumericString(item.challenge.confidenceAdjustment, 4),
              ...(item.challenge.provider ? { provider: item.challenge.provider } : {}),
              ...(item.challenge.model ? { model: item.challenge.model } : {}),
            })
          }
        }

        if (input.macroSignals.length > 0) {
          await tx.insert(schema.aiMacroSignal).values(
            input.macroSignals.map(item => ({
              runId: input.runId,
              signalKey: item.signalKey,
              title: item.title,
              direction: item.direction,
              severity: item.severity,
              confidence: item.confidence,
              facts: item.facts,
              hypotheses: item.hypotheses,
              implications: item.implications,
              sourceRefs: item.sourceRefs,
            }))
          )
        }

        if (input.newsSignals.length > 0) {
          await tx.insert(schema.aiNewsSignal).values(
            input.newsSignals.map(item => ({
              runId: input.runId,
              ...(item.newsArticleId ? { newsArticleId: item.newsArticleId } : {}),
              signalKey: item.signalKey,
              title: item.title,
              eventType: item.eventType,
              direction: item.direction,
              severity: item.severity,
              confidence: item.confidence,
              ...(item.publishedAt ? { publishedAt: item.publishedAt } : {}),
              supportingUrls: item.supportingUrls,
              affectedEntities: item.affectedEntities,
              affectedSectors: item.affectedSectors,
              whyItMatters: item.whyItMatters,
            }))
          )
        }

        if (input.transactionSuggestions.length > 0) {
          await tx.insert(schema.aiTransactionLabelSuggestion).values(
            input.transactionSuggestions.map(item => ({
              runId: input.runId,
              ...(item.transactionId ? { transactionId: item.transactionId } : {}),
              suggestionKey: item.suggestionKey,
              status: item.status,
              suggestionSource: item.suggestionSource,
              suggestedKind: item.suggestedKind,
              suggestedCategory: item.suggestedCategory,
              ...(item.suggestedSubcategory ? { suggestedSubcategory: item.suggestedSubcategory } : {}),
              suggestedTags: item.suggestedTags,
              confidence: toNumericString(item.confidence, 4),
              rationale: item.rationale,
              ...(item.provider ? { provider: item.provider } : {}),
              ...(item.model ? { model: item.model } : {}),
            }))
          )
        }

        if (input.evalRun) {
          await tx.insert(schema.aiEvalRun).values({
            runId: input.runId,
            status: input.evalRun.status,
            totalCases: input.evalRun.totalCases,
            passedCases: input.evalRun.passedCases,
            failedCases: input.evalRun.failedCases,
            summary: input.evalRun.summary,
          })
        }
      })
    },

    async getAdvisorOverview(input) {
      const latestRunRow = await getLatestDailyRunRow(db)
      if (!latestRunRow) {
        return null
      }

      const [latestRun, brief, recommendations, snapshot, assumptions, signals, spend] =
        await Promise.all([
          mapRunSummary({
            db,
            row: latestRunRow,
          }),
          getDailyBriefByRunId({
            db,
            runId: latestRunRow.id,
          }),
          getRecommendationsByRunId({
            db,
            runId: latestRunRow.id,
            limit: 5,
          }),
          getSnapshotByRunId({
            db,
            runId: latestRunRow.id,
          }),
          getAssumptionsByRunId({
            db,
            runId: latestRunRow.id,
            limit: 100,
          }),
          getSignalsByRunId({
            db,
            runId: latestRunRow.id,
            limit: 20,
          }),
          this.getSpendAnalytics({
            dailyBudgetUsd: input.dailyBudgetUsd,
            monthlyBudgetUsd: input.monthlyBudgetUsd,
            challengerDisableRatio: input.challengerDisableRatio,
            deepAnalysisDisableRatio: input.deepAnalysisDisableRatio,
          }),
        ])

      return {
        mode: 'admin',
        source: 'persisted',
        requestId: latestRun.requestId,
        generatedAt: new Date().toISOString(),
        status:
          latestRun.status === 'failed'
            ? 'degraded'
            : latestRun.status === 'completed' || latestRun.status === 'degraded'
              ? 'ready'
              : 'needs_run',
        degradedMessage:
          latestRun.degraded || latestRun.status === 'failed'
            ? latestRun.errorMessage ?? latestRun.fallbackReason ?? 'Dernier run degrade.'
            : null,
        latestRun,
        brief,
        topRecommendations: recommendations.items,
        snapshot,
        spend: spend.summary,
        signalCounts: {
          macro: signals.macroSignals.length,
          news: signals.newsSignals.length,
          social: 0,
        },
        assumptionCount: assumptions.items.length,
        chatEnabled: input.chatEnabled,
      }
    },

    async getLatestDailyBrief() {
      const latestRunRow = await getLatestDailyRunRow(db)
      if (!latestRunRow) {
        return null
      }

      return getDailyBriefByRunId({
        db,
        runId: latestRunRow.id,
      })
    },

    async listRecommendations(limit) {
      const latestRunRow = await getLatestDailyRunRow(db)
      if (!latestRunRow) {
        return { items: [] }
      }

      return getRecommendationsByRunId({
        db,
        runId: latestRunRow.id,
        limit,
      })
    },

    async listRuns(limit) {
      const rows = await db
        .select({
          id: schema.aiRun.id,
          runType: schema.aiRun.runType,
          status: schema.aiRun.status,
          triggerSource: schema.aiRun.triggerSource,
          requestId: schema.aiRun.requestId,
          startedAt: schema.aiRun.startedAt,
          finishedAt: schema.aiRun.finishedAt,
          durationMs: schema.aiRun.durationMs,
          degraded: schema.aiRun.degraded,
          fallbackReason: schema.aiRun.fallbackReason,
          errorCode: schema.aiRun.errorCode,
          errorMessage: schema.aiRun.errorMessage,
          budgetState: schema.aiRun.budgetState,
        })
        .from(schema.aiRun)
        .orderBy(desc(schema.aiRun.startedAt), desc(schema.aiRun.id))
        .limit(limit)

      return {
        items: await Promise.all(
          rows.map(row =>
            mapRunSummary({
              db,
              row,
            })
          )
        ),
      }
    },

    async createManualOperation(input) {
      await db.insert(schema.aiManualOperation).values({
        id: input.operationId,
        status: input.status,
        mode: input.mode,
        triggerSource: input.triggerSource,
        requestId: input.requestId,
        ...(input.currentStage !== undefined ? { currentStage: input.currentStage } : {}),
        ...(input.statusMessage !== undefined ? { statusMessage: input.statusMessage } : {}),
        degraded: input.degraded,
        ...(input.advisorRunId !== undefined ? { advisorRunId: input.advisorRunId } : {}),
        ...(input.inputDigest !== undefined ? { inputDigest: input.inputDigest } : {}),
        ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      })
    },

    async updateManualOperation(input) {
      await db
        .update(schema.aiManualOperation)
        .set({
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.currentStage !== undefined ? { currentStage: input.currentStage } : {}),
          ...(input.statusMessage !== undefined ? { statusMessage: input.statusMessage } : {}),
          ...(input.degraded !== undefined ? { degraded: input.degraded } : {}),
          ...(input.errorCode !== undefined ? { errorCode: input.errorCode } : {}),
          ...(input.errorMessage !== undefined ? { errorMessage: input.errorMessage } : {}),
          ...(input.advisorRunId !== undefined ? { advisorRunId: input.advisorRunId } : {}),
          ...(input.finishedAt !== undefined ? { finishedAt: input.finishedAt } : {}),
          ...(input.durationMs !== undefined ? { durationMs: input.durationMs } : {}),
          ...(input.outputDigest !== undefined ? { outputDigest: input.outputDigest } : {}),
          ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
          updatedAt: new Date(),
        })
        .where(eq(schema.aiManualOperation.id, input.operationId))
    },

    async upsertManualOperationStep(input) {
      await db
        .insert(schema.aiManualOperationStep)
        .values({
          operationId: input.operationId,
          stepKey: input.stepKey,
          label: input.label,
          status: input.status,
          ...(input.startedAt !== undefined ? { startedAt: input.startedAt } : {}),
          ...(input.finishedAt !== undefined ? { finishedAt: input.finishedAt } : {}),
          ...(input.durationMs !== undefined ? { durationMs: input.durationMs } : {}),
          ...(input.errorCode !== undefined ? { errorCode: input.errorCode } : {}),
          ...(input.errorMessage !== undefined ? { errorMessage: input.errorMessage } : {}),
          ...(input.details !== undefined ? { details: input.details } : {}),
        })
        .onConflictDoUpdate({
          target: [
            schema.aiManualOperationStep.operationId,
            schema.aiManualOperationStep.stepKey,
          ],
          set: {
            label: sql`excluded.label`,
            status: sql`excluded.status`,
            startedAt: sql`excluded.started_at`,
            finishedAt: sql`excluded.finished_at`,
            durationMs: sql`excluded.duration_ms`,
            errorCode: sql`excluded.error_code`,
            errorMessage: sql`excluded.error_message`,
            details: sql`excluded.details`,
            updatedAt: new Date(),
          },
        })
    },

    async getManualOperation(operationId) {
      return getManualOperationByPredicate({
        db,
        whereClause: eq(schema.aiManualOperation.id, operationId),
      })
    },

    async getLatestManualOperation() {
      return getManualOperationByPredicate({
        db,
        whereClause: sql`true`,
      })
    },

    async getLatestActiveManualOperation() {
      return getManualOperationByPredicate({
        db,
        whereClause: inArray(schema.aiManualOperation.status, ['queued', 'running']),
      })
    },

    async listAssumptions(limit) {
      const latestRunRow = await getLatestDailyRunRow(db)
      if (!latestRunRow) {
        return { items: [] }
      }

      return getAssumptionsByRunId({
        db,
        runId: latestRunRow.id,
        limit,
      })
    },

    async listSignals(limit) {
      const latestRunRow = await getLatestDailyRunRow(db)
      if (!latestRunRow) {
        return {
          macroSignals: [],
          newsSignals: [],
          socialSignals: {
            mode: 'off',
            usedInAdvisorContext: false,
            droppedReason: 'policy_off',
            freshnessState: 'empty',
            deterministicFactsPriority: true,
            maxSignalsPerRun: 0,
            maxExternalSharePct: 0,
            included: [],
            excluded: [],
            exclusionSummary: {},
            decisionLedger: {
              xSignalCandidates: 0,
              xSignalIncluded: 0,
              xSignalExcluded: 0,
              advisorSocialSharePct: 0,
              xSignalCapHit: false,
              trustTierContribution: {},
              freshnessHistogram: {},
              inclusionScoreBreakdown: {
                total: 0,
                trust: 0,
                recency: 0,
                convergence: 0,
                novelty: 0,
                curation: 0,
              },
              exclusionReasonBreakdown: {},
            },
          },
        }
      }

      const persisted = await getSignalsByRunId({
        db,
        runId: latestRunRow.id,
        limit,
      })

      return {
        ...persisted,
        socialSignals: {
          mode: 'off',
          usedInAdvisorContext: false,
          droppedReason: 'policy_off',
          freshnessState: 'empty',
          deterministicFactsPriority: true,
          maxSignalsPerRun: 0,
          maxExternalSharePct: 0,
          included: [],
          excluded: [],
          exclusionSummary: {},
          decisionLedger: {
            xSignalCandidates: 0,
            xSignalIncluded: 0,
            xSignalExcluded: 0,
            advisorSocialSharePct: 0,
            xSignalCapHit: false,
            trustTierContribution: {},
            freshnessHistogram: {},
            inclusionScoreBreakdown: {
              total: 0,
              trust: 0,
              recency: 0,
              convergence: 0,
              novelty: 0,
              curation: 0,
            },
            exclusionReasonBreakdown: {},
          },
        },
      }
    },

    async getSpendAnalytics(input) {
      const budgetState = await getBudgetState({
        db,
        dailyBudgetUsd: input.dailyBudgetUsd,
        monthlyBudgetUsd: input.monthlyBudgetUsd,
        challengerDisableRatio: input.challengerDisableRatio,
        deepAnalysisDisableRatio: input.deepAnalysisDisableRatio,
      })

      const dailyRows = await db
        .select({
          date: schema.aiCostLedger.ledgerDate,
          usd: sql<string>`coalesce(sum(${schema.aiCostLedger.amountUsd}), 0)::text`,
          eur: sql<string>`coalesce(sum(${schema.aiCostLedger.amountEur}), 0)::text`,
        })
        .from(schema.aiCostLedger)
        .groupBy(schema.aiCostLedger.ledgerDate)
        .orderBy(schema.aiCostLedger.ledgerDate)

      const byFeatureRows = await db
        .select({
          key: schema.aiCostLedger.feature,
          usd: sql<string>`coalesce(sum(${schema.aiCostLedger.amountUsd}), 0)::text`,
          eur: sql<string>`coalesce(sum(${schema.aiCostLedger.amountEur}), 0)::text`,
        })
        .from(schema.aiCostLedger)
        .groupBy(schema.aiCostLedger.feature)
        .orderBy(desc(sql`sum(${schema.aiCostLedger.amountUsd})`))

      const byModelRows = await db
        .select({
          provider: schema.aiCostLedger.provider,
          model: schema.aiCostLedger.model,
          usd: sql<string>`coalesce(sum(${schema.aiCostLedger.amountUsd}), 0)::text`,
          eur: sql<string>`coalesce(sum(${schema.aiCostLedger.amountEur}), 0)::text`,
        })
        .from(schema.aiCostLedger)
        .groupBy(schema.aiCostLedger.provider, schema.aiCostLedger.model)
        .orderBy(desc(sql`sum(${schema.aiCostLedger.amountUsd})`))

      const daily = dailyRows.map(row => ({
        date: row.date,
        usd: toNumber(row.usd),
        eur: toNumber(row.eur),
      }))

      return {
        summary: budgetState,
        daily,
        byFeature: byFeatureRows.map(row => ({
          key: row.key,
          label: row.key,
          usd: toNumber(row.usd),
          eur: toNumber(row.eur),
        })),
        byModel: byModelRows.map(row => ({
          key: `${row.provider}:${row.model}`,
          label: `${row.provider}:${row.model}`,
          usd: toNumber(row.usd),
          eur: toNumber(row.eur),
        })),
        anomalies: buildAnomalies({
          budgetState,
          dailySeries: daily,
        }),
      }
    },

    async listTransactionSuggestions(runId, limit) {
      const rows = await db
        .select()
        .from(schema.aiTransactionLabelSuggestion)
        .where(eq(schema.aiTransactionLabelSuggestion.runId, runId))
        .orderBy(desc(schema.aiTransactionLabelSuggestion.confidence), desc(schema.aiTransactionLabelSuggestion.id))
        .limit(limit)

      return rows.map(row => ({
        id: row.id,
        runId: row.runId,
        transactionId: row.transactionId ?? null,
        suggestionKey: row.suggestionKey,
        status: row.status,
        suggestionSource: row.suggestionSource,
        suggestedKind: row.suggestedKind,
        suggestedCategory: row.suggestedCategory,
        suggestedSubcategory: row.suggestedSubcategory ?? null,
        suggestedTags: row.suggestedTags,
        confidence: toNumber(row.confidence),
        rationale: row.rationale,
        provider: row.provider ?? null,
        model: row.model ?? null,
        createdAt: row.createdAt.toISOString(),
        reviewedAt: toIsoString(row.reviewedAt),
      })) satisfies DashboardAdvisorTransactionLabelSuggestionResponse[]
    },

    async getOrCreateChatThread(input) {
      await db
        .insert(schema.aiChatThread)
        .values({
          threadKey: input.threadKey,
          mode: input.mode,
        })
        .onConflictDoNothing({
          target: schema.aiChatThread.threadKey,
        })

      const [row] = await db
        .select({
          threadKey: schema.aiChatThread.threadKey,
        })
        .from(schema.aiChatThread)
        .where(eq(schema.aiChatThread.threadKey, input.threadKey))
        .limit(1)

      if (!row) {
        throw new Error('Failed to load AI chat thread')
      }

      return row.threadKey
    },

    async listChatMessages(threadKey, limit) {
      const [thread] = await db
        .select()
        .from(schema.aiChatThread)
        .where(eq(schema.aiChatThread.threadKey, threadKey))
        .limit(1)

      if (!thread) {
        return null
      }

      const messageRows = await db
        .select()
        .from(schema.aiChatMessage)
        .where(eq(schema.aiChatMessage.threadId, thread.id))
        .orderBy(desc(schema.aiChatMessage.id))
        .limit(limit)

      return {
        threadId: thread.threadKey,
        title: thread.title,
        messages: [...messageRows].reverse().map(row => ({
          id: row.id,
          role: row.role,
          content: row.content,
          citations: row.citations,
          assumptions: row.assumptions,
          caveats: row.caveats,
          simulations: row.simulations,
          provider: row.provider ?? null,
          model: row.model ?? null,
          createdAt: row.createdAt.toISOString(),
        })),
      }
    },

    async appendChatMessages(input) {
      await this.getOrCreateChatThread({
        threadKey: input.threadKey,
        mode: input.mode,
      })

      const [thread] = await db
        .select()
        .from(schema.aiChatThread)
        .where(eq(schema.aiChatThread.threadKey, input.threadKey))
        .limit(1)

      if (!thread) {
        throw new Error('Failed to reload AI chat thread')
      }

      await db.transaction(async tx => {
        await tx
          .update(schema.aiChatThread)
          .set({
            title: input.title,
            updatedAt: new Date(),
          })
          .where(eq(schema.aiChatThread.id, thread.id))

        await tx.insert(schema.aiChatMessage).values([
          {
            threadId: thread.id,
            ...(input.runId !== undefined ? { runId: input.runId } : {}),
            role: 'user',
            content: input.userMessage.content,
          },
          {
            threadId: thread.id,
            ...(input.runId !== undefined ? { runId: input.runId } : {}),
            role: 'assistant',
            content: input.assistantMessage.content,
            citations: input.assistantMessage.citations,
            assumptions: input.assistantMessage.assumptions,
            caveats: input.assistantMessage.caveats,
            simulations: input.assistantMessage.simulations,
            ...(input.assistantMessage.provider ? { provider: input.assistantMessage.provider } : {}),
            ...(input.assistantMessage.model ? { model: input.assistantMessage.model } : {}),
          },
        ])
      })

      const threadWithMessages = await this.listChatMessages(thread.threadKey, 24)
      if (!threadWithMessages) {
        throw new Error('Failed to load AI chat messages')
      }

      return {
        ok: true,
        requestId: `chat-${Date.now().toString(36)}`,
        thread: threadWithMessages,
      } satisfies DashboardAdvisorChatPostResponse
    },

    async getEvals() {
      const [cases, latestRun] = await Promise.all([
        db
          .select()
          .from(schema.aiEvalCase)
          .where(eq(schema.aiEvalCase.active, true))
          .orderBy(schema.aiEvalCase.category, schema.aiEvalCase.caseKey),
        this.getLatestEvalRun(),
      ])

      return {
        cases: cases.map(item => ({
          id: item.id,
          caseKey: item.caseKey,
          category: item.category,
          description: item.description,
          input: item.input,
          expectation: item.expectation,
          active: item.active,
        })),
        latestRun,
      } satisfies DashboardAdvisorEvalsResponse
    },

    async getLatestEvalRun() {
      const [row] = await db
        .select()
        .from(schema.aiEvalRun)
        .orderBy(desc(schema.aiEvalRun.createdAt), desc(schema.aiEvalRun.id))
        .limit(1)

      if (!row) {
        return null
      }

      return {
        id: row.id,
        runId: row.runId ?? null,
        status: row.status,
        totalCases: row.totalCases,
        passedCases: row.passedCases,
        failedCases: row.failedCases,
        summary: row.summary,
        createdAt: row.createdAt.toISOString(),
      } satisfies DashboardAdvisorEvalRunResponse
    },
  }
}
