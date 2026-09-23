import { useEffect, useRef } from 'react'
import styles from './ActionSheet.module.css'
import { Modal } from './Modal.tsx'

export interface SheetAction {
  label: string
  onSelect: () => void
  destructive?: boolean
  disabled?: boolean
}

interface ActionSheetProps {
  open: boolean
  title?: string
  actions: SheetAction[]
  onClose: () => void
}

/** iPhone-style menu that slides up from the bottom. Picking an action closes it. */
export function ActionSheet({ open, title, actions, onClose }: ActionSheetProps) {
  const sheet = useRef<HTMLDivElement>(null)

  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })

  // Runs when the sheet opens — not on every re-render, which would steal focus.
  useEffect(() => {
    if (!open) return
    // Start keyboard/VoiceOver users on the first choice.
    sheet.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null
  return (
    <Modal className={styles.backdrop} onClick={onClose}>
      <div ref={sheet} role="menu" aria-label={title ?? 'Actions'} className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.group}>
          {title && <p className={styles.title}>{title}</p>}
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              role="menuitem"
              disabled={a.disabled}
              className={a.destructive ? `${styles.action} ${styles.destructive}` : styles.action}
              onClick={() => {
                onClose()
                a.onSelect()
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
        <button type="button" className={`${styles.group} ${styles.cancel}`} onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  )
}
