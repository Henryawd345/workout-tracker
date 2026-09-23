import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

/** Builds some real data through the UI: a routine, one finished workout, one in progress. */
async function seed(page: Page) {
  await page.goto('/#/routines')
  await page.getByRole('button', { name: 'New routine' }).tap()
  await page.getByRole('textbox', { name: 'Name' }).fill('Push')
  await page.getByRole('button', { name: 'Add exercises' }).tap()
  const picker = page.getByRole('dialog', { name: 'Add exercises' })
  await picker.getByRole('searchbox').fill('Dip')
  await picker.getByRole('button', { name: /^Dip/ }).first().tap()
  await picker.getByRole('button', { name: 'Add (1)' }).tap()
  await page.getByRole('button', { name: 'Back to routines' }).tap()
  await page.getByRole('link', { name: 'Today' }).tap()
  await page.getByRole('button', { name: 'Start Push' }).tap()
  const dip = page.getByRole('listitem', { name: 'Dip' })
  await dip.getByRole('textbox', { name: 'Set 1 reps' }).fill('10')
  await dip.getByRole('button', { name: 'Complete set 1' }).tap()
  await page.getByRole('button', { name: 'Finish' }).tap()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Finish' }).tap()
  await page.getByRole('button', { name: 'Done', exact: true }).tap()
}

const SCREENS = ['/#/today', '/#/routines', '/#/routines/exercises', '/#/history', '/#/history?view=calendar', '/#/progress', '/#/settings']

test('no serious accessibility problems on the main screens (light and dark)', async ({ page }) => {
  await seed(page)
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme })
    for (const url of SCREENS) {
      await page.goto(url)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(300)
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
      expect(
        serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`),
        `${scheme} ${url}`,
      ).toEqual([])
    }
  }
})

test('the active workout screen has no serious accessibility problems', async ({ page }) => {
  await page.goto('/#/today')
  await page.getByRole('button', { name: 'Start empty workout' }).tap()
  await page.getByRole('button', { name: 'Add exercises' }).tap()
  const picker = page.getByRole('dialog', { name: 'Add exercises' })
  await picker.getByRole('searchbox').fill('Plank')
  await picker.getByRole('button', { name: /^Plank/ }).first().tap()
  await picker.getByRole('button', { name: 'Add (1)' }).tap()
  const plank = page.getByRole('listitem', { name: 'Plank' })
  await plank.getByRole('textbox', { name: 'Set 1 time' }).fill('0:45')
  await plank.getByRole('button', { name: 'Complete set 1' }).tap()
  await expect(page.getByRole('group', { name: 'Rest timer' })).toBeVisible()
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([])
})

test('the Home Screen tip shows once on iPhone Safari', async ({ page }) => {
  await page.goto('/#/today')
  const tip = page.getByRole('complementary', { name: 'Install the app' })
  await expect(tip).toBeVisible()
  await tip.getByRole('button', { name: 'Got it' }).tap()
  await expect(tip).toBeHidden()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  await expect(tip).toBeHidden()
})

test('the offline build caches everything the app needs', async () => {
  // Built by `npm run build`; the e2e script runs it first.
  const sw = readFileSync('dist/sw.js', 'utf8')
  const html = readFileSync('dist/index.html', 'utf8')
  const assets = [...html.matchAll(/(?:src|href)="\/?(assets\/[^"]+)"/g)].map((m) => m[1])
  expect(assets.length).toBeGreaterThanOrEqual(2) // the app's JS and CSS
  for (const file of ['index.html', 'apple-touch-icon.png', 'manifest.webmanifest', ...assets]) {
    expect(sw, `${file} is cached for offline use`).toContain(`"${file}"`)
  }
  // Every page is index.html (hash addresses), which is served from the cache when offline.
  expect(sw).toMatch(/NavigationRoute\(.*createHandlerBoundToURL\("index\.html"\)/s)
})
