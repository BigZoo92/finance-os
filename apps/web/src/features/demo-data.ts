import type { AuthMeResponse } from './auth-types'
import type {
  DashboardRange,
  DashboardSummaryResponse,
  DashboardTransactionsResponse,
} from './dashboard-types'
import type {
  PowensAuditTrailResponse,
  PowensStatusResponse,
  PowensSyncRunsResponse,
} from './powens/types'

export const DEMO_AUTH_RESPONSE: AuthMeResponse = {
  mode: 'demo',
  user: null,
}

export const AUTH_UNAVAILABLE_RESPONSE: AuthMeResponse = {
  ...DEMO_AUTH_RESPONSE,
  error: 'auth_unavailable',
}

export const getDemoDashboardSummary = (range: DashboardRange): DashboardSummaryResponse => {
  return {
    range,
    totals: {
      balance: 48320.44,
      incomes: 4120,
      expenses: 1924.67,
    },
    connections: [
      {
        powensConnectionId: 'demo-fortuneo',
        source: 'banking',
        provider: 'powens',
        providerConnectionId: 'demo-fortuneo',
        providerInstitutionId: 'fortuneo',
        providerInstitutionName: 'Fortuneo',
        status: 'connected',
        lastSyncAttemptAt: '2026-02-22T19:20:00.000Z',
        lastSyncAt: '2026-02-22T19:22:00.000Z',
        lastSuccessAt: '2026-02-22T19:22:00.000Z',
        lastFailedAt: null,
        lastError: null,
        syncMetadata: {
          accountCount: 2,
          importedTransactionCount: 32,
          windowDays: 90,
        },
        balance: 33210.44,
        accountCount: 2,
      },
      {
        powensConnectionId: 'demo-revolut',
        source: 'banking',
        provider: 'powens',
        providerConnectionId: 'demo-revolut',
        providerInstitutionId: 'revolut',
        providerInstitutionName: 'Revolut',
        status: 'syncing',
        lastSyncAttemptAt: '2026-02-22T18:45:00.000Z',
        lastSyncAt: '2026-02-22T18:45:00.000Z',
        lastSuccessAt: '2026-02-22T17:59:00.000Z',
        lastFailedAt: '2026-02-21T16:14:00.000Z',
        lastError: null,
        syncMetadata: {
          accountCount: 1,
          importedTransactionCount: 11,
          windowDays: 30,
        },
        balance: 15110,
        accountCount: 1,
      },
    ],
    accounts: [
      {
        powensAccountId: 'demo-fortuneo-checking',
        powensConnectionId: 'demo-fortuneo',
        name: 'Fortuneo Courant',
        currency: 'EUR',
        type: 'checking',
        enabled: true,
        balance: 6210.44,
      },
      {
        powensAccountId: 'demo-fortuneo-savings',
        powensConnectionId: 'demo-fortuneo',
        name: 'Fortuneo Livret',
        currency: 'EUR',
        type: 'savings',
        enabled: true,
        balance: 27000,
      },
      {
        powensAccountId: 'demo-revolut-main',
        powensConnectionId: 'demo-revolut',
        name: 'Revolut Main',
        currency: 'EUR',
        type: 'checking',
        enabled: true,
        balance: 15110,
      },
    ],
    topExpenseGroups: [
      {
        label: 'Courses',
        category: 'Courses',
        merchant: 'Carrefour',
        total: 524.8,
        count: 12,
      },
      {
        label: 'Transport',
        category: 'Transport',
        merchant: 'SNCF',
        total: 244.1,
        count: 5,
      },
      {
        label: 'Restaurants',
        category: 'Restaurants',
        merchant: 'Uber Eats',
        total: 198.34,
        count: 7,
      },
      {
        label: 'Abonnements',
        category: 'Abonnements',
        merchant: 'Spotify',
        total: 54.95,
        count: 5,
      },
      {
        label: 'Shopping',
        category: 'Shopping',
        merchant: 'Amazon',
        total: 311.48,
        count: 4,
      },
    ],
  }
}

