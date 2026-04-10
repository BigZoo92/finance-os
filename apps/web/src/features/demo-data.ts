import type { AuthMeResponse } from './auth-types'
import type {
  DashboardDerivedRecomputeStatusResponse,
  DashboardRange,
  DashboardSummaryResponse,
  DashboardTransactionsResponse,
  DashboardNewsResponse,
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

const RANGE_TO_DAYS: Record<DashboardRange, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
}

const MOCK_TODAY = '2026-02-22'
const MOCK_DAILY_NET_FLOW_BY_DATE = new Map<string, number>([
  ['2026-02-16', -150.5],
  ['2026-02-18', 280],
  ['2026-02-19', -86.9],
  ['2026-02-21', -124.3],
  ['2026-02-22', 96.2],
])

const toMoney = (value: number) => Math.round(value * 100) / 100

const toDateOnly = (value: Date) => value.toISOString().slice(0, 10)

const getRangeStartDate = (range: DashboardRange) => {
  const start = new Date(`${MOCK_TODAY}T00:00:00.000Z`)
  start.setUTCDate(start.getUTCDate() - (RANGE_TO_DAYS[range] - 1))
  return toDateOnly(start)
}

const listDatesInRange = (range: DashboardRange) => {
  const dates: string[] = []
  const cursor = new Date(`${getRangeStartDate(range)}T00:00:00.000Z`)
  const end = new Date(`${MOCK_TODAY}T00:00:00.000Z`)

  while (cursor.getTime() <= end.getTime()) {
    dates.push(toDateOnly(cursor))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return dates
}

const buildDailyWealthSnapshots = (
  range: DashboardRange,
  totalBalance: number
): DashboardSummaryResponse['dailyWealthSnapshots'] => {
  let runningBalance = totalBalance
  const snapshotsDescending: DashboardSummaryResponse['dailyWealthSnapshots'] = []

  for (const date of [...listDatesInRange(range)].reverse()) {
    snapshotsDescending.push({
      date,
      balance: toMoney(runningBalance),
    })

    runningBalance = toMoney(runningBalance - (MOCK_DAILY_NET_FLOW_BY_DATE.get(date) ?? 0))
  }

  return snapshotsDescending.reverse()
}

export const getDemoDashboardSummary = (range: DashboardRange): DashboardSummaryResponse => {
  return {
    range,
    totals: {
      balance: 67070.44,
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
    assets: [
      {
        assetId: 1,
        type: 'cash',
        origin: 'provider',
        source: 'banking',
        provider: 'powens',
        providerConnectionId: 'demo-fortuneo',
        providerInstitutionName: 'Fortuneo',
        powensConnectionId: 'demo-fortuneo',
        powensAccountId: 'demo-fortuneo-checking',
        name: 'Fortuneo Courant',
        currency: 'EUR',
        valuation: 6210.44,
        valuationAsOf: '2026-02-22T19:22:00.000Z',
        enabled: true,
        metadata: null,
      },
      {
        assetId: 2,
        type: 'cash',
        origin: 'provider',
        source: 'banking',
        provider: 'powens',
        providerConnectionId: 'demo-fortuneo',
        providerInstitutionName: 'Fortuneo',
        powensConnectionId: 'demo-fortuneo',
        powensAccountId: 'demo-fortuneo-savings',
        name: 'Fortuneo Livret',
        currency: 'EUR',
        valuation: 27000,
        valuationAsOf: '2026-02-22T19:22:00.000Z',
        enabled: true,
        metadata: null,
      },
      {
        assetId: 3,
        type: 'cash',
        origin: 'provider',
        source: 'banking',
        provider: 'powens',
        providerConnectionId: 'demo-revolut',
        providerInstitutionName: 'Revolut',
        powensConnectionId: 'demo-revolut',
        powensAccountId: 'demo-revolut-main',
        name: 'Revolut Main',
        currency: 'EUR',
        valuation: 15110,
        valuationAsOf: '2026-02-22T18:45:00.000Z',
        enabled: true,
        metadata: null,
      },
      {
        assetId: 4,
        type: 'investment',
        origin: 'manual',
        source: 'manual',
        provider: null,
        providerConnectionId: null,
        providerInstitutionName: null,
        powensConnectionId: null,
        powensAccountId: null,
        name: 'PEA ETF Monde',
        currency: 'EUR',
        valuation: 12450,
        valuationAsOf: '2026-02-22T00:00:00.000Z',
        enabled: true,
        metadata: {
          valuationSource: 'manual_snapshot',
        },
      },
      {
        assetId: 5,
        type: 'manual',
        origin: 'manual',
        source: 'manual',
        provider: null,
        providerConnectionId: null,
        providerInstitutionName: null,
        powensConnectionId: null,
        powensAccountId: null,
        name: 'Or familial',
        currency: 'EUR',
        valuation: 6300,
        valuationAsOf: null,
        enabled: true,
        metadata: {
          note: 'Estimation statique',
        },
      },
    ],
    positions: [
      {
        positionId: 1,
        positionKey: 'demo-pea-etf-monde-open',
        assetId: 4,
        powensAccountId: null,
        powensConnectionId: null,
        source: 'manual',
        provider: null,
        providerConnectionId: null,
        providerPositionId: null,
        assetName: 'PEA ETF Monde',
        accountName: 'PEA Bourse',
        name: 'ETF Monde CW8',
        currency: 'EUR',
        quantity: 18.7345,
        costBasis: 10980,
        costBasisSource: 'minimal',
        currentValue: 12450,
        lastKnownValue: 12380,
        openedAt: '2024-01-15T00:00:00.000Z',
        closedAt: null,
        valuedAt: '2026-02-22T00:00:00.000Z',
        lastSyncedAt: '2026-02-22T19:22:00.000Z',
        enabled: true,
        metadata: {
          pricingMode: 'manual_snapshot',
        },
      },
    ],
    dailyWealthSnapshots: buildDailyWealthSnapshots(range, 67070.44),
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
    category: 'Courses',
    subcategory: 'Supermarche',
    resolvedCategory: 'Courses',
    resolutionSource: 'fallback',
    resolutionRuleId: null,
    resolutionTrace: [],
    incomeType: null,
    tags: ['essentiel'],
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
    category: 'Abonnements',
    subcategory: 'Musique',
    resolvedCategory: 'Abonnements',
    resolutionSource: 'fallback',
    resolutionRuleId: null,
    resolutionTrace: [],
    incomeType: null,
    tags: ['loisir'],
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
    category: 'Revenus',
    subcategory: 'Salaire',
    resolvedCategory: 'Revenus',
    resolutionSource: 'fallback',
    resolutionRuleId: null,
    resolutionTrace: [],
    incomeType: 'salary',
    tags: ['mensuel'],
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
    category: 'Transport',
    subcategory: 'Train',
    resolvedCategory: 'Transport',
    resolutionSource: 'fallback',
    resolutionRuleId: null,
    resolutionTrace: [],
    incomeType: null,
    tags: ['deplacement'],
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
    category: 'Abonnements',
    subcategory: 'Video',
    resolvedCategory: 'Abonnements',
    resolutionSource: 'fallback',
    resolutionRuleId: null,
    resolutionTrace: [],
    incomeType: null,
    tags: ['loisir'],
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
    category: 'Transport',
    subcategory: 'Carburant',
    resolvedCategory: 'Transport',
    resolutionSource: 'fallback',
    resolutionRuleId: null,
    resolutionTrace: [],
    incomeType: null,
    tags: ['vehicule'],
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
    category: 'Transport',
    subcategory: 'VTC',
    resolvedCategory: 'Transport',
    resolutionSource: 'fallback',
    resolutionRuleId: null,
    resolutionTrace: [],
    incomeType: null,
    tags: ['deplacement'],
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
    category: 'Courses',
    subcategory: 'Supermarche',
    resolvedCategory: 'Courses',
    resolutionSource: 'fallback',
    resolutionRuleId: null,
    resolutionTrace: [],
    incomeType: null,
    tags: ['essentiel'],
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
    category: 'Revenus',
    subcategory: 'Remboursement',
    resolvedCategory: 'Revenus',
    resolutionSource: 'fallback',
    resolutionRuleId: null,
    resolutionTrace: [],
    incomeType: 'exceptional',
    tags: ['ponctuel'],
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
    category: 'Courses',
    subcategory: 'Alimentation',
    resolvedCategory: 'Courses',
    resolutionSource: 'fallback',
    resolutionRuleId: null,
    resolutionTrace: [],
    incomeType: null,
    tags: ['quotidien'],
    powensConnectionId: 'demo-fortuneo',
    powensAccountId: 'demo-fortuneo-checking',
    accountName: 'Fortuneo Courant',
  },
  {
    id: 12002,
    bookingDate: '2026-01-29',
    amount: -148.35,
    currency: 'EUR',
    direction: 'expense',
    label: 'Carrefour Drive',
    category: 'Courses',
    subcategory: 'Supermarche',
    resolvedCategory: 'Courses',
    resolutionSource: 'fallback',
    resolutionRuleId: null,
    resolutionTrace: [],
    incomeType: null,
    tags: ['essentiel'],
    powensConnectionId: 'demo-fortuneo',
    powensAccountId: 'demo-fortuneo-checking',
    accountName: 'Fortuneo Courant',
  },
  {
    id: 12001,
    bookingDate: '2026-01-24',
    amount: -58,
    currency: 'EUR',
    direction: 'expense',
    label: 'SNCF',
    category: 'Transport',
    subcategory: 'Train',
    resolvedCategory: 'Transport',
    resolutionSource: 'fallback',
    resolutionRuleId: null,
    resolutionTrace: [],
    incomeType: null,
    tags: ['deplacement'],
    powensConnectionId: 'demo-fortuneo',
    powensAccountId: 'demo-fortuneo-checking',
    accountName: 'Fortuneo Courant',
  },
  {
    id: 12000,
    bookingDate: '2025-12-27',
    amount: -82.9,
    currency: 'EUR',
    direction: 'expense',
    label: 'Ubereats',
    category: 'Restaurants',
    subcategory: 'Livraison',
    resolvedCategory: 'Restaurants',
    resolutionSource: 'fallback',
    resolutionRuleId: null,
    resolutionTrace: [],
    incomeType: null,
    tags: ['loisir'],
    powensConnectionId: 'demo-revolut',
    powensAccountId: 'demo-revolut-main',
    accountName: 'Revolut Main',
  },
]

const CURSOR_PATTERN = /^(\d{4}-\d{2}-\d{2})\|(\d+)$/

const normalizePaginationNumber = (value: number, fallback: number) => {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback
  }

  return Math.floor(value)
}

const decodeDashboardCursor = (value: string | undefined) => {
  if (!value) {
    return null
  }

  const match = CURSOR_PATTERN.exec(value)
  if (!match) {
    return null
  }

  const [, bookingDate, rawId] = match
  if (!bookingDate || !rawId) {
    return null
  }

  const id = Number(rawId)
  if (!Number.isInteger(id) || id <= 0) {
    return null
  }

  return {
    bookingDate,
    id,
  }
}

const encodeDashboardCursor = (cursor: { bookingDate: string; id: number }) => {
  return `${cursor.bookingDate}|${cursor.id}`
}

const isBeforeCursor = (params: {
  bookingDate: string
  id: number
  cursor: { bookingDate: string; id: number }
}) => {
  if (params.bookingDate < params.cursor.bookingDate) {
    return true
  }

  if (params.bookingDate > params.cursor.bookingDate) {
    return false
  }

  return params.id < params.cursor.id
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
  const decodedCursor = decodeDashboardCursor(cursor)

  const visible = decodedCursor
    ? DEMO_TRANSACTIONS.filter(item =>
        isBeforeCursor({
          bookingDate: item.bookingDate,
          id: item.id,
          cursor: decodedCursor,
        })
      )
    : DEMO_TRANSACTIONS

  const rows = visible.slice(0, normalizedLimit + 1)
  const hasNextPage = rows.length > normalizedLimit
  const items = hasNextPage ? rows.slice(0, normalizedLimit) : rows
  const tail = items[items.length - 1]

  return {
    schemaVersion: '2026-04-04',
    range,
    limit: normalizedLimit,
    nextCursor:
      hasNextPage && tail
        ? encodeDashboardCursor({
            bookingDate: tail.bookingDate,
            id: tail.id,
          })
        : null,
    freshness: {
      strategy: 'snapshot-first',
      lastSyncedAt: '2026-02-22T18:45:00.000Z',
      syncStatus: 'fresh',
      degradedReason: null,
      snapshotAgeSeconds: 60,
      refreshRequested: false,
    },
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
        connectionId: 'demo-boursorama',
        startedAt: '2026-02-22T17:40:00.000Z',
        endedAt: '2026-02-22T17:41:00.000Z',
        result: 'error',
        errorMessage: 'Powens timeout while fetching transactions',
        errorFingerprint: 'powens timeout while fetching transactions',
      },
      {
        id: 'demo-sync-run-3',
        requestId: 'req-demo-3',
        connectionId: 'demo-bnp',
        startedAt: '2026-02-22T14:12:00.000Z',
        endedAt: '2026-02-22T14:13:00.000Z',
        result: 'reconnect_required',
        errorMessage: 'Strong customer authentication expired',
        errorFingerprint: 'strong customer authentication expired',
      },
      {
        id: 'demo-sync-run-4',
        requestId: 'req-demo-4',
        connectionId: 'demo-revolut',
        startedAt: '2026-02-22T18:47:00.000Z',
        endedAt: null,
        result: 'running',
      },
    ],
  }
}

