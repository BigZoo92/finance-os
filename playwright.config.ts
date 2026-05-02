import { defineConfig, devices } from '@playwright/test'

const webPort = Number(process.env.E2E_WEB_PORT ?? 3000)
const apiPort = Number(process.env.E2E_API_PORT ?? 3001)
const webBaseUrl = `http://127.0.0.1:${webPort}`
const apiBaseUrl = `http://127.0.0.1:${apiPort}`

const commonDemoEnv = {
  APP_URL: webBaseUrl,
  WEB_URL: webBaseUrl,
  WEB_ORIGIN: webBaseUrl,
  LOG_LEVEL: 'warn',
  EXTERNAL_INTEGRATIONS_SAFE_MODE: 'true',
  EXTERNAL_INVESTMENTS_SAFE_MODE: 'true',
  AI_ADVISOR_ENABLED: 'false',
  KNOWLEDGE_SERVICE_ENABLED: 'false',
  QUANT_SERVICE_ENABLED: 'false',
  LIVE_NEWS_INGESTION_ENABLED: 'false',
  MARKET_DATA_ENABLED: 'false',
  MARKET_DATA_REFRESH_ENABLED: 'false',
}

const apiDemoEnv = {
  ...commonDemoEnv,
  NODE_ENV: 'test',
  FINANCE_OS_SKIP_ROOT_ENV: '1',
  RUN_DB_MIGRATIONS: 'false',
  API_HOST: '127.0.0.1',
  API_PORT: String(apiPort),
  API_ALLOW_IN_MEMORY_REDIS: 'true',
  DATABASE_URL: 'postgres://finance_os:finance_os@127.0.0.1:1/finance_os',
  REDIS_URL: 'redis://127.0.0.1:1',
  APP_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef',
  AUTH_ADMIN_EMAIL: 'admin@example.test',
  AUTH_ADMIN_PASSWORD_HASH: 'pbkdf2$e2e-placeholder',
  AUTH_SESSION_SECRET: 'test-session-secret-12345678901234567890',
  POWENS_CLIENT_ID: 'e2e-powens-client-id',
  POWENS_CLIENT_SECRET: 'e2e-powens-client-secret',
  POWENS_BASE_URL: 'https://powens.example.test',
  POWENS_DOMAIN: 'demo.powens.test',
  POWENS_REDIRECT_URI_DEV: `${webBaseUrl}/integrations/powens/callback`,
  DERIVED_RECOMPUTE_ENABLED: 'false',
  NEWS_AI_CONTEXT_BUNDLE_ENABLED: 'false',
  NEWS_METADATA_FETCH_ENABLED: 'false',
  NEWS_PROVIDER_HN_ENABLED: 'false',
  NEWS_PROVIDER_GDELT_ENABLED: 'false',
  NEWS_PROVIDER_ECB_RSS_ENABLED: 'false',
  NEWS_PROVIDER_ECB_DATA_ENABLED: 'false',
  NEWS_PROVIDER_FED_ENABLED: 'false',
  NEWS_PROVIDER_SEC_ENABLED: 'false',
  NEWS_PROVIDER_FRED_ENABLED: 'false',
  NEWS_PROVIDER_X_TWITTER_ENABLED: 'false',
  SIGNALS_SOCIAL_POLLING_ENABLED: 'false',
  MARKET_DATA_EODHD_ENABLED: 'false',
  MARKET_DATA_TWELVEDATA_ENABLED: 'false',
  MARKET_DATA_FRED_ENABLED: 'false',
  MARKET_DATA_US_FRESH_OVERLAY_ENABLED: 'false',
  AI_CHAT_ENABLED: 'false',
  AI_CHALLENGER_ENABLED: 'false',
  AI_RELABEL_ENABLED: 'false',
  AI_KNOWLEDGE_QA_RETRIEVAL_ENABLED: 'false',
  TRADING_LAB_GRAPH_INGEST_ENABLED: 'false',
  EXTERNAL_INVESTMENTS_ENABLED: 'false',
  IBKR_FLEX_ENABLED: 'false',
  BINANCE_SPOT_ENABLED: 'false',
  PWA_NOTIFICATIONS_ENABLED: 'false',
  PWA_CRITICAL_ENABLED: 'false',
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [['list'], ['junit', { outputFile: 'test-results/e2e-junit-results.xml' }]]
    : 'list',
  use: {
    baseURL: webBaseUrl,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      name: 'api',
      command: 'pnpm --filter @finance-os/api start',
      url: `${apiBaseUrl}/health`,
      timeout: 60_000,
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        ...apiDemoEnv,
      },
    },
    {
      name: 'web',
      command: `pnpm --filter @finance-os/web build && pnpm --filter @finance-os/web start --host 127.0.0.1 --port ${webPort}`,
      url: `${webBaseUrl}/health`,
      timeout: 180_000,
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        ...commonDemoEnv,
        NODE_ENV: 'production',
        API_INTERNAL_URL: apiBaseUrl,
        VITE_API_BASE_URL: '/api',
        VITE_APP_ORIGIN: webBaseUrl,
        VITE_APP_TITLE: 'finance-os',
        VITE_AI_ADVISOR_ENABLED: 'false',
      },
    },
  ],
})
