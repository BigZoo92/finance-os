import type { DashboardTransactionsResponse } from '../routes/dashboard/types'
import { env } from '../env'
import { DEMO_TRANSACTIONS_LEGACY } from './transactions.mock'
import {
  matchPersonaScenario,
  type DemoPersonaId,
  type DemoTransactionsScenario,
  type PersonaMatchResult,
} from './demo-scenario-library'

export const DEMO_DATASET_VERSION = 'demoDataset:v1'
export const DEMO_DATASET_SEED = 'finance-os-demo-seed-v1'

export type DemoDatasetStrategy = 'legacy' | 'minimal' | 'v1'

const V1_FIXTURE_JSON = JSON.stringify([
  {
    id: 14023,
    bookingDate: '2026-04-01',
    amount: -1,
    currency: 'EUR',
    direction: 'expense',
    label: 'Push notif permission check',
    merchant: 'Finance-OS',
    category: 'Divers',
    subcategory: 'Notification',
    resolvedCategory: 'Divers',
    resolutionSource: 'fallback',
    resolutionRuleId: null,
    resolutionTrace: [],
    incomeType: null,
    tags: ['notification_candidate', 'installation'],
    powensConnectionId: 'demo-revolut',
    powensAccountId: 'demo-revolut-main',
    accountName: 'Revolut Main',
  },
  {
    id: 14022,
    bookingDate: '2026-03-31',
    amount: -3.49,
    currency: 'EUR',
    direction: 'expense',
    label: 'Offline retry buffer',
    merchant: 'Finance-OS',
    category: 'Divers',
    subcategory: 'Offline',
    resolvedCategory: 'Divers',
    resolutionSource: 'fallback',
    resolutionRuleId: null,
    resolutionTrace: [],
    incomeType: null,
    tags: ['offline', 'export_candidate'],
    powensConnectionId: 'demo-fortuneo',
    powensAccountId: 'demo-fortuneo-checking',
    accountName: 'Fortuneo Courant',
  },
  {
    id: 14021,
    bookingDate: '2026-03-31',
    amount: 0,
    currency: 'EUR',
    direction: 'income',
    label: 'Installation seed event',
    merchant: 'Finance-OS',
    category: 'Divers',
    subcategory: 'Onboarding',
    resolvedCategory: 'Divers',
    resolutionSource: 'fallback',
    resolutionRuleId: null,
    resolutionTrace: [],
    incomeType: null,
    tags: ['installation', 'export_candidate'],
    powensConnectionId: 'demo-fortuneo',
    powensAccountId: 'demo-fortuneo-checking',
    accountName: 'Fortuneo Courant',
  },
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

  if (scenario === 'installation_readiness') {
    return parsed.filter(item => item.tags.includes('installation'))
  }

  if (scenario === 'offline_resilience') {
    return parsed.filter(item => item.tags.includes('offline') || item.tags.includes('pending'))
  }

  if (scenario === 'notifications_candidate') {
    return parsed.filter(item => item.tags.includes('notification_candidate'))
  }

  if (scenario === 'export_audit') {
    return parsed.filter(
      item =>
        item.tags.includes('export_candidate') ||
        item.tags.includes('salary') ||
        item.tags.includes('refund')
    )
  }

  if (scenario === 'student_budget') {
    return parsed.filter(item => item.direction === 'expense' && Math.abs(item.amount) <= 150)
  }

  if (scenario === 'freelancer_cashflow') {
    return parsed.filter(item => item.incomeType !== 'salary')
  }

  if (scenario === 'family_planning') {
    return parsed.filter(item => item.category === 'Logement' || item.category === 'Courses')
  }

  if (scenario === 'retiree_stability') {
    return parsed.filter(item => item.direction === 'income' || item.category === 'Transferts')
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
  profile,
}: {
  scenario: DemoTransactionsScenario
  profile?: string
}): {
  datasetVersion: string
  fixtureSeed: string
  strategy: DemoDatasetStrategy
  degradedFallback: boolean
  degradedReason: string | null
  personaMatch: {
    profile: string
    personaId: DemoPersonaId
    scenarioId: DemoTransactionsScenario
    boundedVariation: 0 | 1 | 2
    overrideReason: 'manual_scenario_override' | 'persona_match' | 'kill_switch_disabled'
    matchReason: string
    fallbackCause: string | null
  }
  items: DashboardTransactionsResponse['items']
} => {
  const strategy = getDemoDatasetStrategy()
  const personaMatchResult: PersonaMatchResult = matchPersonaScenario(profile)
  const killSwitchActive = env.DEMO_PERSONA_MATCHING_ENABLED === false
  const hasScenarioOverride = scenario !== 'default'
  const scenarioToUse = killSwitchActive
    ? hasScenarioOverride
      ? scenario
      : 'default'
    : hasScenarioOverride
      ? scenario
      : personaMatchResult.scenarioId
  const overrideReason = killSwitchActive
    ? 'kill_switch_disabled'
    : hasScenarioOverride
      ? 'manual_scenario_override'
      : 'persona_match'
  const fallbackCause = killSwitchActive ? 'persona_matching_disabled' : null

  try {
    return {
      datasetVersion: strategy === 'v1' ? DEMO_DATASET_VERSION : `demoDataset:${strategy}`,
      fixtureSeed: DEMO_DATASET_SEED,
      strategy,
      degradedFallback: false,
      degradedReason: null,
      personaMatch: {
        ...personaMatchResult,
        scenarioId: scenarioToUse,
        overrideReason,
        fallbackCause,
      },
      items: readFixtureItems(strategy, scenarioToUse),
    }
  } catch {
    return {
      datasetVersion: 'demoDataset:legacy',
      fixtureSeed: DEMO_DATASET_SEED,
      strategy: 'legacy',
      degradedFallback: true,
      degradedReason: 'fixture_parse_failed',
      personaMatch: {
        ...personaMatchResult,
        scenarioId: scenarioToUse,
        overrideReason,
        fallbackCause: 'fixture_parse_failed',
      },
      items: DEMO_TRANSACTIONS_LEGACY,
    }
  }
}
