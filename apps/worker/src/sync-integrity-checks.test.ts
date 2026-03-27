import { describe, expect, it } from 'bun:test'
import { detectSyncIntegrityIssues } from './sync-integrity-checks'

describe('detectSyncIntegrityIssues', () => {
  it('flags accounts with missing balances', () => {
    expect(
      detectSyncIntegrityIssues({
        accounts: [
          { powensAccountId: 'acc-1', balance: null },
          { powensAccountId: 'acc-2', balance: '12.00' },
        ],
        transactions: [],
      })
    ).toEqual([
      {
        code: 'MISSING_ACCOUNT_BALANCE',
        accountId: 'acc-1',
      },
    ])
  })

  it('flags transaction account mismatches and reused ids across accounts', () => {
    expect(
      detectSyncIntegrityIssues({
        accounts: [],
        transactions: [
          {
            expectedAccountId: 'acc-1',
            observedAccountId: 'acc-2',
            transactionId: 'tx-1',
          },
          {
            expectedAccountId: 'acc-2',
            observedAccountId: 'acc-2',
            transactionId: 'tx-1',
          },
        ],
      })
    ).toEqual([
      {
        code: 'TRANSACTION_ACCOUNT_MISMATCH',
        accountId: 'acc-1',
        expectedAccountId: 'acc-1',
        observedAccountId: 'acc-2',
        transactionId: 'tx-1',
      },
      {
        code: 'TRANSACTION_ID_REUSED_ACROSS_ACCOUNTS',
        accountId: 'acc-2',
        expectedAccountId: 'acc-2',
        observedAccountId: 'acc-1',
        transactionId: 'tx-1',
      },
    ])
  })

  it('deduplicates repeated integrity issues', () => {
    expect(
      detectSyncIntegrityIssues({
        accounts: [{ powensAccountId: 'acc-1', balance: null }],
        transactions: [
          {
            expectedAccountId: 'acc-1',
            observedAccountId: 'acc-2',
            transactionId: 'tx-1',
          },
          {
            expectedAccountId: 'acc-1',
            observedAccountId: 'acc-2',
            transactionId: 'tx-1',
          },
        ],
      })
    ).toEqual([
      {
        code: 'MISSING_ACCOUNT_BALANCE',
        accountId: 'acc-1',
      },
      {
        code: 'TRANSACTION_ACCOUNT_MISMATCH',
        accountId: 'acc-1',
        expectedAccountId: 'acc-1',
        observedAccountId: 'acc-2',
        transactionId: 'tx-1',
      },
    ])
  })
})
