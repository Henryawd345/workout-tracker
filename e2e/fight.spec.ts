import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

async function noSeriousProblems(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`), label).toEqual([])
}

test('a 1-round boxing session runs to the bell and shows a summary', async ({ page }) => {
  await page.clock.install()
  await page.goto('/#/fight')
  await page.getByRole('link', { name: /Boxing/ }).tap()
  await page.getByRole('group', { name: 'Round length' }).getByText('1 min').tap()
  while (!(await page.getByRole('button', { name: 'Fewer rounds' }).isDisabled())) {
    await page.getByRole('button', { name: 'Fewer rounds' }).tap()
  }
  await page.getByRole('button', { name: 'Start' }).tap()

  await expect(page.getByText('Get ready')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden()
  await page.clock.runFor(12_000)
  await expect(page.getByText('Round 1 of 1')).toBeVisible()
  await page.clock.runFor(5_000)
  await expect(page.getByLabel('Combo')).toHaveText(/^[1-6]/)

  // Big, readable controls on the screen you use mid-round.
  for (const name of ['Pause', 'End', 'Minimise session']) {
    const box = await page.getByRole('button', { name }).boundingBox()
    expect(box!.height, name).toBeGreaterThanOrEqual(48)
  }
  const comboSize = await page.getByLabel('Combo').evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
  expect(comboSize).toBeGreaterThanOrEqual(32)

  await page.clock.runFor(60_000)
  await expect(page.getByRole('heading', { name: 'Session complete' })).toBeVisible()
  await expect(page.getByText('1/1')).toBeVisible()
  await page.getByRole('button', { name: 'Done' }).tap()

  // It's in History, next to lifting workouts, and opens its own detail.
  await page.getByRole('link', { name: 'History' }).tap()
  await page.getByRole('link', { name: /Boxing/ }).tap()
  await expect(page.getByRole('heading', { name: 'Boxing' })).toBeVisible()
  await noSeriousProblems(page, 'fight detail')
})

test('your own combos are saved per sport', async ({ page }) => {
  await page.goto('/#/fight/muay_thai')
  await page.getByRole('link', { name: 'Combos' }).tap()
  await page.getByRole('textbox', { name: 'New combo' }).fill('1 2 rear kick')
  await page.getByRole('button', { name: 'Add combo' }).tap()
  await expect(page.getByRole('list', { name: 'Your combos' })).toContainText('1 2 rear kick')
  await page.reload()
  await expect(page.getByRole('list', { name: 'Your combos' })).toContainText('1 2 rear kick')
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme })
    await noSeriousProblems(page, `${scheme} combos`)
  }
})

test('Start is in reach without scrolling, with nothing under it to mis-tap', async ({ page }) => {
  await page.goto('/#/fight')
  await page.getByRole('link', { name: /Kickboxing/ }).tap()
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible()
  // On an iPhone 14 the setup screen is taller than the space for it — that's what made Start move.
  const main = await page.locator('main').evaluate((m) => ({ scroll: m.scrollHeight, client: m.clientHeight, bottom: m.getBoundingClientRect().bottom }))
  expect(main.scroll).toBeGreaterThan(main.client)
  const start = await page.getByRole('button', { name: 'Start' }).boundingBox()
  // Before any scrolling, Start already sits at the bottom of the visible area.
  expect(main.bottom - (start!.y + start!.height)).toBeLessThan(24)
  const combos = await page.getByRole('link', { name: /Combos/ }).boundingBox()
  expect(combos!.y).toBeLessThan(start!.y)
  // Scrolled to the very bottom, Start is still the last thing above the tab bar.
  await page.locator('main').evaluate((m) => m.scrollTo(0, m.scrollHeight))
  const after = await page.getByRole('button', { name: 'Start' }).boundingBox()
  expect(after!.y).toBeCloseTo(start!.y, 0)
})

test('the session survives a reload', async ({ page }) => {
  await page.clock.install()
  await page.goto('/#/fight/wrestling')
  await page.getByRole('button', { name: 'Start' }).tap()
  await page.clock.runFor(15_000)
  await expect(page.getByText(/Round 1 of/)).toBeVisible()
  await page.reload()
  await expect(page.getByText(/Round 1 of/)).toBeVisible()
  await page.getByRole('button', { name: 'Minimise session' }).tap()
  await expect(page.getByRole('link', { name: /Wrestling · Round 1/ })).toBeVisible()
})

test('fight screens have no serious accessibility problems (light and dark)', async ({ page }) => {
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme })
    for (const url of ['/#/fight', '/#/fight/muay_thai']) {
      await page.goto(url)
      await page.waitForLoadState('networkidle')
      await noSeriousProblems(page, `${scheme} ${url}`)
    }
  }
  await page.goto('/#/fight/kickboxing')
  await page.getByRole('button', { name: 'Start' }).tap()
  await expect(page.getByText('Get ready')).toBeVisible()
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme })
    await noSeriousProblems(page, `${scheme} session`)
  }
})
