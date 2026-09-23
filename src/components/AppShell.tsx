import { useLiveQuery } from 'dexie-react-hooks'
import { Link, Outlet, useMatch } from 'react-router'
import { formatDuration, getActiveWorkout, workoutDurationSec } from '../data/index.ts'
import { useNow } from '../hooks/useNow.ts'
import styles from './AppShell.module.css'
import { TabBar } from './TabBar.tsx'
import { UpdateBanner } from './UpdateBanner.tsx'

export function AppShell() {
  // The active workout screen is full-screen: no tabs, no "in progress" bar.
  const onWorkout = useMatch('/workout') !== null
  return (
    <div className={styles.shell}>
      <main className={styles.main}>
        {!onWorkout && <UpdateBanner />}
        <Outlet />
      </main>
      {!onWorkout && <WorkoutInProgressBar />}
      {!onWorkout && <TabBar />}
    </div>
  )
}

function WorkoutInProgressBar() {
  const active = useLiveQuery(async () => (await getActiveWorkout()) ?? null, [])
  const now = useNow(1000)
  if (!active) return null
  return (
    <Link to="/workout" className={styles.progressBar}>
      <span className={styles.pulse} aria-hidden="true" />
      <span className={styles.progressText}>
        <strong>{active.name}</strong> · {formatDuration(workoutDurationSec(active, now.toISOString()))}
      </span>
      <span className={styles.progressAction}>Resume</span>
    </Link>
  )
}
