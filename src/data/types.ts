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
  /** Fight coach voice (a speechSynthesis voiceURI); null = the phone's default. */
  coachVoice: string | null
  /** Fight coach speaking speed: 1 = normal. */
  coachRate: number
  /** Which foot is forward; the coach says left/right to match. */
  stance: Stance
}

export type Stance = 'orthodox' | 'southpaw'

export const COACH_RATES = [0.85, 1, 1.2] as const

export const DEFAULT_SETTINGS: Settings = {
  displayUnit: 'kg',
  defaultRestSec: 90,
  autoStartRest: true,
  coachVoice: null,
  coachRate: 1,
  stance: 'orthodox',
}

// —— Fight trainer ——

export const SPORTS = ['boxing', 'muay_thai', 'kickboxing', 'wrestling'] as const
export type Sport = (typeof SPORTS)[number]

export const INTENSITIES = ['easy', 'medium', 'hard'] as const
export type Intensity = (typeof INTENSITIES)[number]

/**
 * Stored as time passed, not as the current phase, so the phase can always be worked out
 * again after a reload or a locked screen (see fightClock.ts).
 */
export interface FightClock {
  /** Set while running. */
  runningSince: string | null
  /** Seconds counted before the last pause. */
  elapsedBeforeSec: number
}

/** 'combos': the coach calls combos (drills for wrestling). 'timer': bells and round calls only. */
export type CoachMode = 'combos' | 'timer'

export interface FightPlan {
  sport: Sport
  intensity: Intensity
  roundSec: number
  restSec: number
  rounds: number
  /** Added later, so older sessions may not have them; see fightPlanExtras(). Default 'combos'. */
  coachMode?: CoachMode
  /** "Burst! Everything!" for the last 20 s of each round (not on Easy combos). Default true. */
  burst?: boolean
  /** Warm-up round before round 1, then the usual rest. 0 = none (default). */
  warmupSec?: number
}

export interface FightSession extends FightPlan {
  id: ID
  status: WorkoutStatus
  startedAt: string
  endedAt: string | null
  clock: FightClock
  /** Set when finished; only full rounds count. */
  completedRounds: number
  note: string
  updatedAt: string
}

/** A combo the user typed, mixed in with the random ones, e.g. "1 2 3 slip 2". */
export interface CustomCombo {
  id: ID
  sport: Sport
  text: string
  createdAt: string
  updatedAt: string
}
