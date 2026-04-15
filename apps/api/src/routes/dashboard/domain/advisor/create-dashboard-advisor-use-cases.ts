import {
  CHAT_GROUNDED_PROMPT,
  computeAiBudgetState,
  createAnthropicMessagesClient,
  createOpenAiResponsesClient,
  DAILY_BRIEF_PROMPT,
  DEFAULT_AI_EVAL_CASES,
  RECOMMENDATION_CHALLENGE_PROMPT,
  TRANSACTION_LABELS_PROMPT,
  type AiBudgetState,
  type ChatGroundedAnswer,
  type DailyBriefLlmDraft,
  type RecommendationChallengeDraft,
  type StructuredCompletionRequest,
  type StructuredCompletionResult,
  type TransactionLabelSuggestionDraft,
} from '@finance-os/ai'
import {
  calculateAdvisorSnapshot,
  generateAdvisorRecommendations,
  type AdvisorSnapshot,
  type DeterministicRecommendation,
} from '@finance-os/finance-engine'
import { getDashboardSummaryMock } from '../../../../mocks/dashboardSummary.mock'
import type {
  DashboardAdvisorAssumptionsResponse,
  DashboardAdvisorChatPostResponse,
  DashboardAdvisorDailyBriefResponse,
  DashboardAdvisorEvalsResponse,
  DashboardAdvisorOverviewResponse,
  DashboardAdvisorRecommendationResponse,
  DashboardAdvisorRecommendationsResponse,
  DashboardAdvisorRelabelResponse,
  DashboardAdvisorRunDailyResponse,
  DashboardAdvisorSignalsResponse,
  DashboardAdvisorSpendAnalyticsResponse,
} from '../../advisor-contract'
import type {
  DashboardAdvisorRepository,
  DashboardGoalResponse,
  DashboardSummaryResponse,
  DashboardUseCases,
} from '../../types'
import type { NewsContextBundle } from '../news-types'
import { buildAdvisorChatFallback } from './build-chat-fallback'
import { buildDeterministicBrief } from './build-deterministic-brief'
import { buildDeterministicTransactionSuggestions } from './build-transaction-suggestions'
import { mapNewsBundleToSignals, mapSummaryToFinanceEngineInput } from './map-summary-to-engine-input'
import { runAdvisorEvals } from './run-advisor-evals'

type StructuredClient = {
  runStructured: <TOutput>(
    request: StructuredCompletionRequest
  ) => Promise<StructuredCompletionResult<TOutput>>
}

export interface DashboardAdvisorConfig {
  advisorEnabled: boolean
  adminOnly: boolean
  forceLocalOnly: boolean
  chatEnabled: boolean
  challengerEnabled: boolean
  relabelEnabled: boolean
  dailyBudgetUsd: number
  monthlyBudgetUsd: number
  challengerDisableRatio: number
  deepAnalysisDisableRatio: number
  maxChatMessagesContext: number
  usdToEurRate: number
  openAi:
    | {
        apiKey: string
        baseUrl?: string
        classifierModel: string
        dailyModel: string
        deepModel: string
      }
    | null
  anthropic:
    | {
        apiKey: string
        baseUrl?: string
        challengerModel: string
      }
    | null
}

const renderPrompt = (template: { userPromptTemplate: string }, context: Record<string, unknown>) =>
  template.userPromptTemplate.replace('{{context_json}}', JSON.stringify(context))

const toSnapshotResponse = ({
  snapshot,
  runId,
}: {
  snapshot: AdvisorSnapshot
  runId: number
}) => ({
  id: 0,
  runId,
  asOfDate: snapshot.asOf.slice(0, 10),
  range: snapshot.range,
  currency: snapshot.currency,
  riskProfile: snapshot.riskProfile,
  metrics: snapshot.metrics as unknown as Record<string, unknown>,
  allocationBuckets: snapshot.allocationBuckets as unknown as Array<Record<string, unknown>>,
  assetClassAllocations: snapshot.assetClassAllocations as unknown as Array<Record<string, unknown>>,
  driftSignals: snapshot.driftSignals as unknown as Array<Record<string, unknown>>,
  scenarios: snapshot.scenarios as unknown as Array<Record<string, unknown>>,
  diagnostics: snapshot.diagnostics as unknown as Record<string, unknown>,
})

