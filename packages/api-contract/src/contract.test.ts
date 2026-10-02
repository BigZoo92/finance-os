import { describe, expect, it } from 'bun:test'
import {
  type DashboardAnalyticsResponse,
  type DashboardGoalsResponse,
  type DashboardManualAssetsResponse,
  type DashboardMarketsOverviewResponse,
  type DashboardSummaryResponse,
  type DashboardTransactionsResponse,
  dashboardAnalyticsResponseSchema,
  dashboardGoalsResponseSchema,
  dashboardManualAssetsResponseSchema,
  dashboardMarketsOverviewResponseSchema,
  dashboardSummaryResponseSchema,
  dashboardTransactionsResponseSchema,
  type InvestmentActionableStep,
  type InvestmentAllocationSnapshot,
  type InvestmentStrategyProfile,
  investmentActionableStepSchema,
  investmentAllocationSnapshotSchema,
  investmentDataQualitySchema,
  investmentStrategyProfileSchema,
  type ValuationStatusResponse,
  type ValuationUnresolvedResponse,
  valuationStatusResponseSchema,
  valuationUnresolvedResponseSchema,
} from './index'

const AS_OF = '2026-02-22T19:25:00.000Z'

const summary = {
  range: '30d',
  totals: { balance: null, unknownValuationAssetCount: 1, incomes: 4120, expenses: 1924.67 },
  valuation: {
    baseCurrency: 'EUR',
    totalValueBase: 48320.44,
    coveragePercent: 66.67,
    statusCounts: {
      priced: 0,
      derived: 2,
      estimated: 0,
      manual: 0,
      stale: 0,
      unresolved: 1,
      unavailable: 0,
    },
    unknownValueCount: 1,
    totalUnrealizedPnlBase: null,
    pnlCoverageCount: 0,
    asOf: AS_OF,
  },
  connections: [
    {
      powensConnectionId: 'c1',
      source: 'banking',
      provider: 'powens',
      providerConnectionId: 'c1',
      providerInstitutionId: null,
      providerInstitutionName: 'Demo Bank',
      status: 'connected',
      lastSyncAttemptAt: AS_OF,
      lastSyncAt: null,
      lastSuccessAt: null,
      lastFailedAt: null,
      lastError: null,
      syncMetadata: null,
      balance: null,
      accountCount: 1,
    },
  ],
  accounts: [
    {
      powensAccountId: 'a1',
      powensConnectionId: 'c1',
      name: 'Compte courant',
      currency: 'EUR',
      type: 'checking',
      metadata: null,
      enabled: true,
      balance: null,
    },
  ],
  assets: [
    {
      assetId: 1,
      type: 'investment',
      origin: 'manual',
      source: 'manual',
      provider: null,
      providerConnectionId: null,
      providerInstitutionName: null,
      powensConnectionId: null,
      powensAccountId: null,
      name: 'Actions non cotees',
      currency: 'EUR',
      valuation: null,
      valuationAsOf: null,
      valueBase: null,
      valuationStatus: 'unresolved',
      enabled: true,
      metadata: null,
    },
  ],
  positions: [
    {
      positionId: 1,
      positionKey: 'p1',
      assetId: 1,
      powensAccountId: null,
      powensConnectionId: null,
      source: 'manual',
      provider: null,
      providerConnectionId: null,
      providerPositionId: null,
      assetName: null,
      accountName: null,
      name: 'ETF Monde',
      currency: 'EUR',
      quantity: 2,
      costBasis: null,
      costBasisSource: 'unknown',
      currentValue: null,
      lastKnownValue: null,
      openedAt: null,
      closedAt: null,
      valuedAt: null,
      lastSyncedAt: null,
      valueBase: null,
      valuationStatus: null,
      enabled: true,
      metadata: null,
    },
  ],
  dailyWealthSnapshots: [{ date: '2026-02-22', balance: 48320.44 }],
  topExpenseGroups: [
    { label: 'Carrefour', category: 'Courses', merchant: 'Carrefour', total: 210.4, count: 3 },
  ],
} satisfies DashboardSummaryResponse

