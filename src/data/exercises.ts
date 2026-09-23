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

export async function createCustomExercise(input: NewExercise): Promise<Exercise> {
  const name = input.name.trim()
  if (!name) throw new Error('Exercise name is required')
  if (input.muscleGroups.length === 0) throw new Error('Pick at least one muscle group')
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
}

/**
 * Edits an exercise. The note can be changed on any exercise; the other fields only on
 * custom ones, so built-in exercises stay the same for everyone.
 */
export async function updateExercise(
  id: ID,
  changes: Partial<Pick<Exercise, 'name' | 'muscleGroups' | 'equipment' | 'trackingType' | 'note'>>,
): Promise<Exercise> {
  return db.transaction('rw', db.exercises, async () => {
    const current = await db.exercises.get(id)
    if (!current) throw new Error('Exercise not found')
    const allowed = current.isCustom ? changes : { note: changes.note }
    const next: Exercise = {
      ...current,
      ...Object.fromEntries(Object.entries(allowed).filter(([, v]) => v !== undefined)),
      updatedAt: nowIso(),
    }
    next.name = next.name.trim()
    if (!next.name) throw new Error('Exercise name is required')
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

export async function restoreExercise(id: ID): Promise<void> {
  await db.exercises.update(id, { archived: false, updatedAt: nowIso() })
}
