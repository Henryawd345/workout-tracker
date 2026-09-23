import { newId } from './ids.ts'
import type { ID, PlannedSet, Routine, RoutineExercise } from './types.ts'

// Pure edits for the routine editor. Each returns a new routine; nothing is saved here.

/** Moves an item; out-of-range positions leave the array unchanged. */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items
  const next = [...items]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export const DEFAULT_ROUTINE_SETS = 3

export function addRoutineExercises(routine: Routine, exerciseIds: ID[], restSec: number): Routine {
  const added: RoutineExercise[] = exerciseIds.map((exerciseId) => ({
    id: newId(),
    exerciseId,
    sets: Array.from({ length: DEFAULT_ROUTINE_SETS }, () => ({})),
    restSec,
    note: '',
  }))
  return { ...routine, exercises: [...routine.exercises, ...added] }
}

export function removeRoutineExercise(routine: Routine, routineExerciseId: ID): Routine {
  return { ...routine, exercises: routine.exercises.filter((e) => e.id !== routineExerciseId) }
}

export function moveRoutineExercise(routine: Routine, from: number, to: number): Routine {
  return { ...routine, exercises: moveItem(routine.exercises, from, to) }
}

function updateExercise(routine: Routine, id: ID, change: (e: RoutineExercise) => RoutineExercise): Routine {
  return { ...routine, exercises: routine.exercises.map((e) => (e.id === id ? change(e) : e)) }
}

export function setRoutineExerciseRest(routine: Routine, id: ID, restSec: number): Routine {
  return updateExercise(routine, id, (e) => ({ ...e, restSec }))
}

/** Adds a set that copies the previous set's targets (usually what you want). */
export function addPlannedSet(routine: Routine, id: ID): Routine {
  return updateExercise(routine, id, (e) => ({ ...e, sets: [...e.sets, { ...(e.sets.at(-1) ?? {}) }] }))
}

/** Removes a set, always keeping at least one. */
export function removePlannedSet(routine: Routine, id: ID, index: number): Routine {
  return updateExercise(routine, id, (e) =>
    e.sets.length <= 1 ? e : { ...e, sets: e.sets.filter((_, i) => i !== index) },
  )
}

/** Changes targets of one set. An `undefined` value clears that target. */
export function updatePlannedSet(routine: Routine, id: ID, index: number, changes: Partial<PlannedSet>): Routine {
  return updateExercise(routine, id, (e) => ({
    ...e,
    sets: e.sets.map((s, i) => {
      if (i !== index) return s
      const next: PlannedSet = { ...s, ...changes }
      for (const key of Object.keys(next) as (keyof PlannedSet)[]) {
        if (next[key] === undefined) delete next[key]
      }
      if (next.targetWeight === undefined) delete next.targetWeightUnit
      return next
    }),
  }))
}
