import { db, ensureSeedExercises } from '../data/db.ts'
import { newId } from '../data/ids.ts'
import type { SetEntry, Workout, WorkoutExercise } from '../data/types.ts'

/** Fresh empty database with the built-in exercises. Call in beforeEach. */
export async function resetDb(): Promise<void> {
  await db.delete()
  await db.open()
  await ensureSeedExercises()
}

export function makeSet(partial: Partial<SetEntry> = {}): SetEntry {
  return {
    id: newId(),
    weight: null,
    weightUnit: 'kg',
    reps: null,
    durationSec: null,
    completed: false,
    completedAt: null,
    ...partial,
  }
}

/** Completed weight × reps set. */
export function done(weight: number, reps: number, weightUnit: SetEntry['weightUnit'] = 'kg'): SetEntry {
  return makeSet({ weight, reps, weightUnit, completed: true, completedAt: '2026-01-01T00:00:00.000Z' })
}

/** Completed timed set. */
export function doneTimed(durationSec: number): SetEntry {
  return makeSet({ durationSec, completed: true, completedAt: '2026-01-01T00:00:00.000Z' })
}

export function makeExercise(exerciseId: string, sets: SetEntry[]): WorkoutExercise {
  return { id: newId(), exerciseId, restSec: 90, note: '', sets }
}

/** A finished workout stored directly in the database (bypasses startWorkout). */
export async function addCompletedWorkout(
  startedAt: string,
  exercises: WorkoutExercise[],
  partial: Partial<Workout> = {},
): Promise<Workout> {
  const workout: Workout = {
    id: newId(),
    name: 'Test workout',
    routineId: null,
    status: 'completed',
    startedAt,
    endedAt: new Date(Date.parse(startedAt) + 60 * 60 * 1000).toISOString(),
    note: '',
    exercises,
    exerciseIds: [...new Set(exercises.map((e) => e.exerciseId))],
    restTimer: null,
    updatedAt: startedAt,
    ...partial,
  }
  await db.workouts.add(workout)
  return workout
}
