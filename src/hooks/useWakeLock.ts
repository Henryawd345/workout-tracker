import { useEffect } from 'react'

export function wakeLockSupported(): boolean {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator
}

/**
 * Keeps the screen on while `active`. The phone drops the lock when the app is hidden, so it
 * is asked for again when the app comes back. Does nothing where it isn't supported.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !wakeLockSupported()) return
    let lock: WakeLockSentinel | null = null
    let requesting = false
    let stopped = false

    async function request() {
      if (requesting || document.visibilityState !== 'visible' || (lock && !lock.released)) return
      requesting = true
      try {
        const next = await navigator.wakeLock.request('screen')
        if (stopped) void next.release().catch(() => undefined)
        else lock = next
      } catch {
        // Refused (e.g. low battery mode): the screen may dim; the session still works.
      } finally {
        requesting = false
      }
    }

    void request()
    const onVisible = () => void request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      document.removeEventListener('visibilitychange', onVisible)
      void lock?.release().catch(() => undefined)
    }
  }, [active])
}
