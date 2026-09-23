import type { ID, SetEntry, WeightUnit, Workout } from './types.ts'
import { convertWeight, round1 } from './units.ts'

// Every function here counts COMPLETED sets only.

export function completedSets(sets: SetEntry[]): SetEntry[] {
  return sets.filter((s) => s.completed)
}

/** weight × reps, in `unit`. 0 for sets without both. */
export function setVolume(set: SetEntry, unit: WeightUnit): number {
  if (!set.completed || set.weight === null || set.reps === null) return 0
  return convertWeight(set.weight, set.weightUnit, unit) * set.reps
}

export function setsVolume(sets: SetEntry[], unit: WeightUnit): number {
  return round1(sets.reduce((sum, s) => sum + setVolume(s, unit), 0))
}

export function workoutVolume(workout: Workout, unit: WeightUnit): number {
  return setsVolume(
    workout.exercises.flatMap((e) => e.sets),
    unit,
  )
}

export function workoutCompletedSetCount(workout: Workout): number {
  return workout.exercises.reduce((n, e) => n + completedSets(e.sets).length, 0)
}

/** Seconds from start to end (or to `now` while still active). */
export function workoutDurationSec(workout: Workout, now: string = new Date().toISOString()): number {
  const end = workout.endedAt ?? now
  return Math.max(0, Math.round((Date.parse(end) - Date.parse(workout.startedAt)) / 1000))
}

/** One exercise's numbers for one session — a point on the Progress chart. */
export interface SessionMetrics {
  /** Heaviest completed weight, in `unit`; null if no weighted sets. */
  topWeight: number | null
  /** Reps done at that top weight. */
  topWeightReps: number | null
  /** Most reps in a single set. */
  bestReps: number | null
  volume: number
  longestDurationSec: number | null
  totalDurationSec: number
  setCount: number
}

export function sessionMetrics(sets: SetEntry[], unit: WeightUnit): SessionMetrics {
  const done = completedSets(sets)
  let topWeight: number | null = null
  let topWeightReps: number | null = null
  let bestReps: number | null = null
  let longest: number | null = null
  let totalDuration = 0

  for (const s of done) {
    if (s.weight !== null && s.reps !== null) {
      const w = convertWeight(s.weight, s.weightUnit, unit)
      if (topWeight === null || w > topWeight || (w === topWeight && s.reps > (topWeightReps ?? 0))) {
        topWeight = w
        topWeightReps = s.reps
      }
    }
    if (s.reps !== null) bestReps = Math.max(bestReps ?? 0, s.reps)
    if (s.durationSec !== null) {
      longest = Math.max(longest ?? 0, s.durationSec)
      totalDuration += s.durationSec
    }
  }

  return {
    topWeight: topWeight === null ? null : round1(topWeight),
    topWeightReps,
    bestReps,
    volume: setsVolume(done, unit),
    longestDurationSec: longest,
    totalDurationSec: totalDuration,
    setCount: done.length,
  }
}

/** All completed sets of one exercise in one workout. */
export interface ExerciseSession {
  workoutId: ID
  date: string
  /** Every completed set of the exercise in this workout, in order. */
  sets: SetEntry[]
  /**
   * The same sets grouped by each time the exercise appears in the workout (usually one
   * group; two if it was done twice, e.g. heavy then back-off). Optional for callers that
   * only need totals.
   */
  occurrences?: SetEntry[][]
}

/**
 * Previous sets to base suggestions on for the `occurrence`-th appearance (0-based) of an
 * exercise in the current workout: the matching appearance last time, else all of last
 * time's sets.
 */
export function previousSetsFor(session: ExerciseSession | null, occurrence: number): SetEntry[] {
  if (!session) return []
  return session.occurrences?.[occurrence] ?? session.sets
}

export interface RecordEntry {
  value: number
  /** For the heaviest-weight record: reps done at that weight. */
  reps?: number
  workoutId: ID
  date: string
}

export interface PersonalRecords {
  heaviestWeight: RecordEntry | null
  mostReps: RecordEntry | null
  bestVolume: RecordEntry | null
  longestDuration: RecordEntry | null
}

/**
 * Personal records across sessions. A record belongs to the FIRST session that reached it —
 * matching it later doesn't move it.
 */
export function personalRecords(sessions: ExerciseSession[], unit: WeightUnit): PersonalRecords {
  const records: PersonalRecords = {
    heaviestWeight: null,
    mostReps: null,
    bestVolume: null,
    longestDuration: null,
  }
  const chronological = [...sessions].sort((a, b) => a.date.localeCompare(b.date))

  for (const session of chronological) {
    const m = sessionMetrics(session.sets, unit)
    const at = { workoutId: session.workoutId, date: session.date }
    if (m.topWeight !== null && m.topWeight > (records.heaviestWeight?.value ?? -1)) {
      records.heaviestWeight = { value: m.topWeight, reps: m.topWeightReps ?? undefined, ...at }
    }
    if (m.bestReps !== null && m.bestReps > (records.mostReps?.value ?? 0)) {
      records.mostReps = { value: m.bestReps, ...at }
    }
    if (m.volume > 0 && m.volume > (records.bestVolume?.value ?? 0)) {
      records.bestVolume = { value: m.volume, ...at }
    }
    if (m.longestDurationSec !== null && m.longestDurationSec > (records.longestDuration?.value ?? 0)) {
      records.longestDuration = { value: m.longestDurationSec, ...at }
    }
  }
  return records
}

/** Completed sets of `exerciseId` in a workout (an exercise can appear more than once). */
export function exerciseSetsInWorkout(workout: Workout, exerciseId: ID): SetEntry[] {
  return completedSets(
    workout.exercises.filter((e) => e.exerciseId === exerciseId).flatMap((e) => e.sets),
  )
}
