import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Button } from '../components/Button.tsx'
import { TextAreaField } from '../components/Fields.tsx'
import { formatSetsSummary } from '../components/format.ts'
import { EmptyState, Screen } from '../components/Screen.tsx'
import {
  DEFAULT_SETTINGS,
  exerciseSetsInWorkout,
  formatDuration,
  formatNumber,
  getExerciseHistory,
  getSettings,
  getWorkout,
  listExercises,
  recordsSetBy,
  saveWorkout,
  workoutCompletedSetCount,
  workoutDurationSec,
  workoutVolume,
  type RecordKind,
  type Workout,
} from '../data/index.ts'
import { useDebouncedSave } from '../hooks/useDebouncedSave.ts'
import styles from './WorkoutSummaryScreen.module.css'

const RECORD_LABELS: Record<RecordKind, string> = {
  heaviestWeight: 'heaviest weight',
  mostReps: 'most reps',
  bestVolume: 'best volume',
  longestDuration: 'longest time',
}

export function WorkoutSummaryScreen() {
  const { id = '' } = useParams()
  const loaded = useLiveQuery(async () => (await getWorkout(id)) ?? null, [id])
  if (loaded === undefined) return null
  if (loaded === null || loaded.status !== 'completed') {
    return (
      <Screen title="Workout">
        <EmptyState title="Workout not found" />
      </Screen>
    )
  }
  return <Summary key={loaded.id} workout={loaded} />
}

function Summary({ workout }: { workout: Workout }) {
  const navigate = useNavigate()
  const settings = useLiveQuery(() => getSettings(), [], DEFAULT_SETTINGS)
  const unit = settings.displayUnit
  const exerciseList = useLiveQuery(() => listExercises(), [])
  const names = useMemo(() => new Map((exerciseList ?? []).map((e) => [e.id, e.name])), [exerciseList])
  const [note, setNote] = useState(workout.note)
  const { schedule, flush } = useDebouncedSave((text: string) =>
    saveWorkout({ ...workout, note: text }).catch(() => undefined),
  )

  const records = useLiveQuery(
    async () => {
      const found: { exerciseId: string; kinds: RecordKind[] }[] = []
      for (const exerciseId of workout.exerciseIds) {
        const kinds = recordsSetBy(await getExerciseHistory(exerciseId), workout.id, unit)
        if (kinds.length > 0) found.push({ exerciseId, kinds })
      }
      return found
    },
    [workout.id, unit],
    [],
  )

  const volume = workoutVolume(workout, unit)

  return (
    <Screen title="Workout complete">
      <p className={styles.name}>{workout.name}</p>

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
            {formatNumber(Math.round(volume))} <small>{unit}</small>
          </dd>
        </div>
      </dl>

      {records.length > 0 && (
        <section className={styles.records} aria-label="New personal records">
          <h2>New personal records</h2>
          <ul>
            {records.map((r) => (
              <li key={r.exerciseId}>
                <strong>{names.get(r.exerciseId) ?? 'Exercise'}</strong> — {r.kinds.map((k) => RECORD_LABELS[k]).join(', ')}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Exercises" className={styles.exercises}>
        {workout.exerciseIds.map((exerciseId) => (
          <div key={exerciseId} className={styles.exercise}>
            <span className={styles.exerciseName}>{names.get(exerciseId) ?? 'Exercise'}</span>
            <span className={styles.exerciseSets}>
              {formatSetsSummary(exerciseSetsInWorkout(workout, exerciseId), unit)}
            </span>
          </div>
        ))}
      </section>

      <TextAreaField
        label="How did it feel?"
        value={note}
        placeholder="Energy, sleep, anything to remember next time…"
        onChange={(e) => {
          setNote(e.target.value)
          schedule(e.target.value)
        }}
        onBlur={() => void flush()}
      />

      <Button
        variant="primary"
        block
        onClick={async () => {
          await flush()
          navigate('/today', { replace: true })
        }}
      >
        Done
      </Button>
    </Screen>
  )
}
