import { expect, test } from '@playwright/test'

test('demo cockpit boots and auth/me stays safe', async ({ page, request }) => {
  const healthResponse = await request.get('/api/health', {
    headers: {
      'x-request-id': 'e2e-health',
    },
  })

  expect(healthResponse.status()).toBe(200)
  await expect(healthResponse).toBeOK()
  expect(await healthResponse.json()).toMatchObject({
    ok: true,
    service: 'api',
    runtimeFlags: {
      safeModeActive: true,
    },
  })

  const authResponse = await request.get('/api/auth/me', {
    headers: {
      'x-request-id': 'e2e-auth-me',
    },
  })

  expect(authResponse.status()).toBe(200)
  expect(authResponse.headers()['cache-control']).toContain('no-store')

  const authPayload = await authResponse.json()
  expect(authPayload).toMatchObject({
    mode: 'demo',
    user: null,
  })
  expect(authPayload.requestId).toBeTruthy()

  const summaryResponse = await request.get('/api/dashboard/summary?range=30d', {
    headers: {
      'x-request-id': 'e2e-dashboard-summary',
    },
  })

  expect(summaryResponse.status()).toBe(200)
  const summaryPayload = await summaryResponse.json()
  expect(summaryPayload).toMatchObject({
    range: '30d',
    totals: {
      balance: expect.any(Number),
      incomes: expect.any(Number),
      expenses: expect.any(Number),
    },
  })

  const attentionResponse = await request.get('/api/dashboard/trading-lab/attention?status=open', {
    headers: {
      'x-request-id': 'e2e-trading-lab-attention',
    },
  })

  expect(attentionResponse.status()).toBe(200)
  expect(await attentionResponse.json()).toMatchObject({
    items: expect.any(Array),
    openCount: expect.any(Number),
  })

  await page.goto('/', { waitUntil: 'domcontentloaded' })

  const body = page.locator('body')
  await expect(body).toContainText(/Finance OS/i)
  await expect(body).toContainText(/cockpit/i)
  await expect(body).toContainText(/mode/i)
  await expect(body).not.toContainText(
    /Internal Server Error|Application Error|Cannot GET|Unhandled/i
  )
})
