import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ActionSheet } from '../components/ActionSheet.tsx'
import { ConfirmDialog } from '../components/ConfirmDialog.tsx'
import { IconButton } from '../components/IconButton.tsx'
import { MoreIcon } from '../components/icons.tsx'
import { BackButton } from '../components/BackButton.tsx'
import { formatDate, formatSetShort, formatTime, plural } from '../components/format.ts'
import { EmptyState, Screen } from '../components/Screen.tsx'
import {
  completedSets,
  DEFAULT_SETTINGS,
  deleteWorkout,
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
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (workout === undefined) return <Screen title="" leading={back}>{null}</Screen>
  if (workout === null || workout.status !== 'completed') {
    return (
      <Screen title="Workout" leading={back}>
        <EmptyState title="Workout not found">It may have been deleted.</EmptyState>
      </Screen>
    )
  }

  return (
    <Screen
      title={workout.name}
      leading={back}
      action={
        <IconButton label="Workout actions" onClick={() => setMenuOpen(true)}>
          <MoreIcon />
        </IconButton>
      }
    >
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
        {/* Exercises with no ticked sets (e.g. added while editing, then left) are not shown. */}
        {workout.exercises.filter((item) => completedSets(item.sets).length > 0).map((item) => {
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

      <ActionSheet
        open={menuOpen}
        title={workout.name}
        onClose={() => setMenuOpen(false)}
        actions={[
          { label: 'Edit workout', onSelect: () => navigate(`/history/${workout.id}/edit`) },
          { label: 'Delete workout', destructive: true, onSelect: () => setConfirmDelete(true) },
        ]}
      />
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this workout?"
        message="It will be removed from your history and progress. This can’t be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          setConfirmDelete(false)
          await deleteWorkout(workout.id)
          navigate('/history', { replace: true })
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </Screen>
  )
}
