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
