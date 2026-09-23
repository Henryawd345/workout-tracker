import { registerSW } from 'virtual:pwa-register'
import { setUpdateReady } from './pwaUpdate.ts'

/**
 * Registers the offline service worker. New versions never reload the page by themselves
 * (that could interrupt a workout) — they wait until the user taps "Update".
 */
export function registerPwa() {
  const updateSW = registerSW({
    onNeedRefresh() {
      setUpdateReady(() => updateSW(true))
    },
  })
}
