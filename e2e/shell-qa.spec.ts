import { expect, type Page, test } from '@playwright/test'

/**
 * Canonical Shell QA (UI-2): desktop navbar, dropdowns, user menu, command
 * palette, mobile bottom nav and More drawer, dark and light, demo and
 * admin visibility. Screenshots land in test-results/shell-qa/ for visual
 * comparison against the canonical Command Pixel frames.
 */

const SHOT_DIR = 'test-results/shell-qa'

const ADMIN_AUTH = {
  mode: 'admin',
  user: { email: 'admin@example.test', displayName: 'Admin' },
  requestId: 'e2e-shell-admin',
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

test.describe('desktop shell (dark, demo)', () => {
  test.use({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' })

  test('navbar structure, dropdowns and user menu', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })

    await expect(page.locator('html')).toHaveClass(/dark/)
    const navbar = page.getByRole('navigation', { name: 'Navigation principale' })
    await expect(navbar.getByRole('link', { name: 'Cockpit' })).toBeVisible()
    await expect(navbar.getByRole('button', { name: /Argent/ })).toBeVisible()
    await expect(navbar.getByRole('button', { name: /IA/ })).toBeVisible()
    await expect(navbar.getByRole('link', { name: 'Radar' })).toBeVisible()
    await expect(navbar.getByRole('button', { name: /Ops/ })).toHaveCount(0)
    await expect(page.getByText('DÉMO', { exact: true })).toBeVisible()
    await page.screenshot({ path: `${SHOT_DIR}/desktop-dark-cockpit.png`, fullPage: false })

    await navbar.getByRole('button', { name: /Argent/ }).click()
    await expect(page.getByRole('link', { name: /Dépenses/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /Patrimoine/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /Investissements/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /Objectifs/ })).toBeVisible()
    await page.screenshot({ path: `${SHOT_DIR}/desktop-dark-argent-dropdown.png` })
    await page.keyboard.press('Escape')

    await navbar.getByRole('button', { name: /IA/ }).click()
    await expect(page.getByRole('link', { name: /Advisor/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /Chat/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /Mémoire/ })).toBeVisible()
    await page.screenshot({ path: `${SHOT_DIR}/desktop-dark-ia-dropdown.png` })
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Menu utilisateur' }).click()
    const userMenu = page.locator('[data-slot="popover-content"]')
    await expect(userMenu.getByText('Mode démo')).toBeVisible()
    await expect(userMenu.getByRole('button', { name: /Passer en mode clair/ })).toBeVisible()
    await expect(userMenu.getByRole('button', { name: 'Se connecter' })).toBeVisible()
    await page.screenshot({ path: `${SHOT_DIR}/desktop-dark-user-menu.png` })
    await page.keyboard.press('Escape')
  })

  test('dropdown navigation works and active state follows the route', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    const navbar = page.getByRole('navigation', { name: 'Navigation principale' })

    await navbar.getByRole('button', { name: /Argent/ }).click()
    await page.getByRole('link', { name: /Patrimoine/ }).click()
    await expect(page).toHaveURL(/\/patrimoine/)
    await expect(navbar.getByRole('button', { name: /Argent/ })).toHaveAttribute(
      'data-active',
      'true'
    )
  })

  test('command palette opens with the shortcut and stays quiet in inputs', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })

    await page.keyboard.press('ControlOrMeta+k')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByPlaceholder('Rechercher une page')).toBeFocused()
    await page.screenshot({ path: `${SHOT_DIR}/desktop-dark-command-palette.png` })

    await dialog.getByPlaceholder('Rechercher une page').fill('objec')
    await expect(dialog.getByText('Objectifs')).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/objectifs/)
    await expect(dialog).toHaveCount(0)
  })

  test('escape and focus restoration on the Argent dropdown', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    const trigger = page.getByRole('button', { name: /Argent/ })
    await trigger.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('link', { name: /Dépenses/ })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('link', { name: /Dépenses/ })).toHaveCount(0)
    await expect(trigger).toBeFocused()
  })
})

