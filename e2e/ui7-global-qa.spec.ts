import { expect, type Page, test } from '@playwright/test'

const APP_ERRORS = /Internal Server Error|Application Error|Cannot GET|Unhandled/i
const routes = [
  '/',
  '/depenses',
  '/patrimoine',
  '/investissements',
  '/objectifs',
  '/ia',
  '/ia/chat',
  '/ia/memoire',
  '/radar',
  '/social-intelligence',
  '/orchestration',
  '/couts',
  '/integrations',
  '/sante',
  '/login',
] as const

const expectHealthyViewport = async (page: Page) => {
  await expect(page.locator('#main-content')).toBeVisible()
  await expect(page.locator('body')).not.toContainText(APP_ERRORS)
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  )
  expect(overflow).toBe(false)
}

test.describe('Command Pixel final route matrix', () => {
  test('all canonical routes render in desktop dark mode', async ({ page }) => {
    test.setTimeout(180_000)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.addInitScript(() => window.localStorage.setItem('finance-os-theme', 'dark'))
    for (const route of routes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' })
      await expect(page.locator('html')).toHaveClass(/dark/)
      await expectHealthyViewport(page)
    }
  })

  test('all canonical routes render in warm light mode on mobile', async ({ page }) => {
    test.setTimeout(180_000)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.addInitScript(() => window.localStorage.setItem('finance-os-theme', 'light'))
    for (const route of routes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' })
      await expect(page.locator('html')).not.toHaveClass(/dark/)
      await expectHealthyViewport(page)
    }
  })

  for (const viewport of [
    { name: 'narrow mobile', width: 320, height: 700 },
    { name: 'tablet portrait', width: 768, height: 1024 },
    { name: 'tablet landscape', width: 1024, height: 768 },
    { name: 'wide desktop', width: 1728, height: 1000 },
  ]) {
    test(`representative routes fit ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      for (const route of ['/', '/ia/chat', '/ia/memoire', '/radar', '/login']) {
        await page.goto(route, { waitUntil: 'domcontentloaded' })
        await expectHealthyViewport(page)
      }
    })
  }

  test('canonical pages do not emit uncaught browser errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    for (const route of routes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' })
      await expectHealthyViewport(page)
    }
    expect(errors).toEqual([])
  })
})

test.describe('Trading lab', () => {
  test('demo backtest charts render with the lightweight-charts 5 API', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('/ia/trading-lab', { waitUntil: 'networkidle' })
    await expectHealthyViewport(page)
    // Equity curve and drawdown of the demo backtest: both must mount a chart,
    // never fall back to "Graphique indisponible".
    await expect(page.locator('[data-chart-state="ready"]')).toHaveCount(2)
    await expect(page.locator('[data-chart-state="unavailable"]')).toHaveCount(0)
    await expect(page.locator('[data-chart-state="ready"] canvas').first()).toBeVisible()
    // The chart palette is read from Panda's color variables on <html>: they
    // must resolve, or the charts silently fall back to hard-coded colors.
    const palette = await page.evaluate(() => {
      const styles = getComputedStyle(document.documentElement)
      return ['border', 'negative', 'teal', 'muted-foreground', 'foreground'].map(name =>
        styles.getPropertyValue(`--colors-${name}`).trim()
      )
    })
    expect(palette.every(value => value.length > 0)).toBe(true)
    expect(errors).toEqual([])
  })
})

test.describe('Compatibility routes', () => {
  const redirects = [
    ['/transactions', '/depenses'],
    ['/memoire', '/ia/memoire'],
    ['/ia/memoire/graph', '/ia/memoire'],
    ['/ia/strategie-investissement', '/investissements'],
    ['/ia/couts', '/couts'],
    ['/signaux', '/radar'],
    ['/signaux/marches', '/radar'],
    ['/marches', '/radar'],
    ['/actualites', '/radar'],
    ['/signaux/social', '/social-intelligence'],
    ['/signaux/x-twitter', '/social-intelligence'],
  ] as const

  for (const [source, destination] of redirects) {
    test(`${source} redirects to ${destination}`, async ({ page }) => {
      await page.goto(source, { waitUntil: 'domcontentloaded' })
      await expect(page).toHaveURL(new RegExp(`${destination.replaceAll('/', '\\/')}/?(?:\\?|$)`))
    })
  }
})
