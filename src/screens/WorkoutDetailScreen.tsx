import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { useParams } from 'react-router'
import { BackButton } from '../components/BackButton.tsx'
import { formatDate, formatSetShort, formatTime, plural } from '../components/format.ts'
import { EmptyState, Screen } from '../components/Screen.tsx'
import {
  completedSets,
  DEFAULT_SETTINGS,
  formatDuration,
  formatNumber,
  getSettings,
  getWorkout,
  listExercises,
  workoutCompletedSetCount,
  workoutDurationSec,
  workoutVolume,
} from '../data/index.ts'
import styles from './WorkoutDetailScreen.module.css'

const back = <BackButton fallback="/history" label="Back to history" />

export function WorkoutDetailScreen() {
  const { id = '' } = useParams()
  const workout = useLiveQuery(async () => (await getWorkout(id)) ?? null, [id])
  const settings = useLiveQuery(() => getSettings(), [], DEFAULT_SETTINGS)
  const exerciseList = useLiveQuery(() => listExercises(), [])
  const exercises = useMemo(() => new Map((exerciseList ?? []).map((e) => [e.id, e])), [exerciseList])
  const unit = settings.displayUnit

  if (workout === undefined) return <Screen title="" leading={back}>{null}</Screen>
  if (workout === null || workout.status !== 'completed') {
    return (
      <Screen title="Workout" leading={back}>
        <EmptyState title="Workout not found">It may have been deleted.</EmptyState>
      </Screen>
    )
  }

  return (
    <Screen title={workout.name} leading={back}>
      <p className={styles.when}>
        {formatDate(workout.startedAt)} · {formatTime(workout.startedAt)}
        {workout.endedAt ? `–${formatTime(workout.endedAt)}` : ''}
      </p>

      <dl className={styles.stats}>
        <div>
          <dt>Time</dt>
          <dd>{formatDuration(workoutDurationSec(workout))}</dd>
        </div>
        <div>
          <dt>Sets</dt>
          <dd>{workoutCompletedSetCount(workout)}</dd>
        </div>
        <div>
          <dt>Volume</dt>
          <dd>
            {formatNumber(Math.round(workoutVolume(workout, unit)))} <small>{unit}</small>
          </dd>
        </div>
      </dl>

      {workout.note && <p className={styles.note}>{workout.note}</p>}

      <ol className={styles.exercises} aria-label="Exercises">
        {workout.exercises.map((item) => {
          const exercise = exercises.get(item.exerciseId)
          const name = exercise?.name ?? 'Unknown exercise'
          return (
            <li key={item.id} className={styles.exercise} aria-label={name}>
              <h2 className={styles.exerciseName}>{name}</h2>
              {item.note && <p className={styles.exerciseNote}>{item.note}</p>}
              <ol className={styles.sets} aria-label={`${name}: ${plural(completedSets(item.sets).length, 'set')}`}>
                {completedSets(item.sets).map((set, i) => (
                  <li key={set.id}>
                    <span className={styles.setNumber}>{i + 1}</span>
                    <span>
                      {formatSetShort(set, unit)}
                      {set.weight !== null && set.reps !== null ? ` ${unit}` : ''}
                    </span>
                  </li>
                ))}
              </ol>
            </li>
          )
        })}
      </ol>
    </Screen>
  )
}
