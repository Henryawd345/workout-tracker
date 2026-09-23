import type { ButtonHTMLAttributes, ReactNode } from 'react'
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

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  label: string
}

/** Round 48px icon-only button. `label` is read by screen readers. */
export function IconButton({ label, type = 'button', ...rest }: IconButtonProps) {
  return <button type={type} className={styles.button} aria-label={label} {...rest} />
}
