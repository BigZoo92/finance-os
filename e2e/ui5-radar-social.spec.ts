import { expect, type Page, test } from '@playwright/test'

/**
 * UI-5 Radar and Social Intelligence QA: canonical routes, legacy redirects,
 * the D3 Signal Field, signal selection, quiet state, source gallery,
 * selection, filters, light mode and mobile viewports. Screenshots land in
 * test-results/ui5-radar-social/ for comparison against the canonical frames.
 */

const SHOT_DIR = 'test-results/ui5-radar-social'
const RECOMMENDATIONS = /\b(acheter|vendre|renforcer|alléger|investir)\b/i
const APP_ERRORS = /Internal Server Error|Application Error|Cannot GET|Unhandled/i

const ADMIN_AUTH = {
  mode: 'admin',
  user: { email: 'admin@example.test', displayName: 'Admin' },
  requestId: 'e2e-ui5-admin',
}

const mockAdmin = async (page: Page) => {
  await page.route('**/api/auth/me', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'cache-control': 'no-store' },
      body: JSON.stringify(ADMIN_AUTH),
    })
  )
}

const setLightTheme = async (page: Page) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('finance-os-theme', 'light')
  })
}

const expectNoHorizontalOverflow = async (page: Page) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  )
  expect(overflow).toBe(false)
}

