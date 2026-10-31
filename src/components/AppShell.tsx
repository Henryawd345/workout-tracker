import { useLiveQuery } from 'dexie-react-hooks'
import { Link, Outlet, useMatch } from 'react-router'
import { formatDuration, getActiveWorkout, workoutDurationSec } from '../data/index.ts'
import { useNow } from '../hooks/useNow.ts'
import styles from './AppShell.module.css'
import { unlockFightSound } from './fight/coach.ts'
import { useFightSession } from './fight/fightContext.ts'
import { FightSessionHost } from './fight/FightSessionHost.tsx'
import { SPORT_LABELS } from './fight/labels.ts'
import { TabBar } from './TabBar.tsx'
import { UpdateBanner } from './UpdateBanner.tsx'

export function AppShell() {
  // The active workout and fight session screens are full-screen: no tabs, no "in progress" bar.
  const workoutMatch = useMatch('/workout')
  const fightMatch = useMatch('/fight/session')
  const onWorkout = workoutMatch !== null || fightMatch !== null
  return (
    <FightSessionHost>
      <div className={onWorkout ? styles.shell : `${styles.shell} ${styles.withTabs}`}>
        <main className={styles.main}>
          {!onWorkout && <UpdateBanner />}
          <Outlet />
        </main>
        {!onWorkout && <WorkoutInProgressBar />}
        {!onWorkout && <FightInProgressBar />}
        {!onWorkout && <TabBar />}
      </div>
    </FightSessionHost>
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

function FightInProgressBar() {
  const fight = useFightSession()
  if (fight.status !== 'active') return null
  const { session, state } = fight
  const where = state.paused
    ? 'Paused'
    : state.phase === 'round'
      ? `Round ${state.round} of ${session.rounds}`
      : state.phase === 'rest'
        ? 'Rest'
        : state.phase === 'ready'
          ? 'Get ready'
          : 'Finished'
  return (
    <Link to="/fight/session" className={styles.progressBar} onClick={unlockFightSound}>
      <span className={styles.pulse} aria-hidden="true" />
      <span className={styles.progressText}>
        <strong>{SPORT_LABELS[session.sport]}</strong> · {where} · {formatDuration(state.remainingSec)}
      </span>
      <span className={styles.progressAction}>Open</span>
    </Link>
  )
}
