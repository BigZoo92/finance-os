import type { DashboardRange, DashboardSummaryResponse } from '../routes/dashboard/types'

export const getDashboardSummaryMock = (range: DashboardRange): DashboardSummaryResponse => {
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
        status: 'connected',
        lastSyncAt: '2026-02-22T19:22:00.000Z',
        lastSuccessAt: '2026-02-22T19:22:00.000Z',
        lastError: null,
        balance: 33210.44,
        accountCount: 2,
      },
      {
        powensConnectionId: 'demo-revolut',
        status: 'syncing',
        lastSyncAt: '2026-02-22T18:45:00.000Z',
        lastSuccessAt: '2026-02-22T17:59:00.000Z',
        lastError: null,
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
