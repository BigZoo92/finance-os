import { defineConfig, devices } from '@playwright/test'

const webPort = Number(process.env.E2E_WEB_PORT ?? 3000)
const apiPort = Number(process.env.E2E_API_PORT ?? 3001)
const webBaseUrl = `http://127.0.0.1:${webPort}`
const apiBaseUrl = `http://127.0.0.1:${apiPort}`

const commonDemoEnv = {
  NODE_ENV: 'development',
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
      name: 'demo-api',
      command: 'node scripts/e2e-demo-api.mjs',
      url: `${apiBaseUrl}/health`,
      timeout: 30_000,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        E2E_DEMO_API_HOST: '127.0.0.1',
        E2E_DEMO_API_PORT: String(apiPort),
      },
    },
    {
      name: 'web',
      command: `pnpm --filter @finance-os/web dev --host 127.0.0.1 --port ${webPort}`,
      url: `${webBaseUrl}/health`,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        ...commonDemoEnv,
        API_INTERNAL_URL: apiBaseUrl,
        VITE_API_BASE_URL: '/api',
        VITE_APP_ORIGIN: webBaseUrl,
        VITE_APP_TITLE: 'finance-os',
        VITE_AI_ADVISOR_ENABLED: 'false',
      },
    },
  ],
})
