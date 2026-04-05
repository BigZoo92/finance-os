import type { DashboardRange, DashboardTransactionsResponse } from '../routes/dashboard/types'
import { decodeDashboardCursor, encodeDashboardCursor } from '../routes/dashboard/utils/cursor'

const DEMO_TRANSACTIONS: DashboardTransactionsResponse['items'] = [
  {
    id: 12012,
    bookingDate: '2026-02-22',
    amount: -64.2,
    currency: 'EUR',
    direction: 'expense',
    label: 'Carrefour Market',
    merchant: 'Carrefour Market',
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
    merchant: 'Spotify',
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
    merchant: 'Salaire',
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
    merchant: 'SNCF',
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
    merchant: 'Netflix',
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
    merchant: 'TotalEnergies',
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
    merchant: 'Uber',
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
    merchant: 'Monoprix',
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
    merchant: 'Remboursement',
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
    merchant: 'Boulangerie',
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
]

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

export const getDashboardTransactionsMock = ({
  range,
  limit,
  cursor,
}: {
  range: DashboardRange
  limit: number
  cursor: string | undefined
}): DashboardTransactionsResponse => {
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

  const rows = visible.slice(0, limit + 1)
  const hasNextPage = rows.length > limit
  const items = hasNextPage ? rows.slice(0, limit) : rows
  const tail = items[items.length - 1]

  return {
    schemaVersion: '2026-04-04',
    range,
    limit,
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