const transactions = {
  schemaVersion: '2026-04-05',
  range: '7d',
  limit: 30,
  nextCursor: null,
  freshness: {
    strategy: 'snapshot-first',
    lastSyncedAt: null,
    syncStatus: 'no-data-first-connect',
    degradedReason: null,
    snapshotAgeSeconds: null,
    refreshRequested: false,
  },
  items: [
    {
      id: 1,
      bookingDate: '2026-02-22',
      amount: -42.1,
      currency: 'EUR',
      direction: 'expense',
      label: 'CARREFOUR MARKET',
      merchant: 'Carrefour',
      category: 'Courses',
      subcategory: null,
      resolvedCategory: 'Courses',
      resolutionSource: 'merchant_rules',
      resolutionRuleId: null,
      resolutionTrace: [
        {
          source: 'merchant_rules',
          rank: 1,
          matched: true,
          reason: 'merchant match',
          category: 'Courses',
          subcategory: null,
          ruleId: null,
        },
      ],
      incomeType: null,
      tags: [],
      powensConnectionId: 'c1',
      powensAccountId: 'a1',
      accountName: 'Compte courant',
    },
  ],
} satisfies DashboardTransactionsResponse

const manualAssets = {
  items: [
    {
      assetId: 7,
      type: 'manual',
      origin: 'manual',
      source: 'manual',
      name: 'Montre',
      currency: 'EUR',
      valuation: null,
      valuationAsOf: null,
      enabled: true,
      note: null,
      category: null,
      metadata: null,
      createdAt: AS_OF,
      updatedAt: AS_OF,
    },
  ],
} satisfies DashboardManualAssetsResponse

const analytics = {
  schemaVersion: '2026-04-06',
  range: '30d',
  source: 'demoAdapter',
  generatedAt: AS_OF,
  summaryCards: {
    netWorth: { value: null, state: 'empty' },
    incomes: { value: 4120, state: 'ready' },
    expenses: { value: 1924.67, state: 'ready' },
  },
  timeseries: { points: [{ date: '2026-02-22', balance: 100 }], state: 'ready' },
  categorySplit: { items: [{ label: 'Courses', total: 210.4, ratio: 1 }], state: 'ready' },
  portfolioAllocation: { items: [{ type: 'cash', total: 100, ratio: 1 }], state: 'ready' },
  allocationEvolution: {
    points: [{ date: '2026-02-22', total: 100, cash: 100, investment: 0, manual: 0 }],
    state: 'ready',
  },
  recurringSpend: {
    fixedCharges: {
      items: [{ label: 'loyer', monthlyAmount: 900, occurrences: 3 }],
      totalMonthly: 900,
      state: 'ready',
    },
    subscriptions: { items: [], totalMonthly: 0, state: 'empty' },
  },
  spendConcentration: {
    topMerchantShare: 1,
    top3Share: 1,
    hhi: 1,
    dominantMerchantLabel: 'Carrefour',
    state: 'ready',
  },
  availability: {
    summaryCards: true,
    timeseries: true,
    categorySplit: true,
    portfolioAllocation: true,
    allocationEvolution: true,
    recurringSpend: true,
    spendConcentration: true,
  },
} satisfies DashboardAnalyticsResponse

const goals = {
  items: [
    {
      id: 1,
      name: 'Emergency runway',
      goalType: 'emergency_fund',
      currency: 'EUR',
      targetAmount: 12000,
      currentAmount: 8400,
      targetDate: null,
      note: null,
      progressSnapshots: [{ recordedAt: AS_OF, amount: 3200, note: null }],
      archivedAt: null,
      createdAt: AS_OF,
      updatedAt: AS_OF,
    },
  ],
} satisfies DashboardGoalsResponse

