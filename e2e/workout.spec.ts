import { expect, test, type Page } from '@playwright/test'

async function createRoutine(page: Page, name: string, exercises: string[]) {
  await page.goto('/#/routines')
  await page.getByRole('button', { name: 'New routine' }).tap()
  await page.getByRole('textbox', { name: 'Name' }).fill(name)
  await page.getByRole('button', { name: 'Add exercises' }).tap()
  const picker = page.getByRole('dialog', { name: 'Add exercises' })
  for (const ex of exercises) {
    await picker.getByRole('searchbox').fill(ex)
    await picker.getByRole('button', { name: new RegExp(`^${ex}`) }).first().tap()
  }
  await picker.getByRole('button', { name: `Add (${exercises.length})` }).tap()
  await page.getByRole('button', { name: 'Back to routines' }).tap()
  await expect(page.getByText(`${exercises.length} exercise${exercises.length === 1 ? "" : "s"}`)).toBeVisible()
}

test('core flow: routine → start → log → reload → finish → summary', async ({ page }) => {
  await createRoutine(page, 'Full Body', ['Back Squat', 'Plank'])

  // Start from Today
  await page.getByRole('link', { name: 'Today' }).tap()
  await page.getByRole('button', { name: 'Start Full Body' }).tap()
  await expect(page.getByRole('textbox', { name: 'Workout name' })).toHaveValue('Full Body')
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden()

  const squat = page.getByRole('listitem', { name: 'Back Squat' })
  const plank = page.getByRole('listitem', { name: 'Plank' })

  // The set row fits a phone: big ✓, number keypads, no sideways scroll
  const check = squat.getByRole('button', { name: 'Complete set 1' })
  expect((await check.boundingBox())!.width).toBeGreaterThanOrEqual(48)
  await expect(squat.getByRole('textbox', { name: 'Set 1 weight (kg)' })).toHaveAttribute('inputmode', 'decimal')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBe(0)

  // Log squats
  await squat.getByRole('textbox', { name: 'Set 1 weight (kg)' }).fill('60')
  await squat.getByRole('textbox', { name: 'Set 1 reps' }).fill('8')
  await check.tap()

  // Rest timer starts, pinned to the bottom, and can be adjusted
  const rest = page.getByRole('group', { name: 'Rest timer' })
  await expect(rest).toBeVisible()
  await rest.getByRole('button', { name: '15 seconds more' }).tap()
  await expect(rest.getByRole('timer')).toHaveText(/^1:(45|44|43)$/)
  const restBox = (await rest.boundingBox())!
  expect(Math.round(restBox.y + restBox.height)).toBe(page.viewportSize()!.height)

  await squat.getByRole('textbox', { name: 'Set 2 weight (kg)' }).fill('60')
  await squat.getByRole('textbox', { name: 'Set 2 reps' }).fill('8')
  await squat.getByRole('button', { name: 'Complete set 2' }).tap()
  await expect(squat.getByText('2/3 sets')).toBeVisible()

  // Close the app mid-workout and come back
  await page.waitForTimeout(500) // let the auto-save land (it runs 300 ms after the last change)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Set 2 done — tap to undo' })).toBeVisible()

  // Timed exercise
  await plank.getByRole('textbox', { name: 'Set 1 time' }).fill('1:00')
  await plank.getByRole('button', { name: 'Complete set 1' }).tap()

  // Finish — 3 sets left un-ticked
  await page.getByRole('button', { name: 'Finish' }).tap()
  const dialog = page.getByRole('alertdialog', { name: 'Finish workout?' })
  await expect(dialog).toContainText('3 sets not ticked off')
  await dialog.getByRole('button', { name: 'Finish' }).tap()

  await expect(page.getByRole('heading', { name: 'Workout complete' })).toBeVisible()
  await expect(page.getByText('60 kg × 8, 8')).toBeVisible()
  await expect(page.getByText('1:00', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Done' }).tap()
  await expect(page.getByText('1 workout this week.')).toBeVisible()

  // …and it's in History with every set (milestone: the full flow works end to end)
  await page.getByRole('link', { name: 'History' }).tap()
  await page.getByRole('link', { name: /Full Body/ }).tap()
  await expect(page.getByRole('heading', { name: 'Full Body' })).toBeVisible()
  const squatLog = page.getByRole('listitem', { name: 'Back Squat' })
  await expect(squatLog.getByText('60×8 kg')).toHaveCount(2)
  await expect(page.getByRole('listitem', { name: 'Plank' }).getByText('1:00')).toBeVisible()
})

test('second session: one tap per set using last time', async ({ page }) => {
  await createRoutine(page, 'Squats', ['Back Squat'])
  const squat = page.getByRole('listitem', { name: 'Back Squat' })

  for (const round of [1, 2]) {
    await page.getByRole('link', { name: 'Today' }).tap()
    await page.getByRole('button', { name: 'Start Squats' }).tap()
    if (round === 1) {
      for (const n of [1, 2, 3]) {
        await squat.getByRole('textbox', { name: `Set ${n} weight (kg)` }).fill('100')
        await squat.getByRole('textbox', { name: `Set ${n} reps` }).fill('5')
        await squat.getByRole('button', { name: `Complete set ${n}` }).tap()
      }
    } else {
      await expect(squat.getByText(/Last time: 100 kg × 5, 5, 5/)).toBeVisible()
      for (const n of [1, 2, 3]) await squat.getByRole('button', { name: `Complete set ${n}` }).tap()
    }
    await page.getByRole('button', { name: 'Finish' }).tap()
    await expect(page.getByRole('heading', { name: 'Workout complete' })).toBeVisible()
    await expect(page.getByText('100 kg × 5, 5, 5')).toBeVisible()
    await page.getByRole('button', { name: 'Done' }).tap()
  }
  await expect(page.getByText('2 workouts this week.')).toBeVisible()

  // Calendar → today → correct a set in the latest workout
  await page.getByRole('link', { name: 'History' }).tap()
  await page.locator('label', { hasText: 'Calendar' }).tap()
  await expect(page.getByRole('group', { name: /^Days in/ })).toBeVisible()
  await page.getByRole('button', { name: /, 2 workouts$/ }).tap()
  await page.getByRole('list', { name: /^Workouts on/ }).getByRole('link').last().tap()
  await page.getByRole('button', { name: 'Workout actions' }).tap()
  await page.getByRole('menuitem', { name: 'Edit workout' }).tap()

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBe(0)
  await squat.getByRole('textbox', { name: 'Set 3 reps' }).fill('4')
  await page.getByRole('button', { name: 'Done', exact: true }).tap()
  await expect(page.getByRole('listitem', { name: 'Back Squat' }).getByText('100×4 kg')).toBeVisible()

  // Progress: chart for the squat, tap to read a value, fits the screen
  await page.getByRole('link', { name: 'Progress' }).tap()
  const chart = page.getByRole('img', { name: /Heaviest, Back Squat\. 2 sessions/ })
  await expect(chart).toBeVisible()
  const box = (await chart.boundingBox())!
  await page.mouse.click(box.x + box.width - 20, box.y + box.height / 2)
  await expect(page.getByRole('status').filter({ hasText: '100 kg' })).toBeVisible()
  const progressOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(progressOverflow).toBe(0)
  await page.screenshot({ path: 'test-results/progress.png', fullPage: true })
})
