import {
  createArchiveDashboardGoalUseCase,
  createCreateDashboardGoalUseCase,
  createGetDashboardGoalsUseCase,
  createUpdateDashboardGoalUseCase,
} from './domain/dashboard-goals'
import { createGetDashboardSummaryUseCase } from './domain/create-get-dashboard-summary-use-case'
import { createGetDashboardTransactionsUseCase } from './domain/create-get-dashboard-transactions-use-case'
import { createUpdateTransactionClassificationUseCase } from './domain/create-update-transaction-classification-use-case'
import { createDashboardReadRepository } from './repositories/dashboard-read-repository'
import { listStaticManualAssets } from './services/list-static-manual-assets'
import type { ApiDb, DashboardRouteRuntime } from './types'

export const createDashboardRouteRuntime = ({ db }: { db: ApiDb }): DashboardRouteRuntime => {
  const readModel = createDashboardReadRepository({ db })

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

  return {
    repositories: {
      readModel,
    },
    useCases: {
      getSummary,
      getTransactions,
      updateTransactionClassification,
      getGoals,
      createGoal,
      updateGoal,
      archiveGoal,
    },
  }
}