const DEMO_TRANSACTIONS: DashboardTransactionsResponse['items'] = [
  {
    id: 12012,
    bookingDate: '2026-02-22',
    amount: -64.2,
    currency: 'EUR',
    direction: 'expense',
    label: 'Carrefour Market',
    powensConnectionId: 'demo-fortuneo',
    powensAccountId: 'demo-fortuneo-checking',
    accountName: 'Fortuneo Courant',
  },
  {
    id: 12011,
    bookingDate: '2026-02-22',
    amount: -12.99,
    currency: 'EUR',
    direction: 'expense',
    label: 'Spotify',
    powensConnectionId: 'demo-revolut',
    powensAccountId: 'demo-revolut-main',
    accountName: 'Revolut Main',
  },
  {
    id: 12010,
    bookingDate: '2026-02-21',
    amount: 2450,
    currency: 'EUR',
    direction: 'income',
    label: 'Salaire',
    powensConnectionId: 'demo-fortuneo',
    powensAccountId: 'demo-fortuneo-checking',
    accountName: 'Fortuneo Courant',
  },
  {
    id: 12009,
    bookingDate: '2026-02-21',
    amount: -35.9,
    currency: 'EUR',
    direction: 'expense',
    label: 'SNCF',
    powensConnectionId: 'demo-fortuneo',
    powensAccountId: 'demo-fortuneo-checking',
    accountName: 'Fortuneo Courant',
  },
  {
    id: 12008,
    bookingDate: '2026-02-20',
    amount: -19.99,
    currency: 'EUR',
    direction: 'expense',
    label: 'Netflix',
    powensConnectionId: 'demo-revolut',
    powensAccountId: 'demo-revolut-main',
    accountName: 'Revolut Main',
  },
  {
    id: 12007,
    bookingDate: '2026-02-19',
    amount: -82.5,
    currency: 'EUR',
    direction: 'expense',
    label: 'TotalEnergies',
    powensConnectionId: 'demo-fortuneo',
    powensAccountId: 'demo-fortuneo-checking',
    accountName: 'Fortuneo Courant',
  },
  {
    id: 12006,
    bookingDate: '2026-02-19',
    amount: -44,
    currency: 'EUR',
    direction: 'expense',
    label: 'Uber',
    powensConnectionId: 'demo-revolut',
    powensAccountId: 'demo-revolut-main',
    accountName: 'Revolut Main',
  },
  {
    id: 12005,
    bookingDate: '2026-02-18',
    amount: -93.4,
    currency: 'EUR',
    direction: 'expense',
    label: 'Monoprix',
    powensConnectionId: 'demo-fortuneo',
    powensAccountId: 'demo-fortuneo-checking',
    accountName: 'Fortuneo Courant',
  },
  {
    id: 12004,
    bookingDate: '2026-02-18',
    amount: 38.42,
    currency: 'EUR',
    direction: 'income',
    label: 'Remboursement',
    powensConnectionId: 'demo-fortuneo',
    powensAccountId: 'demo-fortuneo-checking',
    accountName: 'Fortuneo Courant',
  },
  {
    id: 12003,
    bookingDate: '2026-02-17',
    amount: -16.8,
    currency: 'EUR',
    direction: 'expense',
    label: 'Boulangerie',
    powensConnectionId: 'demo-fortuneo',
    powensAccountId: 'demo-fortuneo-checking',
    accountName: 'Fortuneo Courant',
  },
]

const normalizePaginationNumber = (value: number, fallback: number) => {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback
  }

  return Math.floor(value)
}

