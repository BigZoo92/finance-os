import { expect, type Page, test } from '@playwright/test'

const SHOT_DIR = 'test-results/ui7-login'

const expectNoHorizontalOverflow = async (page: Page) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  )
  expect(overflow).toBe(false)
}

test.describe('Login desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' })

  test('renders the canonical dark composition and usable form states', async ({ page }) => {
    await page.goto('/login?reason=powens_admin_required', { waitUntil: 'networkidle' })

    await expect(page.getByRole('heading', { level: 1, name: /Finance OS/i })).toBeVisible()
    await expect(page.getByText(/Connexion admin requise/i).first()).toBeVisible()
    await expect(page.getByLabel('Email')).toHaveAttribute('autocomplete', 'email')
    await expect(page.locator('#password')).toHaveAttribute('autocomplete', 'current-password')
    await page.getByLabel('Email').fill('admin@example.test')
    await page.locator('#password').fill('secret')
    await page.getByRole('button', { name: 'Afficher le mot de passe' }).click()
    await expect(page.locator('#password')).toHaveAttribute('type', 'text')
    await expectNoHorizontalOverflow(page)
    await page.screenshot({
      path: `${SHOT_DIR}/desktop-dark.png`,
      fullPage: true,
      animations: 'disabled',
    })
  })

  test('shows a safe inline authentication error without moving the panel', async ({ page }) => {
    await page.route('**/api/auth/login', route =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'INVALID_CREDENTIALS', message: 'raw error' } }),
      })
    )
    await page.goto('/login', { waitUntil: 'networkidle' })

    const panel = page.getByRole('heading', { name: 'Se connecter' }).locator('..')
    const before = await panel.boundingBox()
    await page.getByLabel('Email').fill('admin@example.test')
    await page.locator('#password').fill('incorrect')
    await page.locator('#password').press('Enter')
    await expect(page.getByText('Identifiants incorrects')).toBeVisible()
    await expect(page.locator('body')).not.toContainText(/raw error|request id/i)
    const after = await panel.boundingBox()
    // The reveal animation leaves sub-pixel transform noise; the panel must not visibly move.
    expect(Math.abs((after?.y ?? 0) - (before?.y ?? 0))).toBeLessThan(0.5)
  })

  test('submits with Enter and transitions to the authenticated cockpit', async ({ page }) => {
    let authenticated = false
    await page.route('**/api/auth/login', async route => {
      authenticated = true
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })
    })
    await page.route('**/api/auth/me', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'cache-control': 'no-store' },
        body: JSON.stringify(
          authenticated
            ? {
                mode: 'admin',
                user: { email: 'admin@example.test', displayName: 'Admin' },
                requestId: 'ui7-login',
              }
            : { mode: 'demo', user: null, requestId: 'ui7-login' }
        ),
      })
    )
    await page.goto('/login', { waitUntil: 'networkidle' })
    await page.getByLabel('Email').fill('admin@example.test')
    await page.locator('#password').fill('secret')
    await page.locator('#password').press('Enter')
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByText('ADMIN', { exact: true })).toBeVisible()
  })
})

test.describe('Login light and responsive', () => {
  test('renders warm light mode', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.addInitScript(() => window.localStorage.setItem('finance-os-theme', 'light'))
    await page.goto('/login', { waitUntil: 'networkidle' })
    await expect(page.locator('html')).not.toHaveClass(/dark/)
    await page.screenshot({
      path: `${SHOT_DIR}/desktop-light.png`,
      fullPage: true,
      animations: 'disabled',
    })
  })

  for (const width of [390, 320]) {
    test(`keeps the form usable at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 320 ? 700 : 844 })
      await page.goto('/login', { waitUntil: 'networkidle' })
      await expect(page.getByRole('heading', { name: 'Se connecter' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible()
      await expectNoHorizontalOverflow(page)
      await page.getByLabel('Email').focus()
      await expect(page.getByLabel('Email')).toBeFocused()
      await page.screenshot({
        path: `${SHOT_DIR}/mobile-${width}.png`,
        fullPage: true,
        animations: 'disabled',
      })
    })
  }

  test('preserves the composition when reduced motion is requested', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/login', { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { name: /Finance OS/i })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeEnabled()
  })
})
