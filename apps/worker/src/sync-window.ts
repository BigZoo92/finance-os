type SyncMode = 'full' | 'incremental'

export type SyncWindowReason =
  | 'force_full_sync_enabled'
  | 'manual_full_resync_requested'
  | 'incremental_last_success_lookback'
  | 'incremental_initial_backfill'

export const formatDate = (date: Date) => date.toISOString().slice(0, 10)

const subtractDays = (date: Date, days: number) => {
  const clone = new Date(date)
  clone.setUTCDate(clone.getUTCDate() - days)
  return clone
}

export const resolveSyncWindow = (input: {
  syncStart: Date
  lastSuccessAt: Date | null
  fullResyncRequested: boolean
  forceFullSync: boolean
  incrementalLookbackDays: number
  defaultSyncWindowDays: number
  fullResyncWindowDays: number
}) => {
  const maxDate = formatDate(input.syncStart)

  if (input.forceFullSync) {
    return {
      fromDate: formatDate(subtractDays(input.syncStart, input.fullResyncWindowDays)),
      maxDate,
      syncMode: 'full' as SyncMode,
      reason: 'force_full_sync_enabled' as SyncWindowReason,
    }
  }

  if (input.fullResyncRequested) {
    return {
      fromDate: formatDate(subtractDays(input.syncStart, input.fullResyncWindowDays)),
      maxDate,
      syncMode: 'full' as SyncMode,
      reason: 'manual_full_resync_requested' as SyncWindowReason,
    }
  }

  if (input.lastSuccessAt) {
    return {
      fromDate: formatDate(subtractDays(input.lastSuccessAt, input.incrementalLookbackDays)),
      maxDate,
      syncMode: 'incremental' as SyncMode,
      reason: 'incremental_last_success_lookback' as SyncWindowReason,
    }
  }

  return {
    fromDate: formatDate(subtractDays(input.syncStart, input.defaultSyncWindowDays)),
    maxDate,
    syncMode: 'incremental' as SyncMode,
    reason: 'incremental_initial_backfill' as SyncWindowReason,
  }
}

export const parseDisabledProviders = (value: string[]) =>
  new Set(value.map(provider => provider.trim().toLowerCase()).filter(Boolean))
