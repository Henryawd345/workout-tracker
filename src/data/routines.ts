import { db } from './db.ts'
import { newId, nowIso } from './ids.ts'
import type { ID, Routine, RoutineExercise } from './types.ts'

export async function listRoutines(): Promise<Routine[]> {
  return db.routines.orderBy('updatedAt').reverse().toArray()
}

export async function getRoutine(id: ID): Promise<Routine | undefined> {
  return db.routines.get(id)
}

export async function createRoutine(name: string, exercises: RoutineExercise[] = []): Promise<Routine> {
  const now = nowIso()
  const routine: Routine = {
    id: newId(),
    name: name.trim() || 'New routine',
    note: '',
    exercises,
    createdAt: now,
    updatedAt: now,
  }
  await db.routines.add(routine)
  return routine
}

export const UNTITLED_ROUTINE = 'Untitled routine'

/**
 * Saves the whole routine (the editor auto-saves after every change).
 * Refuses (StaleRoutineError) if the routine was deleted meanwhile, so a late auto-save
 * can't bring it back.
 */
export async function saveRoutine(routine: Routine): Promise<Routine> {
  return db.transaction('rw', db.routines, async () => {
    if (!(await db.routines.get(routine.id))) throw new StaleRoutineError()
    const saved = { ...routine, name: routine.name.trim() || UNTITLED_ROUTINE, updatedAt: nowIso() }
    await db.routines.put(saved)
    return saved
  })
}

export class StaleRoutineError extends Error {
  constructor() {
    super('This routine was deleted — change not saved')
    this.name = 'StaleRoutineError'
  }
}

export async function duplicateRoutine(id: ID): Promise<Routine> {
  const source = await db.routines.get(id)
  if (!source) throw new Error('Routine not found')
  const now = nowIso()
  const copy: Routine = {
    ...structuredClone(source),
    id: newId(),
    name: `${source.name} (copy)`,
    exercises: source.exercises.map((e) => ({ ...structuredClone(e), id: newId() })),
    createdAt: now,
    updatedAt: now,
  }
  await db.routines.add(copy)
  return copy
}

/** Past workouts keep their data; they just no longer link to a routine. */
export async function deleteRoutine(id: ID): Promise<void> {
  await db.transaction('rw', db.routines, db.workouts, async () => {
    await db.routines.delete(id)
    await db.workouts.filter((w) => w.routineId === id).modify({ routineId: null })
  })
}

export function newRoutineExercise(exerciseId: ID, restSec: number, setCount = 3): RoutineExercise {
  return {
    id: newId(),
    exerciseId,
    sets: Array.from({ length: setCount }, () => ({})),
    restSec,
    note: '',
  }
}
