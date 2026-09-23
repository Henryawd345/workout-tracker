import { expect, test } from '@playwright/test'

test('find an exercise, create a custom one, add a note', async ({ page }) => {
  await page.goto('/#/routines')
  await page.getByRole('link', { name: 'Exercises' }).tap()
  await expect(page.getByRole('heading', { name: 'Exercises' })).toBeVisible()

  // Filter chips scroll sideways inside their row; the page itself must not.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBe(0)

  // Tap targets
  const firstRow = page.getByRole('link', { name: /^Ab Wheel Rollout/ })
  expect((await firstRow.boundingBox())!.height).toBeGreaterThanOrEqual(48)
  const chip = page.getByRole('group', { name: 'Muscle group' }).getByRole('button', { name: 'Chest' })
  expect((await chip.boundingBox())!.height).toBeGreaterThanOrEqual(40)

  // Search → no match → create with the name prefilled
  await page.getByRole('searchbox', { name: 'Search exercises' }).fill('Sled Push')
  await page.getByRole('button', { name: 'Create “Sled Push”' }).tap()
  await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Sled Push')
  await page.getByRole('button', { name: 'Quads' }).tap()
  await page.getByRole('combobox', { name: 'Equipment' }).selectOption('other')
  await page.getByRole('button', { name: 'Create exercise' }).tap()

  // Lands on its page; add a note and leave
  await expect(page.getByRole('heading', { name: 'Sled Push' })).toBeVisible()
  await page.getByRole('textbox', { name: 'Note' }).fill('Two plates each side')
  await page.getByRole('button', { name: 'Back to exercises' }).tap()

  await expect(page.getByRole('heading', { name: 'Exercises' })).toBeVisible()
  // The note is saved as we leave. Wait for that write to land before reloading —
  // reloading mid-write would throw it away, which is a test artefact, not app behaviour.
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            new Promise<string>((resolve) => {
              const open = indexedDB.open('workout-tracker')
              open.onsuccess = () => {
                const req = open.result.transaction('exercises').objectStore('exercises').getAll()
                req.onsuccess = () => {
                  const e = (req.result as { name: string; note: string }[]).find((x) => x.name === 'Sled Push')
                  resolve(e?.note ?? '<missing>')
                  open.result.close()
                }
              }
            }),
        ),
      { timeout: 3000 },
    )
    .toBe('Two plates each side')

  // Survives a reload
  await page.reload()
  await page.getByRole('searchbox', { name: 'Search exercises' }).fill('sled')
  await page.getByRole('link', { name: /^Sled Push/ }).tap()
  await expect(page.getByRole('textbox', { name: 'Note' })).toHaveValue('Two plates each side')
})
