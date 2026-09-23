import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router'
import { Button, ButtonLink } from '../components/Button.tsx'
import { formatRelativeDay, plural, startOfWeekIso } from '../components/format.ts'
import { IconLink } from '../components/IconButton.tsx'
import { PlusIcon, SettingsIcon } from '../components/icons.tsx'
import { EmptyState, Screen } from '../components/Screen.tsx'
import {
  ActiveWorkoutExistsError,
  countCompletedSince,
  formatDuration,
  getActiveWorkout,
  getRoutinesLastPerformed,
  listRoutines,
  setCounts,
  startWorkout,
  workoutDurationSec,
  type ID,
} from '../data/index.ts'
import { useNow } from '../hooks/useNow.ts'
import styles from './TodayScreen.module.css'

export function TodayScreen() {
  const navigate = useNavigate()
  const now = useNow(1000)
  const active = useLiveQuery(async () => (await getActiveWorkout()) ?? null, [])
  const routines = useLiveQuery(() => listRoutines(), [])
  const lastDone = useLiveQuery(() => getRoutinesLastPerformed(), [], {} as Record<string, string>)
  const thisWeek = useLiveQuery(() => countCompletedSince(startOfWeekIso()), [], 0)

  // Most recently trained first; never-used routines after, newest edits first.
  const sorted = [...(routines ?? [])].sort((a, b) =>
    (lastDone[b.id] ?? '').localeCompare(lastDone[a.id] ?? '') || b.updatedAt.localeCompare(a.updatedAt),
  )

  async function start(routineId?: ID) {
    try {
      await startWorkout({ routineId })
    } catch (err) {
      if (!(err instanceof ActiveWorkoutExistsError)) throw err
    }
    navigate('/workout')
  }

  return (
    <Screen
      title="Today"
      action={
        <IconLink to="/settings" label="Settings">
          <SettingsIcon />
        </IconLink>
      }
    >
      {active === undefined ? null : active ? (
        <section className={styles.resume} aria-label="Workout in progress">
          <p className={styles.resumeLabel}>In progress</p>
          <h2 className={styles.resumeName}>{active.name}</h2>
          <p className={styles.resumeMeta}>
            {formatDuration(workoutDurationSec(active, now.toISOString()))} ·{' '}
            {setCounts(active).completed}/{setCounts(active).total} sets done
          </p>
          <ButtonLink to="/workout" variant="primary" block>
            Resume workout
          </ButtonLink>
        </section>
      ) : (
        <>
          <p className={styles.week}>
            {thisWeek === 0 ? 'No workouts yet this week.' : `${plural(thisWeek, 'workout')} this week.`}
          </p>
          <Button variant="primary" block onClick={() => void start()}>
            <PlusIcon aria-hidden="true" /> Start empty workout
          </Button>

          <section aria-label="Start a routine" className={styles.section}>
            <h2 className={styles.heading}>Start a routine</h2>
            {routines?.length === 0 ? (
              <EmptyState title="No routines yet">
                Save your usual workouts as routines to start them in one tap.
              </EmptyState>
            ) : (
              <ul className={styles.routines}>
                {sorted.map((r) => (
                  <li key={r.id} className={styles.routine}>
                    <div className={styles.routineText}>
                      <span className={styles.routineName}>{r.name}</span>
                      <span className={styles.routineMeta}>
                        {plural(r.exercises.length, 'exercise')}
                        {lastDone[r.id] ? ` · ${formatRelativeDay(lastDone[r.id])}` : ''}
                      </span>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => void start(r.id)}
                      aria-label={`Start ${r.name}`}
                      disabled={r.exercises.length === 0}
                    >
                      Start
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <ButtonLink to="/routines" variant="ghost">
              Manage routines
            </ButtonLink>
          </section>
        </>
      )}
    </Screen>
  )
}
