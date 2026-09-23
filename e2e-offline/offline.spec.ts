import { expect, test } from '@playwright/test'

// Runs against a production build served from a sub-folder (/wt/), like GitHub Pages.
// Playwright's WebKit on Windows can't load pages with the network switched off (it
// reports an internal error even when a service worker could answer), so instead this checks,
// inside the real app, that the service worker takes control and has cached everything the
// app needs at the right sub-folder addresses. The final Airplane-Mode check is by hand on the
// iPhone (see PLAN.md phase 10).
test('the service worker takes over and caches the whole app under the sub-folder', async ({ page }) => {
  await page.goto('/wt/#/today')
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  await page.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 15_000 })

  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope)
  expect(new URL(scope).pathname).toBe('/wt/')

  const assets = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>('script[src], link[rel=stylesheet]')].map(
      (el) => new URL((el as HTMLScriptElement).src || (el as HTMLLinkElement).href).pathname,
    ),
  )
  expect(assets.length).toBeGreaterThanOrEqual(2)

  const missing = await page.evaluate(async (paths) => {
    const needed = ['/wt/index.html', '/wt/apple-touch-icon.png', '/wt/manifest.webmanifest', ...paths]
    const out: string[] = []
    for (const path of needed) {
      if (!(await caches.match(path, { ignoreSearch: true }))) out.push(path)
    }
    return out
  }, assets)
  expect(missing, 'files missing from the offline cache').toEqual([])
})
