import { useCallback, useEffect, useRef } from 'react'

/**
 * Saves a value shortly after the last change (e.g. while typing a note).
 * `flush()` saves immediately — call it on blur. Anything pending is also saved when the
 * component unmounts, so leaving the screen never loses the last few keystrokes.
 */
export function useDebouncedSave<T>(save: (value: T) => Promise<unknown>, delayMs = 600) {
  const saveRef = useRef(save)
  useEffect(() => {
    saveRef.current = save
  })
  const pending = useRef<{ value: T } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const flush = useCallback(() => {
    clearTimeout(timer.current)
    const p = pending.current
    if (!p) return
    pending.current = null
    void saveRef.current(p.value)
  }, [])

  const schedule = useCallback(
    (value: T) => {
      pending.current = { value }
      clearTimeout(timer.current)
      timer.current = setTimeout(flush, delayMs)
    },
    [delayMs, flush],
  )

  useEffect(() => flush, [flush])

  // Save right away if the app is hidden (home button, app switcher) or closed —
  // on iPhone a hidden page may never get to run its timer.
  useEffect(() => {
    const onVisibility = () => document.visibilityState === 'hidden' && flush()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', flush)
    }
  }, [flush])

  return { schedule, flush }
}
