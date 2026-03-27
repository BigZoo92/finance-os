export type PersistedSyncStatus = 'OK' | 'KO'

export type PersistedSyncReasonCode =
  | 'SUCCESS'
  | 'PARTIAL_IMPORT'
  | 'SYNC_FAILED'
  | 'RECONNECT_REQUIRED'

export type PersistedSyncSnapshot = {
  status: PersistedSyncStatus
  reasonCode: PersistedSyncReasonCode
}

export const resolvePersistedSyncSnapshot = ({
  result,
  rawImportFailedCount = 0,
  transactionGapCount = 0,
}: {
  result: 'success' | 'error' | 'reconnect_required'
  rawImportFailedCount?: number
  transactionGapCount?: number
}): PersistedSyncSnapshot => {
  if (result === 'success') {
    return {
      status: 'OK',
      reasonCode: rawImportFailedCount > 0 || transactionGapCount > 0 ? 'PARTIAL_IMPORT' : 'SUCCESS',
    }
  }

  if (result === 'reconnect_required') {
    return {
      status: 'KO',
      reasonCode: 'RECONNECT_REQUIRED',
    }
  }

  return {
    status: 'KO',
    reasonCode: 'SYNC_FAILED',
  }
}
