import { nowIso } from './ids.ts'
import type { PlannedSet, SetEntry, TrackingType, WeightUnit } from './types.ts'

/**
 * Values shown in grey in an empty set row. Never saved unless the user taps ✓.
 * The weight stays in the unit it was originally logged in (e.g. 225 lb even when logging
 * in kg): the screen converts it for display with displayWeight(), and ✓ stores the
 * original — so accepting "same as last time" never introduces rounding drift.
 */
export interface Suggestion {
  weight: number | null
  weightUnit: WeightUnit
  reps: number | null
  durationSec: number | null
}

interface SuggestInput {
  /** 0-based position of the set within the exercise. */
  index: number
  /** Completed sets from the most recent session of this exercise (may be empty). */
  previousSets: SetEntry[]
  /** Planned sets from the routine (may be empty). */
  plannedSets: PlannedSet[]
  /** Unit the new set is logged in — used when the source has no unit of its own. */
  unit: WeightUnit
}

/**
 * Suggestion for set n:
 * 1. set n of the previous session, else its last set;
 * 2. otherwise the routine's planned set n, else its last planned set;
 * 3. otherwise nothing.
 * Weights keep their original unit (see Suggestion).
 */
export function suggestSet({ index, previousSets, plannedSets, unit }: SuggestInput): Suggestion {
  const prev = previousSets[index] ?? previousSets.at(-1)
  if (prev) {
    return {
      weight: prev.weight,
      weightUnit: prev.weight === null ? unit : prev.weightUnit,
      reps: prev.reps,
      durationSec: prev.durationSec,
    }
  }
  const plan = plannedSets[index] ?? plannedSets.at(-1)
  if (plan) {
    const hasWeight = plan.targetWeight !== undefined
    return {
      weight: hasWeight ? plan.targetWeight! : null,
      weightUnit: hasWeight ? (plan.targetWeightUnit ?? unit) : unit,
      reps: plan.targetReps ?? null,
      durationSec: plan.targetDurationSec ?? null,
    }
  }
  return { weight: null, weightUnit: unit, reps: null, durationSec: null }
}

export type SetField = 'weight' | 'reps' | 'durationSec'

/** Fields that must have a value before a set can be completed. */
export function missingFields(set: Pick<SetEntry, SetField>, tracking: TrackingType): SetField[] {
  const missing: SetField[] = []
  if (tracking === 'weight_reps') {
    if (set.weight === null || set.weight < 0) missing.push('weight')
    if (set.reps === null || set.reps < 1) missing.push('reps')
  } else if (tracking === 'reps_only') {
    if (set.reps === null || set.reps < 1) missing.push('reps')
  } else if (set.durationSec === null || set.durationSec < 1) {
    missing.push('durationSec')
  }
  return missing
}

/**
 * The ✓ tap: fills any empty field from the suggestion and marks the set complete.
 * Returns null (nothing changes) if a required value is still missing.
 */
export function completeSet(
  set: SetEntry,
  suggestion: Suggestion,
  tracking: TrackingType,
  now: string = nowIso(),
): SetEntry | null {
  // A typed weight keeps the set's unit; a suggested weight brings its own.
  const useSuggestedWeight = set.weight === null && suggestion.weight !== null
  const filled: SetEntry = {
    ...set,
    weight: useSuggestedWeight ? suggestion.weight : set.weight,
    weightUnit: useSuggestedWeight ? suggestion.weightUnit : set.weightUnit,
    reps: set.reps ?? suggestion.reps,
    durationSec: set.durationSec ?? suggestion.durationSec,
  }
  if (missingFields(filled, tracking).length > 0) return null
  // Only keep the fields this exercise type uses.
  if (tracking !== 'weight_reps') filled.weight = null
  if (tracking === 'duration') filled.reps = null
  else filled.durationSec = null
  return { ...filled, completed: true, completedAt: now }
}

/** Tapping ✓ again: back to not completed, keeping the values. */
export function uncompleteSet(set: SetEntry): SetEntry {
  return { ...set, completed: false, completedAt: null }
}
