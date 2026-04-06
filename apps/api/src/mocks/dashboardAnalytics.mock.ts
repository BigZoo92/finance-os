import type { DashboardRange } from '../routes/dashboard/types'

interface DashboardAnalyticsMockTransaction {
  bookingDate: string
  amount: number
  direction: 'income' | 'expense'
  currency: string
  label: string
  merchant: string
}

const RANGE_TO_DAYS: Record<DashboardRange, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
}

const DEMO_ANALYTICS_MOCK_TODAY = '2026-02-22'

const DEMO_ANALYTICS_TRANSACTIONS: DashboardAnalyticsMockTransaction[] = [
  {
    bookingDate: '2025-12-28',
    amount: -520,
    direction: 'expense',
    currency: 'EUR',
    label: 'Virement Loyer Dec',
    merchant: 'SCI Logement',
  },
  {
    bookingDate: '2026-01-26',
    amount: -519.5,
    direction: 'expense',
    currency: 'EUR',
    label: 'Virement Loyer Jan',
    merchant: 'SCI Logement',
  },
  {
    bookingDate: '2026-02-21',
    amount: -520,
    direction: 'expense',
    currency: 'EUR',
    label: 'Virement Loyer Feb',
    merchant: 'SCI Logement',
  },
  {
    bookingDate: '2026-01-27',
    amount: -12.99,
    direction: 'expense',
    currency: 'EUR',
    label: 'Spotify Premium Jan',
    merchant: 'Spotify',
  },
  {
    bookingDate: '2026-02-22',
    amount: -12.99,
    direction: 'expense',
    currency: 'EUR',
    label: 'Spotify Premium Feb',
    merchant: 'Spotify',
  },
  {
    bookingDate: '2026-02-18',
    amount: -132.45,
    direction: 'expense',
    currency: 'EUR',
    label: 'Carrefour City',
    merchant: 'Carrefour',
  },
  {
    bookingDate: '2026-02-20',
    amount: -38.2,
    direction: 'expense',
    currency: 'EUR',
    label: 'Uber trip',
    merchant: 'Uber',
  },
  {
    bookingDate: '2026-02-21',
    amount: 2840,
    direction: 'income',
    currency: 'EUR',
    label: 'Salaire Fevrier',
    merchant: 'Employeur',
  },
]

const toDateOnly = (value: Date) => value.toISOString().slice(0, 10)

const getRangeStartDate = (range: DashboardRange) => {
  const start = new Date(`${DEMO_ANALYTICS_MOCK_TODAY}T00:00:00.000Z`)
  start.setUTCDate(start.getUTCDate() - (RANGE_TO_DAYS[range] - 1))
  return toDateOnly(start)
}

export const getDashboardAnalyticsMockTransactions = (
  range: DashboardRange,
): DashboardAnalyticsMockTransaction[] => {
  const start = getRangeStartDate(range)

  return DEMO_ANALYTICS_TRANSACTIONS.filter(
    transaction => transaction.bookingDate >= start && transaction.bookingDate <= DEMO_ANALYTICS_MOCK_TODAY,
  )
}
