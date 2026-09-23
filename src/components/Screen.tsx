import type { ReactNode } from 'react'
import styles from './Screen.module.css'

interface ScreenProps {
  title: string
  /** Element shown left of the title, e.g. a back button. */
  leading?: ReactNode
  /** Element shown at the right of the header, e.g. a settings button. */
  action?: ReactNode
  children: ReactNode
}

export function Screen({ title, leading, action, children }: ScreenProps) {
  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        {leading}
        <h1 className={styles.title}>{title}</h1>
        {action && <div className={styles.action}>{action}</div>}
      </header>
      <div className={styles.body}>{children}</div>
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className={styles.empty}>
      <p className={styles.emptyTitle}>{title}</p>
      {children && <p className={styles.emptyText}>{children}</p>}
    </div>
  )
}