const quote = {
  instrumentId: 'spy-us',
  label: 'S&P 500 (SPY)',
  shortLabel: 'S&P 500',
  symbol: 'SPY',
  assetClass: 'etf',
  region: 'us',
  exchange: 'NYSE Arca',
  currency: 'USD',
  proxyLabel: 'ETF proxy',
  tags: ['panorama'],
  price: null,
  previousClose: null,
  dayChangePct: null,
  weekChangePct: null,
  monthChangePct: null,
  ytdChangePct: null,
  history: [],
  source: {
    provider: 'eodhd',
    baselineProvider: 'eodhd',
    overlayProvider: null,
    mode: 'eod',
    delayLabel: 'EOD',
    reason: 'no quote',
    quoteDate: '2026-04-10',
    quoteAsOf: null,
    capturedAt: AS_OF,
    freshnessMinutes: null,
    isDelayed: true,
  },
  marketSession: { state: 'closed', isOpen: false, label: 'Ferme' },
} satisfies DashboardMarketsOverviewResponse['panorama']['items'][number]

const marketsOverview = {
  source: 'demo_fixture',
  requestId: 'req-1',
  generatedAt: AS_OF,
  freshness: {
    lastSuccessAt: null,
    stale: true,
    staleAgeSeconds: null,
    staleAfterMinutes: 960,
    degradedReason: 'MARKET_CACHE_EMPTY',
  },
  summary: {
    headline: 'Marches fermes',
    tone: 'neutral',
    badge: 'EOD',
    openCount: 0,
    closedCount: 1,
    positiveCount: 0,
    negativeCount: 0,
    primarySourceLabel: 'EODHD',
  },
  panorama: { items: [quote] },
  macro: {
    items: [
      {
        seriesId: 'FEDFUNDS',
        label: 'Fed funds',
        shortLabel: 'Fed funds',
        group: 'rates',
        unit: 'percent',
        description: 'Taux directeur.',
        latestValue: null,
        previousValue: null,
        change: null,
        changePct: null,
        changeDirection: 'flat',
        displayValue: 'n/a',
        comparisonLabel: 'vs precedent',
        comparisonValue: null,
        observationDate: null,
        history: [],
        source: { provider: 'fred', freshnessLabel: 'FRED', observationCount: 0 },
      },
    ],
  },
  watchlist: {
    items: [quote],
    groups: [{ id: 'global', label: 'Panorama global', itemIds: ['spy-us'] }],
  },
  signals: {
    items: [
      {
        id: 's1',
        title: 't',
        detail: 'd',
        tone: 'neutral',
        severity: 'low',
        evidence: [],
        dataRefs: [],
      },
    ],
  },
  contextBundle: {
    schemaVersion: '2026-04-10',
    generatedAt: AS_OF,
    coverageSummary: {
      instrumentCount: 1,
      macroSeriesCount: 1,
      providers: [{ provider: 'fred', role: 'macro', coverageCount: 1, freshnessLabel: 'FRED' }],
    },
    quoteFreshness: { intradayCount: 0, delayedCount: 0, eodCount: 1, staleCount: 0 },
    keyMovers: { gainers: [], losers: [] },
    marketBreadth: { positiveCount: 0, negativeCount: 0, flatCount: 1, strongestRegion: null },
    marketRegimeHints: [],
    macroRegime: { rates: [], inflation: [], labor: [] },
    ratesSummary: { fedFunds: null, sofr: null, ust2y: null, ust10y: null, spread10y2y: null },
    inflationSummary: { cpiYoY: null, direction: 'unknown' },
    laborSummary: { unemploymentRate: null, direction: 'unknown' },
    riskFlags: [],
    anomalies: [],
    warnings: ['no data'],
    watchlistHighlights: [],
    providerProvenance: [
      { provider: 'fred', label: 'FRED', role: 'macro', freshnessLabel: 'FRED', note: 'macro' },
    ],
    confidence: { level: 'low', score: 0.1, caveats: [] },
  },
  providers: [
    {
      provider: 'fred',
      label: 'FRED',
      role: 'macro',
      enabled: true,
      status: 'idle',
      lastSuccessAt: null,
      lastAttemptAt: null,
      lastFailureAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      lastFetchedCount: 0,
      successCount: 0,
      failureCount: 0,
      skippedCount: 0,
      freshnessLabel: 'FRED: jamais rafraichi',
    },
  ],
} satisfies DashboardMarketsOverviewResponse