const toRecommendationResponse = ({
  item,
  runId,
}: {
  item: DeterministicRecommendation
  runId: number
}): DashboardAdvisorRecommendationResponse => ({
  id: 0,
  runId,
  recommendationKey: item.id,
  type: item.type,
  category: item.category,
  title: item.title,
  description: item.description,
  whyNow: item.whyNow,
  evidence: item.evidence,
  assumptions: item.assumptions,
  confidence: item.confidence,
  riskLevel: item.riskLevel,
  expectedImpact: item.expectedImpact as unknown as Record<string, unknown>,
  effort: item.effort,
  reversibility: item.reversibility,
  blockingFactors: item.blockingFactors,
  alternatives: item.alternatives,
  deterministicMetricsUsed: item.deterministicMetricsUsed,
  llmModelsUsed: [],
  challengerStatus: 'skipped',
  priorityScore: item.priorityScore,
  expiresAt: null,
  createdAt: new Date().toISOString(),
  challenge: null,
})

const buildSignalResponses = (newsBundle?: NewsContextBundle | null): DashboardAdvisorSignalsResponse => {
  if (!newsBundle) {
    return {
      macroSignals: [],
      newsSignals: [],
    }
  }

  return {
    macroSignals: newsBundle.causalHypotheses.slice(0, 6).map((hypothesis, index) => ({
      id: index + 1,
      runId: 0,
      signalKey: `macro-${index + 1}`,
      title: hypothesis,
      direction: 'mixed',
      severity: 55,
      confidence: 50,
      facts: [],
      hypotheses: [hypothesis],
      implications: [],
      sourceRefs: [],
      createdAt: new Date().toISOString(),
    })),
    newsSignals: newsBundle.topSignals.slice(0, 10).map((signal, index) => ({
      id: index + 1,
      runId: 0,
      signalKey: signal.id,
      title: signal.title,
      eventType: signal.eventType,
      direction: signal.direction,
      severity: signal.severity,
      confidence: signal.confidence,
      publishedAt: signal.publishedAt,
      supportingUrls: signal.supportingUrls,
      affectedEntities: signal.affectedEntities,
      affectedSectors: signal.affectedSectors,
      whyItMatters: signal.whyItMatters,
      createdAt: new Date().toISOString(),
    })),
  }
}

const createEmptySpendAnalytics = (budgetState: AiBudgetState): DashboardAdvisorSpendAnalyticsResponse => ({
  summary: budgetState,
  daily: [],
  byFeature: [],
  byModel: [],
  anomalies: [],
})

const buildPreviewArtifacts = ({
  summary,
  goals,
  newsBundle,
  spend,
  mode,
  requestId,
  chatEnabled,
}: {
  summary: DashboardSummaryResponse
  goals: DashboardGoalResponse[]
  newsBundle?: NewsContextBundle | null
  spend: DashboardAdvisorSpendAnalyticsResponse
  mode: 'demo' | 'admin'
  requestId: string
  chatEnabled: boolean
}): {
  overview: DashboardAdvisorOverviewResponse
  brief: DashboardAdvisorDailyBriefResponse
  recommendations: DashboardAdvisorRecommendationsResponse
  assumptions: DashboardAdvisorAssumptionsResponse
  signals: DashboardAdvisorSignalsResponse
  snapshot: AdvisorSnapshot
  deterministicRecommendations: DeterministicRecommendation[]
} => {
  const engineInput = mapSummaryToFinanceEngineInput({
    summary,
    goals,
    ...(newsBundle ? { newsBundle } : {}),
  })
  const snapshot = calculateAdvisorSnapshot(engineInput)
  const deterministicRecommendations = generateAdvisorRecommendations({
    snapshot,
    signals: mapNewsBundleToSignals(newsBundle),
  })
  const briefDraft = buildDeterministicBrief({
    snapshot,
    recommendations: deterministicRecommendations,
    signals: mapNewsBundleToSignals(newsBundle),
  })
  const brief: DashboardAdvisorDailyBriefResponse = {
    id: 0,
    runId: 0,
    title: briefDraft.title,
    summary: briefDraft.summary,
    keyFacts: briefDraft.keyFacts,
    opportunities: briefDraft.opportunities,
    risks: briefDraft.risks,
    watchItems: briefDraft.watchItems,
    recommendationNotes: briefDraft.recommendationNotes as Array<Record<string, unknown>>,
    provider: null,
    model: null,
    createdAt: new Date().toISOString(),
  }
  const recommendations: DashboardAdvisorRecommendationsResponse = {
    items: deterministicRecommendations.map(item =>
      toRecommendationResponse({
        item,
        runId: 0,
      })
    ),
  }
  const assumptions: DashboardAdvisorAssumptionsResponse = {
    items: snapshot.assumptions.map((assumption, index) => ({
      id: index + 1,
      runId: 0,
      assumptionKey: assumption.key,
      source: assumption.source,
      value: assumption.value,
      justification: assumption.justification,
      createdAt: new Date().toISOString(),
    })),
  }
  const signals = buildSignalResponses(newsBundle)

  return {
    overview: {
      mode,
      source: mode === 'demo' ? 'demo_fixture' : 'preview',
      requestId,
      generatedAt: new Date().toISOString(),
      status: mode === 'demo' ? 'ready' : 'needs_run',
      degradedMessage:
        mode === 'demo'
          ? 'Mode demo: artefacts deterministes, aucune requete provider.'
          : 'Aucun artefact persiste: apercu deterministe en lecture seule.',
      latestRun: null,
      brief,
      topRecommendations: recommendations.items.slice(0, 5),
      snapshot: toSnapshotResponse({
        snapshot,
        runId: 0,
      }),
      spend: spend.summary,
      signalCounts: {
        macro: signals.macroSignals.length,
        news: signals.newsSignals.length,
      },
      assumptionCount: assumptions.items.length,
      chatEnabled: mode === 'admin' ? chatEnabled : false,
    },
    brief,
    recommendations,
    assumptions,
    signals,
    snapshot,
    deterministicRecommendations,
  }
}

