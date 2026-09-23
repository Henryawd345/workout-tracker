import { useId, useState } from 'react'
import { Button } from './Button.tsx'
import { Modal } from './Modal.tsx'
import styles from './TextDialog.module.css'

interface TextDialogProps {
  title: string
  initial: string
  placeholder?: string
  /** Called with the text when Done is tapped. */
  onDone: (text: string) => void
  onCancel: () => void
}

/** Small sheet for writing a note. Render it only while open. */
export function TextDialog({ title, initial, placeholder, onDone, onCancel }: TextDialogProps) {
  const [text, setText] = useState(initial)
  const titleId = useId()
  return (
    <Modal className={styles.backdrop} onClick={onCancel}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <Button variant="primary" onClick={() => onDone(text.trim())}>
            Done
          </Button>
        </div>
        <textarea
          className={styles.textarea}
          aria-labelledby={titleId}
          value={text}
          placeholder={placeholder}
          rows={5}
          autoFocus
          onChange={(e) => setText(e.target.value)}
        />
      </div>
    </Modal>
  )
}
