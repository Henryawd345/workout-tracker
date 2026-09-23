import { useEffect, useId, useRef } from 'react'
import { Modal } from './Modal.tsx'
import { Button } from './Button.tsx'
import styles from './ConfirmDialog.module.css'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message?: string
  confirmLabel: string
  /** Red confirm button for destructive actions. */
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  destructive,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)

  const cancel = useRef(onCancel)
  useEffect(() => {
    cancel.current = onCancel
  })

  // Runs when the dialog opens — not on every re-render, which would steal focus.
  useEffect(() => {
    if (!open) return
    // Focus the safe choice first.
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && cancel.current()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null
  return (
    <Modal className={styles.backdrop} onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={styles.dialog}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        {message && <p className={styles.message}>{message}</p>}
        <div className={styles.actions}>
          <button ref={cancelRef} type="button" className={styles.cancel} onClick={onCancel}>
            Cancel
          </button>
          <Button variant={destructive ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
