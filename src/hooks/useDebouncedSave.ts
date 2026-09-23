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
  // Every save started and not yet finished, combined (null when idle).
  const inFlight = useRef<Promise<void> | null>(null)

  /**
   * Saves anything pending now, starting it synchronously (matters when iOS is closing the
   * app). The returned promise resolves when EVERY save started so far has finished — await
   * it before doing something that must see the latest data. Saves themselves are applied
   * in the order started, because IndexedDB runs write transactions in creation order.
   */
  const flush = useCallback((): Promise<void> => {
    clearTimeout(timer.current)
    const p = pending.current
    if (p) {
      pending.current = null
      // Errors are the save function's job to handle; never leave an unhandled rejection.
      const started = Promise.resolve(saveRef.current(p.value)).then(
        () => undefined,
        () => undefined,
      )
      const all: Promise<void> = Promise.all([inFlight.current, started]).then(() => undefined)
      inFlight.current = all
      void all.then(() => {
        if (inFlight.current === all) inFlight.current = null
      })
    }
    return inFlight.current ?? Promise.resolve()
  }, [])

  const schedule = useCallback(
    (value: T) => {
      pending.current = { value }
      clearTimeout(timer.current)
      timer.current = setTimeout(() => void flush(), delayMs)
    },
    [delayMs, flush],
  )

  /** Drops a pending save (e.g. the thing is being deleted). */
  const cancel = useCallback(() => {
    clearTimeout(timer.current)
    pending.current = null
  }, [])

  useEffect(() => () => void flush(), [flush])

  // Save right away if the app is hidden (home button, app switcher) or closed —
  // on iPhone a hidden page may never get to run its timer.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void flush()
    }
    const onPageHide = () => void flush()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [flush])

  return { schedule, flush, cancel }
}
