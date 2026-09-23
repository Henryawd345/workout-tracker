import { expect, test, type Page } from '@playwright/test'

/** Counts records in one IndexedDB table using the browser's own API. */
function countRecords(page: Page, table: string) {
  return page.evaluate(
    (name) =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open('workout-tracker')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const tx = open.result.transaction(name, 'readonly')
          const req = tx.objectStore(name).count()
          req.onsuccess = () => {
            resolve(req.result)
            open.result.close()
          }
          req.onerror = () => reject(req.error)
        }
      }),
    table,
  )
}

test('the built-in exercise library is stored on first launch and kept after reload', async ({ page }) => {
  await page.goto('/')
  await expect.poll(() => countRecords(page, 'exercises')).toBeGreaterThanOrEqual(80)
  const first = await countRecords(page, 'exercises')

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  await expect.poll(() => countRecords(page, 'exercises')).toBe(first)
})
