import type { DashboardTransactionsResponse } from '../routes/dashboard/types'
import { env } from '../env'
import { DEMO_TRANSACTIONS_LEGACY } from './transactions.mock'

export const DEMO_DATASET_VERSION = 'demoDataset:v1'
export const DEMO_DATASET_SEED = 'finance-os-demo-seed-v1'

export type DemoDatasetStrategy = 'legacy' | 'minimal' | 'v1'
export type DemoTransactionsScenario = 'default' | 'empty' | 'subscriptions' | 'parse_error'

const V1_FIXTURE_JSON = JSON.stringify([
  {
    id: 14020,
    bookingDate: '2026-03-31',
    amount: -95.12,
    currency: 'EUR',
    direction: 'expense',
    label: 'Carrefour City',
    merchant: 'Carrefour City',
    category: 'Courses',
    subcategory: 'Supermarche',
    resolvedCategory: 'Courses',
    resolutionSource: 'fallback',
    resolutionRuleId: null,
    resolutionTrace: [],
    incomeType: null,
    tags: ['edge_date', 'posted'],
    powensConnectionId: 'demo-fortuneo',
    powensAccountId: 'demo-fortuneo-checking',
    accountName: 'Fortuneo Courant',
  },
  {
    id: 14019,
    bookingDate: '2026-03-30',
    amount: -12.99,
    currency: 'EUR',
    direction: 'expense',
    label: 'Spotify Premium',
    merchant: 'Spotify',
    category: 'Abonnements',
    subcategory: 'Musique',
    resolvedCategory: 'Abonnements',
    resolutionSource: 'fallback',
    resolutionRuleId: null,
    resolutionTrace: [],
    incomeType: null,
    tags: ['subscription', 'posted'],
    powensConnectionId: 'demo-revolut',
    powensAccountId: 'demo-revolut-main',
    accountName: 'Revolut Main',
  },
  {
    id: 14018,
    bookingDate: '2026-03-30',
    amount: -39.95,
    currency: 'EUR',
    direction: 'expense',
    label: 'Amazon Prime pending',
    merchant: 'Amazon',
    category: 'Abonnements',
    subcategory: 'Video',
    resolvedCategory: 'Abonnements',
    resolutionSource: 'fallback',
    resolutionRuleId: null,
    resolutionTrace: [],
    incomeType: null,
    tags: ['subscription', 'pending'],
    powensConnectionId: 'demo-revolut',
    powensAccountId: 'demo-revolut-main',
    accountName: 'Revolut Main',
  },
  {
    id: 14017,
    bookingDate: '2026-03-29',
    amount: 2490,
    currency: 'EUR',
    direction: 'income',
    label: 'Salaire Mars',
    merchant: 'Employeur',
    category: 'Revenus',
    subcategory: 'Salaire',
    resolvedCategory: 'Revenus',
    resolutionSource: 'counterparty',
    resolutionRuleId: 'counterparty-salary',
    resolutionTrace: [],
    incomeType: 'salary',
    tags: ['salary', 'posted'],
    powensConnectionId: 'demo-fortuneo',
    powensAccountId: 'demo-fortuneo-checking',
    accountName: 'Fortuneo Courant',
  },
  {
    id: 14016,
    bookingDate: '2026-03-29',
    amount: 48.75,
    currency: 'EUR',
    direction: 'income',
    label: 'Remboursement SNCF',
    merchant: 'SNCF',
    category: 'Revenus',
    subcategory: 'Remboursement',
    resolvedCategory: 'Revenus',
    resolutionSource: 'merchant_rules',
    resolutionRuleId: 'merchant-refund-sncf',
    resolutionTrace: [],
    incomeType: 'exceptional',
    tags: ['refund'],
    powensConnectionId: 'demo-fortuneo',
    powensAccountId: 'demo-fortuneo-checking',
    accountName: 'Fortuneo Courant',
  },
  {
    id: 14015,
    bookingDate: '2026-03-28',
    amount: -520,
    currency: 'EUR',
    direction: 'expense',
    label: 'Virement Loyer',
    merchant: 'SCI Logement',
    category: 'Logement',
    subcategory: 'Loyer',
    resolvedCategory: 'Logement',
    resolutionSource: 'counterparty',
    resolutionRuleId: 'counterparty-rent',
    resolutionTrace: [],
    incomeType: null,
    tags: ['transfer', 'posted'],
    powensConnectionId: 'demo-fortuneo',
    powensAccountId: 'demo-fortuneo-checking',
    accountName: 'Fortuneo Courant',
  },
  {
    id: 14014,
    bookingDate: '2026-03-27',
    amount: -120,
    currency: 'EUR',
    direction: 'expense',
    label: 'Virement epargne',
    merchant: 'Fortuneo Livret',
    category: 'Transferts',
    subcategory: 'Interne',
    resolvedCategory: 'Transferts',
    resolutionSource: 'fallback',
    resolutionRuleId: null,
    resolutionTrace: [],
    incomeType: null,
    tags: ['transfer', 'internal'],
    powensConnectionId: 'demo-fortuneo',
    powensAccountId: 'demo-fortuneo-checking',
    accountName: 'Fortuneo Courant',
  },
  {
    id: 14013,
    bookingDate: '2026-03-26',
    amount: -0.01,
    currency: 'EUR',
    direction: 'expense',
    label: 'Verification carte',
    merchant: 'Stripe Test',
    category: 'Divers',
    subcategory: 'Test',
    resolvedCategory: 'Divers',
    resolutionSource: 'fallback',
    resolutionRuleId: null,
    resolutionTrace: [],
    incomeType: null,
    tags: ['edge_amount'],
    powensConnectionId: 'demo-revolut',
    powensAccountId: 'demo-revolut-main',
    accountName: 'Revolut Main',
  },
  {
    id: 14012,
    bookingDate: '2026-02-29',
    amount: -44.4,
    currency: 'EUR',
    direction: 'expense',
    label: 'Uber',
    merchant: 'Uber',
    category: 'Transport',
    subcategory: 'VTC',
    resolvedCategory: 'Transport',
    resolutionSource: 'merchant_rules',
    resolutionRuleId: 'merchant-uber-transport',
    resolutionTrace: [],
    incomeType: null,
    tags: ['edge_date'],
    powensConnectionId: 'demo-revolut',
    powensAccountId: 'demo-revolut-main',
    accountName: 'Revolut Main',
  },
])

