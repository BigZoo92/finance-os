import { expect, type Page, type Route, test } from '@playwright/test'

/**
 * UI-6 Ops QA. Admin responses mirror existing read and mutation contracts;
 * they exercise client states without contacting providers or persisting data.
 */

const SHOT_DIR = 'test-results/ui6-ops'
const APP_ERRORS = /Internal Server Error|Application Error|Cannot GET|Unhandled/i
const CREDENTIAL_COPY = /API key|API secret|Flex token|Query ID|client secret|credential/i
const NOW = '2026-09-04T08:30:00.000Z'

const json = (route: Route, body: unknown) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })

const setLightTheme = async (page: Page) => {
  await page.addInitScript(() => window.localStorage.setItem('finance-os-theme', 'light'))
}

const expectNoHorizontalOverflow = async (page: Page) => {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    )
  ).toBe(false)
}

const ADMIN_AUTH = {
  mode: 'admin',
  user: { email: 'admin@example.test', displayName: 'Admin' },
  requestId: 'e2e-ui6-admin',
}

const POWENS_CONNECTED = {
  safeModeActive: false,
  syncStatusPersistenceEnabled: true,
  lastCallback: null,
  connections: [
    {
      id: 1,
      source: 'banking',
      provider: 'powens',
      powensConnectionId: 'e2e-bank',
      providerConnectionId: 'e2e-bank',
      providerInstitutionId: 'fortuneo',
      providerInstitutionName: 'Fortuneo',
      status: 'connected',
      lastSyncStatus: 'OK',
      lastSyncReasonCode: 'SUCCESS',
      lastSyncAttemptAt: NOW,
      lastSyncAt: NOW,
      lastSuccessAt: NOW,
      lastFailedAt: null,
      lastError: null,
      syncMetadata: null,
      createdAt: NOW,
      updatedAt: NOW,
    },
  ],
}

const POWENS_RECONNECT = {
  ...POWENS_CONNECTED,
  connections: [
    {
      ...POWENS_CONNECTED.connections[0],
      status: 'reconnect_required',
      lastSyncStatus: 'KO',
      lastSyncReasonCode: 'RECONNECT_REQUIRED',
      lastFailedAt: NOW,
    },
  ],
}

const EXTERNAL_HEALTHY = {
  requestId: 'e2e-external',
  mode: 'admin',
  source: 'db',
  enabled: true,
  safeModeActive: false,
  providerEnabled: { ibkr: true, binance: true },
  providerConfigured: { ibkr: true, binance: true },
  connections: [],
  health: [
    { provider: 'ibkr', enabled: true, status: 'healthy', lastSuccessAt: NOW },
    { provider: 'binance', enabled: true, status: 'healthy', lastSuccessAt: NOW },
  ],
}

const EXTERNAL_MIXED = {
  ...EXTERNAL_HEALTHY,
  health: [
    { provider: 'ibkr', enabled: true, status: 'healthy', lastSuccessAt: NOW },
    {
      provider: 'binance',
      enabled: true,
      status: 'failing',
      lastSuccessAt: '2026-09-01T08:30:00.000Z',
    },
  ],
}

const DERIVED_HEALTHY = {
  featureEnabled: true,
  state: 'completed',
  currentSnapshot: null,
  latestRun: { finishedAt: NOW },
}

const VALUATION_HEALTHY = {
  featureEnabled: true,
  fxEnabled: true,
  state: 'completed',
  latestRun: {
    status: 'completed',
    finishedAt: NOW,
    coverage: {
      totalItems: 8,
      unknownValueCount: 0,
      coveragePercent: 100,
      statusCounts: {
        priced: 5,
        derived: 2,
        estimated: 0,
        manual: 1,
        stale: 0,
        unresolved: 0,
        unavailable: 0,
      },
    },
  },
  fx: { baseCurrency: 'EUR', ratesAvailable: 30, staleRates: 0, latestRateTimestamp: NOW },
}

const VALUATION_UNRESOLVED = {
  ...VALUATION_HEALTHY,
  latestRun: {
    ...VALUATION_HEALTHY.latestRun,
    coverage: {
      ...VALUATION_HEALTHY.latestRun.coverage,
      unknownValueCount: 2,
      coveragePercent: 75,
      statusCounts: {
        ...VALUATION_HEALTHY.latestRun.coverage.statusCounts,
        priced: 3,
        unresolved: 2,
      },
    },
  },
}

