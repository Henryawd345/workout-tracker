import { useSyncExternalStore } from 'react'
import { applyUpdate, isUpdateReady, subscribeUpdate } from '../pwaUpdate.ts'
import { Button } from './Button.tsx'
import styles from './UpdateBanner.module.css'

/** "New version available" — shown on normal screens only, never during a workout. */
export function UpdateBanner() {
  const ready = useSyncExternalStore(subscribeUpdate, isUpdateReady)
  if (!ready) return null
  return (
    <div className={styles.banner} role="status">
      <span>A new version of the app is ready.</span>
      <Button variant="primary" onClick={() => void applyUpdate()}>
        Update
      </Button>
    </div>
  )
}
