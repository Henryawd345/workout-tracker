import { useEffect, useRef } from 'react'
import styles from './Toast.module.css'

export interface ToastMessage {
  /** Changes every time, so the same text shown twice still restarts the timer. */
  id: number
  text: string
  actionLabel?: string
  onAction?: () => void
}

interface ToastProps {
  toast: ToastMessage | null
  onDismiss: () => void
  durationMs?: number
}

/** Short message at the bottom of the screen, optionally with one action (e.g. Undo). */
export function Toast({ toast, onDismiss, durationMs = 5000 }: ToastProps) {
  const dismiss = useRef(onDismiss)
  useEffect(() => {
    dismiss.current = onDismiss
  })

  // Restart the timer only for a new message — not on every re-render of the screen.
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => dismiss.current(), durationMs)
    return () => clearTimeout(id)
  }, [toast, durationMs])

  return (
    <div className={styles.region} role="status" aria-live="polite">
      {toast && (
        <div className={styles.toast}>
          <span>{toast.text}</span>
          {toast.actionLabel && toast.onAction && (
            <button
              type="button"
              className={styles.action}
              onClick={() => {
                // Dismiss first, so the action can show a follow-up message.
                onDismiss()
                toast.onAction?.()
              }}
            >
              {toast.actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
