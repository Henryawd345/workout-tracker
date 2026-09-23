import type { ReactNode } from 'react'
import { Link } from 'react-router'
import styles from './IconButton.module.css'

interface IconLinkProps {
  to: string
  label: string
  children: ReactNode
}

/** Round 48px icon-only link. `label` is read by screen readers. */
export function IconLink({ to, label, children }: IconLinkProps) {
  return (
    <Link to={to} className={styles.button} aria-label={label}>
      {children}
    </Link>
  )
}
