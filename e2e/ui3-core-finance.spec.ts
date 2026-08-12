import { expect, type Page, test } from '@playwright/test'

const SHOT_DIR = 'test-results/ui3-core-finance'
const routes = [
  { path: '/', title: 'Cockpit', slug: 'cockpit' },
  { path: '/objectifs', title: 'Objectifs', slug: 'objectifs' },
  { path: '/depenses', title: 'Dépenses', slug: 'depenses' },
  { path: '/investissements', title: 'Investissements', slug: 'investissements' },
  { path: '/patrimoine', title: 'Patrimoine', slug: 'patrimoine' },
] as const

const openRoute = async (page: Page, route: (typeof routes)[number]) => {
  await page.goto(route.path, { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { level: 1, name: route.title })).toBeVisible()
  await expect(page.locator('body')).not.toContainText(
    /Internal Server Error|Application Error|Cannot GET|Unhandled/i
  )
}

test.describe('UI-3 desktop dark', () => {
  test.use({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' })

  test('core financial routes render and interactions stay accessible', async ({ page }) => {
    test.setTimeout(120_000)
    for (const route of routes) {
      await openRoute(page, route)
      await page.screenshot({ path: `${SHOT_DIR}/desktop-dark-${route.slug}.png`, fullPage: true })
    }

    await openRoute(page, routes[0])
    await page.getByRole('radio', { name: '90 j' }).click()
    await expect(page).toHaveURL(/range=90d/)

    await openRoute(page, routes[1])
    const addGoal = page.getByRole('button', { name: 'Ajouter un objectif' }).first()
    await expect(addGoal).toBeDisabled()

    await openRoute(page, routes[3])
    const detail = page.getByRole('button', { name: 'Détail' }).first()
    await detail.click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(detail).toBeFocused()
  })
})

test.describe('UI-3 desktop light', () => {
  test.use({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' })

  test('all core financial routes render in light mode', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('finance-os-theme', 'light')
    })
    for (const route of routes) {
      await openRoute(page, route)
      await expect(page.locator('html')).not.toHaveClass(/dark/)
      await page.screenshot({ path: `${SHOT_DIR}/desktop-light-${route.slug}.png`, fullPage: true })
    }
  })
})

test.describe('UI-3 mobile dark', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, colorScheme: 'dark' })

  test('all core financial routes fit the mobile viewport', async ({ page }) => {
    for (const route of routes) {
      await openRoute(page, route)
      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      )
      expect(hasHorizontalOverflow).toBe(false)
      await page.screenshot({ path: `${SHOT_DIR}/mobile-dark-${route.slug}.png`, fullPage: true })
    }
  })
})
