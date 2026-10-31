import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router'
import styles from './Button.module.css'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

function classes(variant: Variant, block?: boolean) {
  return [styles.button, styles[variant], block ? styles.block : ''].join(' ')
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  /** Full width. */
  block?: boolean
}

export function Button({ variant = 'secondary', block, type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={classes(variant, block)} {...rest} />
}

interface ButtonLinkProps {
  to: string
  variant?: Variant
  block?: boolean
  onClick?: () => void
  children: ReactNode
}

export function ButtonLink({ to, variant = 'secondary', block, onClick, children }: ButtonLinkProps) {
  return (
    <Link to={to} className={classes(variant, block)} onClick={onClick}>
      {children}
    </Link>
  )
}