const valuationStatus = {
  featureEnabled: true,
  fxEnabled: false,
  state: 'completed',
  latestRun: {
    runId: 1,
    dryRun: true,
    status: 'completed',
    triggerSource: 'admin',
    startedAt: AS_OF,
    finishedAt: null,
    durationMs: null,
    coverage: {
      baseCurrency: 'EUR',
      totalItems: 1,
      statusCounts: {
        priced: 0,
        derived: 0,
        estimated: 0,
        manual: 0,
        stale: 0,
        unresolved: 1,
        unavailable: 0,
      },
      coveragePercent: 0,
      totalValueBase: null,
      unknownValueCount: 1,
      providerBreakdown: { manual: { itemCount: 1, valueBase: null, unknownValueCount: 1 } },
      assetClassBreakdown: {},
    },
    itemCount: 1,
    snapshotCount: null,
    wouldCreateSnapshots: 0,
    providerFailures: [
      { provider: 'ecb', errorCode: 'FX_DOWN', safeErrorMessage: 'FX unavailable' },
    ],
    safeErrorCode: null,
    safeErrorMessage: null,
  },
  fx: { baseCurrency: 'EUR', ratesAvailable: 0, staleRates: 0, latestRateTimestamp: null },
} satisfies ValuationStatusResponse

const valuationUnresolved = {
  items: [
    {
      itemKey: 'position:1',
      name: 'Actions non cotees',
      provider: null,
      assetClass: 'other',
      status: 'unresolved',
      identityStatus: 'unresolved',
      errorCode: null,
      safeErrorMessage: null,
      asOf: null,
    },
  ],
  totalItems: 1,
} satisfies ValuationUnresolvedResponse

const strategy = {
  id: 1,
  name: 'bigzoo_growth_60_30_10_v1',
  version: 'v1',
  status: 'active',
  description: 'Growth strategy',
  riskProfile: 'growth',
  horizonYears: 10,
  baseCurrency: 'EUR',
  monthlyContributionTarget: null,
  rebalanceThresholdPct: 5,
  reviewFrequency: 'monthly',
  noAutoTrade: true,
  humanValidationRequired: true,
  createdAt: AS_OF,
  updatedAt: AS_OF,
} satisfies InvestmentStrategyProfile

const allocation = {
  strategyId: 1,
  snapshotAt: AS_OF,
  baseCurrency: 'EUR',
  totalValue: 1000,
  coreValue: 600,
  growthValue: 300,
  asymmetricValue: 100,
  cashValue: 0,
  unknownValue: 0,
  corePct: 60,
  growthPct: 30,
  asymmetricPct: 10,
  drift: [
    {
      bucket: 'core',
      targetPct: 60,
      actualPct: 60,
      driftPct: 0,
      severity: 'ok',
      recommendedContribution: null,
      recommendedAction: 'hold',
    },
  ],
  dataQuality: {
    status: 'degraded',
    confidence: 0.5,
    unknownValue: null,
    unknownPositionCount: 1,
    stalePositionCount: 0,
    missingPriceSymbols: ['XYZ'],
    stalePriceSymbols: [],
    providerWarnings: [],
    fxWarnings: [],
    graphWarnings: [],
  },
  holdings: [
    {
      provider: 'ibkr',
      accountId: null,
      accountLabel: null,
      accountType: 'brokerage',
      symbol: 'XYZ',
      name: 'XYZ',
      assetClass: 'equity',
      value: null,
      currency: null,
      valueAsOf: null,
      quantity: 3,
      degradedReasons: ['missing price'],
      assumptions: [],
    },
  ],
} satisfies InvestmentAllocationSnapshot

