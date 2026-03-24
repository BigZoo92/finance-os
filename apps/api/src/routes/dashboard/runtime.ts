import { createGetDashboardSummaryUseCase } from './domain/create-get-dashboard-summary-use-case'
import { createGetDashboardTransactionsUseCase } from './domain/create-get-dashboard-transactions-use-case'
import { createDashboardReadRepository } from './repositories/dashboard-read-repository'
import type { ApiDb, DashboardRouteRuntime } from './types'

export const createDashboardRouteRuntime = ({ db }: { db: ApiDb }): DashboardRouteRuntime => {
  const readModel = createDashboardReadRepository({ db })

  const getSummary = createGetDashboardSummaryUseCase({
    listAccountsWithConnections: readModel.listAccountsWithConnections,
    listAssets: readModel.listAssets,
    listInvestmentPositions: readModel.listInvestmentPositions,
    getFlowTotals: readModel.getFlowTotals,
    listDailyNetFlows: readModel.listDailyNetFlows,
    listTopExpenseGroups: readModel.listTopExpenseGroups,
  })

  const getTransactions = createGetDashboardTransactionsUseCase({
    listTransactions: readModel.listTransactions,
  })

  return {
    repositories: {
      readModel,
    },
    useCases: {
      getSummary,
      getTransactions,
    },
  }
}