export const getDemoDashboardDerivedRecomputeStatus =
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
    syncStatusPersistenceEnabled: true,
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
        lastSyncStatus: 'OK',
        lastSyncReasonCode: 'SUCCESS',
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
        lastSyncStatus: 'KO',
        lastSyncReasonCode: 'SYNC_FAILED',
        lastSyncAttemptAt: '2026-02-22T18:47:00.000Z',
        lastSyncAt: '2026-02-22T18:45:00.000Z',
        lastSuccessAt: '2026-02-22T17:59:00.000Z',
        lastFailedAt: '2026-02-22T18:46:30.000Z',
        lastError: null,
        syncMetadata: {
          accountCount: 1,
          importedTransactionCount: 11,
          windowDays: 30,
        },
        createdAt: '2026-01-19T09:30:00.000Z',
        updatedAt: '2026-02-22T18:47:00.000Z',
      },
      {
        id: 3,
        source: 'banking',
        provider: 'powens',
        powensConnectionId: 'demo-boursorama',
        providerConnectionId: 'demo-boursorama',
        providerInstitutionId: 'boursorama',
        providerInstitutionName: 'Boursorama Banque',
        status: 'error',
        lastSyncStatus: 'KO',
        lastSyncReasonCode: 'SYNC_FAILED',
        lastSyncAttemptAt: '2026-02-22T17:40:00.000Z',
        lastSyncAt: '2026-02-22T17:40:00.000Z',
        lastSuccessAt: '2026-02-22T15:18:00.000Z',
        lastFailedAt: '2026-02-22T17:41:00.000Z',
        lastError: 'Powens timeout while fetching transactions',
        syncMetadata: {
          accountCount: 3,
          importedTransactionCount: 0,
          windowDays: 90,
        },
        createdAt: '2026-01-10T09:10:00.000Z',
        updatedAt: '2026-02-22T17:41:00.000Z',
      },
      {
        id: 4,
        source: 'banking',
        provider: 'powens',
        powensConnectionId: 'demo-bnp',
        providerConnectionId: 'demo-bnp',
        providerInstitutionId: 'bnp',
        providerInstitutionName: 'BNP Paribas',
        status: 'reconnect_required',
        lastSyncStatus: 'KO',
        lastSyncReasonCode: 'RECONNECT_REQUIRED',
        lastSyncAttemptAt: '2026-02-22T14:12:00.000Z',
        lastSyncAt: '2026-02-22T14:12:00.000Z',
        lastSuccessAt: '2026-02-20T08:45:00.000Z',
        lastFailedAt: '2026-02-22T14:13:00.000Z',
        lastError: 'Strong customer authentication expired',
        syncMetadata: {
          accountCount: 2,
          importedTransactionCount: 0,
          windowDays: 30,
        },
        createdAt: '2026-01-08T07:20:00.000Z',
        updatedAt: '2026-02-22T14:13:00.000Z',
      },
    ],
  }
}


