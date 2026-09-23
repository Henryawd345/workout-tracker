import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useRef, useState } from 'react'
import {
  addWorkoutExercises,
  DEFAULT_SETTINGS,
  getLastPerformance,
  getRoutine,
  getSettings,
  listExercises,
  missingFields,
  occurrenceIndex,
  previousSetsFor,
  saveWorkout,
  StaleSaveError,
  startRest,
  suggestSet,
  toggleWorkoutSet,
  type ExerciseSession,
  type ID,
  type SetEntry,
  type Workout,
  type WorkoutExercise,
} from '../../data/index.ts'
import { useDebouncedSave } from '../../hooks/useDebouncedSave.ts'
import type { ToastMessage } from '../Toast.tsx'
import { unlockAudio } from './alerts.ts'
import { setFieldId } from './setFieldId.ts'

const DEFAULT_NEW_SETS = 3

interface EditorOptions {
  /** The workout was finished, discarded or deleted elsewhere. */
  onStale: () => void
  /** Start the rest timer when a set is ticked (active workouts only). */
  restTimer: boolean
}

/**
 * Everything needed to edit a workout — the one in progress, or a past one from History.
 * Holds the workout in state, shows every change at once and auto-saves it.
 */
export function useWorkoutEditor(initial: Workout, { onStale, restTimer }: EditorOptions) {
  const [workout, setWorkout] = useState(initial)
  // Always the newest workout, for callbacks (like Undo) that run after later changes.
  const latest = useRef(initial)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [saveFailed, setSaveFailed] = useState(false)

  const settings = useLiveQuery(() => getSettings(), [], DEFAULT_SETTINGS)
  const unit = settings.displayUnit
  const exerciseList = useLiveQuery(() => listExercises(), [])
  const exercises = useMemo(() => new Map((exerciseList ?? []).map((e) => [e.id, e])), [exerciseList])
  const routine = useLiveQuery(
    async () => (workout.routineId ? ((await getRoutine(workout.routineId)) ?? null) : null),
    [workout.routineId],
  )

  // "Last time" (before this workout) for every exercise in it.
  const exerciseKey = [...new Set(workout.exercises.map((e) => e.exerciseId))].sort().join(',')
  const lastTime = useLiveQuery(
    async () => {
      const ids = exerciseKey ? exerciseKey.split(',') : []
      const sessions = await Promise.all(ids.map((id) => getLastPerformance(id, workout.startedAt)))
      return new Map(ids.map((id, i) => [id, sessions[i]]))
    },
    [exerciseKey, workout.startedAt],
    new Map<ID, ExerciseSession | null>(),
  )

  const { schedule, flush, cancel } = useDebouncedSave(
    (w: Workout) =>
      saveWorkout(w).then(
        () => setSaveFailed(false),
        (err: unknown) => {
          if (err instanceof StaleSaveError) onStale()
          else setSaveFailed(true)
        },
      ),
    300,
  )

  /** Every change goes through here: shown at once, saved right after. */
  function apply(next: Workout, options: { immediate?: boolean } = {}) {
    latest.current = next
    setWorkout(next)
    schedule(next)
    if (options.immediate) void flush()
  }

  /**
   * Offers Undo for one action. `reverse` puts back just that action, keeping any later
   * changes — or returns null when that's no longer possible without losing data.
   */
  function showUndo(text: string, reverse: (w: Workout) => Workout | null) {
    setToast({
      id: Date.now(),
      text,
      actionLabel: 'Undo',
      onAction: () => {
        const next = reverse(latest.current)
        if (next) apply(next, { immediate: true })
        else setToast({ id: Date.now(), text: 'Can’t undo — sets were already logged on it' })
      },
    })
  }

  const previousFor = (item: WorkoutExercise): SetEntry[] =>
    previousSetsFor(lastTime.get(item.exerciseId) ?? null, occurrenceIndex(workout, item.id))

  const plannedFor = (item: WorkoutExercise) => {
    if (!routine) return []
    const occurrence = occurrenceIndex(workout, item.id)
    return routine.exercises.filter((e) => e.exerciseId === item.exerciseId)[occurrence]?.sets ?? []
  }

  function toggleSet(item: WorkoutExercise, set: SetEntry, index: number) {
    const tracking = exercises.get(item.exerciseId)?.trackingType ?? 'weight_reps'
    const suggestion = suggestSet({
      index,
      previousSets: previousFor(item),
      plannedSets: plannedFor(item),
      unit,
      setsAbove: item.sets.slice(0, index),
    })
    if (restTimer) unlockAudio() // iPhone only allows the end-of-rest beep after a tap
    const next = toggleWorkoutSet(workout, item.id, set.id, suggestion, tracking)
    if (next) {
      const startsRest = restTimer && !set.completed && settings.autoStartRest && item.restSec > 0
      return apply(startsRest ? { ...next, restTimer: startRest(item.restSec, Date.now()) } : next, { immediate: true })
    }

    // Something is missing: point at it.
    const merged = {
      weight: set.weight ?? suggestion.weight,
      reps: set.reps ?? suggestion.reps,
      durationSec: set.durationSec ?? suggestion.durationSec,
    }
    const field = missingFields(merged, tracking)[0]
    if (field) document.getElementById(setFieldId(set.id, field))?.focus()
    setToast({
      id: Date.now(),
      text: field === 'weight' ? 'Enter a weight first' : field === 'reps' ? 'Enter reps first' : 'Enter a time first',
    })
  }

  async function addExercises(ids: ID[]) {
    const sessions = await Promise.all(ids.map((id) => getLastPerformance(id, latest.current.startedAt)))
    const items = ids.map((exerciseId, i) => ({
      exerciseId,
      restSec: settings.defaultRestSec,
      setCount: sessions[i]?.occurrences?.[0]?.length ?? sessions[i]?.sets.length ?? DEFAULT_NEW_SETS,
    }))
    apply(addWorkoutExercises(latest.current, items, unit))
  }

  const nameOf = (item: WorkoutExercise) => exercises.get(item.exerciseId)?.name ?? 'exercise'

  return {
    workout,
    latest,
    apply,
    flush,
    cancel,
    saveFailed,
    setSaveFailed,
    toast,
    setToast,
    showUndo,
    unit,
    settings,
    exercises,
    previousFor,
    plannedFor,
    toggleSet,
    addExercises,
    nameOf,
  }
}

export type WorkoutEditor = ReturnType<typeof useWorkoutEditor>
