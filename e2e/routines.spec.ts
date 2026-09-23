import { expect, test, type Page } from '@playwright/test'

async function addExercises(page: Page, names: string[]) {
  await page.getByRole('button', { name: 'Add exercises' }).tap()
  const picker = page.getByRole('dialog', { name: 'Add exercises' })
  for (const name of names) {
    await picker.getByRole('searchbox').fill(name)
    await picker.getByRole('button', { name: new RegExp(`^${name}`) }).first().tap()
  }
  await picker.getByRole('button', { name: `Add (${names.length})` }).tap()
  await expect(picker).toBeHidden()
}

test('create a routine, set targets, reorder, and it survives a reload', async ({ page }) => {
  await page.goto('/#/routines')
  await page.getByRole('button', { name: 'New routine' }).tap()
  const name = page.getByRole('textbox', { name: 'Name' })
  await name.fill('Leg Day')

  await addExercises(page, ['Back Squat', 'Leg Press', 'Plank'])
  const cards = page.getByRole('list', { name: 'Exercises' }).getByRole('listitem')
  await expect(cards).toHaveCount(3)

  // Number keypad for targets, large enough to tap
  const reps = cards.nth(0).getByRole('textbox', { name: 'Set 1 target reps' })
  await expect(reps).toHaveAttribute('inputmode', 'numeric')
  expect((await reps.boundingBox())!.height).toBeGreaterThanOrEqual(48)
  await reps.fill('5')
  await cards.nth(2).getByRole('textbox', { name: 'Set 1 target time' }).fill('1:00')
  await name.tap() // leave the time field

  // Move Plank up one place. (Finger-dragging the handle does the same, but simulated
  // touch drags are unreliable in automated WebKit — checked by hand instead.)
  await expect(page.getByRole('button', { name: 'Reorder Plank' })).toBeVisible()
  await cards.nth(2).getByRole('button', { name: 'More actions for Plank' }).tap()
  await page.getByRole('menuitem', { name: 'Move up' }).tap()
  await expect
    .poll(() => cards.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label'))))
    .toEqual(['Back Squat', 'Plank', 'Leg Press'])

  // No sideways scrolling with the sets table
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBe(0)

  // Leave, and wait for the list to show the saved routine before reloading
  await page.getByRole('button', { name: 'Back to routines' }).tap()
  await expect(page.getByText('3 exercises')).toBeVisible()
  await page.reload()
  await page.getByRole('link', { name: /Leg Day/ }).tap()
  await expect(cards.nth(1)).toHaveAttribute('aria-label', 'Plank')
  await expect(cards.nth(1).getByRole('textbox', { name: 'Set 1 target time' })).toHaveValue('1:00')
  await expect(cards.nth(0).getByRole('textbox', { name: 'Set 1 target reps' })).toHaveValue('5')
})
