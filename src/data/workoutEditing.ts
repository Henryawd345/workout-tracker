import { newId, nowIso } from './ids.ts'
import { moveItem } from './routineEditing.ts'
import { completeSet, uncompleteSet, type Suggestion } from './suggestions.ts'
import type { ID, SetEntry, TrackingType, WeightUnit, Workout, WorkoutExercise } from './types.ts'
import { newSet } from './workouts.ts'

// Pure edits for the active workout (and history corrections). Each returns a new workout;
// saving is the screen's job (saveWorkout).

function mapExercise(w: Workout, id: ID, change: (e: WorkoutExercise) => WorkoutExercise): Workout {
  return { ...w, exercises: w.exercises.map((e) => (e.id === id ? change(e) : e)) }
}

function mapSet(w: Workout, exerciseId: ID, setId: ID, change: (s: SetEntry) => SetEntry): Workout {
  return mapExercise(w, exerciseId, (e) => ({ ...e, sets: e.sets.map((s) => (s.id === setId ? change(s) : s)) }))
}

export interface ExerciseToAdd {
  exerciseId: ID
  restSec: number
  /** How many empty sets to start with (e.g. as many as last time). */
  setCount: number
}

export function addWorkoutExercises(w: Workout, items: ExerciseToAdd[], unit: WeightUnit): Workout {
  const added: WorkoutExercise[] = items.map((it) => ({
    id: newId(),
    exerciseId: it.exerciseId,
    restSec: it.restSec,
    note: '',
    sets: Array.from({ length: Math.max(1, it.setCount) }, () => newSet(unit)),
  }))
  return { ...w, exercises: [...w.exercises, ...added] }
}

export function removeWorkoutExercise(w: Workout, id: ID): Workout {
  return { ...w, exercises: w.exercises.filter((e) => e.id !== id) }
}

export function moveWorkoutExercise(w: Workout, from: number, to: number): Workout {
  return { ...w, exercises: moveItem(w.exercises, from, to) }
}

/**
 * Swaps the exercise (e.g. the machine is taken). Keeps the number of sets and rest time,
 * but clears values — weights from another exercise don't carry over.
 */
export function replaceWorkoutExercise(w: Workout, id: ID, exerciseId: ID, unit: WeightUnit): Workout {
  return mapExercise(w, id, (e) => ({ ...e, exerciseId, note: '', sets: e.sets.map(() => newSet(unit)) }))
}

export function setWorkoutExerciseRest(w: Workout, id: ID, restSec: number): Workout {
  return mapExercise(w, id, (e) => ({ ...e, restSec }))
}

export function setWorkoutExerciseNote(w: Workout, id: ID, note: string): Workout {
  return mapExercise(w, id, (e) => ({ ...e, note }))
}

export function addWorkoutSet(w: Workout, id: ID, unit: WeightUnit): Workout {
  return mapExercise(w, id, (e) => ({ ...e, sets: [...e.sets, newSet(unit)] }))
}

export function removeWorkoutSet(w: Workout, exerciseId: ID, setId: ID): Workout {
  return mapExercise(w, exerciseId, (e) => ({ ...e, sets: e.sets.filter((s) => s.id !== setId) }))
}

/** Typing a value. Weights are stored in the unit they were typed in. */
export function updateWorkoutSet(
  w: Workout,
  exerciseId: ID,
  setId: ID,
  changes: Partial<Pick<SetEntry, 'weight' | 'weightUnit' | 'reps' | 'durationSec'>>,
): Workout {
  return mapSet(w, exerciseId, setId, (s) => ({ ...s, ...changes }))
}

/**
 * The ✓ tap. Returns null (nothing to change) if a required value is missing, so the screen
 * can point at the empty field instead.
 */
export function toggleWorkoutSet(
  w: Workout,
  exerciseId: ID,
  setId: ID,
  suggestion: Suggestion,
  tracking: TrackingType,
  now: string = nowIso(),
): Workout | null {
  const set = w.exercises.find((e) => e.id === exerciseId)?.sets.find((s) => s.id === setId)
  if (!set) return null
  if (set.completed) return mapSet(w, exerciseId, setId, uncompleteSet)
  const done = completeSet(set, suggestion, tracking, now)
  return done ? mapSet(w, exerciseId, setId, () => done) : null
}

// Undo helpers: each puts back exactly one thing, leaving any later changes alone.

/** Puts a deleted set back at its old position (or at the end if the exercise got shorter). */
export function insertWorkoutSet(w: Workout, exerciseId: ID, set: SetEntry, index: number): Workout {
  return mapExercise(w, exerciseId, (e) => {
    const sets = [...e.sets]
    sets.splice(Math.min(index, sets.length), 0, set)
    return { ...e, sets }
  })
}

/** Puts a removed exercise back at its old position. */
export function insertWorkoutExercise(w: Workout, item: WorkoutExercise, index: number): Workout {
  const exercises = [...w.exercises]
  exercises.splice(Math.min(index, exercises.length), 0, item)
  return { ...w, exercises }
}

/**
 * Undo "replace": puts the old exercise back — but only if nothing has been typed or ticked
 * on the new one yet. Returns null otherwise, because undoing would throw those sets away.
 */
export function restoreWorkoutExercise(w: Workout, item: WorkoutExercise): Workout | null {
  const current = w.exercises.find((e) => e.id === item.id)
  if (!current) return null
  const touched = current.sets.some((s) => s.completed || s.weight !== null || s.reps !== null || s.durationSec !== null)
  return touched ? null : mapExercise(w, item.id, () => item)
}

export function renameWorkout(w: Workout, name: string): Workout {
  return { ...w, name }
}

export function setWorkoutNote(w: Workout, note: string): Workout {
  return { ...w, note }
}

/** Counts for the header and the finish dialog. */
export function setCounts(w: Workout): { completed: number; total: number } {
  let completed = 0
  let total = 0
  for (const e of w.exercises) {
    for (const s of e.sets) {
      total++
      if (s.completed) completed++
    }
  }
  return { completed, total }
}

/** Which appearance of its exercise this card is (0 = first), for per-appearance suggestions. */
export function occurrenceIndex(w: Workout, workoutExerciseId: ID): number {
  const index = w.exercises.findIndex((e) => e.id === workoutExerciseId)
  if (index < 0) return 0
  const exerciseId = w.exercises[index].exerciseId
  return w.exercises.slice(0, index).filter((e) => e.exerciseId === exerciseId).length
}

