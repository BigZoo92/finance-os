import { expect, test } from '@playwright/test'
import { VISUAL_FIXED_TIME } from './support/visual-clock'

/**
 * Command Pixel visual regression harness.
 *
 * Baselines are recorded locally with `pnpm test:e2e:visual -- --update-snapshots`
 * (stored under e2e/__visual__, gitignored: fonts and antialiasing are machine
 * specific) and compared on the following runs. The suite is opt-in through
 * VISUAL_REGRESSION=1 so the CI matrix stays deterministic across platforms.
 * The clock is pinned to VISUAL_FIXED_TIME in the browser and in the SSR
 * process, so relative labels do not drift between runs.
 */
const routes = [
  '/',
  '/depenses',
  '/patrimoine',
  '/investissements',
  '/objectifs',
  '/ia',
  '/ia/chat',
  '/ia/memoire',
  '/ia/trading-lab',
  '/radar',
  '/social-intelligence',
  '/orchestration',
  '/couts',
  '/integrations',
  '/sante',
  '/login',
] as const

const scenarios = [
  { name: 'desktop-dark', width: 1440, height: 900, theme: 'dark' },
  { name: 'desktop-light', width: 1440, height: 900, theme: 'light' },
  { name: 'mobile-dark', width: 390, height: 844, theme: 'dark' },
] as const

const slug = (route: string) => (route === '/' ? 'home' : route.slice(1).replace(/\//g, '-'))

test.describe('Command Pixel visual regression', () => {
  test.skip(process.env.VISUAL_REGRESSION !== '1', 'opt-in: VISUAL_REGRESSION=1')

  for (const scenario of scenarios) {
    test(`${scenario.name} route matrix`, async ({ page }) => {
      test.setTimeout(300_000)
      await page.setViewportSize({ width: scenario.width, height: scenario.height })
      await page.clock.setFixedTime(new Date(VISUAL_FIXED_TIME))
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.addInitScript(
        theme => window.localStorage.setItem('finance-os-theme', theme),
        scenario.theme
      )
      for (const route of routes) {
        await page.goto(route, { waitUntil: 'networkidle' })
        await expect(page.locator('#main-content')).toBeVisible()
        // Lazy client-only charts settle after network idle: wait for each one
        // to reach a terminal state (ready or unavailable) before capturing.
        await expect(
          page.locator('[data-chart-state="loading"], [data-chart-state="pending"]')
        ).toHaveCount(0)
        // Soft: one run reports every differing route of the scenario instead
        // of stopping at the first one (the test still fails if any differs).
        await expect.soft(page).toHaveScreenshot(`${scenario.name}-${slug(route)}.png`, {
          fullPage: true,
          animations: 'disabled',
          caret: 'hide',
          maxDiffPixels: 100,
          // Lazy chart canvases resize asynchronously during the full-page
          // capture; their containers are masked (layout still compared) and
          // their rendering is asserted by the trading lab E2E test.
          mask: [page.locator('[data-chart-state]')],
        })
      }
    })
  }
})
