import type { DashboardRange, DashboardSummaryResponse } from '../routes/dashboard/types'

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

export const getDashboardSummaryMock = (range: DashboardRange): DashboardSummaryResponse => {
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
