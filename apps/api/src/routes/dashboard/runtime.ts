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
import { createGetDashboardTransactionsUseCase } from './domain/create-get-dashboard-transactions-use-case'
import { createUpdateTransactionClassificationUseCase } from './domain/create-update-transaction-classification-use-case'
import { createDashboardDerivedRecomputeRepository } from './repositories/dashboard-derived-recompute-repository'
import { createDashboardReadRepository } from './repositories/dashboard-read-repository'
import { listStaticManualAssets } from './services/list-static-manual-assets'
import type { ApiDb, DashboardRouteRuntime } from './types'

export const createDashboardRouteRuntime = ({
  db,
  featureEnabled,
}: {
  db: ApiDb
  featureEnabled: boolean
}): DashboardRouteRuntime => {
  const readModel = createDashboardReadRepository({ db })
  const derivedRecompute = createDashboardDerivedRecomputeRepository({ db })

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
  })
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

  return {
    repositories: {
      readModel,
      derivedRecompute,
    },
    useCases: {
      getSummary,
      getTransactions,
      updateTransactionClassification,
      getGoals,
      createGoal,
      updateGoal,
      archiveGoal,
      getDerivedRecomputeStatus,
      runDerivedRecompute,
    },
  }
}