const UNRESOLVED_ITEMS = {
  totalItems: 8,
  items: [
    {
      itemKey: 'asset-private-shares',
      name: 'Actions non cotées',
      provider: 'manual-import',
      assetClass: 'other',
      status: 'unresolved',
      identityStatus: 'unresolved',
      errorCode: 'IDENTITY_UNRESOLVED',
      safeErrorMessage: 'Actif non identifiable',
      asOf: null,
    },
    {
      itemKey: 'asset-vintage-watch',
      name: 'Montre de collection',
      provider: 'manual',
      assetClass: 'other',
      status: 'unresolved',
      identityStatus: 'unresolved',
      errorCode: 'PRICE_UNAVAILABLE',
      safeErrorMessage: 'Prix indisponible',
      asOf: null,
    },
  ],
}

const SPEND = {
  summary: {
    dailyUsdSpent: 0.38,
    monthlyUsdSpent: 7.42,
    dailyBudgetUsd: 2,
    monthlyBudgetUsd: 30,
    challengerAllowed: true,
    deepAnalysisAllowed: true,
    blocked: false,
    reasons: [],
  },
  daily: [
    { date: '2026-08-29', usd: 0.16, eur: 0.14 },
    { date: '2026-08-30', usd: 0.31, eur: 0.27 },
    { date: '2026-08-31', usd: 0.24, eur: 0.21 },
    { date: '2026-09-01', usd: 0.52, eur: 0.45 },
    { date: '2026-09-02', usd: 0.27, eur: 0.23 },
    { date: '2026-09-03', usd: 0.44, eur: 0.38 },
    { date: '2026-09-04', usd: 0.38, eur: 0.33 },
  ],
  byFeature: [
    { key: 'daily-brief', label: 'Brief quotidien', usd: 4.2, eur: 3.65 },
    { key: 'chat', label: 'Chat', usd: 3.22, eur: 2.8 },
  ],
  byModel: [{ key: 'gpt', label: 'Modèle principal', usd: 7.42, eur: 6.45 }],
  anomalies: [],
}

const COSTS = {
  ok: true,
  mode: 'admin',
  source: 'db',
  requestId: 'e2e-costs',
  generatedAt: NOW,
  totals: {
    recurringMonthlyByCurrency: [{ currency: 'EUR', amount: 24 }],
    recurringAnnualByCurrency: [{ currency: 'EUR', amount: 288 }],
    variableMonthlyUsd: 11.62,
    variableDailyUsd: 0.62,
  },
  recurringSubscriptions: [],
  variableUsage: {
    xTwitter: {
      dailyUsd: 0.24,
      monthlyUsd: 4.2,
      costBasisToday: 'mixed',
      costBasisThisMonth: 'mixed',
    },
    advisor: {
      status: 'ok',
      dailyUsd: 0.38,
      monthlyUsd: 7.42,
      dailyBudgetUsd: 2,
      monthlyBudgetUsd: 30,
      lastError: null,
    },
  },
}

const JOB_INPUTS = [
  ['powens', 'Powens', 'banking', true],
  ['transactions-categorization', 'Transactions', 'transactions', true],
  ['external-investments', 'Investissements externes', 'investments', true],
  ['ibkr', 'IBKR', 'investments', true],
  ['binance-crypto', 'Binance', 'investments', true],
  ['asset-valuation', 'Valorisation des actifs', 'investments', true],
  ['news-finance', 'News finance', 'news', true],
  ['news-crypto', 'News crypto', 'news', true],
  ['market-data', 'Marchés', 'markets', true],
  ['tweets-finance', 'Signaux finance', 'social', false],
  ['tweets-ai', 'Signaux IA', 'social', false],
  ['investment-learning-review', 'Revue des apprentissages', 'advisor', true],
  ['investment-action-plan', 'Plan d’investissement', 'advisor', true],
  ['advisor-context', 'Advisor', 'advisor', true],
] as const

