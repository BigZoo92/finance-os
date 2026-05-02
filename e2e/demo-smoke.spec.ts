import { expect, test } from '@playwright/test'

test('demo cockpit boots and auth/me stays safe', async ({ page, request }) => {
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

  await page.goto('/', { waitUntil: 'domcontentloaded' })

  const body = page.locator('body')
  await expect(body).toContainText(/Finance OS/i)
  await expect(body).toContainText(/cockpit/i)
  await expect(body).toContainText(/mode/i)
  await expect(body).not.toContainText(
    /Internal Server Error|Application Error|Cannot GET|Unhandled/i
  )
})