test.describe('Radar desktop dark', () => {
  test.use({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' })

  test('renders the signal field, focuses a signal and keeps signals observational', async ({
    page,
  }) => {
    await page.goto('/radar', { waitUntil: 'networkidle' })

    await expect(page.getByRole('heading', { level: 1, name: 'Radar' })).toBeAttached()
    await expect(page.getByRole('img', { name: 'Champ des signaux' })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Marchés suivis' })).toBeVisible()
    const signals = page.getByRole('list', { name: 'Signaux' })
    await expect(signals.getByRole('button').first()).toBeVisible()
    await expect(page.locator('body')).not.toContainText(RECOMMENDATIONS)
    await expect(page.locator('body')).not.toContainText(APP_ERRORS)
    await expect(page.locator('body')).not.toContainText(/bundle|pipeline|ingestion|requestId/i)
    await page.screenshot({
      path: `${SHOT_DIR}/radar-desktop-dark.png`,
      fullPage: true,
      animations: 'disabled',
    })

    const first = signals.getByRole('button').first()
    await first.click()
    await expect(page).toHaveURL(/focus=signal/)
    await expect(first).toHaveAttribute('aria-pressed', 'true')
    const detail = page.getByRole('region', { name: 'Fed funds' })
    await expect(detail).toBeVisible()
    await expect(detail).toContainText('Les taux courts restent élevés')
    await expect(detail).not.toContainText(/Advisor/)
    await page.screenshot({
      path: `${SHOT_DIR}/radar-desktop-dark-selected.png`,
      animations: 'disabled',
    })

    await page.keyboard.press('Escape')
    await expect(page).not.toHaveURL(/focus=/)
    await expect(detail).toHaveCount(0)
    await expect(first).toBeFocused()

    await page.getByRole('radio', { name: 'Macro' }).click()
    await expect(page).toHaveURL(/filter=macro/)
    await expect(signals.getByRole('button').first()).toBeVisible()
  })

  test('shows the calm state when nothing is notable', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.route('**/api/dashboard/markets/overview', async route => {
      const response = await route.fetch()
      const json = await response.json()
      json.signals.items = []
      await route.fulfill({ response, json })
    })

    await page
      .getByRole('navigation', { name: 'Navigation principale' })
      .getByRole('link', { name: 'Radar' })
      .click()
    await expect(page).toHaveURL(/\/radar/)
    await expect(page.getByText('Rien de notable')).toBeVisible()
    await expect(page.getByRole('list', { name: 'Signaux' })).toHaveCount(0)
    await expect(page.getByRole('img', { name: 'Champ des signaux' })).toBeVisible()
    await expect(page.locator('#main-content')).not.toContainText(/grâce à|notre IA/i)
    // Client-side navigation: let the route entrance settle before capturing.
    await expect(page.locator('#main-content > div').first()).toHaveCSS('opacity', '1')
    await page.screenshot({
      path: `${SHOT_DIR}/radar-desktop-dark-quiet.png`,
      fullPage: true,
      animations: 'disabled',
    })
  })

  test('legacy routes redirect to the canonical destinations', async ({ page }) => {
    for (const path of ['/signaux', '/signaux/marches', '/marches', '/actualites']) {
      await page.goto(path, { waitUntil: 'networkidle' })
      await expect(page).toHaveURL(/\/radar$/)
    }
    for (const path of ['/signaux/social', '/signaux/x-twitter']) {
      await page.goto(path, { waitUntil: 'networkidle' })
      await expect(page).toHaveURL(/\/social-intelligence$/)
    }
  })
})

test.describe('Radar light', () => {
  test.use({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' })

  test('renders natively in warm light mode', async ({ page }) => {
    await setLightTheme(page)
    await page.goto('/radar', { waitUntil: 'networkidle' })
    await expect(page.locator('html')).not.toHaveClass(/dark/)
    await expect(page.getByRole('img', { name: 'Champ des signaux' })).toBeVisible()
    await page.screenshot({
      path: `${SHOT_DIR}/radar-desktop-light.png`,
      fullPage: true,
      animations: 'disabled',
    })
  })
})

test.describe('Radar mobile 390', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, colorScheme: 'dark' })

  test('keeps the field, chips and selection usable', async ({ page }) => {
    await page.goto('/radar', { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { level: 1, name: 'Radar' })).toBeVisible()
    await expect(page.getByRole('img', { name: 'Champ des signaux' })).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await page.screenshot({
      path: `${SHOT_DIR}/radar-mobile-390.png`,
      fullPage: true,
      animations: 'disabled',
    })

    await page.getByRole('list', { name: 'Signaux' }).getByRole('button').first().click()
    const drawer = page.getByRole('dialog')
    await expect(drawer).toBeVisible()
    await expect(drawer).toContainText('Les taux courts restent élevés')
    await page.screenshot({
      path: `${SHOT_DIR}/radar-mobile-390-selected.png`,
      animations: 'disabled',
    })
    await page.keyboard.press('Escape')
    await expect(drawer).toHaveCount(0)
  })
})

test.describe('Radar mobile 320', () => {
  test.use({ viewport: { width: 320, height: 720 }, hasTouch: true, colorScheme: 'dark' })

  test('fits the narrowest viewport without overflow', async ({ page }) => {
    await page.goto('/radar', { waitUntil: 'networkidle' })
    await expect(page.getByRole('img', { name: 'Champ des signaux' })).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await page.screenshot({
      path: `${SHOT_DIR}/radar-mobile-320.png`,
      fullPage: true,
      animations: 'disabled',
    })
  })
})

test.describe('Social Intelligence desktop dark', () => {
  test.use({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' })

  test('gallery, selection and filters work for normal users', async ({ page }) => {
    await page.goto('/social-intelligence', { waitUntil: 'networkidle' })

    await expect(page.getByRole('heading', { level: 1, name: 'Social Intelligence' })).toBeVisible()
    const navbar = page.getByRole('navigation', { name: 'Navigation principale' })
    await expect(navbar.getByRole('link', { name: 'Radar' })).toHaveAttribute(
      'aria-current',
      'page'
    )
    const gallery = page.getByRole('list', { name: 'Sources suivies' }).first()
    const cards = gallery.getByRole('button')
    await expect(cards).toHaveCount(4)
    await expect(page.getByRole('button', { name: 'Ajouter une source' })).toHaveCount(0)
    await expect(page.locator('body')).not.toContainText(
      /x_twitter|ai_tech|followers|JSON|Import manuel/i
    )
    await page.screenshot({
      path: `${SHOT_DIR}/social-desktop-dark.png`,
      fullPage: true,
      animations: 'disabled',
    })

    const card = cards.filter({ hasText: 'Ben Zaborsky' })
    await card.click()
    await expect(page).toHaveURL(/selected=1/)
    const detail = page.getByRole('dialog')
    await expect(detail).toBeVisible()
    await expect(detail).toContainText('@zaborsky')
    await expect(detail).toContainText('Source')
    await expect(detail).toContainText('Actif')
    await expect(detail.getByRole('button', { name: 'Supprimer' })).toHaveCount(0)
    await page.screenshot({
      path: `${SHOT_DIR}/social-desktop-dark-selected.png`,
      animations: 'disabled',
    })
    await page.keyboard.press('Escape')
    await expect(detail).toHaveCount(0)
    await expect(card).toBeFocused()

    await page.getByRole('button', { name: /Filtres/ }).click()
    const filters = page.locator('[data-slot="popover-content"]')
    await expect(filters).toBeVisible()
    await page.screenshot({
      path: `${SHOT_DIR}/social-desktop-dark-filters.png`,
      animations: 'disabled',
    })
    await filters.getByRole('radio', { name: 'IA et Tech' }).click()
    await filters.getByRole('button', { name: 'Appliquer' }).click()
    await expect(filters).toHaveCount(0)
    await expect(page).toHaveURL(/group=ia-tech/)
    await expect(cards).toHaveCount(2)
    await expect(page.getByText('2 sources correspondantes')).toBeVisible()

    await page.getByRole('searchbox', { name: 'Rechercher une source' }).fill('anthropic')
    await expect(cards).toHaveCount(1)
    await expect(cards.first()).toContainText('Anthropic')
  })

  test('admin sees source management without weakening the gallery', async ({ page }) => {
    await mockAdmin(page)
    await page.goto('/social-intelligence', { waitUntil: 'networkidle' })

    await expect(page.getByRole('button', { name: 'Ajouter une source' })).toBeVisible()
    await page
      .getByRole('list', { name: 'Sources suivies' })
      .first()
      .getByRole('button')
      .first()
      .click()
    const detail = page.getByRole('dialog')
    await expect(detail.getByRole('button', { name: 'Mettre en pause' })).toBeVisible()
    await detail.getByRole('button', { name: 'Supprimer' }).click()
    const confirm = page.getByRole('dialog', { name: 'Supprimer cette source' })
    await expect(confirm).toBeVisible()
    await page.screenshot({
      path: `${SHOT_DIR}/social-desktop-dark-admin.png`,
      animations: 'disabled',
    })
    await confirm.getByRole('button', { name: 'Annuler' }).click()
    await expect(confirm).toHaveCount(0)
    await page.keyboard.press('Escape')

    await expect(page.getByRole('button', { name: 'Autres actions' })).toHaveCount(0)
    await expect(page.getByText('Import manuel')).toHaveCount(0)
  })
})

test.describe('Social Intelligence light', () => {
  test.use({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' })

  test('renders natively in warm light mode', async ({ page }) => {
    await setLightTheme(page)
    await page.goto('/social-intelligence', { waitUntil: 'networkidle' })
    await expect(page.locator('html')).not.toHaveClass(/dark/)
    await expect(
      page.getByRole('list', { name: 'Sources suivies' }).first().getByRole('button')
    ).toHaveCount(4)
    await page.screenshot({
      path: `${SHOT_DIR}/social-desktop-light.png`,
      fullPage: true,
      animations: 'disabled',
    })
  })
})

test.describe('Social Intelligence mobile 390', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, colorScheme: 'dark' })

  test('uses the row gallery, the bottom detail sheet and reachable filters', async ({ page }) => {
    await page.goto('/social-intelligence', { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { level: 1, name: 'Social Intelligence' })).toBeVisible()
    const rows = page.getByRole('list', { name: 'Sources suivies' }).last().getByRole('button')
    await expect(rows).toHaveCount(4)
    await expectNoHorizontalOverflow(page)
    await page.screenshot({
      path: `${SHOT_DIR}/social-mobile-390.png`,
      fullPage: true,
      animations: 'disabled',
    })

    await rows.first().click()
    const sheet = page.getByRole('dialog')
    await expect(sheet).toBeVisible()
    await expect(sheet).toContainText('@')
    await page.screenshot({
      path: `${SHOT_DIR}/social-mobile-390-selected.png`,
      animations: 'disabled',
    })
    await page.keyboard.press('Escape')
    await expect(sheet).toHaveCount(0)

    await page.getByRole('button', { name: /Filtres/ }).click()
    await expect(page.getByRole('dialog', { name: 'Filtres' })).toBeVisible()
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: /Plus/i }).click()
    const drawer = page.getByRole('dialog')
    await expect(drawer.getByRole('link', { name: /Social Intelligence/ })).toBeVisible()
    await expect(drawer.getByRole('link', { name: /Radar/ })).toBeVisible()
  })
})
