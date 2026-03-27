import { describe, expect, it } from 'bun:test'
import { resolvePersistedSyncSnapshot } from './sync-status-persistence'

describe('resolvePersistedSyncSnapshot', () => {
  it('marks a clean success as OK with SUCCESS reason', () => {
    expect(resolvePersistedSyncSnapshot({ result: 'success' })).toEqual({
      status: 'OK',
      reasonCode: 'SUCCESS',
    })
  })

  it('marks a partial success as OK with PARTIAL_IMPORT reason', () => {
    expect(
      resolvePersistedSyncSnapshot({
        result: 'success',
        rawImportFailedCount: 2,
      })
    ).toEqual({
      status: 'OK',
      reasonCode: 'PARTIAL_IMPORT',
    })
  })

  it('marks transaction gaps as OK with PARTIAL_IMPORT reason', () => {
    expect(
      resolvePersistedSyncSnapshot({
        result: 'success',
        transactionGapCount: 1,
      })
    ).toEqual({
      status: 'OK',
      reasonCode: 'PARTIAL_IMPORT',
    })
  })


  it('marks integrity issues as OK with PARTIAL_IMPORT reason', () => {
    expect(
      resolvePersistedSyncSnapshot({
        result: 'success',
        integrityIssueCount: 1,
      })
    ).toEqual({
      status: 'OK',
      reasonCode: 'PARTIAL_IMPORT',
    })
  })

  it('maps reconnect failures to KO with RECONNECT_REQUIRED reason', () => {
    expect(resolvePersistedSyncSnapshot({ result: 'reconnect_required' })).toEqual({
      status: 'KO',
      reasonCode: 'RECONNECT_REQUIRED',
    })
  })

  it('maps generic failures to KO with SYNC_FAILED reason', () => {
    expect(resolvePersistedSyncSnapshot({ result: 'error' })).toEqual({
      status: 'KO',
      reasonCode: 'SYNC_FAILED',
    })
  })
})