export const getDemoDashboardTransactions = ({
  range,
  limit,
  cursor,
}: {
  range: DashboardRange
  limit: number
  cursor?: string
}): DashboardTransactionsResponse => {
  const normalizedLimit = normalizePaginationNumber(limit, 30)
  const parsedCursor = cursor ? Number.parseInt(cursor, 10) : 0
  const startIndex = Number.isFinite(parsedCursor) && parsedCursor >= 0 ? parsedCursor : 0
  const endIndex = startIndex + normalizedLimit
  const items = DEMO_TRANSACTIONS.slice(startIndex, endIndex)
  const nextCursor = endIndex < DEMO_TRANSACTIONS.length ? String(endIndex) : null

  return {
    range,
    limit: normalizedLimit,
    nextCursor,
    items,
  }
}

export const getDemoPowensSyncRuns = (): PowensSyncRunsResponse => {
  return {
    runs: [
      {
        id: 'demo-sync-run-1',
        requestId: 'req-demo-1',
        connectionId: 'demo-fortuneo',
        startedAt: '2026-02-22T19:20:00.000Z',
        endedAt: '2026-02-22T19:22:00.000Z',
        result: 'success',
      },
      {
        id: 'demo-sync-run-2',
        requestId: 'req-demo-2',
        connectionId: 'demo-revolut',
        startedAt: '2026-02-22T18:44:00.000Z',
        endedAt: '2026-02-22T18:45:00.000Z',
        result: 'error',
        errorMessage: 'Powens timeout while fetching transactions',
        errorFingerprint: 'powens timeout while fetching transactions',
      },
      {
        id: 'demo-sync-run-3',
        requestId: 'req-demo-3',
        connectionId: 'demo-fortuneo',
        startedAt: '2026-02-22T18:00:00.000Z',
        endedAt: null,
        result: 'running',
      },
    ],
  }
}

export const getDemoPowensAuditTrail = (): PowensAuditTrailResponse => {
  return {
    requestId: 'demo-audit',
    events: [
      {
        id: 'demo-callback-1',
        action: 'callback',
        result: 'allowed',
        actorMode: 'state',
        at: '2026-03-23T08:42:00.000Z',
        requestId: 'demo-powens-callback',
        connectionId: 'demo-fortuneo',
      },
    ],
  }
}

export const getDemoPowensStatus = (): PowensStatusResponse => {
  return {
    safeModeActive: false,
    lastCallback: {
      receivedAt: '2026-03-23T08:42:00.000Z',
      status: 'allowed',
      actorMode: 'state',
      requestId: 'demo-powens-callback',
      connectionId: 'demo-fortuneo',
    },
    connections: [
      {
        id: 1,
        source: 'banking',
        provider: 'powens',
        powensConnectionId: 'demo-fortuneo',
        providerConnectionId: 'demo-fortuneo',
        providerInstitutionId: 'fortuneo',
        providerInstitutionName: 'Fortuneo',
        status: 'connected',
        lastSyncAttemptAt: '2026-02-22T19:20:00.000Z',
        lastSyncAt: '2026-02-22T19:22:00.000Z',
        lastSuccessAt: '2026-02-22T19:22:00.000Z',
        lastFailedAt: null,
        lastError: null,
        syncMetadata: {
          accountCount: 2,
          importedTransactionCount: 32,
          windowDays: 90,
        },
        createdAt: '2026-01-15T10:00:00.000Z',
        updatedAt: '2026-02-22T19:22:00.000Z',
      },
      {
        id: 2,
        source: 'banking',
        provider: 'powens',
        powensConnectionId: 'demo-revolut',
        providerConnectionId: 'demo-revolut',
        providerInstitutionId: 'revolut',
        providerInstitutionName: 'Revolut',
        status: 'syncing',
        lastSyncAttemptAt: '2026-02-22T18:45:00.000Z',
        lastSyncAt: '2026-02-22T18:45:00.000Z',
        lastSuccessAt: '2026-02-22T17:59:00.000Z',
        lastFailedAt: '2026-02-21T16:14:00.000Z',
        lastError: null,
        syncMetadata: {
          accountCount: 1,
          importedTransactionCount: 11,
          windowDays: 30,
        },
        createdAt: '2026-01-19T09:30:00.000Z',
        updatedAt: '2026-02-22T18:45:00.000Z',
      },
    ],
  }
}
