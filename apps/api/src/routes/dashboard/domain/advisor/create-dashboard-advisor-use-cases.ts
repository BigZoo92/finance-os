import {
  type AiBudgetState,
  CHAT_GROUNDED_PROMPT,
  type ChatGroundedAnswer,
  compactKnowledgeContextForPrompt,
  computeAiBudgetState,
  createAnthropicMessagesClient,
  createOpenAiResponsesClient,
  DAILY_BRIEF_PROMPT,
  type DailyBriefLlmDraft,
  DEFAULT_AI_EVAL_CASES,
  type KnowledgeContextBundle,
  RECOMMENDATION_CHALLENGE_PROMPT,
  type RecommendationChallengeDraft,
  type StructuredCompletionRequest,
  type StructuredCompletionResult,
  TRANSACTION_LABELS_PROMPT,
  type TransactionLabelSuggestionDraft,
} from '@finance-os/ai'
import type { ExternalInvestmentBundle } from '@finance-os/external-investments'
import {
  type AdvisorSnapshot,
  calculateAdvisorSnapshot,
  type DeterministicRecommendation,
  generateAdvisorRecommendations,
} from '@finance-os/finance-engine'
import { getDashboardSummaryMock } from '../../../../mocks/dashboardSummary.mock'
import { getExternalInvestmentsBundleMock } from '../../../../mocks/externalInvestments.mock'
import type {
  DashboardAdvisorAssumptionsResponse,
  DashboardAdvisorChatPostResponse,
  DashboardAdvisorDailyBriefResponse,
  DashboardAdvisorEvalsResponse,
  DashboardAdvisorKnowledgeAnswerResponse,
  DashboardAdvisorKnowledgeTopicsResponse,
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
import {
  buildAdvisorKnowledgeAnswer,
  buildAdvisorKnowledgeBrowseFallback,
  buildAdvisorKnowledgeTopics,
} from './knowledge-pack'
import {
  mapNewsBundleToSignals,
  mapSummaryToFinanceEngineInput,
} from './map-summary-to-engine-input'
import { runAdvisorEvals } from './run-advisor-evals'
import { roundFiniteNumber, toFiniteNumberOrNull } from '../../utils/number-format'

type StructuredClient = {
  runStructured: <TOutput>(
    request: StructuredCompletionRequest
  ) => Promise<StructuredCompletionResult<TOutput>>
}

export type AdvisorInvestmentContextHealth = {
  degraded: boolean
  insufficientForChallenger: boolean
  confidence: ExternalInvestmentBundle['confidence'] | null
  totalKnownValue: number | null
  unknownValuePositionCount: number | null
  warningCounts: {
    unknownCostBasis: number
    missingMarketData: number
    staleData: number
    riskFlags: number
  }
  degradedProviders: Array<{
    provider: string
    status: string
    stale: boolean
    degradedReasons: string[]
  }>
  missingFields: string[]
}

export type AdvisorChallengerViability = {
  allowed: boolean
  skipReasons: string[]
  details: Record<string, unknown>
}

export interface DashboardAdvisorConfig {
  advisorEnabled: boolean
  adminOnly: boolean
  forceLocalOnly: boolean
  knowledgeRetrievalEnabled: boolean
  chatEnabled: boolean
  challengerEnabled: boolean
  relabelEnabled: boolean
  dailyBudgetUsd: number
  monthlyBudgetUsd: number
  challengerDisableRatio: number
  deepAnalysisDisableRatio: number
  maxChatMessagesContext: number
  usdToEurRate: number
  xSignalsMode: 'off' | 'shadow' | 'enforced'
  openAi: {
    apiKey: string
    baseUrl?: string
    classifierModel: string
    dailyModel: string
    deepModel: string
  } | null
  anthropic: {
    apiKey: string
    baseUrl?: string
    challengerModel: string
  } | null
}

type SocialSignalMode = DashboardAdvisorConfig['xSignalsMode']

export const inspectAdvisorInvestmentContext = (
  bundle: ExternalInvestmentBundle | null | undefined
): AdvisorInvestmentContextHealth | null => {
  if (!bundle) {
    return null
  }

  const missingFields: string[] = []
  const totalKnownValue = toFiniteNumberOrNull(bundle.totalKnownValue)
  const unknownValuePositionCount = toFiniteNumberOrNull(bundle.unknownValuePositionCount)
  if (totalKnownValue === null) {
    missingFields.push('totalKnownValue')
  }
  if (unknownValuePositionCount === null) {
    missingFields.push('unknownValuePositionCount')
  }

  const degradedProviders = bundle.providerCoverage
    .filter(
      coverage =>
        coverage.status === 'degraded' ||
        coverage.status === 'failing' ||
        coverage.stale ||
        coverage.degradedReasons.length > 0
    )
    .map(coverage => ({
      provider: coverage.provider,
      status: coverage.status,
      stale: coverage.stale,
      degradedReasons: coverage.degradedReasons,
    }))

  const configuredProviders = bundle.providerCoverage.filter(coverage => coverage.configured)
  const allConfiguredProvidersUnavailable =
    configuredProviders.length > 0 &&
    configuredProviders.every(
      coverage => coverage.status === 'failing' || coverage.status === 'missing' || coverage.stale
    )
  const warningCounts = {
    unknownCostBasis: bundle.unknownCostBasisWarnings.length,
    missingMarketData: bundle.missingMarketDataWarnings.length,
    staleData: bundle.staleDataWarnings.length,
    riskFlags: bundle.riskFlags.length,
  }
  const degraded =
    missingFields.length > 0 ||
    degradedProviders.length > 0 ||
    warningCounts.unknownCostBasis > 0 ||
    warningCounts.missingMarketData > 0 ||
    warningCounts.staleData > 0 ||
    warningCounts.riskFlags > 0 ||
    bundle.confidence === 'low'

  return {
    degraded,
    insufficientForChallenger:
      missingFields.length > 0 ||
      bundle.confidence === 'low' ||
      allConfiguredProvidersUnavailable ||
      (configuredProviders.length > 0 && (totalKnownValue ?? 0) <= 0),
    confidence: bundle.confidence,
    totalKnownValue,
    unknownValuePositionCount,
    warningCounts,
    degradedProviders,
    missingFields,
  }
}

export const evaluateAdvisorChallengerViability = ({
  budgetState,
  recommendationCount,
  investmentHealth,
}: {
  budgetState: AiBudgetState
  recommendationCount: number
  investmentHealth: AdvisorInvestmentContextHealth | null
}): AdvisorChallengerViability => {
  const skipReasons: string[] = []
  if (budgetState.blocked) {
    skipReasons.push('budget_blocked')
  }
  if (!budgetState.challengerAllowed) {
    skipReasons.push('challenger_budget_guard')
  }
  if (recommendationCount <= 0) {
    skipReasons.push('no_recommendations')
  }
  if (investmentHealth?.insufficientForChallenger) {
    skipReasons.push('investment_context_insufficient')
  }

  return {
    allowed: skipReasons.length === 0,
    skipReasons,
    details: {
      budgetBlocked: budgetState.blocked,
      budgetChallengerAllowed: budgetState.challengerAllowed,
      recommendationCount,
      investmentContext: investmentHealth,
    },
  }
}

const normalizeRecommendationChallenge = (
  challenge: RecommendationChallengeDraft,
  recommendationKey: string
):
  | { ok: true; challenge: RecommendationChallengeDraft }
  | { ok: false; reason: string; details: Record<string, unknown> } => {
  const confidenceAdjustment = toFiniteNumberOrNull(challenge.confidenceAdjustment)
  if (confidenceAdjustment === null) {
    return {
      ok: false,
      reason: `challenger_invalid_numeric:${recommendationKey}:confidenceAdjustment`,
      details: {
        section: 'advisor.challenger',
        recommendationKey,
        field: 'confidenceAdjustment',
      },
    }
  }

  return {
    ok: true,
    challenge: {
      ...challenge,
      confidenceAdjustment: Math.max(-0.5, Math.min(0.2, confidenceAdjustment)),
    },
  }
}

const renderPrompt = (template: { userPromptTemplate: string }, context: Record<string, unknown>) =>
  template.userPromptTemplate.replace('{{context_json}}', JSON.stringify(context))

const toSnapshotResponse = ({ snapshot, runId }: { snapshot: AdvisorSnapshot; runId: number }) => ({
  id: 0,
  runId,
  asOfDate: snapshot.asOf.slice(0, 10),
  range: snapshot.range,
  currency: snapshot.currency,
  riskProfile: snapshot.riskProfile,
  metrics: snapshot.metrics as unknown as Record<string, unknown>,
  allocationBuckets: snapshot.allocationBuckets as unknown as Array<Record<string, unknown>>,
  assetClassAllocations: snapshot.assetClassAllocations as unknown as Array<
    Record<string, unknown>
  >,
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

const buildSignalResponses = (
  newsBundle?: NewsContextBundle | null
): DashboardAdvisorSignalsResponse => {
  const now = Date.now()
  const toEmptySocialSignals = (
    mode: SocialSignalMode
  ): DashboardAdvisorSignalsResponse['socialSignals'] => ({
    mode,
    usedInAdvisorContext: false,
    droppedReason: mode === 'off' ? 'policy_off' : 'empty',
    freshnessState: 'empty',
    deterministicFactsPriority: true,
    maxSignalsPerRun: 3,
    maxExternalSharePct: 35,
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
  })

  if (!newsBundle) {
    return {
      macroSignals: [],
      newsSignals: [],
      socialSignals: toEmptySocialSignals('shadow'),
    }
  }

  const newsSignals = newsBundle.topSignals.slice(0, 10).map((signal, index) => ({
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
  }))

  const xCandidates = newsSignals.filter(item =>
    item.supportingUrls.some(url => url.includes('x.com') || url.includes('twitter.com'))
  )

  const socialSignals: DashboardAdvisorSignalsResponse['socialSignals'] = {
    mode: 'shadow',
    usedInAdvisorContext: false,
    droppedReason: xCandidates.length === 0 ? 'empty' : 'shadow_mode',
    freshnessState: xCandidates.length === 0 ? 'empty' : 'recent',
    deterministicFactsPriority: true,
    maxSignalsPerRun: 3,
    maxExternalSharePct: 35,
    included: xCandidates.slice(0, 3).map(item => {
      const publishedAtMs = item.publishedAt ? Date.parse(item.publishedAt) : now
      const recencyHours = Math.max(0, Math.round((now - publishedAtMs) / (1000 * 60 * 60)))
      const freshnessState =
        recencyHours <= 24 ? 'fresh' : recencyHours <= 72 ? ('recent' as const) : ('stale' as const)
      return {
        signalKey: item.signalKey,
        thesisSummary: item.whyItMatters[0] ?? item.title,
        direction:
          item.direction === 'opportunity'
            ? 'bullish'
            : item.direction === 'risk'
              ? 'bearish'
              : 'neutral',
        confidence: item.confidence,
        recencyHours,
        freshnessState,
        account: {
          handle: 'demo.market.signal',
          trustTier: 'standard',
          accountWeight: 0.55,
        },
        affected: {
          entities: item.affectedEntities,
          tickers: item.affectedEntities.map(entity => entity.toUpperCase()).slice(0, 3),
          themes: item.affectedSectors,
        },
        provenance: {
          source: 'demo_fixture',
          signalId: item.signalKey,
          sourceUrls: item.supportingUrls,
        },
        scoring: {
          total: 0.62,
          trust: 0.55,
          recency: freshnessState === 'fresh' ? 1 : freshnessState === 'recent' ? 0.7 : 0.3,
          convergence: 0.4,
          novelty: 0.6,
          curation: 0.5,
        },
        inclusionReason: 'Shadow mode: candidate retained for observability, not prompt injection.',
      }
    }),
    excluded: [],
    exclusionSummary: {},
    decisionLedger: {
      xSignalCandidates: xCandidates.length,
      xSignalIncluded: Math.min(3, xCandidates.length),
      xSignalExcluded: 0,
      advisorSocialSharePct: xCandidates.length > 0 ? 35 : 0,
      xSignalCapHit: xCandidates.length > 3,
      trustTierContribution: { standard: Math.min(3, xCandidates.length) },
      freshnessHistogram: {},
      inclusionScoreBreakdown: {
        total: 0.62,
        trust: 0.55,
        recency: xCandidates.length > 0 ? 0.7 : 0,
        convergence: 0.4,
        novelty: 0.6,
        curation: 0.5,
      },
      exclusionReasonBreakdown: {},
    },
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
    newsSignals,
    socialSignals,
  }
}

const applySocialSignalPolicy = ({
  signals,
  mode,
  source,
}: {
  signals: DashboardAdvisorSignalsResponse
  mode: SocialSignalMode
  source: 'demo_fixture' | 'persisted_news_signal'
}): DashboardAdvisorSignalsResponse => {
  const maxSignalsPerRun = 3
  const maxExternalSharePct = 35
  const now = Date.now()

  if (mode === 'off') {
    return {
      ...signals,
      socialSignals: {
        mode,
        usedInAdvisorContext: false,
        droppedReason: 'policy_off',
        freshnessState: 'empty',
        deterministicFactsPriority: true,
        maxSignalsPerRun,
        maxExternalSharePct,
        included: [],
        excluded: signals.newsSignals.map(item => ({
          signalKey: item.signalKey,
          handle: 'x.disabled',
          exclusionReason: 'policy_off',
        })),
        exclusionSummary: { policy_off: signals.newsSignals.length },
        decisionLedger: {
          xSignalCandidates: signals.newsSignals.length,
          xSignalIncluded: 0,
          xSignalExcluded: signals.newsSignals.length,
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
          exclusionReasonBreakdown: { policy_off: signals.newsSignals.length },
        },
      },
    }
  }

  const candidates = signals.newsSignals
    .filter(item =>
      item.supportingUrls.some(url => url.includes('x.com') || url.includes('twitter.com'))
    )
    .map(item => {
      const recencyHours = item.publishedAt
        ? Math.max(0, Math.round((now - Date.parse(item.publishedAt)) / (1000 * 60 * 60)))
        : 999
      const freshnessState: 'fresh' | 'recent' | 'stale' =
        recencyHours <= 24 ? 'fresh' : recencyHours <= 72 ? ('recent' as const) : ('stale' as const)
      const trustTier: 'trusted' | 'standard' | 'experimental' =
        source === 'demo_fixture' ? 'standard' : 'trusted'
      const trust = trustTier === 'trusted' ? 0.85 : 0.55
      const recency = freshnessState === 'fresh' ? 1 : freshnessState === 'recent' ? 0.7 : 0.2
      const convergence = item.affectedEntities.length > 1 ? 0.7 : 0.4
      const novelty = item.eventType === 'social_sentiment' ? 0.65 : 0.45
      const curation = source === 'demo_fixture' ? 0.5 : 0.6
      const total =
        trust * 0.35 + recency * 0.25 + convergence * 0.2 + novelty * 0.1 + curation * 0.1
      return {
        item,
        recencyHours,
        freshnessState,
        trustTier,
        total,
        trust,
        recency,
        convergence,
        novelty,
        curation,
      }
    })
    .sort((a, b) => b.total - a.total)

  const included: DashboardAdvisorSignalsResponse['socialSignals']['included'] = []
  const excluded: DashboardAdvisorSignalsResponse['socialSignals']['excluded'] = []

  for (const candidate of candidates) {
    if (candidate.freshnessState === 'stale') {
      excluded.push({
        signalKey: candidate.item.signalKey,
        handle: candidate.item.signalKey,
        exclusionReason: 'stale',
      })
      continue
    }
    if (candidate.total < 0.45) {
      excluded.push({
        signalKey: candidate.item.signalKey,
        handle: candidate.item.signalKey,
        exclusionReason: 'low_score',
      })
      continue
    }
    if (included.length >= maxSignalsPerRun) {
      excluded.push({
        signalKey: candidate.item.signalKey,
        handle: candidate.item.signalKey,
        exclusionReason: 'signal_cap',
      })
      continue
    }
    included.push({
      signalKey: candidate.item.signalKey,
      thesisSummary: candidate.item.whyItMatters[0] ?? candidate.item.title,
      direction:
        candidate.item.direction === 'positive'
          ? 'bullish'
          : candidate.item.direction === 'negative'
            ? 'bearish'
            : 'neutral',
      confidence: candidate.item.confidence,
      recencyHours: candidate.recencyHours,
      freshnessState: candidate.freshnessState,
      account: {
        handle: candidate.item.signalKey,
        trustTier: candidate.trustTier,
        accountWeight: roundFiniteNumber({ value: candidate.trust, digits: 2 }),
      },
      affected: {
        entities: candidate.item.affectedEntities,
        tickers: candidate.item.affectedEntities.map(entity => entity.toUpperCase()).slice(0, 3),
        themes: candidate.item.affectedSectors,
      },
      provenance: {
        source,
        signalId: candidate.item.signalKey,
        sourceUrls: candidate.item.supportingUrls,
      },
      scoring: {
        total: roundFiniteNumber({ value: candidate.total, digits: 3 }),
        trust: roundFiniteNumber({ value: candidate.trust, digits: 3 }),
        recency: roundFiniteNumber({ value: candidate.recency, digits: 3 }),
        convergence: roundFiniteNumber({ value: candidate.convergence, digits: 3 }),
        novelty: roundFiniteNumber({ value: candidate.novelty, digits: 3 }),
        curation: roundFiniteNumber({ value: candidate.curation, digits: 3 }),
      },
      inclusionReason:
        mode === 'shadow'
          ? 'Shadow mode scoring only; signal kept out of advisor prompt.'
          : 'Included under bounded policy (trust, recency, convergence, novelty, curation).',
    })
  }

  const exclusionSummary: Record<string, number> = {}
  for (const item of excluded) {
    exclusionSummary[item.exclusionReason] = (exclusionSummary[item.exclusionReason] ?? 0) + 1
  }
  const trustTierContribution: Record<string, number> = {}
  const freshnessHistogram: Record<string, number> = {}
  const scoreTotals = {
    total: 0,
    trust: 0,
    recency: 0,
    convergence: 0,
    novelty: 0,
    curation: 0,
  }
  for (const item of included) {
    trustTierContribution[item.account.trustTier] =
      (trustTierContribution[item.account.trustTier] ?? 0) + 1
    freshnessHistogram[item.freshnessState] = (freshnessHistogram[item.freshnessState] ?? 0) + 1
    scoreTotals.total += item.scoring.total
    scoreTotals.trust += item.scoring.trust
    scoreTotals.recency += item.scoring.recency
    scoreTotals.convergence += item.scoring.convergence
    scoreTotals.novelty += item.scoring.novelty
    scoreTotals.curation += item.scoring.curation
  }
  const includedCount = Math.max(included.length, 1)
  const inclusionScoreBreakdown = {
    total: roundFiniteNumber({ value: scoreTotals.total / includedCount, digits: 3 }),
    trust: roundFiniteNumber({ value: scoreTotals.trust / includedCount, digits: 3 }),
    recency: roundFiniteNumber({ value: scoreTotals.recency / includedCount, digits: 3 }),
    convergence: roundFiniteNumber({
      value: scoreTotals.convergence / includedCount,
      digits: 3,
    }),
    novelty: roundFiniteNumber({ value: scoreTotals.novelty / includedCount, digits: 3 }),
    curation: roundFiniteNumber({ value: scoreTotals.curation / includedCount, digits: 3 }),
  }
  const freshnessState: DashboardAdvisorSignalsResponse['socialSignals']['freshnessState'] =
    candidates.length === 0
      ? 'empty'
      : included.length === 0
        ? 'stale'
        : included.some(item => item.freshnessState === 'fresh')
          ? 'fresh'
          : 'recent'

  return {
    ...signals,
    socialSignals: {
      mode,
      usedInAdvisorContext: mode === 'enforced' && included.length > 0,
      droppedReason:
        candidates.length === 0
          ? 'empty'
          : mode === 'shadow'
            ? 'shadow_mode'
            : included.length === 0
              ? 'stale_or_noisy'
              : null,
      freshnessState,
      deterministicFactsPriority: true,
      maxSignalsPerRun,
      maxExternalSharePct,
      included,
      excluded,
      exclusionSummary,
      decisionLedger: {
        xSignalCandidates: candidates.length,
        xSignalIncluded: included.length,
        xSignalExcluded: excluded.length,
        advisorSocialSharePct: included.length > 0 ? maxExternalSharePct : 0,
        xSignalCapHit: excluded.some(item => item.exclusionReason === 'signal_cap'),
        trustTierContribution,
        freshnessHistogram,
        inclusionScoreBreakdown,
        exclusionReasonBreakdown: exclusionSummary,
      },
    },
  }
}

const createEmptySpendAnalytics = (
  budgetState: AiBudgetState
): DashboardAdvisorSpendAnalyticsResponse => ({
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
  investmentBundle,
  spend,
  mode,
  requestId,
  chatEnabled,
}: {
  summary: DashboardSummaryResponse
  goals: DashboardGoalResponse[]
  newsBundle?: NewsContextBundle | null
  investmentBundle?: ExternalInvestmentBundle | null
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
  investmentBundle: ExternalInvestmentBundle | null
} => {
  const effectiveInvestmentBundle =
    investmentBundle !== undefined
      ? investmentBundle
      : mode === 'demo'
        ? getExternalInvestmentsBundleMock()
        : null
  const engineInput = mapSummaryToFinanceEngineInput({
    summary,
    goals,
    ...(newsBundle ? { newsBundle } : {}),
    ...(effectiveInvestmentBundle ? { investmentBundle: effectiveInvestmentBundle } : {}),
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
  const investmentWatchItems =
    effectiveInvestmentBundle === null
      ? []
      : [
          ...effectiveInvestmentBundle.missingMarketDataWarnings.slice(0, 2),
          ...effectiveInvestmentBundle.unknownCostBasisWarnings.slice(0, 2),
          ...effectiveInvestmentBundle.staleDataWarnings.slice(0, 2),
        ]
  const brief: DashboardAdvisorDailyBriefResponse = {
    id: 0,
    runId: 0,
    title: briefDraft.title,
    summary: briefDraft.summary,
    keyFacts: briefDraft.keyFacts,
    opportunities: briefDraft.opportunities,
    risks: briefDraft.risks,
    watchItems: Array.from(new Set([...briefDraft.watchItems, ...investmentWatchItems])).slice(
      0,
      8
    ),
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
  const signals = applySocialSignalPolicy({
    signals: buildSignalResponses(newsBundle),
    mode: 'shadow',
    source: mode === 'demo' ? 'demo_fixture' : 'persisted_news_signal',
  })

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
        social: signals.socialSignals.included.length,
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
    investmentBundle: effectiveInvestmentBundle,
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

const resolveKnowledgeAvailability = (config: DashboardAdvisorConfig) => {
  if (config.forceLocalOnly) {
    return {
      retrievalEnabled: false,
      browseOnlyReason: 'provider_disable_switch' as const,
    }
  }

  if (!config.knowledgeRetrievalEnabled) {
    return {
      retrievalEnabled: false,
      browseOnlyReason: 'retrieval_kill_switch' as const,
    }
  }

  return {
    retrievalEnabled: true,
    browseOnlyReason: null,
  }
}

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

export type AdvisorKnowledgeContextFetcher = (input: {
  requestId: string
  mode: 'admin' | 'demo' | 'internal'
  snapshot: AdvisorSnapshot
  recommendations: DeterministicRecommendation[]
  advisorTask: string
}) => Promise<KnowledgeContextBundle | null>

export const createDashboardAdvisorUseCases = ({
  repository,
  getSummary,
  getGoals,
  getNewsContextBundle,
  getInvestmentContextBundle,
  getTransactions,
  getKnowledgeContextBundle,
  config,
  structuredClients,
}: {
  repository: DashboardAdvisorRepository
  getSummary: DashboardUseCases['getSummary']
  getGoals: DashboardUseCases['getGoals']
  getNewsContextBundle?: DashboardUseCases['getNewsContextBundle']
  getInvestmentContextBundle?: (input: {
    requestId: string
  }) => Promise<ExternalInvestmentBundle | null>
  getTransactions: DashboardUseCases['getTransactions']
  getKnowledgeContextBundle?: AdvisorKnowledgeContextFetcher
  config: DashboardAdvisorConfig
  structuredClients?: {
    openAi?: StructuredClient | null
    anthropic?: StructuredClient | null
  }
}) => {
  const openAiClient: StructuredClient | null =
    structuredClients?.openAi !== undefined
      ? structuredClients.openAi
      : config.openAi
        ? createOpenAiResponsesClient({
            apiKey: config.openAi.apiKey,
            ...(config.openAi.baseUrl ? { baseUrl: config.openAi.baseUrl } : {}),
            usdToEurRate: config.usdToEurRate,
          })
        : null
  const anthropicClient: StructuredClient | null =
    structuredClients?.anthropic !== undefined
      ? structuredClients.anthropic
      : config.anthropic
        ? createAnthropicMessagesClient({
            apiKey: config.anthropic.apiKey,
            ...(config.anthropic.baseUrl ? { baseUrl: config.anthropic.baseUrl } : {}),
            usdToEurRate: config.usdToEurRate,
          })
        : null

  const resolveKnowledgeBundle = async ({
    requestId,
    mode,
    snapshot,
    recommendations,
    advisorTask,
  }: {
    requestId: string
    mode: 'admin' | 'demo' | 'internal'
    snapshot: AdvisorSnapshot
    recommendations: DeterministicRecommendation[]
    advisorTask: string
  }): Promise<{ bundle: KnowledgeContextBundle | null; degradedReason: string | null }> => {
    if (!getKnowledgeContextBundle) {
      return { bundle: null, degradedReason: 'knowledge_context_disabled' }
    }
    try {
      const bundle = await getKnowledgeContextBundle({
        requestId,
        mode,
        snapshot,
        recommendations,
        advisorTask,
      })
      if (!bundle) {
        return { bundle: null, degradedReason: 'knowledge_context_unavailable' }
      }
      return {
        bundle,
        degradedReason: bundle.degraded
          ? `knowledge_context_degraded:${bundle.fallbackReason ?? 'unknown'}`
          : null,
      }
    } catch {
      return { bundle: null, degradedReason: 'knowledge_context_failed' }
    }
  }

  const knowledgeContextForPrompt = (
    bundle: KnowledgeContextBundle | null
  ): {
    knowledgeContext?: {
      summary: string
      tokenEstimate: number
      confidence: number
      recency: number
      degraded: boolean
      mode: string
      contradictions: Array<{ id: string; title: string }>
      assumptions: Array<{ id: string; title: string }>
      unknowns: string[]
      retrievalExplanation: string[]
      provenanceCount: number
    }
  } => {
    if (!bundle) {
      return {}
    }
    const compactedText = compactKnowledgeContextForPrompt({ bundle })
    return {
      knowledgeContext: {
        summary: compactedText,
        tokenEstimate: bundle.tokenEstimate,
        confidence: bundle.confidence,
        recency: bundle.recency,
        degraded: bundle.degraded,
        mode: bundle.mode,
        contradictions: bundle.contradictoryEvidence
          .slice(0, 4)
          .map(item => ({ id: item.id, title: item.title })),
        assumptions: bundle.assumptions
          .slice(0, 4)
          .map(item => ({ id: item.id, title: item.title })),
        unknowns: bundle.unknowns.slice(0, 4),
        retrievalExplanation: bundle.retrievalExplanation.slice(0, 3),
        provenanceCount: bundle.provenance.length,
      },
    }
  }

  const investmentContextForPrompt = (
    bundle: ExternalInvestmentBundle | null | undefined
  ): {
    investmentContext?: Record<string, unknown>
  } => {
    if (!bundle) {
      return {}
    }

    return {
      investmentContext: {
        schemaVersion: bundle.schemaVersion,
        generatedAt: bundle.generatedAt,
        providerCoverage: bundle.providerCoverage,
        totalKnownValue: bundle.totalKnownValue,
        unknownValuePositionCount: bundle.unknownValuePositionCount,
        allocationByAssetClass: bundle.allocationByAssetClass.slice(0, 8),
        allocationByProvider: bundle.allocationByProvider,
        allocationByCurrency: bundle.allocationByCurrency.slice(0, 8),
        topConcentrations: bundle.topConcentrations.slice(0, 8),
        cryptoExposure: bundle.cryptoExposure,
        stablecoinExposure: bundle.stablecoinExposure,
        cashDrag: bundle.cashDrag,
        pnlSummary: bundle.pnlSummary,
        feesSummary: bundle.feesSummary,
        unknownCostBasisWarnings: bundle.unknownCostBasisWarnings.slice(0, 8),
        missingMarketDataWarnings: bundle.missingMarketDataWarnings.slice(0, 8),
        staleDataWarnings: bundle.staleDataWarnings.slice(0, 8),
        riskFlags: bundle.riskFlags.slice(0, 8),
        assumptions: bundle.assumptions.slice(0, 8),
        confidence: bundle.confidence,
      },
    }
  }

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

  const loadAdminPreview = async ({ requestId }: { requestId: string }) => {
    const [summary, goalsResponse, newsBundle, investmentBundle, spend] = await Promise.all([
      getSummary('30d'),
      getGoals(),
      getNewsContextBundle
        ? getNewsContextBundle({ requestId, range: '7d' })
        : Promise.resolve(null),
      getInvestmentContextBundle
        ? getInvestmentContextBundle({ requestId })
        : Promise.resolve(null),
      repository.getSpendAnalytics(buildSpendInput(config)),
    ])

    return buildPreviewArtifacts({
      summary,
      goals: goalsResponse.items,
      ...(newsBundle ? { newsBundle } : {}),
      ...(investmentBundle ? { investmentBundle } : {}),
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
    const addDegradedReason = (reason: string) => {
      if (!degradedReasons.includes(reason)) {
        degradedReasons.push(reason)
      }
    }
    const pipelineMetadata: Record<string, unknown> = {}

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
      const [summary, goalsResponse, newsBundle, investmentBundle, transactionsResponse] = await Promise.all([
        getSummary('30d'),
        getGoals(),
        getNewsContextBundle
          ? getNewsContextBundle({ requestId, range: '7d' })
          : Promise.resolve(null),
        getInvestmentContextBundle
          ? getInvestmentContextBundle({ requestId })
          : Promise.resolve(null),
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
        ...(investmentBundle ? { investmentBundle } : {}),
        spend,
        mode: 'admin',
        requestId,
        chatEnabled: config.chatEnabled,
      })

      let brief = preview.brief
      const recommendations = preview.recommendations.items.map(item => ({ ...item }))
      let transactionSuggestions = buildDeterministicTransactionSuggestions(
        transactionsResponse.items
      )
      const investmentHealth = inspectAdvisorInvestmentContext(investmentBundle)
      if (investmentHealth) {
        pipelineMetadata.investmentContext = investmentHealth
      }
      if (investmentHealth?.degraded) {
        addDegradedReason('investment_context_degraded')
      }

      await repository.updateRunStep({
        stepId: deterministicStepId,
        status: 'completed',
        finishedAt: new Date(),
        latencyMs: Date.now() - startedAt,
        metadata: {
          recommendationCount: recommendations.length,
          suggestionCount: transactionSuggestions.length,
          signalCount: preview.signals.newsSignals.length,
          xSignalCandidates: preview.signals.socialSignals.decisionLedger.xSignalCandidates,
          xSignalIncluded: preview.signals.socialSignals.decisionLedger.xSignalIncluded,
          xSignalExcluded: preview.signals.socialSignals.decisionLedger.xSignalExcluded,
          advisorSocialSharePct: preview.signals.socialSignals.decisionLedger.advisorSocialSharePct,
          xSignalCapHit: preview.signals.socialSignals.decisionLedger.xSignalCapHit,
          inclusionScoreBreakdown:
            preview.signals.socialSignals.decisionLedger.inclusionScoreBreakdown,
          exclusionReasonBreakdown:
            preview.signals.socialSignals.decisionLedger.exclusionReasonBreakdown,
          freshnessState: preview.signals.socialSignals.freshnessState,
          xUsedInPrompt:
            config.xSignalsMode === 'enforced' && preview.signals.socialSignals.included.length > 0,
          xDroppedReason: preview.signals.socialSignals.droppedReason,
        },
      })

      const dailyKnowledge = await resolveKnowledgeBundle({
        requestId,
        mode: 'admin',
        snapshot: preview.snapshot,
        recommendations: preview.deterministicRecommendations,
        advisorTask: 'daily-brief',
      })
      if (dailyKnowledge.degradedReason) {
        addDegradedReason(dailyKnowledge.degradedReason)
      }

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
            socialSignals:
              config.xSignalsMode !== 'off'
                ? preview.signals.socialSignals.included.slice(0, 3)
                : [],
            socialSignalCaveats:
              config.xSignalsMode === 'shadow'
                ? [
                    'Social signals are provided as supplementary context only.',
                    'Do not base recommendations solely on social signal content.',
                    'Verify claims against official sources before citing.',
                    'Include source attribution and confidence level when referencing.',
                  ]
                : config.xSignalsMode === 'enforced'
                  ? [
                      'Social signals are enrichment context. Always cite source and confidence.',
                      'Never recommend solely based on a single social post.',
                    ]
                  : [],
            assumptions: preview.assumptions.items.slice(0, 8),
            ...investmentContextForPrompt(investmentBundle),
            ...knowledgeContextForPrompt(dailyKnowledge.bundle),
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
          addDegradedReason('daily_brief_llm_failed')
        }
      } else if (!config.forceLocalOnly && !openAiClient) {
        addDegradedReason('openai_unavailable')
      } else if (budgetState.blocked) {
        addDegradedReason('budget_blocked')
      }

      const challengerViability = evaluateAdvisorChallengerViability({
        budgetState,
        recommendationCount: recommendations.length,
        investmentHealth,
      })
      pipelineMetadata.challenger = {
        status: challengerViability.allowed ? 'eligible' : 'skipped',
        skipReasons: challengerViability.skipReasons,
        details: challengerViability.details,
      }

      if (
        !config.forceLocalOnly &&
        config.challengerEnabled &&
        anthropicClient &&
        challengerViability.allowed
      ) {
        pipelineMetadata.challenger = {
          status: 'running',
          skipReasons: [],
          details: challengerViability.details,
        }
        for (const recommendation of recommendations.slice(0, 3)) {
          const challengeKnowledge = await resolveKnowledgeBundle({
            requestId,
            mode: 'admin',
            snapshot: preview.snapshot,
            recommendations: [
              ...preview.deterministicRecommendations.filter(
                item => item.category === recommendation.category
              ),
              ...preview.deterministicRecommendations.filter(
                item => item.category !== recommendation.category
              ),
            ].slice(0, 4),
            advisorTask: `challenger:${recommendation.category}`,
          })
          if (challengeKnowledge.degradedReason) {
            addDegradedReason(challengeKnowledge.degradedReason)
          }
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
              socialSignals:
                config.xSignalsMode !== 'off'
                  ? preview.signals.socialSignals.included.slice(0, 2)
                  : [],
              socialSignalCaveats:
                config.xSignalsMode !== 'off'
                  ? ['Social signals are supplementary context. Verify before citing.']
                  : [],
              assumptions: preview.assumptions.items.slice(0, 8),
              ...investmentContextForPrompt(investmentBundle),
              ...knowledgeContextForPrompt(challengeKnowledge.bundle),
            },
            maxOutputTokens: 1000,
          })

          if (!challenge) {
            addDegradedReason(`challenger_failed:${recommendation.recommendationKey}`)
            continue
          }

          const normalizedChallenge = normalizeRecommendationChallenge(
            challenge,
            recommendation.recommendationKey
          )
          if (!normalizedChallenge.ok) {
            addDegradedReason(normalizedChallenge.reason)
            pipelineMetadata.challenger = {
              status: 'degraded',
              skipReasons: [],
              details: {
                ...challengerViability.details,
                invalidOutput: normalizedChallenge.details,
              },
            }
            continue
          }
          const validChallenge = normalizedChallenge.challenge

          recommendation.challengerStatus = validChallenge.status
          recommendation.challenge = {
            id: 0,
            status: validChallenge.status,
            summary: validChallenge.summary,
            contradictions: validChallenge.contradictions,
            missingSignals: validChallenge.missingSignals,
            confidenceAdjustment: validChallenge.confidenceAdjustment,
            provider: 'anthropic',
            model: config.anthropic?.challengerModel ?? 'claude-sonnet-4-6',
            createdAt: new Date().toISOString(),
          }
          recommendation.confidence = Math.max(
            0,
            Math.min(1, recommendation.confidence + validChallenge.confidenceAdjustment)
          )
          recommendation.llmModelsUsed = [
            ...new Set([
              ...recommendation.llmModelsUsed,
              config.anthropic?.challengerModel ?? 'claude-sonnet-4-6',
            ]),
          ]
        }
        if ((pipelineMetadata.challenger as { status?: string }).status === 'running') {
          pipelineMetadata.challenger = {
            status: 'completed',
            skipReasons: [],
            details: challengerViability.details,
          }
        }
      } else if (
        !config.forceLocalOnly &&
        config.challengerEnabled &&
        anthropicClient &&
        !challengerViability.allowed
      ) {
        for (const reason of challengerViability.skipReasons) {
          addDegradedReason(reason)
        }
      }

      const ambiguousSuggestions = transactionSuggestions.filter(item => item.confidence < 0.7)
      if (
        !config.forceLocalOnly &&
        config.relabelEnabled &&
        openAiClient &&
        ambiguousSuggestions.length > 0 &&
        !budgetState.blocked
      ) {
        const llmSuggestions = await runStructuredStep<{
          suggestions: TransactionLabelSuggestionDraft[]
        }>({
          runId,
          stepKey: 'transaction_relabel_llm',
          feature: 'advisor_relabel',
          provider: 'openai',
          model: config.openAi?.classifierModel ?? 'gpt-5.4-nano',
          client: openAiClient,
          template: TRANSACTION_LABELS_PROMPT,
          context: {
            transactions: ambiguousSuggestions.map(item => {
              const source = transactionsResponse.items.find(
                transaction => transaction.id === item.transactionId
              )
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
          addDegradedReason('transaction_relabel_llm_failed')
        }
      }

      const finalDegradedReasons = Array.from(new Set(degradedReasons))

      const evalRun = runAdvisorEvals({
        cases: DEFAULT_AI_EVAL_CASES,
        snapshot: preview.snapshot,
        recommendations: preview.deterministicRecommendations,
        budgetState,
        degraded: finalDegradedReasons.length > 0,
      })

      await repository.saveDailyArtifacts({
        runId,
        snapshot: {
          asOfDate: preview.overview.snapshot?.asOfDate ?? new Date().toISOString().slice(0, 10),
          range: preview.snapshot.range,
          currency: preview.snapshot.currency,
          riskProfile: preview.snapshot.riskProfile,
          metrics: preview.snapshot.metrics as unknown as Record<string, unknown>,
          allocationBuckets: preview.snapshot.allocationBuckets as unknown as Array<
            Record<string, unknown>
          >,
          assetClassAllocations: preview.snapshot.assetClassAllocations as unknown as Array<
            Record<string, unknown>
          >,
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
        status:
          finalDegradedReasons.length > 0 || evalRun.failedCases > 0 ? 'degraded' : 'completed',
        degraded: finalDegradedReasons.length > 0 || evalRun.failedCases > 0,
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt,
        fallbackReason: finalDegradedReasons[0] ?? null,
        outputDigest: {
          recommendationCount: recommendations.length,
          suggestionCount: transactionSuggestions.length,
          degradedReasons: finalDegradedReasons,
          challenger: pipelineMetadata.challenger ?? null,
          investmentContext: pipelineMetadata.investmentContext ?? null,
        },
        budgetState: budgetState as unknown as Record<string, unknown>,
        metadata: pipelineMetadata,
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
        metadata: pipelineMetadata,
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
        (
          await loadAdminPreview({
            requestId,
          })
        ).overview
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

      return (
        (await repository.getLatestDailyBrief()) ?? (await loadAdminPreview({ requestId })).brief
      )
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
      return persisted.items.length > 0
        ? persisted
        : (await loadAdminPreview({ requestId })).recommendations
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
      return persisted.items.length > 0
        ? persisted
        : (await loadAdminPreview({ requestId })).assumptions
    },

    getAdvisorSignals: async ({ mode, requestId, limit = 20 }) => {
      if (mode === 'demo') {
        const previewSignals = buildPreviewArtifacts({
          summary: getDashboardSummaryMock('30d'),
          goals: [],
          spend: buildDemoSpend(config),
          mode: 'demo',
          requestId,
          chatEnabled: false,
        }).signals
        return applySocialSignalPolicy({
          signals: previewSignals,
          mode: 'shadow',
          source: 'demo_fixture',
        })
      }

      const persisted = await repository.listSignals(limit)
      if (persisted.macroSignals.length > 0 || persisted.newsSignals.length > 0) {
        return applySocialSignalPolicy({
          signals: persisted,
          mode: config.xSignalsMode,
          source: 'persisted_news_signal',
        })
      }

      const previewSignals = (await loadAdminPreview({ requestId })).signals
      return applySocialSignalPolicy({
        signals: previewSignals,
        mode: config.xSignalsMode,
        source: 'demo_fixture',
      })
    },

    getAdvisorSpend: async ({ mode }) => {
      return mode === 'demo'
        ? buildDemoSpend(config)
        : repository.getSpendAnalytics(buildSpendInput(config))
    },

    getAdvisorKnowledgeTopics: async ({
      mode,
      requestId,
    }): Promise<DashboardAdvisorKnowledgeTopicsResponse> => {
      const availability = resolveKnowledgeAvailability(config)

      return buildAdvisorKnowledgeTopics({
        mode,
        requestId,
        retrievalEnabled: availability.retrievalEnabled,
        browseOnlyReason: availability.browseOnlyReason,
      })
    },

    getAdvisorKnowledgeAnswer: async ({
      mode,
      requestId,
      question,
    }): Promise<DashboardAdvisorKnowledgeAnswerResponse> => {
      const availability = resolveKnowledgeAvailability(config)

      try {
        return buildAdvisorKnowledgeAnswer({
          mode,
          requestId,
          question,
          retrievalEnabled: availability.retrievalEnabled,
          browseOnlyReason: availability.browseOnlyReason,
        })
      } catch {
        return buildAdvisorKnowledgeBrowseFallback({
          mode,
          requestId,
          question,
          retrievalEnabled: availability.retrievalEnabled,
          fallbackReason: 'retrieval_error',
          intent: 'unknown',
          queryParseLatencyMs: 0,
        })
      }
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
        (await repository.listChatMessages(
          threadKey ?? 'default',
          config.maxChatMessagesContext
        )) ?? {
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

      const chatKnowledge = await resolveKnowledgeBundle({
        requestId,
        mode: 'admin',
        snapshot: previewForChat.snapshot,
        recommendations: previewForChat.deterministicRecommendations,
        advisorTask: `chat:${message.slice(0, 80)}`,
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
            socialSignals:
              config.xSignalsMode !== 'off'
                ? previewForChat.signals.socialSignals.included.slice(0, 3)
                : [],
            socialSignalCaveats:
              config.xSignalsMode !== 'off'
                ? [
                    'Social signals are supplementary context. Always cite source and confidence.',
                    'Never present social signal content as verified financial advice.',
                  ]
                : [],
            priorMessages:
              (
                await repository.listChatMessages(
                  threadKey ?? 'default',
                  config.maxChatMessagesContext
                )
              )?.messages ?? [],
            ...investmentContextForPrompt(previewForChat.investmentBundle),
            ...knowledgeContextForPrompt(chatKnowledge.bundle),
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
    | 'getAdvisorKnowledgeTopics'
    | 'getAdvisorKnowledgeAnswer'
    | 'runAdvisorDaily'
    | 'relabelAdvisorTransactions'
    | 'getAdvisorChat'
    | 'postAdvisorChat'
    | 'getAdvisorEvals'
  >
}
