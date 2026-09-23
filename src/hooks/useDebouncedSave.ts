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

  /** Saves anything pending now. Await it when the next step needs the save done. */
  const flush = useCallback((): Promise<void> => {
    clearTimeout(timer.current)
    const p = pending.current
    if (!p) return Promise.resolve()
    pending.current = null
    // Errors are the save function's job to handle; never leave an unhandled rejection.
    return Promise.resolve(saveRef.current(p.value)).then(
      () => undefined,
      () => undefined,
    )
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