const buildSpendInput = (config: DashboardAdvisorConfig) => ({
  dailyBudgetUsd: config.dailyBudgetUsd,
  monthlyBudgetUsd: config.monthlyBudgetUsd,
  challengerDisableRatio: config.challengerDisableRatio,
  deepAnalysisDisableRatio: config.deepAnalysisDisableRatio,
})

const buildDemoSpend = (config: DashboardAdvisorConfig) =>
  createEmptySpendAnalytics(
    computeAiBudgetState({
      dailyUsdSpent: 0,
      monthlyUsdSpent: 0,
      dailyBudgetUsd: config.dailyBudgetUsd,
      monthlyBudgetUsd: config.monthlyBudgetUsd,
      challengerDisableRatio: config.challengerDisableRatio,
      deepAnalysisDisableRatio: config.deepAnalysisDisableRatio,
    })
  )

const toPromptTemplateRecord = (template: {
  key: string
  version: string
  description: string
  schemaName: string
  systemPrompt: string
  userPromptTemplate: string
  schema: Record<string, unknown>
}) => ({
  templateKey: template.key,
  version: template.version,
  description: template.description,
  schemaName: template.schemaName,
  systemPrompt: template.systemPrompt,
  userPromptTemplate: template.userPromptTemplate,
  schema: template.schema,
})

