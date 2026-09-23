// Data model — mirrors section 3 of PLAN.md. Change both together.

export type ID = string
export type WeightUnit = 'kg' | 'lb'
export type TrackingType = 'weight_reps' | 'reps_only' | 'duration'

export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'core',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'full_body',
] as const
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number]

export const EQUIPMENT = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bodyweight',
  'kettlebell',
  'band',
  'other',
] as const
export type Equipment = (typeof EQUIPMENT)[number]

export interface Exercise {
  id: ID
  name: string
  /** First entry is the primary muscle. */
  muscleGroups: MuscleGroup[]
  equipment: Equipment
  trackingType: TrackingType
  /** Lasting cues and machine settings, e.g. "seat 4, pins at 6". */
  note: string
  isCustom: boolean
  /** Hidden from the picker but kept so history still makes sense. */
  archived: boolean
  createdAt: string
  updatedAt: string
}

export interface PlannedSet {
  targetReps?: number
  targetDurationSec?: number
  targetWeight?: number
  targetWeightUnit?: WeightUnit
}

export interface RoutineExercise {
  id: ID
  exerciseId: ID
  /** Order = set order. */
  sets: PlannedSet[]
  restSec: number
  note: string
}

export interface Routine {
  id: ID
  name: string
  note: string
  /** Order = exercise order. */
  exercises: RoutineExercise[]
  createdAt: string
  updatedAt: string
}

export interface SetEntry {
  id: ID
  /** null = not typed yet; the UI shows a suggestion instead. */
  weight: number | null
  weightUnit: WeightUnit
  reps: number | null
  durationSec: number | null
  completed: boolean
  completedAt: string | null
}

export interface WorkoutExercise {
  id: ID
  exerciseId: ID
  restSec: number
  /** Note for this session only, e.g. "felt heavy". */
  note: string
  sets: SetEntry[]
}

export interface RestTimer {
  durationSec: number
  /** Set while running. */
  endsAt: string | null
  /** Set while paused. */
  pausedRemainingSec: number | null
}

export type WorkoutStatus = 'active' | 'completed'

export interface Workout {
  id: ID
  name: string
  routineId: ID | null
  status: WorkoutStatus
  startedAt: string
  endedAt: string | null
  note: string
  exercises: WorkoutExercise[]
  /** Copy of exercises[].exerciseId, indexed for fast "last time" lookups. Kept in sync by saveWorkout. */
  exerciseIds: ID[]
  /** Stored so the timer survives closing the app. */
  restTimer: RestTimer | null
  updatedAt: string
}

export interface Settings {
  displayUnit: WeightUnit
  defaultRestSec: number
  autoStartRest: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  displayUnit: 'kg',
  defaultRestSec: 90,
  autoStartRest: true,
}
