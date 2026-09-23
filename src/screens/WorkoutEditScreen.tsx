import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { BackButton } from '../components/BackButton.tsx'
import { Button } from '../components/Button.tsx'
import { ConfirmDialog } from '../components/ConfirmDialog.tsx'
import { Field, TextAreaField, TextField } from '../components/Fields.tsx'
import { fromDateTimeInputs, toDateInputValue, toTimeInputValue } from '../components/format.ts'
import { NumberInput } from '../components/NumberInput.tsx'
import { EmptyState, Screen } from '../components/Screen.tsx'
import { Toast } from '../components/Toast.tsx'
import { useWorkoutEditor } from '../components/workout/useWorkoutEditor.ts'
import { WorkoutExerciseList } from '../components/workout/WorkoutExerciseList.tsx'
import {
  deleteWorkout,
  getSettings,
  listExercises,
  getWorkout,
  renameWorkout,
  saveWorkout,
  setWorkoutNote,
  setWorkoutTimes,
  StaleSaveError,
  tidyFinishedWorkout,
  workoutDurationSec,
  type Exercise,
  type Settings,
  type Workout,
} from '../data/index.ts'
import styles from './WorkoutEditScreen.module.css'

export function WorkoutEditScreen() {
  const { id = '' } = useParams()
  // Loaded once; after that the editor owns the workout and saves it.
  const [loaded, setLoaded] = useState<{ workout: Workout; settings: Settings; exercises: Exercise[] } | null | undefined>(undefined)
  useEffect(() => {
    let cancelled = false
    void Promise.all([getWorkout(id), getSettings(), listExercises()]).then(
      ([w, settings, exercises]) => !cancelled && setLoaded(w && w.status === 'completed' ? { workout: w, settings, exercises } : null),
    )
    return () => {
      cancelled = true
    }
  }, [id])

  if (loaded === undefined) return null
  if (loaded === null) {
    return (
      <Screen title="Edit workout" leading={<BackButton fallback="/history" label="Back" />}>
        <EmptyState title="Workout not found">It may have been deleted.</EmptyState>
      </Screen>
    )
  }
  return <Editor key={loaded.workout.id} initial={loaded.workout} settings={loaded.settings} exercises={loaded.exercises} />
}

function Editor({ initial, settings, exercises }: { initial: Workout; settings: Settings; exercises: Exercise[] }) {
  const navigate = useNavigate()
  const editor = useWorkoutEditor(initial, {
    onStale: () => navigate('/history', { replace: true }),
    restTimer: false,
    settings,
    exercises,
  })
  const { workout, apply, latest } = editor
  const [date, setDate] = useState(toDateInputValue(initial.startedAt))
  const [time, setTime] = useState(toTimeInputValue(initial.startedAt))
  const [confirmEmpty, setConfirmEmpty] = useState(false)

  const [timeError, setTimeError] = useState<string | null>(null)

  function changeTimes(nextDate: string, nextTime: string, durationSec = workoutDurationSec(latest.current)) {
    setDate(nextDate)
    setTime(nextTime)
    const startedAt = fromDateTimeInputs(nextDate, nextTime)
    if (!startedAt) return
    // A past workout in the future would confuse "last time" and records.
    if (Date.parse(startedAt) > Date.now()) return setTimeError('A past workout can’t start in the future.')
    setTimeError(null)
    apply(setWorkoutTimes(latest.current, startedAt, durationSec))
  }

  function failed(err: unknown) {
    if (err instanceof StaleSaveError) navigate('/history', { replace: true })
    else editor.setSaveFailed(true)
  }

  /** Done: drop un-ticked sets (like finishing), then go back to the workout. */
  async function done() {
    const { workout: tidy, empty } = tidyFinishedWorkout(latest.current)
    if (empty) return setConfirmEmpty(true)
    editor.cancel()
    await editor.flush()
    try {
      await saveWorkout(tidy)
      navigate(`/history/${workout.id}`, { replace: true })
    } catch (err) {
      failed(err)
    }
  }

  async function deleteIt() {
    setConfirmEmpty(false)
    editor.cancel()
    await editor.flush()
    try {
      await deleteWorkout(workout.id)
      navigate('/history', { replace: true })
    } catch (err) {
      failed(err)
    }
  }

  return (
    <Screen
      title="Edit workout"
      leading={<BackButton fallback={`/history/${workout.id}`} label="Back" />}
      action={
        <Button variant="primary" onClick={() => void done()}>
          Done
        </Button>
      }
    >
      {editor.saveFailed && (
        <p className={styles.error} role="alert">
          Couldn’t save the last change. It’s still on screen — the next change will try again.
        </p>
      )}

      <TextField
        label="Name"
        value={workout.name}
        maxLength={60}
        onChange={(e) => apply(renameWorkout(workout, e.target.value))}
        onBlur={() => !workout.name.trim() && apply(renameWorkout(latest.current, 'Workout'))}
      />
      <div className={styles.row}>
        <TextField
          label="Date"
          type="date"
          value={date}
          max={toDateInputValue(new Date().toISOString())}
          error={timeError}
          onChange={(e) => changeTimes(e.target.value, time)}
        />
        <TextField label="Start" type="time" value={time} onChange={(e) => changeTimes(date, e.target.value)} />
        <Field label="Minutes">
          {(fieldId) => (
            <NumberInput
              id={fieldId}
              label="Duration in minutes"
              max={24 * 60}
              value={Math.round(workoutDurationSec(workout) / 60)}
              onChange={(minutes) => minutes !== null && minutes > 0 && changeTimes(date, time, minutes * 60)}
            />
          )}
        </Field>
      </div>
      <TextAreaField
        label="Note"
        value={workout.note}
        rows={2}
        onChange={(e) => apply(setWorkoutNote(workout, e.target.value))}
      />

      <WorkoutExerciseList editor={editor} emptyTitle="No exercises" emptyText="Add the exercises you did." />
      <p className={styles.hint}>Changes save as you go. Sets that aren’t ticked are removed when you tap Done.</p>

      <ConfirmDialog
        open={confirmEmpty}
        title="No sets left"
        message="This workout has no ticked sets. Delete it?"
        confirmLabel="Delete workout"
        destructive
        onConfirm={() => void deleteIt()}
        onCancel={() => setConfirmEmpty(false)}
      />
      <Toast toast={editor.toast} onDismiss={() => editor.setToast(null)} />
    </Screen>
  )
}
