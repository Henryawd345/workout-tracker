import { db } from './db.ts'
import { newId, nowIso } from './ids.ts'
import type { Equipment, Exercise, ID, MuscleGroup, TrackingType } from './types.ts'

export interface ExerciseFilter {
  query?: string
  muscle?: MuscleGroup
  equipment?: Equipment
  includeArchived?: boolean
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

/**
 * Filters and sorts by name. Every word typed must appear in the name, equipment or
 * muscle groups, so "db press" doesn't match but "dumbbell press" and "press chest" do.
 */
export function searchExercises(exercises: Exercise[], filter: ExerciseFilter = {}): Exercise[] {
  const words = normalize(filter.query ?? '').split(' ').filter(Boolean)
  return exercises
    .filter((e) => filter.includeArchived || !e.archived)
    .filter((e) => !filter.muscle || e.muscleGroups.includes(filter.muscle))
    .filter((e) => !filter.equipment || e.equipment === filter.equipment)
    .filter((e) => {
      if (words.length === 0) return true
      const haystack = normalize([e.name, e.equipment, ...e.muscleGroups].join(' '))
      return words.every((w) => haystack.includes(w))
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function listExercises(): Promise<Exercise[]> {
  return db.exercises.orderBy('name').toArray()
}

export async function getExercise(id: ID): Promise<Exercise | undefined> {
  return db.exercises.get(id)
}

export interface NewExercise {
  name: string
  muscleGroups: MuscleGroup[]
  equipment: Equipment
  trackingType: TrackingType
  note?: string
}

export const MAX_EXERCISE_NAME = 60

/** Throws a user-readable error if the name is empty, too long or already taken. */
async function checkName(name: string, ignoreId?: ID): Promise<void> {
  if (!name) throw new Error('Exercise name is required')
  if (name.length > MAX_EXERCISE_NAME) throw new Error(`Keep the name under ${MAX_EXERCISE_NAME} characters`)
  const lower = name.toLowerCase()
  const clash = await db.exercises
    .filter((e) => !e.archived && e.id !== ignoreId && e.name.toLowerCase() === lower)
    .first()
  if (clash) throw new Error(`“${clash.name}” already exists`)
}

/**
 * True if the exercise is in any workout — finished, or in progress even before a set is
 * ticked. Deliberately cautious: it locks the tracking type and makes removal archive.
 */
export async function isExerciseLogged(id: ID): Promise<boolean> {
  return (await db.workouts.where('exerciseIds').equals(id).count()) > 0
}

export async function createCustomExercise(input: NewExercise): Promise<Exercise> {
  const name = input.name.trim()
  if (input.muscleGroups.length === 0) throw new Error('Pick at least one muscle group')
  return db.transaction('rw', db.exercises, async () => {
    await checkName(name)
    const now = nowIso()
    const exercise: Exercise = {
      id: newId(),
      name,
      muscleGroups: input.muscleGroups,
      equipment: input.equipment,
      trackingType: input.trackingType,
      note: input.note ?? '',
      isCustom: true,
      archived: false,
      createdAt: now,
      updatedAt: now,
    }
    await db.exercises.add(exercise)
    return exercise
  })
}

/**
 * Edits an exercise. The note can be changed on any exercise; the other fields only on
 * custom ones, so built-in exercises stay the same for everyone. The tracking type is
 * locked once the exercise has been logged, because old sets would no longer make sense.
 */
export async function updateExercise(
  id: ID,
  changes: Partial<Pick<Exercise, 'name' | 'muscleGroups' | 'equipment' | 'trackingType' | 'note'>>,
): Promise<Exercise> {
  return db.transaction('rw', db.exercises, db.workouts, async () => {
    const current = await db.exercises.get(id)
    if (!current) throw new Error('Exercise not found')
    const allowed = current.isCustom ? changes : { note: changes.note }
    const next: Exercise = {
      ...current,
      ...Object.fromEntries(Object.entries(allowed).filter(([, v]) => v !== undefined)),
      updatedAt: nowIso(),
    }
    next.name = next.name.trim()
    if (next.name !== current.name) await checkName(next.name, id)
    if (next.muscleGroups.length === 0) throw new Error('Pick at least one muscle group')
    if (next.trackingType !== current.trackingType && (await isExerciseLogged(id))) {
      throw new Error('This exercise has been logged, so its type can’t change. Create a new exercise instead.')
    }
    await db.exercises.put(next)
    return next
  })
}

/**
 * Removes a custom exercise. If any workout or routine uses it, it is archived instead so
 * history keeps its name. Returns what happened.
 */
export async function removeCustomExercise(id: ID): Promise<'deleted' | 'archived'> {
  return db.transaction('rw', db.exercises, db.workouts, db.routines, async () => {
    const exercise = await db.exercises.get(id)
    if (!exercise) throw new Error('Exercise not found')
    if (!exercise.isCustom) throw new Error('Built-in exercises cannot be removed')

    const usedInWorkout = (await db.workouts.where('exerciseIds').equals(id).count()) > 0
    const usedInRoutine = await db.routines
      .filter((r) => r.exercises.some((e) => e.exerciseId === id))
      .count()
    if (usedInWorkout || usedInRoutine > 0) {
      await db.exercises.update(id, { archived: true, updatedAt: nowIso() })
      return 'archived'
    }
    await db.exercises.delete(id)
    return 'deleted'
  })
}

/** Un-archives an exercise. Fails if another exercise took its name meanwhile — rename one first. */
export async function restoreExercise(id: ID): Promise<void> {
  await db.transaction('rw', db.exercises, async () => {
    const exercise = await db.exercises.get(id)
    if (!exercise) throw new Error('Exercise not found')
    await checkName(exercise.name, id)
    await db.exercises.update(id, { archived: false, updatedAt: nowIso() })
  })
}

export interface ExerciseImportPlan {
  /** Names that will be created, in the order they were pasted. */
  toAdd: string[]
  skipped: { name: string; reason: 'exists' | 'duplicate' | 'too_long' }[]
}

/**
 * Turns pasted text (one name per line) into names to create. Strips list markers such as
 * "-", "•" or "3.", and skips names already in the library, repeated in the paste, or too long.
 */
export function planExerciseImport(text: string, existing: Exercise[]): ExerciseImportPlan {
  const taken = new Set(existing.filter((e) => !e.archived).map((e) => e.name.toLowerCase()))
  const plan: ExerciseImportPlan = { toAdd: [], skipped: [] }
  for (const line of text.split(/\r?\n/)) {
    const name = line
      .replace(/^\s*(?:[-*•–]\s*|\d+[.)]\s+)/, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (!name) continue
    const lower = name.toLowerCase()
    if (name.length > MAX_EXERCISE_NAME) plan.skipped.push({ name, reason: 'too_long' })
    else if (plan.toAdd.some((n) => n.toLowerCase() === lower)) plan.skipped.push({ name, reason: 'duplicate' })
    else if (taken.has(lower)) plan.skipped.push({ name, reason: 'exists' })
    else plan.toAdd.push(name)
  }
  return plan
}

/**
 * Creates a custom exercise for every new name in the pasted text, all with the same muscle
 * groups, equipment and tracking type (each can be edited afterwards). All or nothing.
 */
export async function importExercises(
  text: string,
  defaults: Omit<NewExercise, 'name' | 'note'>,
): Promise<{ added: Exercise[]; plan: ExerciseImportPlan }> {
  if (defaults.muscleGroups.length === 0) throw new Error('Pick at least one muscle group')
  return db.transaction('rw', db.exercises, async () => {
    // Planned inside the transaction, so names added meanwhile are still caught.
    const plan = planExerciseImport(text, await db.exercises.toArray())
    const now = nowIso()
    const added: Exercise[] = plan.toAdd.map((name) => ({
      id: newId(),
      name,
      muscleGroups: [...defaults.muscleGroups],
      equipment: defaults.equipment,
      trackingType: defaults.trackingType,
      note: '',
      isCustom: true,
      archived: false,
      createdAt: now,
      updatedAt: now,
    }))
    await db.exercises.bulkAdd(added)
    return { added, plan }
  })
}
