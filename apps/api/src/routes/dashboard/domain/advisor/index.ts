/**
 * Public surface of the `advisor` bounded module. Code outside this folder
 * imports from here only (enforced by architecture-boundaries.test.ts).
 */

export type { AdvisorKnowledgeContextFetcher } from './create-dashboard-advisor-use-cases'
export { createDashboardAdvisorUseCases } from './create-dashboard-advisor-use-cases'
export {
  createDecisionJournalUseCases,
  isDecisionJournalValidationError,
} from './create-decision-journal-use-cases'
export { createAdvisorManualRefreshAndRunUseCases } from './create-manual-refresh-and-run-use-case'
export { createFineTuningReadinessUseCase } from './fine-tuning/create-fine-tuning-readiness-use-case'
export type { AdvisorFineTuningReadinessResponse } from './fine-tuning/fine-tuning-types'
export { createAdvisorBehaviorAnalyticsUseCase } from './get-advisor-behavior-analytics'
export { createAdvisorEvalTrendsUseCase } from './get-advisor-eval-trends'
export type {
  AssetSearchInput,
  GenerateActionPlanInput,
  InvestmentStrategyUpdateInput,
  ReviewDueInput,
  WatchlistAssetInput,
  WatchlistAssetPatchInput,
} from './investment-strategy-inputs'
export { createInvestmentStrategyUseCases } from './investment-strategy-use-cases'
export {
  getDemoKnowledgeContextBundle,
  getDemoKnowledgeExplain,
  getDemoKnowledgeQuery,
  getDemoKnowledgeSchema,
  getDemoKnowledgeStats,
} from './knowledge-graph-demo'
export type { AdvisorKnowledgeGraphDto, AdvisorKnowledgeGraphScope } from './knowledge-graph-dto'
export { hardenGraphDto } from './knowledge-graph-dto'
export type { KnowledgeBundleShape, KnowledgeQueryShape } from './knowledge-graph-dto-admin'
export { buildAdminKnowledgeGraphDto } from './knowledge-graph-dto-admin'
export { buildDemoKnowledgeGraphDto, buildExampleOverlay } from './knowledge-graph-dto-demo'
export type {
  ExpiredRecommendationContext,
  PersistedPostMortemRow,
  PostMortemListResponse,
  PostMortemRepositoryAdapter,
  PostMortemRunStatus,
} from './post-mortem/create-post-mortem-use-cases'
export { createPostMortemUseCases } from './post-mortem/create-post-mortem-use-cases'
export { createAdvisorReplayUseCase } from './replay/create-replay-use-case'
export type { AdvisorReplayResponse } from './replay/replay-types'
export type { AdvisorV2CapabilitiesResponse, AdvisorV2PreviewResponse } from './v2/committee-types'
export { createAdvisorV2UseCases } from './v2/create-advisor-v2-use-cases'
