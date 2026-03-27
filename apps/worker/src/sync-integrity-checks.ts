export type SyncIntegrityIssueCode =
  | 'MISSING_ACCOUNT_BALANCE'
  | 'TRANSACTION_ACCOUNT_MISMATCH'
  | 'TRANSACTION_ID_REUSED_ACROSS_ACCOUNTS'

export type SyncIntegrityIssue = {
  code: SyncIntegrityIssueCode
  accountId: string
  transactionId?: string
  expectedAccountId?: string
  observedAccountId?: string
}

type SyncAccountInput = {
  powensAccountId: string
  balance: string | null
}

type SyncTransactionObservation = {
  expectedAccountId: string
  observedAccountId: string | null
  transactionId: string | null
}

const buildIssueKey = (issue: SyncIntegrityIssue) => {
  return [
    issue.code,
    issue.accountId,
    issue.transactionId ?? '',
    issue.expectedAccountId ?? '',
    issue.observedAccountId ?? '',
  ].join(':')
}

export const detectSyncIntegrityIssues = ({
  accounts,
  transactions,
}: {
  accounts: SyncAccountInput[]
  transactions: SyncTransactionObservation[]
}): SyncIntegrityIssue[] => {
  const issues: SyncIntegrityIssue[] = []

  for (const account of accounts) {
    if (account.balance === null) {
      issues.push({
        code: 'MISSING_ACCOUNT_BALANCE',
        accountId: account.powensAccountId,
      })
    }
  }

  const transactionAccountById = new Map<string, string>()

  for (const transaction of transactions) {
    if (
      transaction.observedAccountId !== null &&
      transaction.observedAccountId !== transaction.expectedAccountId
    ) {
      issues.push({
        code: 'TRANSACTION_ACCOUNT_MISMATCH',
        accountId: transaction.expectedAccountId,
        expectedAccountId: transaction.expectedAccountId,
        observedAccountId: transaction.observedAccountId,
        ...(transaction.transactionId ? { transactionId: transaction.transactionId } : {}),
      })
    }

    if (!transaction.transactionId) {
      continue
    }

    const previousAccountId = transactionAccountById.get(transaction.transactionId)
    if (!previousAccountId) {
      transactionAccountById.set(transaction.transactionId, transaction.expectedAccountId)
      continue
    }

    if (previousAccountId !== transaction.expectedAccountId) {
      issues.push({
        code: 'TRANSACTION_ID_REUSED_ACROSS_ACCOUNTS',
        accountId: transaction.expectedAccountId,
        transactionId: transaction.transactionId,
        expectedAccountId: transaction.expectedAccountId,
        observedAccountId: previousAccountId,
      })
    }
  }

  const seenKeys = new Set<string>()
  return issues.filter(issue => {
    const key = buildIssueKey(issue)
    if (seenKeys.has(key)) {
      return false
    }

    seenKeys.add(key)
    return true
  })
}