const makeOpsStatus = (overrides?: { jobId?: string; status?: string; active?: boolean }) => {
  const jobs = JOB_INPUTS.map(([id, label, domain, manualTriggerAllowed]) => ({
    id,
    label,
    description: `${label} via le registre existant.`,
    domain,
    dependencies: [],
    enabled: true,
    manualTriggerAllowed,
    scheduleGroup: manualTriggerAllowed ? 'daily-intelligence' : 'manual-only',
    timeoutMs: 90_000,
    retryPolicy: { maxAttempts: 1, backoffMs: 0 },
  }))
  const results = jobs.map(job => ({
    jobId: job.id,
    status: job.id === overrides?.jobId ? (overrides.status ?? 'failed') : 'success',
    requestId: 'e2e-safe',
    runId: 'e2e-run',
    startedAt: '2026-09-04T08:28:00.000Z',
    finishedAt: NOW,
    durationMs: job.id === overrides?.jobId ? 82_000 : 12_000,
    recordsRead: null,
    recordsWritten: null,
    errorCode: job.id === overrides?.jobId ? 'PRIVATE_BACKEND_CODE' : null,
    errorMessage: job.id === overrides?.jobId ? 'raw backend error must stay hidden' : null,
    retryCount: 0,
    message: null,
    details: null,
  }))
  return {
    requestId: 'e2e-ops',
    mode: 'admin',
    jobs,
    latestRun: overrides?.active
      ? {
          operationId: 'e2e-operation',
          status: 'running',
          currentStage: 'market_refresh',
          startedAt: NOW,
          finishedAt: null,
          durationMs: null,
          degraded: false,
          steps: [],
        }
      : null,
    history: [],
    latestTopologicalRun: {
      runId: 'e2e-run',
      status: overrides?.status === 'failed' ? 'partial' : 'success',
      startedAt: '2026-09-04T08:28:00.000Z',
      finishedAt: NOW,
      durationMs: 120_000,
      jobs: results,
    },
    topologicalHistory: [],
  }
}

type AdminOpsOptions = {
  spend?: typeof SPEND
  costs?: typeof COSTS
  powens?: typeof POWENS_CONNECTED
  external?: typeof EXTERNAL_HEALTHY
  valuation?: typeof VALUATION_HEALTHY
  unresolved?: typeof UNRESOLVED_ITEMS
  ops?: ReturnType<typeof makeOpsStatus>
}

const mockAdminOps = async (page: Page, options: AdminOpsOptions = {}) => {
  const powens = options.powens ?? POWENS_CONNECTED
  const external = options.external ?? EXTERNAL_HEALTHY
  const valuation = options.valuation ?? VALUATION_HEALTHY
  const unresolved = options.unresolved ?? { totalItems: 8, items: [] }

  await page.route('**/api/auth/me', route => json(route, ADMIN_AUTH))
  await page.route('**/api/dashboard/advisor/spend', route => json(route, options.spend ?? SPEND))
  await page.route('**/api/dashboard/costs/overview', route => json(route, options.costs ?? COSTS))
  await page.route('**/api/integrations/powens/status', route => json(route, powens))
  await page.route('**/api/integrations/external-investments/status', route =>
    json(route, external)
  )
  await page.route('**/api/dashboard/derived-recompute', route => json(route, DERIVED_HEALTHY))
  await page.route('**/api/dashboard/valuation/status', route => json(route, valuation))
  await page.route('**/api/dashboard/valuation/unresolved', route => json(route, unresolved))
  await page.route('**/api/dashboard/signals/x-twitter/health', route =>
    json(route, {
      ok: true,
      mode: 'admin',
      enabled: true,
      configured: true,
      budgetStatus: 'healthy',
      lastDailyRunStartedAt: NOW,
      lastDailyRunStatus: 'success',
    })
  )
  await page.route('**/api/ops/refresh/status', route =>
    json(route, options.ops ?? makeOpsStatus())
  )
  await page.route('**/api/dashboard/admin/free-firehose/estimate', route =>
    json(route, {
      ok: true,
      maxRecords: 80,
      weeklyCap: 3,
      runsLastWeek: 1,
      wouldBeBlockedByCap: false,
      requiresConfirmation: true,
    })
  )
}

