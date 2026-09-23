import { useEffect } from 'react'
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
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <Modal className={styles.backdrop} onClick={onClose}>
      <div role="menu" aria-label={title ?? 'Actions'} className={styles.sheet} onClick={(e) => e.stopPropagation()}>
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
