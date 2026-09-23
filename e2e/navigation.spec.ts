import { expect, test } from '@playwright/test'

test('tabs are reachable and large enough to tap', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()

  const nav = page.getByRole('navigation', { name: 'Main' })
  for (const name of ['Routines', 'History', 'Progress', 'Today']) {
    const tab = nav.getByRole('link', { name })
    const box = await tab.boundingBox()
    expect(box?.height, `${name} tab height`).toBeGreaterThanOrEqual(48)
    expect(box?.width, `${name} tab width`).toBeGreaterThanOrEqual(48)
    await tab.tap()
    await expect(page.getByRole('heading', { name })).toBeVisible()
  }
})

test('the tab bar stays on screen at the bottom', async ({ page }) => {
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Main' })
  const box = await nav.boundingBox()
  const viewport = page.viewportSize()!
  expect(box).not.toBeNull()
  expect(Math.round(box!.y + box!.height)).toBe(viewport.height)
})

test('page does not scroll sideways', async ({ page }) => {
  await page.goto('/')
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBe(0)
})
