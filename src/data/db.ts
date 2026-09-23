import { Dexie, type EntityTable } from 'dexie'
import { SEED_EXERCISES } from './seedExercises.ts'
import type { Exercise, Routine, Settings, Workout } from './types.ts'

export type SettingsRecord = Settings & { id: 'settings' }

export type WorkoutDB = Dexie & {
  exercises: EntityTable<Exercise, 'id'>
  routines: EntityTable<Routine, 'id'>
  workouts: EntityTable<Workout, 'id'>
  settings: EntityTable<SettingsRecord, 'id'>
}

export const db = new Dexie('workout-tracker') as WorkoutDB

// Only indexed fields are listed; every other field is still stored.
// Changing this? Add db.version(2) below — never edit version 1.
db.version(1).stores({
  exercises: 'id, name, *muscleGroups, equipment',
  routines: 'id, updatedAt',
  workouts: 'id, status, startedAt, *exerciseIds',
  settings: 'id',
})

/** Adds any built-in exercises that aren't in the database yet (first run, or new ones in an update). */
export async function ensureSeedExercises(): Promise<void> {
  await db.transaction('rw', db.exercises, async () => {
    const existing = new Set(await db.exercises.toCollection().primaryKeys())
    const missing = SEED_EXERCISES.filter((e) => !existing.has(e.id))
    if (missing.length > 0) await db.exercises.bulkAdd(missing)
  })
}

/**
 * Asks the browser not to clear our data when space runs low.
 * Safari mostly decides on its own (Home Screen apps are kept), so this is best effort.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    return (await navigator.storage.persisted()) || (await navigator.storage.persist())
  } catch {
    return false
  }
}

/** Run once when the app starts. */
export async function initDb(): Promise<void> {
  await ensureSeedExercises()
  void requestPersistentStorage()
}
