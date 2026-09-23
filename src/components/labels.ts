import type { Equipment, Exercise, MuscleGroup, TrackingType } from '../data/index.ts'

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  core: 'Core',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  full_body: 'Full body',
}

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  machine: 'Machine',
  cable: 'Cable',
  bodyweight: 'Bodyweight',
  kettlebell: 'Kettlebell',
  band: 'Band',
  other: 'Other',
}

export const TRACKING_LABELS: Record<TrackingType, string> = {
  weight_reps: 'Weight & reps',
  reps_only: 'Reps only',
  duration: 'Time',
}

/** "Chest · Barbell" */
export function exerciseSubtitle(e: Exercise): string {
  return `${MUSCLE_LABELS[e.muscleGroups[0]]} · ${EQUIPMENT_LABELS[e.equipment]}`
}