const actionableStep = {
  type: 'no_trade_today',
  priority: 'high',
  message: 'Aucun ordre aujourd hui.',
  reason: 'Prix manquant.',
} satisfies InvestmentActionableStep

describe('api contract schemas', () => {
  it('parses a dashboard summary and keeps unknown valuations as null', () => {
    const parsed = dashboardSummaryResponseSchema.parse(summary)

    expect(parsed).toEqual(summary)
    expect(parsed.totals.balance).toBeNull()
    expect(parsed.assets[0]?.valuation).toBeNull()
    expect(parsed.assets[0]?.valueBase).toBeNull()
    expect(parsed.positions[0]?.currentValue).toBeNull()
    expect(parsed.valuation?.totalUnrealizedPnlBase).toBeNull()
    expect(
      dashboardSummaryResponseSchema.parse({ ...summary, valuation: null }).valuation
    ).toBeNull()
  })

  it('parses transactions and manual assets', () => {
    expect(dashboardTransactionsResponseSchema.parse(transactions)).toEqual(transactions)
    expect(dashboardManualAssetsResponseSchema.parse(manualAssets).items[0]?.valuation).toBeNull()
  })

  it('parses analytics with an unknown net worth', () => {
    const parsed = dashboardAnalyticsResponseSchema.parse(analytics)

    expect(parsed).toEqual(analytics)
    expect(parsed.summaryCards.netWorth.value).toBeNull()
  })

  it('parses goals', () => {
    expect(dashboardGoalsResponseSchema.parse(goals)).toEqual(goals)
  })

  it('parses a markets overview with unpriced quotes', () => {
    const parsed = dashboardMarketsOverviewResponseSchema.parse(marketsOverview)

    expect(parsed).toEqual(marketsOverview)
    expect(parsed.panorama.items[0]?.price).toBeNull()
    expect(parsed.contextBundle.ratesSummary.fedFunds).toBeNull()
  })

  it('parses valuation status and unresolved items', () => {
    const parsed = valuationStatusResponseSchema.parse(valuationStatus)

    expect(parsed).toEqual(valuationStatus)
    expect(parsed.latestRun?.coverage?.totalValueBase).toBeNull()
    expect(
      valuationStatusResponseSchema.parse({ ...valuationStatus, latestRun: null }).latestRun
    ).toBeNull()
    expect(valuationUnresolvedResponseSchema.parse(valuationUnresolved)).toEqual(
      valuationUnresolved
    )
  })

  it('parses investment DTOs and keeps unknown values as null', () => {
    const parsed = investmentAllocationSnapshotSchema.parse(allocation)

    expect(parsed).toEqual(allocation)
    expect(parsed.dataQuality.unknownValue).toBeNull()
    expect(parsed.holdings[0]?.value).toBeNull()
    expect(investmentStrategyProfileSchema.parse(strategy).monthlyContributionTarget).toBeNull()
    expect(investmentActionableStepSchema.parse(actionableStep)).toEqual(actionableStep)
  })

  it('rejects wrong shapes instead of coercing them', () => {
    expect(
      dashboardSummaryResponseSchema.safeParse({
        ...summary,
        totals: { ...summary.totals, balance: '0' },
      }).success
    ).toBe(false)
    expect(
      dashboardSummaryResponseSchema.safeParse({
        ...summary,
        assets: [{ ...summary.assets[0], valuationStatus: 'guessed' }],
      }).success
    ).toBe(false)
    expect(
      dashboardTransactionsResponseSchema.safeParse({ ...transactions, freshness: undefined })
        .success
    ).toBe(false)
    expect(
      investmentDataQualitySchema.safeParse({ ...allocation.dataQuality, unknownValue: undefined })
        .success
    ).toBe(false)
    expect(
      valuationStatusResponseSchema.safeParse({ ...valuationStatus, state: 'paused' }).success
    ).toBe(false)
    expect(
      dashboardMarketsOverviewResponseSchema.safeParse({ ...marketsOverview, contextBundle: {} })
        .success
    ).toBe(false)
  })
})
