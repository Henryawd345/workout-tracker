import { useState } from 'react'
import { Button } from './Button.tsx'
import styles from './InstallTip.module.css'

const DISMISSED_KEY = 'install-tip-dismissed'

/** True in iPhone/iPad Safari when the app was NOT opened from the Home Screen. */
function shouldShow(): boolean {
  if (typeof navigator === 'undefined') return false
  // iPadOS Safari reports itself as a Mac; a Mac with a touch screen is an iPad.
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const standalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia?.('(display-mode: standalone)').matches
  let dismissed = false
  try {
    dismissed = localStorage.getItem(DISMISSED_KEY) === '1'
  } catch {
    // Storage blocked (private mode): just show the tip.
  }
  return ios && !standalone && !dismissed
}

/**
 * iOS only keeps a web app's data safe long-term once it's on the Home Screen, and there's
 * no install button on iPhone — so explain the two taps, once.
 */
export function InstallTip() {
  const [visible, setVisible] = useState(shouldShow)
  if (!visible) return null

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED_KEY, '1')
    } catch {
      // ignore
    }
    setVisible(false)
  }

  return (
    <aside className={styles.tip} aria-label="Install the app">
      <p className={styles.title}>Add this app to your Home Screen</p>
      <p className={styles.text}>
        Tap <strong>Share</strong> <span aria-hidden="true">⎋</span> in Safari, then <strong>Add to Home Screen</strong>. It
        opens full-screen, works offline, and iOS keeps your workouts safe.
      </p>
      <Button variant="ghost" onClick={dismiss}>
        Got it
      </Button>
    </aside>
  )
}
