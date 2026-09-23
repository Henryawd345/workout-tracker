import { useLocation, useNavigate } from 'react-router'
import { IconButton } from './IconButton.tsx'
import { BackIcon } from './icons.tsx'

interface BackButtonProps {
  /** Where to go if this page was opened directly (nothing to go back to). */
  fallback: string
  label?: string
}

/** Goes back to the previous page — keeping its search and scroll — or to `fallback`. */
export function BackButton({ fallback, label = 'Back' }: BackButtonProps) {
  const navigate = useNavigate()
  const location = useLocation()
  // 'default' is the key of the first page the app opened on.
  const canGoBack = location.key !== 'default'
  return (
    <IconButton label={label} onClick={() => (canGoBack ? navigate(-1) : navigate(fallback, { replace: true }))}>
      <BackIcon />
    </IconButton>
  )
}