const MINIMAL_FIXTURE: DashboardTransactionsResponse['items'] =
  DEMO_TRANSACTIONS_LEGACY.length > 0 ? [DEMO_TRANSACTIONS_LEGACY[0] as DashboardTransactionsResponse['items'][number]] : []

const readFixtureItems = (strategy: DemoDatasetStrategy, scenario: DemoTransactionsScenario) => {
  if (scenario === 'empty') {
    return []
  }

  if (strategy === 'legacy') {
    return DEMO_TRANSACTIONS_LEGACY
  }

  if (strategy === 'minimal') {
    return MINIMAL_FIXTURE
  }

  const raw = scenario === 'parse_error' ? '{"broken": true' : V1_FIXTURE_JSON
  const parsed = JSON.parse(raw) as DashboardTransactionsResponse['items']

  if (scenario === 'subscriptions') {
    return parsed.filter(item => item.tags.includes('subscription'))
  }

  return parsed
}

export const getDemoDatasetStrategy = (): DemoDatasetStrategy => {
  if (env.DEMO_DATASET_STRATEGY === 'legacy') {
    return 'legacy'
  }

  if (env.DEMO_DATASET_STRATEGY === 'minimal') {
    return 'minimal'
  }

  return 'v1'
}

export const resolveDemoTransactionsFixture = ({
  scenario,
}: {
  scenario: DemoTransactionsScenario
}): {
  datasetVersion: string
  fixtureSeed: string
  strategy: DemoDatasetStrategy
  degradedFallback: boolean
  degradedReason: string | null
  items: DashboardTransactionsResponse['items']
} => {
  const strategy = getDemoDatasetStrategy()

  try {
    return {
      datasetVersion: strategy === 'v1' ? DEMO_DATASET_VERSION : `demoDataset:${strategy}`,
      fixtureSeed: DEMO_DATASET_SEED,
      strategy,
      degradedFallback: false,
      degradedReason: null,
      items: readFixtureItems(strategy, scenario),
    }
  } catch {
    return {
      datasetVersion: 'demoDataset:legacy',
      fixtureSeed: DEMO_DATASET_SEED,
      strategy: 'legacy',
      degradedFallback: true,
      degradedReason: 'fixture_parse_failed',
      items: DEMO_TRANSACTIONS_LEGACY,
    }
  }
}
