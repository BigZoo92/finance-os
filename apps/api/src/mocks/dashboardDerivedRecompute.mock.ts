import type { DashboardDerivedRecomputeStatusResponse } from '../routes/dashboard/types'

export const getDashboardDerivedRecomputeStatusMock =
  (): DashboardDerivedRecomputeStatusResponse => {
    return {
      featureEnabled: true,
      state: 'completed',
      currentSnapshot: {
        snapshotVersion: 'derived-demo-20260323T084200Z',
        finishedAt: '2026-03-23T08:42:00.000Z',
        rowCounts: {
          rawTransactionCount: 32,
          transactionMatchedCount: 32,
          transactionUpdatedCount: 6,
          transactionUnchangedCount: 26,
          transactionSkippedCount: 0,
          rawImportTimestampUpdatedCount: 3,
          snapshotRowCount: 32,
        },
      },
      latestRun: {
        snapshotVersion: 'derived-demo-20260323T084200Z',
        status: 'completed',
        triggerSource: 'admin',
        requestId: 'demo-derived-recompute',
        stage: 'completed',
        rowCounts: {
          rawTransactionCount: 32,
          transactionMatchedCount: 32,
          transactionUpdatedCount: 6,
          transactionUnchangedCount: 26,
          transactionSkippedCount: 0,
          rawImportTimestampUpdatedCount: 3,
          snapshotRowCount: 32,
        },
        safeErrorCode: null,
        safeErrorMessage: null,
        startedAt: '2026-03-23T08:41:54.000Z',
        finishedAt: '2026-03-23T08:42:00.000Z',
        durationMs: 6000,
      },
    }
  }
