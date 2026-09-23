import { useEffect, useRef, type HTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

/**
 * Renders on top of everything and behaves like a real modal:
 * - the page behind becomes `inert` (can't be tapped, tabbed to or read by VoiceOver),
 * - focus moves into the modal, and goes back where it was when the modal closes.
 * Style it with className; give it role/aria-label like any dialog.
 */
export function Modal({ children, ...rest }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const modal = ref.current
    const host = modal?.parentElement
    if (!modal || !host) return
    const previouslyFocused = document.activeElement as HTMLElement | null

    // Make every other top-level element inert, remembering which ones we changed.
    const changed: Element[] = []
    for (const el of Array.from(document.body.children)) {
      if (el !== host && !el.hasAttribute('inert')) {
        el.setAttribute('inert', '')
        changed.push(el)
      }
    }
    modal.focus({ preventScroll: true })

    return () => {
      for (const el of changed) el.removeAttribute('inert')
      previouslyFocused?.focus?.({ preventScroll: true })
    }
  }, [])

  return createPortal(
    <div ref={ref} tabIndex={-1} {...rest}>
      {children}
    </div>,
    document.body,
  )
}