test.describe('Costs', () => {
  test.use({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' })

  test('shows measured and estimated costs, IA detail, anomaly and quiet states', async ({
    page,
  }) => {
    await mockAdminOps(page, {
      spend: {
        ...SPEND,
        anomalies: [
          {
            severity: 'warning',
            kind: 'usage_spike',
            message: 'Usage supérieur au rythme habituel',
          },
        ],
      },
    })
    await page.goto('/couts', { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { level: 1, name: 'Coûts' })).toBeVisible()
    await expect(page.getByRole('table', { name: 'Coûts Advisor quotidiens' })).toBeAttached()
    await expect(
      page.locator('svg[aria-label="Évolution quotidienne des coûts Advisor en dollars"]')
    ).toBeVisible()
    await expect(page.getByText('Usage supérieur au rythme habituel')).toBeVisible()
    await page.screenshot({
      path: `${SHOT_DIR}/costs-desktop-dark-anomaly.png`,
      fullPage: true,
      animations: 'disabled',
    })

    await page.getByRole('button', { name: 'Détail IA' }).click()
    await expect(page.getByRole('dialog', { name: 'Détail IA' })).toBeVisible()
    await page.screenshot({
      path: `${SHOT_DIR}/costs-desktop-dark-ai-detail.png`,
      animations: 'disabled',
    })
    await page.keyboard.press('Escape')

    await page.unroute('**/api/dashboard/advisor/spend')
    await page.route('**/api/dashboard/advisor/spend', route => json(route, SPEND))
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.getByText('Aucune anomalie')).toBeVisible()
    await page.screenshot({
      path: `${SHOT_DIR}/costs-desktop-dark-quiet.png`,
      fullPage: true,
      animations: 'disabled',
    })
    await expect(page.locator('body')).not.toContainText(APP_ERRORS)
  })

  test('renders in warm light mode', async ({ page }) => {
    await setLightTheme(page)
    await mockAdminOps(page)
    await page.goto('/couts', { waitUntil: 'networkidle' })
    await expect(page.locator('html')).not.toHaveClass(/dark/)
    await page.screenshot({
      path: `${SHOT_DIR}/costs-desktop-light.png`,
      fullPage: true,
      animations: 'disabled',
    })
  })
})

test.describe('Health', () => {
  test.use({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' })

  test('shows the healthy state without operational noise', async ({ page }) => {
    await mockAdminOps(page)
    await page.goto('/sante', { waitUntil: 'networkidle' })
    await expect(page.getByText('Tout fonctionne')).toBeVisible()
    await expect(page.locator('body')).not.toContainText(
      /requestId|raw backend|PRIVATE_BACKEND_CODE/i
    )
    await page.screenshot({
      path: `${SHOT_DIR}/health-desktop-dark-healthy.png`,
      fullPage: true,
      animations: 'disabled',
    })
  })

  test('surfaces Powens and valuation interventions with an unresolved-assets drawer', async ({
    page,
  }) => {
    await mockAdminOps(page, {
      powens: POWENS_RECONNECT,
      external: EXTERNAL_MIXED,
      valuation: VALUATION_UNRESOLVED,
      unresolved: UNRESOLVED_ITEMS,
    })
    await page.goto('/sante', { waitUntil: 'networkidle' })
    await expect(page.getByText('Une intervention est requise')).toBeVisible()
    await expect(page.getByText('Powens demande une intervention')).toBeVisible()
    await page.screenshot({
      path: `${SHOT_DIR}/health-desktop-dark-degraded-powens.png`,
      fullPage: true,
      animations: 'disabled',
    })
    await page.getByRole('button', { name: 'Voir les actifs' }).click()
    await expect(page.getByRole('dialog', { name: 'Actifs non résolus' })).toBeVisible()
    await expect(page.getByText('Actions non cotées')).toBeVisible()
    await page.screenshot({
      path: `${SHOT_DIR}/health-desktop-dark-unresolved.png`,
      animations: 'disabled',
    })
  })

  test('renders in warm light mode', async ({ page }) => {
    await setLightTheme(page)
    await mockAdminOps(page)
    await page.goto('/sante', { waitUntil: 'networkidle' })
    await page.screenshot({
      path: `${SHOT_DIR}/health-desktop-light.png`,
      fullPage: true,
      animations: 'disabled',
    })
  })
})

test.describe('Integrations', () => {
  test.use({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' })

  test('shows provider states and keeps credentials out of the browser surface', async ({
    page,
  }) => {
    await mockAdminOps(page, { powens: POWENS_RECONNECT, external: EXTERNAL_MIXED })
    await page.goto('/integrations', { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { level: 1, name: 'Intégrations' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reconnecter' })).toBeVisible()
    await expect(page.locator('body')).not.toContainText(CREDENTIAL_COPY)
    await page.screenshot({
      path: `${SHOT_DIR}/integrations-desktop-dark-states.png`,
      fullPage: true,
      animations: 'disabled',
    })
    await page.getByRole('button', { name: 'Détails' }).first().click()
    await expect(page.getByRole('dialog', { name: 'Powens' })).toBeVisible()
    await page.getByRole('button', { name: 'Retirer' }).click()
    await expect(
      page.getByRole('alertdialog', { name: 'Confirmer le retrait de la connexion' })
    ).toBeVisible()
    await page.screenshot({
      path: `${SHOT_DIR}/integrations-desktop-dark-detail.png`,
      animations: 'disabled',
    })
  })

  test('renders in warm light mode', async ({ page }) => {
    await setLightTheme(page)
    await mockAdminOps(page)
    await page.goto('/integrations', { waitUntil: 'networkidle' })
    await page.screenshot({
      path: `${SHOT_DIR}/integrations-desktop-light.png`,
      fullPage: true,
      animations: 'disabled',
    })
  })
})

test.describe('Orchestration', () => {
  test.use({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' })

  test('shows human jobs and the wired Social operation detail', async ({ page }) => {
    await mockAdminOps(page)
    await page.goto('/orchestration', { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { level: 1, name: 'Orchestration' })).toBeVisible()
    await expect(page.getByText('Investissements externes').first()).toBeVisible()
    await expect(page.locator('body')).not.toContainText(
      /raw backend|PRIVATE_BACKEND_CODE|requestId/i
    )
    await page.screenshot({
      path: `${SHOT_DIR}/orchestration-desktop-dark.png`,
      fullPage: true,
      animations: 'disabled',
    })
    await page.getByRole('button', { name: /Social et X/ }).click()
    const detail = page.getByRole('dialog', { name: 'Social et X' })
    await expect(detail).toBeVisible()
    await expect(detail.getByText('Free Firehose')).toBeVisible()
    await expect(detail.getByRole('button', { name: 'Ouvrir l’import' })).toBeVisible()
    await page.screenshot({
      path: `${SHOT_DIR}/orchestration-desktop-dark-detail.png`,
      animations: 'disabled',
    })
  })

  test('shows running and failure states without exposing raw failures', async ({ page }) => {
    await mockAdminOps(page, {
      ops: makeOpsStatus({ jobId: 'market-data', status: 'running', active: true }),
    })
    await page.goto('/orchestration', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('En cours').first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Annuler' })).toBeVisible()
    await page.screenshot({
      path: `${SHOT_DIR}/orchestration-desktop-dark-running.png`,
      fullPage: true,
      animations: 'disabled',
    })

    await page.unroute('**/api/ops/refresh/status')
    await page.route('**/api/ops/refresh/status', route =>
      json(route, makeOpsStatus({ jobId: 'market-data', status: 'failed' }))
    )
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.getByText('Échec').first()).toBeVisible()
    await expect(page.locator('body')).not.toContainText(/raw backend|PRIVATE_BACKEND_CODE/i)
    await page.screenshot({
      path: `${SHOT_DIR}/orchestration-desktop-dark-failure.png`,
      fullPage: true,
      animations: 'disabled',
    })
  })

  test('renders in warm light mode', async ({ page }) => {
    await setLightTheme(page)
    await mockAdminOps(page)
    await page.goto('/orchestration', { waitUntil: 'networkidle' })
    await page.screenshot({
      path: `${SHOT_DIR}/orchestration-desktop-light.png`,
      fullPage: true,
      animations: 'disabled',
    })
  })
})

test.describe('Ops responsive and gated behavior', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, colorScheme: 'dark' })

  for (const route of [
    { path: '/couts', slug: 'costs', heading: 'Coûts' },
    { path: '/sante', slug: 'health', heading: 'Santé' },
    { path: '/integrations', slug: 'integrations', heading: 'Intégrations' },
    { path: '/orchestration', slug: 'orchestration', heading: 'Orchestration' },
  ]) {
    test(`${route.slug} fits the 390 mobile viewport`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: 'networkidle' })
      await expect(page.getByRole('heading', { level: 1, name: route.heading })).toBeVisible()
      await expect(page.getByText(/Lecture seule/)).toBeVisible()
      await expectNoHorizontalOverflow(page)
      await page.screenshot({
        path: `${SHOT_DIR}/${route.slug}-mobile-390.png`,
        fullPage: true,
        animations: 'disabled',
      })
    })
  }

  test('preserves keyboard focus, reduced motion and the narrow responsive range', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    for (const width of [768, 320]) {
      await page.setViewportSize({ width, height: width === 320 ? 720 : 900 })
      await page.goto('/couts', { waitUntil: 'networkidle' })
      await expectNoHorizontalOverflow(page)
    }
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/couts', { waitUntil: 'networkidle' })
    await page.keyboard.press('Tab')
    await expect(page.locator(':focus')).not.toHaveCount(0)
  })

  test('admin actions appear only after the authenticated mode transition', async ({ page }) => {
    await page.goto('/integrations', { waitUntil: 'networkidle' })
    await expect(
      page.getByRole('button', { name: /Synchroniser|Reconnecter|Connecter/ })
    ).toHaveCount(0)
    await mockAdminOps(page)
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.getByRole('button', { name: 'Synchroniser' }).first()).toBeVisible()
  })
})
