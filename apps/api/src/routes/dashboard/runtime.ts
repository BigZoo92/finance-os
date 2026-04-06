import {
  createArchiveDashboardGoalUseCase,
  createCreateDashboardGoalUseCase,
  createGetDashboardGoalsUseCase,
  createUpdateDashboardGoalUseCase,
} from './domain/dashboard-goals'
import {
  createGetDashboardDerivedRecomputeStatusUseCase,
  createRunDashboardDerivedRecomputeUseCase,
} from './domain/derived-recompute'
import { createGetDashboardSummaryUseCase } from './domain/create-get-dashboard-summary-use-case'
import { createDashboardNewsUseCases } from './domain/dashboard-news'
import { createGetDashboardTransactionsUseCase } from './domain/create-get-dashboard-transactions-use-case'
import { createUpdateTransactionClassificationUseCase } from './domain/create-update-transaction-classification-use-case'
import { createDashboardDerivedRecomputeRepository } from './repositories/dashboard-derived-recompute-repository'
import { createDashboardReadRepository } from './repositories/dashboard-read-repository'
import { listStaticManualAssets } from './services/list-static-manual-assets'
import { fetchLiveNews } from './services/fetch-live-news'
import { createPowensJobQueueRepository } from '../integrations/powens/repositories/powens-job-queue-repository'
import type { ApiDb, DashboardRouteRuntime, RedisClient } from './types'

export const createDashboardRouteRuntime = ({
  db,
  redisClient,
  featureEnabled,
  liveNewsIngestionEnabled,
  transactionsSnapshotStaleAfterMinutes,
}: {
  db: ApiDb
  redisClient: RedisClient
  featureEnabled: boolean
  liveNewsIngestionEnabled: boolean
  transactionsSnapshotStaleAfterMinutes: number
}): DashboardRouteRuntime => {
  const readModel = createDashboardReadRepository({ db })
  const derivedRecompute = createDashboardDerivedRecomputeRepository({ db })
  const powensJobs = createPowensJobQueueRepository(redisClient)

  const getSummary = createGetDashboardSummaryUseCase({
    listAccountsWithConnections: readModel.listAccountsWithConnections,
    listAssets: readModel.listAssets,
    listStaticManualAssets,
    listInvestmentPositions: readModel.listInvestmentPositions,
    getFlowTotals: readModel.getFlowTotals,
    listDailyNetFlows: readModel.listDailyNetFlows,
    listTopExpenseGroups: readModel.listTopExpenseGroups,
  })

  const getTransactions = createGetDashboardTransactionsUseCase({
    listTransactions: readModel.listTransactions,
    listTransactionSyncMetadata: readModel.listTransactionSyncMetadata,
    now: () => new Date(),
    staleAfterMinutes: transactionsSnapshotStaleAfterMinutes,
  })
  const requestTransactionsBackgroundRefresh: DashboardRouteRuntime['useCases']['requestTransactionsBackgroundRefresh'] =
    async ({ requestId }) => {
      const dedupeKey = 'powens:dashboard:transactions:background-refresh'
      const dedupeResult = await redisClient.set(dedupeKey, requestId, {
        NX: true,
        EX: 120,
      })
      if (dedupeResult !== 'OK') {
        return false
      }
      await powensJobs.enqueueAllConnectionsSync({ requestId })
      return true
    }
  const updateTransactionClassification = createUpdateTransactionClassificationUseCase({
    updateTransactionClassification: readModel.updateTransactionClassification,
  })
  const getGoals = createGetDashboardGoalsUseCase({
    listGoals: readModel.listGoals,
  })
  const createGoal = createCreateDashboardGoalUseCase({
    createGoal: readModel.createGoal,
  })
  const updateGoal = createUpdateDashboardGoalUseCase({
    getGoalById: readModel.getGoalById,
    updateGoal: readModel.updateGoal,
  })
  const archiveGoal = createArchiveDashboardGoalUseCase({
    archiveGoal: readModel.archiveGoal,
  })
  const getDerivedRecomputeStatus = createGetDashboardDerivedRecomputeStatusUseCase({
    featureEnabled,
    repository: derivedRecompute,
  })
  const runDerivedRecompute = createRunDashboardDerivedRecomputeUseCase({
    featureEnabled,
    repository: derivedRecompute,
  })
  const news = createDashboardNewsUseCases({
    readModel,
    fetchLiveNews,
    liveIngestionEnabled: liveNewsIngestionEnabled,
  })

  return {
    repositories: {
      readModel,
      derivedRecompute,
    },
    useCases: {
      getSummary,
      getTransactions,
      requestTransactionsBackgroundRefresh,
      updateTransactionClassification,
      getGoals,
      createGoal,
      updateGoal,
      archiveGoal,
      getDerivedRecomputeStatus,
      runDerivedRecompute,
      getNews: news.getNews,
      ingestNews: news.ingestNews,
    },
  }
}