export const createDashboardAdvisorUseCases = ({
  repository,
  getSummary,
  getGoals,
  getNewsContextBundle,
  getTransactions,
  config,
}: {
  repository: DashboardAdvisorRepository
  getSummary: DashboardUseCases['getSummary']
  getGoals: DashboardUseCases['getGoals']
  getNewsContextBundle?: DashboardUseCases['getNewsContextBundle']
  getTransactions: DashboardUseCases['getTransactions']
  config: DashboardAdvisorConfig
}) => {
  const openAiClient: StructuredClient | null = config.openAi
    ? createOpenAiResponsesClient({
        apiKey: config.openAi.apiKey,
        ...(config.openAi.baseUrl ? { baseUrl: config.openAi.baseUrl } : {}),
        usdToEurRate: config.usdToEurRate,
      })
    : null
  const anthropicClient: StructuredClient | null = config.anthropic
    ? createAnthropicMessagesClient({
        apiKey: config.anthropic.apiKey,
        ...(config.anthropic.baseUrl ? { baseUrl: config.anthropic.baseUrl } : {}),
        usdToEurRate: config.usdToEurRate,
      })
    : null

  const runStructuredStep = async <TOutput>({
    runId,
    stepKey,
    feature,
    provider,
    model,
    client,
    template,
    context,
    maxOutputTokens,
    reasoningEffort,
  }: {
    runId: number
    stepKey: string
    feature: string
    provider: 'openai' | 'anthropic'
    model: string
    client: StructuredClient
    template: {
      key: string
      version: string
      description: string
      schemaName: string
      systemPrompt: string
      userPromptTemplate: string
      schema: Record<string, unknown>
    }
    context: Record<string, unknown>
    maxOutputTokens?: number
    reasoningEffort?: 'low' | 'medium' | 'high'
  }) => {
    await repository.upsertPromptTemplate(toPromptTemplateRecord(template))
    const startedAt = new Date()
    const stepId = await repository.createRunStep({
      runId,
      stepKey,
      status: 'running',
      provider,
      model,
      promptTemplateKey: template.key,
      promptTemplateVersion: template.version,
      startedAt,
    })

    try {
      const result = await client.runStructured<TOutput>({
        feature,
        model,
        systemPrompt: template.systemPrompt,
        userPrompt: renderPrompt(template, context),
        schemaName: template.schemaName,
        schema: template.schema,
        ...(maxOutputTokens ? { maxOutputTokens } : {}),
        ...(reasoningEffort ? { reasoningEffort } : {}),
      })

      await repository.insertModelUsage({
        runId,
        runStepId: stepId,
        ...result.usage,
      })
      await repository.updateRunStep({
        stepId,
        status: 'completed',
        finishedAt: new Date(),
        latencyMs: result.usage.latencyMs,
      })

      return result.output
    } catch (error) {
      await repository.updateRunStep({
        stepId,
        status: 'failed',
        finishedAt: new Date(),
        errorCode: 'LLM_STEP_FAILED',
        errorMessage: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }

  const loadAdminPreview = async ({
    requestId,
  }: {
    requestId: string
  }) => {
    const [summary, goalsResponse, newsBundle, spend] = await Promise.all([
      getSummary('30d'),
      getGoals(),
      getNewsContextBundle ? getNewsContextBundle({ requestId, range: '7d' }) : Promise.resolve(null),
      repository.getSpendAnalytics(buildSpendInput(config)),
    ])

    return buildPreviewArtifacts({
      summary,
      goals: goalsResponse.items,
      ...(newsBundle ? { newsBundle } : {}),
      spend,
      mode: 'admin',
      requestId,
      chatEnabled: config.chatEnabled,
    })
  }

  const executeAdvisorPipeline = async ({
    requestId,
    triggerSource,
    runType,
  }: {
    requestId: string
    triggerSource: string
    runType: 'daily' | 'relabel'
  }) => {
    const spend = await repository.getSpendAnalytics(buildSpendInput(config))
    const budgetState = spend.summary
    const startedAt = Date.now()
    const degradedReasons: string[] = []

    const runId = await repository.createRun({
      runType,
      status: 'running',
      mode: 'admin',
      triggerSource,
      requestId,
      degraded: false,
      budgetState: budgetState as unknown as Record<string, unknown>,
      inputDigest: {
        range: '30d',
        runType,
      },
    })

    await repository.upsertEvalCases(
      DEFAULT_AI_EVAL_CASES.map(item => ({
        caseKey: item.key,
        category: item.category,
        description: item.description,
        input: item.input,
        expectation: item.expectation,
      }))
    )

    const deterministicStepId = await repository.createRunStep({
      runId,
      stepKey: 'deterministic_engine',
      status: 'running',
      startedAt: new Date(),
    })

    try {
      const [summary, goalsResponse, newsBundle, transactionsResponse] = await Promise.all([
        getSummary('30d'),
        getGoals(),
        getNewsContextBundle ? getNewsContextBundle({ requestId, range: '7d' }) : Promise.resolve(null),
        getTransactions({
          range: '30d',
          limit: 40,
          cursor: undefined,
        }),
      ])

      const preview = buildPreviewArtifacts({
        summary,
        goals: goalsResponse.items,
        ...(newsBundle ? { newsBundle } : {}),
        spend,
        mode: 'admin',
        requestId,
        chatEnabled: config.chatEnabled,
      })

      let brief = preview.brief
      const recommendations = preview.recommendations.items.map(item => ({ ...item }))
      let transactionSuggestions = buildDeterministicTransactionSuggestions(transactionsResponse.items)

      await repository.updateRunStep({
        stepId: deterministicStepId,
        status: 'completed',
        finishedAt: new Date(),
        latencyMs: Date.now() - startedAt,
        metadata: {
          recommendationCount: recommendations.length,
          suggestionCount: transactionSuggestions.length,
          signalCount: preview.signals.newsSignals.length,
        },
      })

      if (!config.forceLocalOnly && !budgetState.blocked && openAiClient) {
        const llmBrief = await runStructuredStep<DailyBriefLlmDraft>({
          runId,
          stepKey: 'daily_brief_llm',
          feature: 'advisor_daily_brief',
          provider: 'openai',
          model: config.openAi?.dailyModel ?? 'gpt-5.4-mini',
          client: openAiClient,
          template: DAILY_BRIEF_PROMPT,
          context: {
            snapshot: preview.snapshot,
            recommendations: recommendations.slice(0, 6),
            signals: preview.signals.newsSignals.slice(0, 6),
            assumptions: preview.assumptions.items.slice(0, 8),
          },
          maxOutputTokens: 1400,
          reasoningEffort: budgetState.deepAnalysisAllowed ? 'medium' : 'low',
        })

        if (llmBrief) {
          brief = {
            ...brief,
            title: llmBrief.title,
            summary: llmBrief.summary,
            keyFacts: llmBrief.keyFacts,
            opportunities: llmBrief.opportunities,
            risks: llmBrief.risks,
            watchItems: llmBrief.watchItems,
            recommendationNotes: llmBrief.recommendationNotes as Array<Record<string, unknown>>,
            provider: 'openai',
            model: config.openAi?.dailyModel ?? 'gpt-5.4-mini',
          }
        } else {
          degradedReasons.push('daily_brief_llm_failed')
        }
      } else if (!config.forceLocalOnly && !openAiClient) {
        degradedReasons.push('openai_unavailable')
      } else if (budgetState.blocked) {
        degradedReasons.push('budget_blocked')
      }

      if (!config.forceLocalOnly && config.challengerEnabled && anthropicClient && budgetState.challengerAllowed) {
        for (const recommendation of recommendations.slice(0, 3)) {
          const challenge = await runStructuredStep<RecommendationChallengeDraft>({
            runId,
            stepKey: `challenge_${recommendation.recommendationKey}`,
            feature: 'advisor_challenger',
            provider: 'anthropic',
            model: config.anthropic?.challengerModel ?? 'claude-sonnet-4-6',
            client: anthropicClient,
            template: RECOMMENDATION_CHALLENGE_PROMPT,
            context: {
              recommendation,
              snapshot: preview.snapshot,
              signals: preview.signals.newsSignals.slice(0, 6),
              assumptions: preview.assumptions.items.slice(0, 8),
            },
            maxOutputTokens: 1000,
          })

          if (!challenge) {
            degradedReasons.push(`challenger_failed:${recommendation.recommendationKey}`)
            continue
          }

          recommendation.challengerStatus = challenge.status
          recommendation.challenge = {
            id: 0,
            status: challenge.status,
            summary: challenge.summary,
            contradictions: challenge.contradictions,
            missingSignals: challenge.missingSignals,
            confidenceAdjustment: challenge.confidenceAdjustment,
            provider: 'anthropic',
            model: config.anthropic?.challengerModel ?? 'claude-sonnet-4-6',
            createdAt: new Date().toISOString(),
          }
          recommendation.confidence = Math.max(
            0,
            Math.min(1, recommendation.confidence + challenge.confidenceAdjustment)
          )
          recommendation.llmModelsUsed = [
            ...new Set([
              ...recommendation.llmModelsUsed,
              config.anthropic?.challengerModel ?? 'claude-sonnet-4-6',
            ]),
          ]
        }
      } else if (config.challengerEnabled && !budgetState.challengerAllowed) {
        degradedReasons.push('challenger_budget_guard')
      }

      const ambiguousSuggestions = transactionSuggestions.filter(item => item.confidence < 0.7)
      if (
        !config.forceLocalOnly &&
        config.relabelEnabled &&
        openAiClient &&
        ambiguousSuggestions.length > 0 &&
        !budgetState.blocked
      ) {
        const llmSuggestions = await runStructuredStep<{ suggestions: TransactionLabelSuggestionDraft[] }>({
          runId,
          stepKey: 'transaction_relabel_llm',
          feature: 'advisor_relabel',
          provider: 'openai',
          model: config.openAi?.classifierModel ?? 'gpt-5.4-nano',
          client: openAiClient,
          template: TRANSACTION_LABELS_PROMPT,
          context: {
            transactions: ambiguousSuggestions.map(item => {
              const source = transactionsResponse.items.find(transaction => transaction.id === item.transactionId)
              return {
                transactionId: item.transactionId,
                label: source?.label ?? '',
                accountName: source?.accountName ?? null,
                amount: source?.amount ?? 0,
                direction: source?.direction ?? 'expense',
                resolvedCategory: source?.resolvedCategory ?? null,
                resolutionSource: source?.resolutionSource ?? 'fallback',
              }
            }),
          },
          maxOutputTokens: 1200,
          reasoningEffort: 'low',
        })

        if (llmSuggestions?.suggestions) {
          const byId = new Map(
            llmSuggestions.suggestions.map((item: TransactionLabelSuggestionDraft) => [
              item.transactionId,
              item,
            ])
          )
          transactionSuggestions = transactionSuggestions.map(item => {
            const enriched = byId.get(item.transactionId ?? -1)
            if (!enriched) {
              return item
            }

            return {
              ...item,
              suggestionSource: 'hybrid',
              suggestedKind: enriched.suggestedKind,
              suggestedCategory: enriched.suggestedCategory,
              suggestedSubcategory: enriched.suggestedSubcategory,
              suggestedTags: enriched.suggestedTags,
              confidence: enriched.confidence,
              rationale: enriched.rationale,
              provider: 'openai',
              model: config.openAi?.classifierModel ?? 'gpt-5.4-nano',
            }
          })
        } else {
          degradedReasons.push('transaction_relabel_llm_failed')
        }
      }

      const evalRun = runAdvisorEvals({
        cases: DEFAULT_AI_EVAL_CASES,
        snapshot: preview.snapshot,
        recommendations: preview.deterministicRecommendations,
        budgetState,
        degraded: degradedReasons.length > 0,
      })

      await repository.saveDailyArtifacts({
        runId,
        snapshot: {
          asOfDate: preview.overview.snapshot?.asOfDate ?? new Date().toISOString().slice(0, 10),
          range: preview.snapshot.range,
          currency: preview.snapshot.currency,
          riskProfile: preview.snapshot.riskProfile,
          metrics: preview.snapshot.metrics as unknown as Record<string, unknown>,
          allocationBuckets: preview.snapshot.allocationBuckets as unknown as Array<Record<string, unknown>>,
          assetClassAllocations: preview.snapshot.assetClassAllocations as unknown as Array<Record<string, unknown>>,
          driftSignals: preview.snapshot.driftSignals as unknown as Array<Record<string, unknown>>,
          scenarios: preview.snapshot.scenarios as unknown as Array<Record<string, unknown>>,
          diagnostics: preview.snapshot.diagnostics as unknown as Record<string, unknown>,
        },
        assumptions: preview.assumptions.items.map(item => ({
          assumptionKey: item.assumptionKey,
          source: item.source,
          value: item.value,
          justification: item.justification,
        })),
        brief: {
          title: brief.title,
          summary: brief.summary,
          keyFacts: brief.keyFacts,
          opportunities: brief.opportunities,
          risks: brief.risks,
          watchItems: brief.watchItems,
          recommendationNotes: brief.recommendationNotes,
          ...(brief.provider ? { provider: brief.provider } : {}),
          ...(brief.model ? { model: brief.model } : {}),
          ...(brief.provider ? { promptTemplateKey: DAILY_BRIEF_PROMPT.key } : {}),
          ...(brief.provider ? { promptTemplateVersion: DAILY_BRIEF_PROMPT.version } : {}),
        },
        recommendations: recommendations.map(item => ({
          recommendationKey: item.recommendationKey,
          type: item.type,
          category: item.category,
          title: item.title,
          description: item.description,
          whyNow: item.whyNow,
          evidence: item.evidence,
          assumptions: item.assumptions,
          confidence: item.confidence,
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
          challenge: item.challenge
            ? {
                status: item.challenge.status,
                summary: item.challenge.summary,
                contradictions: item.challenge.contradictions,
                missingSignals: item.challenge.missingSignals,
                confidenceAdjustment: item.challenge.confidenceAdjustment,
                ...(item.challenge.provider ? { provider: item.challenge.provider } : {}),
                ...(item.challenge.model ? { model: item.challenge.model } : {}),
              }
            : null,
        })),
        macroSignals: preview.signals.macroSignals.map(item => ({
          signalKey: item.signalKey,
          title: item.title,
          direction: item.direction,
          severity: item.severity,
          confidence: item.confidence,
          facts: item.facts,
          hypotheses: item.hypotheses,
          implications: item.implications,
          sourceRefs: item.sourceRefs,
        })),
        newsSignals: preview.signals.newsSignals.map(item => ({
          signalKey: item.signalKey,
          title: item.title,
          eventType: item.eventType,
          direction: item.direction,
          severity: item.severity,
          confidence: item.confidence,
          ...(item.publishedAt ? { publishedAt: new Date(item.publishedAt) } : {}),
          supportingUrls: item.supportingUrls,
          affectedEntities: item.affectedEntities,
          affectedSectors: item.affectedSectors,
          whyItMatters: item.whyItMatters,
        })),
        transactionSuggestions,
        evalRun,
      })

      const finishedAt = new Date()
      await repository.updateRun({
        runId,
        status: degradedReasons.length > 0 || evalRun.failedCases > 0 ? 'degraded' : 'completed',
        degraded: degradedReasons.length > 0 || evalRun.failedCases > 0,
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt,
        fallbackReason: degradedReasons[0] ?? null,
        outputDigest: {
          recommendationCount: recommendations.length,
          suggestionCount: transactionSuggestions.length,
          degradedReasons,
        },
        budgetState: budgetState as unknown as Record<string, unknown>,
      })

      const run = (await repository.listRuns(20)).items.find(item => item.id === runId)
      if (!run) {
        throw new Error('Failed to reload advisor run')
      }

      return {
        ok: true,
        requestId,
        run,
      } satisfies DashboardAdvisorRunDailyResponse
    } catch (error) {
      const finishedAt = new Date()
      await repository.updateRun({
        runId,
        status: 'failed',
        degraded: true,
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt,
        errorCode: 'ADVISOR_PIPELINE_FAILED',
        errorMessage: error instanceof Error ? error.message : String(error),
        fallbackReason: degradedReasons[0] ?? 'pipeline_failure',
        budgetState: budgetState as unknown as Record<string, unknown>,
      })

      throw error
    }
  }

  return {
    getAdvisorOverview: async ({ mode, requestId }) => {
      if (mode === 'demo') {
        return buildPreviewArtifacts({
          summary: getDashboardSummaryMock('30d'),
          goals: [],
          spend: buildDemoSpend(config),
          mode: 'demo',
          requestId,
          chatEnabled: false,
        }).overview
      }

      return (
        (await repository.getAdvisorOverview({
          ...buildSpendInput(config),
          chatEnabled: config.chatEnabled,
        })) ??
        (await loadAdminPreview({
          requestId,
        })).overview
      )
    },

    getAdvisorDailyBrief: async ({ mode, requestId }) => {
      if (mode === 'demo') {
        return buildPreviewArtifacts({
          summary: getDashboardSummaryMock('30d'),
          goals: [],
          spend: buildDemoSpend(config),
          mode: 'demo',
          requestId,
          chatEnabled: false,
        }).brief
      }

      return (await repository.getLatestDailyBrief()) ?? (await loadAdminPreview({ requestId })).brief
    },

    getAdvisorRecommendations: async ({ mode, requestId, limit = 20 }) => {
      if (mode === 'demo') {
        return {
          items: buildPreviewArtifacts({
            summary: getDashboardSummaryMock('30d'),
            goals: [],
            spend: buildDemoSpend(config),
            mode: 'demo',
            requestId,
            chatEnabled: false,
          }).recommendations.items.slice(0, limit),
        }
      }

      const persisted = await repository.listRecommendations(limit)
      return persisted.items.length > 0 ? persisted : (await loadAdminPreview({ requestId })).recommendations
    },

    getAdvisorRuns: async ({ mode, limit = 20 }) => {
      return mode === 'demo' ? { items: [] } : repository.listRuns(limit)
    },

    getAdvisorAssumptions: async ({ mode, requestId, limit = 40 }) => {
      if (mode === 'demo') {
        return buildPreviewArtifacts({
          summary: getDashboardSummaryMock('30d'),
          goals: [],
          spend: buildDemoSpend(config),
          mode: 'demo',
          requestId,
          chatEnabled: false,
        }).assumptions
      }

      const persisted = await repository.listAssumptions(limit)
      return persisted.items.length > 0 ? persisted : (await loadAdminPreview({ requestId })).assumptions
    },

    getAdvisorSignals: async ({ mode, requestId, limit = 20 }) => {
      if (mode === 'demo') {
        return buildPreviewArtifacts({
          summary: getDashboardSummaryMock('30d'),
          goals: [],
          spend: buildDemoSpend(config),
          mode: 'demo',
          requestId,
          chatEnabled: false,
        }).signals
      }

      const persisted = await repository.listSignals(limit)
      return persisted.macroSignals.length > 0 || persisted.newsSignals.length > 0
        ? persisted
        : (await loadAdminPreview({ requestId })).signals
    },

    getAdvisorSpend: async ({ mode }) => {
      return mode === 'demo'
        ? buildDemoSpend(config)
        : repository.getSpendAnalytics(buildSpendInput(config))
    },

    runAdvisorDaily: async ({ requestId, triggerSource }) =>
      executeAdvisorPipeline({ requestId, triggerSource, runType: 'daily' }),

    relabelAdvisorTransactions: async ({ requestId, triggerSource }) => {
      const result = await executeAdvisorPipeline({
        requestId,
        triggerSource,
        runType: 'relabel',
      })

      return {
        ok: true,
        requestId,
        run: result.run,
        suggestions: await repository.listTransactionSuggestions(result.run.id, 24),
      } satisfies DashboardAdvisorRelabelResponse
    },

    getAdvisorChat: async ({ mode, threadKey }) => {
      if (mode === 'demo') {
        return {
          threadId: threadKey ?? 'demo-thread',
          title: 'Finance Assistant',
          messages: [],
        }
      }

      return (
        (await repository.listChatMessages(threadKey ?? 'default', config.maxChatMessagesContext)) ?? {
          threadId: threadKey ?? 'default',
          title: 'Finance Assistant',
          messages: [],
        }
      )
    },

    postAdvisorChat: async ({ mode, requestId, threadKey, message }) => {
      if (mode === 'demo') {
        return {
          ok: true,
          requestId,
          thread: {
            threadId: threadKey ?? 'demo-thread',
            title: 'Finance Assistant',
            messages: [
              {
                id: 1,
                role: 'user',
                content: message,
                citations: [],
                assumptions: [],
                caveats: [],
                simulations: [],
                provider: null,
                model: null,
                createdAt: new Date().toISOString(),
              },
              {
                id: 2,
                role: 'assistant',
                content:
                  'Mode demo: reponse deterministe uniquement. Passez en admin pour utiliser les artefacts persistants et les analyses LLM.',
                citations: [],
                assumptions: ['Mode demo sans persistence ni appel provider.'],
                caveats: ['Aucune ecriture ni appel externe en mode demo.'],
                simulations: [],
                provider: null,
                model: null,
                createdAt: new Date().toISOString(),
              },
            ],
          },
        } satisfies DashboardAdvisorChatPostResponse
      }

      const chatStartedAt = Date.now()
      const spend = await repository.getSpendAnalytics(buildSpendInput(config))
      const budgetState = spend.summary
      const runId = await repository.createRun({
        runType: 'chat',
        status: 'running',
        mode,
        triggerSource: 'chat',
        requestId,
        degraded: false,
        budgetState: budgetState as unknown as Record<string, unknown>,
      })

      const context =
        (await repository.getAdvisorOverview({
          ...buildSpendInput(config),
          chatEnabled: config.chatEnabled,
        })) ?? (await loadAdminPreview({ requestId })).overview
      const previewForChat = await loadAdminPreview({ requestId })
      const persistedRecommendations = await repository.listRecommendations(6)

      let answer: ChatGroundedAnswer = buildAdvisorChatFallback({
        question: message,
        snapshot: previewForChat.snapshot,
        recommendations: previewForChat.deterministicRecommendations,
      })

      if (!config.forceLocalOnly && !budgetState.blocked && openAiClient) {
        const llmAnswer = await runStructuredStep<ChatGroundedAnswer>({
          runId,
          stepKey: 'grounded_chat_llm',
          feature: 'advisor_chat',
          provider: 'openai',
          model: config.openAi?.dailyModel ?? 'gpt-5.4-mini',
          client: openAiClient,
          template: CHAT_GROUNDED_PROMPT,
          context: {
            question: message,
            overview: context,
            recommendations: persistedRecommendations.items,
            assumptions: previewForChat.assumptions.items,
            signals: previewForChat.signals.newsSignals.slice(0, 6),
            priorMessages:
              (await repository.listChatMessages(threadKey ?? 'default', config.maxChatMessagesContext))?.messages ??
              [],
          },
          maxOutputTokens: 1200,
          reasoningEffort: budgetState.deepAnalysisAllowed ? 'medium' : 'low',
        })

        if (llmAnswer) {
          answer = llmAnswer
        }
      }

      const appended = await repository.appendChatMessages({
        threadKey: threadKey ?? 'default',
        title: 'Finance Assistant',
        mode,
        runId,
        userMessage: {
          content: message,
        },
        assistantMessage: {
          content: answer.answer,
          citations: answer.citations as Array<Record<string, unknown>>,
          assumptions: answer.assumptions,
          caveats: answer.caveats,
          simulations: answer.simulations as Array<Record<string, unknown>>,
          ...(!config.forceLocalOnly && !budgetState.blocked && openAiClient
            ? {
                provider: 'openai',
                model: config.openAi?.dailyModel ?? 'gpt-5.4-mini',
              }
            : {}),
        },
      })

      await repository.updateRun({
        runId,
        status: 'completed',
        degraded: false,
        finishedAt: new Date(),
        durationMs: Date.now() - chatStartedAt,
        budgetState: budgetState as unknown as Record<string, unknown>,
      })

      return {
        ...appended,
        requestId,
      }
    },

    getAdvisorEvals: async ({ mode }) => {
      if (mode === 'demo') {
        return {
          cases: DEFAULT_AI_EVAL_CASES.map((item, index) => ({
            id: index + 1,
            caseKey: item.key,
            category: item.category,
            description: item.description,
            input: item.input,
            expectation: item.expectation,
            active: true,
          })),
          latestRun: null,
        } satisfies DashboardAdvisorEvalsResponse
      }

      return repository.getEvals()
    },
  } satisfies Pick<
    DashboardUseCases,
    | 'getAdvisorOverview'
    | 'getAdvisorDailyBrief'
    | 'getAdvisorRecommendations'
    | 'getAdvisorRuns'
    | 'getAdvisorAssumptions'
    | 'getAdvisorSignals'
    | 'getAdvisorSpend'
    | 'runAdvisorDaily'
    | 'relabelAdvisorTransactions'
    | 'getAdvisorChat'
    | 'postAdvisorChat'
    | 'getAdvisorEvals'
  >
}