export const getDemoDashboardNews = (): DashboardNewsResponse => {
  const items: DashboardNewsResponse['items'] = [
    {
      id: 'demo-news-1',
      title: 'Fed minutes reinforce a slower easing path while credit spreads stay contained',
      summary: 'The tone remains data-dependent, but policy communication still matters for duration-sensitive assets.',
      contentSnippet: 'Contained spreads offset part of the hawkish surprise, leaving a mixed market signal.',
      url: 'https://example.com/demo-news-1',
      canonicalUrl: 'https://example.com/demo-news-1',
      sourceName: 'Federal Reserve',
      sourceDomain: 'federalreserve.gov',
      sourceType: 'central_bank',
      topic: 'monetary_policy',
      language: 'en',
      publishedAt: '2026-04-09T08:15:00.000Z',
      domains: ['macroeconomy', 'central_banks', 'monetary_policy', 'credit'],
      categories: ['macro'],
      subcategories: ['monetary-policy'],
      eventType: 'policy_speech',
      severity: 71,
      severityLabel: 'high',
      confidence: 91,
      novelty: 55,
      marketImpactScore: 73,
      relevanceScore: 84,
      direction: 'mixed',
      riskFlags: ['rate_risk', 'policy_risk'],
      opportunityFlags: ['credit_improvement'],
      affectedEntities: [
        {
          name: 'Federal Reserve',
          type: 'institution',
          role: 'primary',
          confidence: 92,
        },
      ],
      affectedTickers: [],
      affectedSectors: ['Financials', 'Real estate'],
      affectedThemes: ['rates', 'credit'],
      transmissionHypotheses: [
        {
          id: 'rates-repricing',
          label: 'Rate path repricing can move duration, FX and growth expectations.',
          direction: 'mixed',
          confidence: 82,
        },
      ],
      whyItMatters: [
        'Central-bank communication can move rates, FX and duration-sensitive assets quickly.',
      ],
      scoringReasons: ['macro policy relevance', 'high-sensitivity event type'],
      metadataCard: {
        title: 'Fed minutes reinforce a slower easing path while credit spreads stay contained',
        description: 'A mixed macro signal with direct implications for rates and financing conditions.',
        canonicalUrl: 'https://example.com/demo-news-1',
        imageUrl: null,
        imageCandidates: [],
        imageAlt: null,
        siteName: 'Federal Reserve',
        displayUrl: 'example.com',
        faviconUrl: null,
        faviconCandidates: [],
        publishedAt: '2026-04-09T08:15:00.000Z',
        author: null,
        articleType: 'Article',
      },
      metadataFetchStatus: 'fetched',
      eventClusterId: 'demo-cluster-rates',
      provenance: {
        sourceCount: 1,
        providerCount: 1,
        providers: ['fed_rss'],
        sourceDomains: ['federalreserve.gov'],
      },
      sources: [
        {
          provider: 'fed_rss',
          providerArticleId: 'demo-fed-1',
          sourceName: 'Federal Reserve',
          sourceDomain: 'federalreserve.gov',
          sourceType: 'central_bank',
          publishedAt: '2026-04-09T08:15:00.000Z',
          providerUrl: 'https://example.com/demo-news-1',
        },
      ],
    },
    {
      id: 'demo-news-2',
      title: 'A new Claude variant lands in security workflows and pressures AI tooling pricing',
      summary: 'Enterprise demand could expand, but pricing power may compress across adjacent AI vendors.',
      contentSnippet: 'The launch sits at the intersection of AI, cyber and cloud software.',
      url: 'https://example.com/demo-news-2',
      canonicalUrl: 'https://example.com/demo-news-2',
      sourceName: 'Demo Wire',
      sourceDomain: 'example.com',
      sourceType: 'media',
      topic: 'ai',
      language: 'en',
      publishedAt: '2026-04-09T07:05:00.000Z',
      domains: ['technology', 'ai', 'cybersecurity', 'model_releases'],
      categories: ['technology'],
      subcategories: ['ai'],
      eventType: 'model_release',
      severity: 64,
      severityLabel: 'medium',
      confidence: 69,
      novelty: 83,
      marketImpactScore: 68,
      relevanceScore: 82,
      direction: 'mixed',
      riskFlags: ['execution_risk'],
      opportunityFlags: ['innovation_upside', 'productivity_upside'],
      affectedEntities: [
        {
          name: 'Anthropic',
          type: 'company',
          role: 'primary',
          confidence: 88,
        },
        {
          name: 'Microsoft',
          type: 'company',
          role: 'affected',
          confidence: 74,
        },
      ],
      affectedTickers: ['MSFT'],
      affectedSectors: ['AI software', 'Cybersecurity', 'Cloud software'],
      affectedThemes: ['ai', 'cyber'],
      transmissionHypotheses: [
        {
          id: 'competitive-repricing',
          label: 'New product capabilities can shift pricing power and market-share assumptions.',
          direction: 'mixed',
          confidence: 74,
        },
      ],
      whyItMatters: [
        'Innovation catalysts can pull forward productivity and market-share assumptions.',
        'Likely spillover sectors: AI software, Cybersecurity, Cloud software.',
      ],
      scoringReasons: ['technology regime shift relevance', 'multi-sector spillover'],
      metadataCard: {
        title: 'A new Claude variant lands in security workflows and pressures AI tooling pricing',
        description: 'A product release with second-order effects across AI, cyber and cloud vendors.',
        canonicalUrl: 'https://example.com/demo-news-2',
        imageUrl: null,
        imageCandidates: [],
        imageAlt: null,
        siteName: 'Demo Wire',
        displayUrl: 'example.com',
        faviconUrl: null,
        faviconCandidates: [],
        publishedAt: '2026-04-09T07:05:00.000Z',
        author: null,
        articleType: 'Article',
      },
      metadataFetchStatus: 'fetched',
      eventClusterId: 'demo-cluster-ai',
      provenance: {
        sourceCount: 1,
        providerCount: 1,
        providers: ['gdelt_doc'],
        sourceDomains: ['example.com'],
      },
      sources: [
        {
          provider: 'gdelt_doc',
          providerArticleId: 'demo-ai-1',
          sourceName: 'Demo Wire',
          sourceDomain: 'example.com',
          sourceType: 'media',
          publishedAt: '2026-04-09T07:05:00.000Z',
          providerUrl: 'https://example.com/demo-news-2',
        },
      ],
    },
  ]
  const macroItem = items[0]
  const aiItem = items[1]

  if (!macroItem || !aiItem) {
    throw new Error('Demo dashboard news fixture is misconfigured')
  }

  return {
    source: 'demo_fixture',
    dataset: {
      version: 'dashboard-fixture-pack:2026-04-09',
      source: 'demo_fixture',
      mode: 'demo',
      isDemoData: true,
    },
    resilience: {
      domain: 'news',
      status: 'ok',
      source: 'demo',
      requestId: 'demo-news-request',
      reasonCode: null,
      policy: {
        enabled: true,
        sourceOrder: ['demo'],
      },
      slo: {
        degradedRate: 0,
        hardFailRate: 0,
        staleAgeSeconds: null,
      },
    },
    lastUpdatedAt: '2026-04-09T09:00:00.000Z',
    staleCache: false,
    providerError: null,
    metrics: {
      cacheHitRate: 1,
      dedupeDropRate: 0,
      providerFailureRate: 0,
      lastFetchedCount: 2,
      lastInsertedCount: 2,
      lastMergedCount: 0,
    },
    filters: {
      applied: {},
    },
    providers: [
      {
        provider: 'fed_rss',
        label: 'Federal Reserve RSS',
        enabled: true,
        status: 'healthy',
        lastSuccessAt: '2026-04-09T09:00:00.000Z',
        lastAttemptAt: '2026-04-09T09:00:00.000Z',
        lastFailureAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        successCount: 1,
        failureCount: 0,
        skippedCount: 0,
        lastFetchedCount: 1,
        lastInsertedCount: 1,
        lastMergedCount: 0,
        cooldownUntil: null,
      },
    ],
    clusters: [
      {
        clusterId: 'demo-cluster-rates',
        title: macroItem.title,
        eventType: macroItem.eventType,
        direction: macroItem.direction,
        signalCount: 1,
        sourceCount: 1,
        latestPublishedAt: macroItem.publishedAt,
        topDomains: macroItem.domains,
        topSectors: macroItem.affectedSectors,
        headlineIds: [macroItem.id],
      },
      {
        clusterId: 'demo-cluster-ai',
        title: aiItem.title,
        eventType: aiItem.eventType,
        direction: aiItem.direction,
        signalCount: 1,
        sourceCount: 1,
        latestPublishedAt: aiItem.publishedAt,
        topDomains: aiItem.domains,
        topSectors: aiItem.affectedSectors,
        headlineIds: [aiItem.id],
      },
    ],
    contextPreview: {
      topSignals: items.map(item => ({
        id: item.id,
        title: item.title,
        publishedAt: item.publishedAt,
        eventType: item.eventType,
        direction: item.direction,
        severity: item.severity,
        confidence: item.confidence,
        novelty: item.novelty,
        marketImpactScore: item.marketImpactScore,
        relevanceScore: item.relevanceScore,
        sourceCount: item.provenance.sourceCount,
        providerCount: item.provenance.providerCount,
        affectedEntities: item.affectedEntities.map(entity => entity.name),
        affectedSectors: item.affectedSectors,
        affectedTickers: item.affectedTickers,
        whyItMatters: item.whyItMatters,
        supportingUrls: item.sources.map(source => source.providerUrl).filter((value): value is string => Boolean(value)),
      })),
      mostImpactedSectors: [
        { sector: 'Financials', score: 73 },
        { sector: 'AI software', score: 68 },
      ],
      mostImpactedEntities: [
        { entity: 'Federal Reserve', score: 73 },
        { entity: 'Anthropic', score: 68 },
      ],
      contradictorySignals: [],
      causalHypotheses: [
        'Rate path repricing can move duration, FX and growth expectations.',
        'New product capabilities can shift pricing power and market-share assumptions.',
      ],
    },
    items,
  }
}