test.describe('desktop shell (dark, admin)', () => {
  test.use({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' })

  test('Ops group is visible and gated content reachable', async ({ page }) => {
    await mockAdmin(page)
    await page.goto('/', { waitUntil: 'networkidle' })

    const navbar = page.getByRole('navigation', { name: 'Navigation principale' })
    const ops = navbar.getByRole('button', { name: /Ops/ })
    await expect(ops).toBeVisible()
    await expect(page.getByText('ADMIN', { exact: true })).toBeVisible()

    await ops.click()
    await expect(page.getByRole('link', { name: /Orchestration/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /Coûts/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /Intégrations/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /Santé/ })).toBeVisible()
    await page.screenshot({ path: `${SHOT_DIR}/desktop-dark-admin-ops-dropdown.png` })
  })
})

test.describe('desktop shell (light, demo)', () => {
  test.use({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' })

  test('light mode navbar and Argent dropdown', async ({ page }) => {
    await setLightTheme(page)
    await page.goto('/', { waitUntil: 'networkidle' })

    await expect(page.locator('html')).not.toHaveClass(/dark/)
    const navbar = page.getByRole('navigation', { name: 'Navigation principale' })
    await expect(navbar.getByRole('link', { name: 'Cockpit' })).toBeVisible()
    await page.screenshot({ path: `${SHOT_DIR}/desktop-light-cockpit.png` })

    await navbar.getByRole('button', { name: /Argent/ }).click()
    await expect(page.getByRole('link', { name: /Dépenses/ })).toBeVisible()
    await page.screenshot({ path: `${SHOT_DIR}/desktop-light-argent-dropdown.png` })
  })
})

test.describe('mobile shell (390px)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, colorScheme: 'dark' })

  test('bottom nav tabs and More drawer (demo)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })

    const bottomNav = page.getByRole('navigation', { name: 'Navigation principale' })
    await expect(bottomNav.getByRole('link', { name: /Cockpit/i })).toBeVisible()
    await expect(bottomNav.getByRole('link', { name: /Dépenses/i })).toBeVisible()
    await expect(bottomNav.getByRole('link', { name: /Patrimoine/i })).toBeVisible()
    await expect(bottomNav.getByRole('link', { name: /Advisor/i })).toBeVisible()
    const plus = bottomNav.getByRole('button', { name: /Plus/i })
    await expect(plus).toBeVisible()
    await page.screenshot({ path: `${SHOT_DIR}/mobile-dark-cockpit.png` })

    await plus.click()
    const drawer = page.getByRole('dialog')
    await expect(drawer).toBeVisible()
    await expect(drawer.getByRole('link', { name: /Investissements/ })).toBeVisible()
    await expect(drawer.getByRole('link', { name: /Objectifs/ })).toBeVisible()
    await expect(drawer.getByRole('link', { name: /Radar/ })).toBeVisible()
    await expect(drawer.getByRole('link', { name: /Social Intelligence/ })).toBeVisible()
    await expect(drawer.getByRole('link', { name: /Chat/ })).toBeVisible()
    await expect(drawer.getByRole('link', { name: /Mémoire/ })).toBeVisible()
    await expect(drawer.getByRole('link', { name: /Orchestration/ })).toHaveCount(0)
    await expect(drawer.getByRole('link', { name: /Santé/ })).toHaveCount(0)
    await page.screenshot({ path: `${SHOT_DIR}/mobile-dark-more-drawer.png` })

    await page.keyboard.press('Escape')
    await expect(drawer).toHaveCount(0)

    await plus.click()
    await page
      .getByRole('dialog')
      .getByRole('link', { name: /Objectifs/ })
      .click()
    await expect(page).toHaveURL(/\/objectifs/)
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('More drawer exposes Ops entries in admin mode', async ({ page }) => {
    await mockAdmin(page)
    await page.goto('/', { waitUntil: 'networkidle' })

    await page.getByRole('button', { name: /Plus/i }).click()
    const drawer = page.getByRole('dialog')
    await expect(drawer.getByRole('link', { name: /Orchestration/ })).toBeVisible()
    await expect(drawer.getByRole('link', { name: /Coûts/ })).toBeVisible()
    await expect(drawer.getByRole('link', { name: /Intégrations/ })).toBeVisible()
    await expect(drawer.getByRole('link', { name: /Santé/ })).toBeVisible()
    await expect(drawer.getByRole('link', { name: /Social Intelligence/ })).toBeVisible()
    await page.screenshot({ path: `${SHOT_DIR}/mobile-dark-admin-more-drawer.png` })
  })
})

test.describe('reduced motion', () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', colorScheme: 'dark' })

  test('shell renders and navigates without motion', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    const navbar = page.getByRole('navigation', { name: 'Navigation principale' })
    await expect(navbar.getByRole('link', { name: 'Cockpit' })).toBeVisible()
    await navbar.getByRole('link', { name: 'Radar' }).click()
    await expect(page).toHaveURL(/\/radar/)
    await expect(page.locator('#main-content')).toBeVisible()
  })
})
