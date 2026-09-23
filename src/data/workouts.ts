import { db } from './db.ts'
import { newId, nowIso } from './ids.ts'
import { getSettings } from './settings.ts'
import { completedSets, exerciseSetsInWorkout, type ExerciseSession } from './stats.ts'
import type { ID, SetEntry, WeightUnit, Workout, WorkoutExercise } from './types.ts'

export class ActiveWorkoutExistsError extends Error {
  readonly workoutId: ID
  constructor(workoutId: ID) {
    super('A workout is already in progress')
    this.name = 'ActiveWorkoutExistsError'
    this.workoutId = workoutId
  }
}

export function newSet(unit: WeightUnit): SetEntry {
  return {
    id: newId(),
    weight: null,
    weightUnit: unit,
    reps: null,
    durationSec: null,
    completed: false,
    completedAt: null,
  }
}

export function newWorkoutExercise(exerciseId: ID, restSec: number, unit: WeightUnit, setCount = 1): WorkoutExercise {
  return {
    id: newId(),
    exerciseId,
    restSec,
    note: '',
    sets: Array.from({ length: setCount }, () => newSet(unit)),
  }
}

/** Keeps derived fields in sync. Every write goes through this. */
function normalizeWorkout(workout: Workout, now: string): Workout {
  return {
    ...workout,
    exerciseIds: [...new Set(workout.exercises.map((e) => e.exerciseId))],
    updatedAt: now,
  }
}

export async function getActiveWorkout(): Promise<Workout | undefined> {
  return db.workouts.where('status').equals('active').first()
}

export async function getWorkout(id: ID): Promise<Workout | undefined> {
  return db.workouts.get(id)
}

/**
 * Starts a workout — empty, or from a routine (its exercises and planned set count; values
 * stay empty so the UI can show suggestions). Only one workout can be active at a time.
 */
export async function startWorkout(options: { routineId?: ID; now?: string } = {}): Promise<Workout> {
  const now = options.now ?? nowIso()
  const settings = await getSettings()
  return db.transaction('rw', db.workouts, db.routines, async () => {
    const active = await getActiveWorkout()
    if (active) throw new ActiveWorkoutExistsError(active.id)

    let name = 'Workout'
    let exercises: WorkoutExercise[] = []
    if (options.routineId) {
      const routine = await db.routines.get(options.routineId)
      if (!routine) throw new Error('Routine not found')
      name = routine.name
      exercises = routine.exercises.map((re) =>
        newWorkoutExercise(re.exerciseId, re.restSec, settings.displayUnit, Math.max(1, re.sets.length)),
      )
    }

    const workout = normalizeWorkout(
      {
        id: newId(),
        name,
        routineId: options.routineId ?? null,
        status: 'active',
        startedAt: now,
        endedAt: null,
        note: '',
        exercises,
        exerciseIds: [],
        restTimer: null,
        updatedAt: now,
      },
      now,
    )
    await db.workouts.add(workout)
    return workout
  })
}

export class StaleSaveError extends Error {
  constructor() {
    super('This workout was finished, discarded or deleted — change not saved')
    this.name = 'StaleSaveError'
  }
}

/**
 * Saves the whole workout. Used for every change during a workout and for editing history.
 *
 * Refuses (StaleSaveError) if the stored workout is gone or no longer has the same status —
 * so a late auto-save can never bring back a workout that was just finished or discarded.
 * IndexedDB runs write transactions in the order they were started, so saves apply in order.
 */
export async function saveWorkout(workout: Workout, now: string = nowIso()): Promise<Workout> {
  return db.transaction('rw', db.workouts, async () => {
    const stored = await db.workouts.get(workout.id)
    if (!stored || stored.status !== workout.status) throw new StaleSaveError()
    const saved = normalizeWorkout(workout, now)
    await db.workouts.put(saved)
    return saved
  })
}

export class EmptyWorkoutError extends Error {
  constructor() {
    super('No completed sets — discard the workout instead')
    this.name = 'EmptyWorkoutError'
  }
}

/**
 * Finishes the active workout: drops sets that weren't completed (and exercises left with
 * none), then moves it to history.
 */
export async function finishWorkout(id: ID, now: string = nowIso()): Promise<Workout> {
  return db.transaction('rw', db.workouts, async () => {
    const workout = await db.workouts.get(id)
    if (!workout) throw new Error('Workout not found')
    if (workout.status !== 'active') throw new Error('Workout is already finished')

    const exercises = workout.exercises
      .map((e) => ({ ...e, sets: completedSets(e.sets) }))
      .filter((e) => e.sets.length > 0)
    if (exercises.length === 0) throw new EmptyWorkoutError()

    const finished = normalizeWorkout(
      { ...workout, exercises, status: 'completed', endedAt: now, restTimer: null },
      now,
    )
    await db.workouts.put(finished)
    return finished
  })
}

/** Throws away the active workout. */
export async function discardWorkout(id: ID): Promise<void> {
  await db.transaction('rw', db.workouts, async () => {
    const workout = await db.workouts.get(id)
    if (workout?.status !== 'active') throw new Error('Only a workout in progress can be discarded')
    await db.workouts.delete(id)
  })
}

/** Deletes a finished workout from history. (Use discardWorkout for the one in progress.) */
export async function deleteWorkout(id: ID): Promise<void> {
  await db.transaction('rw', db.workouts, async () => {
    const workout = await db.workouts.get(id)
    if (workout?.status !== 'completed') throw new Error('Only finished workouts can be deleted')
    await db.workouts.delete(id)
  })
}

/** Finished workouts, newest first. */
export async function listCompletedWorkouts(): Promise<Workout[]> {
  const workouts = await db.workouts.where('status').equals('completed').sortBy('startedAt')
  return workouts.reverse()
}

/**
 * Exercises from the most recent workouts (newest first, no repeats), for the picker's
 * "Recent" section. Includes the workout in progress.
 */
export async function listRecentExerciseIds(limit = 8): Promise<ID[]> {
  const recent: ID[] = []
  await db.workouts
    .orderBy('startedAt')
    .reverse()
    .until(() => recent.length >= limit)
    .each((w) => {
      for (const e of w.exercises) {
        if (recent.length < limit && !recent.includes(e.exerciseId)) recent.push(e.exerciseId)
      }
    })
  return recent
}

/** Every finished session of one exercise, oldest first — for charts and records. */
export async function getExerciseHistory(exerciseId: ID): Promise<ExerciseSession[]> {
  const workouts = await db.workouts.where('exerciseIds').equals(exerciseId).toArray()
  return workouts
    .filter((w) => w.status === 'completed')
    .map((w) => ({
      workoutId: w.id,
      date: w.startedAt,
      sets: exerciseSetsInWorkout(w, exerciseId),
      occurrences: w.exercises
        .filter((e) => e.exerciseId === exerciseId)
        .map((e) => completedSets(e.sets))
        .filter((sets) => sets.length > 0),
    }))
    .filter((s) => s.sets.length > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * The most recent finished session of an exercise that started before `before` — the
 * "Last time" line and the source of suggestions. Pass the current workout's startedAt so
 * editing an old workout compares against the session before it, not a newer one.
 */
export async function getLastPerformance(
  exerciseId: ID,
  before: string = nowIso(),
): Promise<ExerciseSession | null> {
  const history = await getExerciseHistory(exerciseId)
  return history.filter((s) => s.date < before).at(-1) ?? null
}
