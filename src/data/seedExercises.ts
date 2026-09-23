import type { Equipment, Exercise, MuscleGroup, TrackingType } from './types.ts'

type Row = [name: string, muscles: MuscleGroup[], equipment: Equipment, tracking?: TrackingType]

// Built-in library. IDs are derived from the name so they are the same on every install
// (keeps backups importable). Don't rename existing entries — add new ones instead.
const rows: Row[] = [
  // Chest
  ['Barbell Bench Press', ['chest', 'triceps', 'shoulders'], 'barbell'],
  ['Incline Barbell Bench Press', ['chest', 'shoulders', 'triceps'], 'barbell'],
  ['Decline Barbell Bench Press', ['chest', 'triceps'], 'barbell'],
  ['Dumbbell Bench Press', ['chest', 'triceps', 'shoulders'], 'dumbbell'],
  ['Incline Dumbbell Press', ['chest', 'shoulders', 'triceps'], 'dumbbell'],
  ['Dumbbell Fly', ['chest'], 'dumbbell'],
  ['Cable Fly', ['chest'], 'cable'],
  ['Machine Chest Press', ['chest', 'triceps'], 'machine'],
  ['Pec Deck', ['chest'], 'machine'],
  ['Push-Up', ['chest', 'triceps', 'shoulders'], 'bodyweight', 'reps_only'],
  ['Dip', ['chest', 'triceps'], 'bodyweight', 'reps_only'],
  // Back
  ['Deadlift', ['back', 'hamstrings', 'glutes'], 'barbell'],
  ['Barbell Row', ['back', 'biceps'], 'barbell'],
  ['Dumbbell Row', ['back', 'biceps'], 'dumbbell'],
  ['T-Bar Row', ['back', 'biceps'], 'barbell'],
  ['Seated Cable Row', ['back', 'biceps'], 'cable'],
  ['Machine Row', ['back', 'biceps'], 'machine'],
  ['Lat Pulldown', ['back', 'biceps'], 'cable'],
  ['Straight-Arm Pulldown', ['back'], 'cable'],
  ['Pull-Up', ['back', 'biceps'], 'bodyweight', 'reps_only'],
  ['Chin-Up', ['back', 'biceps'], 'bodyweight', 'reps_only'],
  ['Weighted Pull-Up', ['back', 'biceps'], 'bodyweight'],
  ['Inverted Row', ['back', 'biceps'], 'bodyweight', 'reps_only'],
  ['Back Extension', ['back', 'glutes', 'hamstrings'], 'bodyweight', 'reps_only'],
  ['Barbell Shrug', ['back'], 'barbell'],
  ['Dumbbell Shrug', ['back'], 'dumbbell'],
  // Shoulders
  ['Overhead Press', ['shoulders', 'triceps'], 'barbell'],
  ['Seated Dumbbell Shoulder Press', ['shoulders', 'triceps'], 'dumbbell'],
  ['Arnold Press', ['shoulders', 'triceps'], 'dumbbell'],
  ['Machine Shoulder Press', ['shoulders', 'triceps'], 'machine'],
  ['Lateral Raise', ['shoulders'], 'dumbbell'],
  ['Cable Lateral Raise', ['shoulders'], 'cable'],
  ['Front Raise', ['shoulders'], 'dumbbell'],
  ['Rear Delt Fly', ['shoulders', 'back'], 'dumbbell'],
  ['Reverse Pec Deck', ['shoulders', 'back'], 'machine'],
  ['Face Pull', ['shoulders', 'back'], 'cable'],
  ['Upright Row', ['shoulders', 'back'], 'barbell'],
  ['Band Pull-Apart', ['shoulders', 'back'], 'band', 'reps_only'],
  // Biceps
  ['Barbell Curl', ['biceps'], 'barbell'],
  ['Dumbbell Curl', ['biceps'], 'dumbbell'],
  ['Hammer Curl', ['biceps', 'forearms'], 'dumbbell'],
  ['Incline Dumbbell Curl', ['biceps'], 'dumbbell'],
  ['Preacher Curl', ['biceps'], 'barbell'],
  ['Cable Curl', ['biceps'], 'cable'],
  ['Concentration Curl', ['biceps'], 'dumbbell'],
  // Triceps
  ['Triceps Pushdown', ['triceps'], 'cable'],
  ['Overhead Cable Triceps Extension', ['triceps'], 'cable'],
  ['Overhead Dumbbell Triceps Extension', ['triceps'], 'dumbbell'],
  ['Skull Crusher', ['triceps'], 'barbell'],
  ['Close-Grip Bench Press', ['triceps', 'chest'], 'barbell'],
  ['Bench Dip', ['triceps'], 'bodyweight', 'reps_only'],
  // Forearms
  ['Wrist Curl', ['forearms'], 'dumbbell'],
  ['Reverse Wrist Curl', ['forearms'], 'dumbbell'],
  ['Dead Hang', ['forearms', 'back'], 'bodyweight', 'duration'],
  // Core
  ['Plank', ['core'], 'bodyweight', 'duration'],
  ['Side Plank', ['core'], 'bodyweight', 'duration'],
  ['Hollow Body Hold', ['core'], 'bodyweight', 'duration'],
  ['Hanging Leg Raise', ['core'], 'bodyweight', 'reps_only'],
  ['Crunch', ['core'], 'bodyweight', 'reps_only'],
  ['Cable Crunch', ['core'], 'cable'],
  ['Ab Wheel Rollout', ['core'], 'other', 'reps_only'],
  ['Russian Twist', ['core'], 'bodyweight', 'reps_only'],
  ['Dead Bug', ['core'], 'bodyweight', 'reps_only'],
  ['Pallof Press', ['core'], 'cable'],
  // Quads
  ['Back Squat', ['quads', 'glutes', 'hamstrings'], 'barbell'],
  ['Front Squat', ['quads', 'glutes'], 'barbell'],
  ['Goblet Squat', ['quads', 'glutes'], 'dumbbell'],
  ['Hack Squat', ['quads', 'glutes'], 'machine'],
  ['Leg Press', ['quads', 'glutes'], 'machine'],
  ['Leg Extension', ['quads'], 'machine'],
  ['Bulgarian Split Squat', ['quads', 'glutes'], 'dumbbell'],
  ['Walking Lunge', ['quads', 'glutes'], 'dumbbell'],
  ['Step-Up', ['quads', 'glutes'], 'dumbbell'],
  ['Wall Sit', ['quads'], 'bodyweight', 'duration'],
  // Hamstrings
  ['Romanian Deadlift', ['hamstrings', 'glutes', 'back'], 'barbell'],
  ['Dumbbell Romanian Deadlift', ['hamstrings', 'glutes'], 'dumbbell'],
  ['Lying Leg Curl', ['hamstrings'], 'machine'],
  ['Seated Leg Curl', ['hamstrings'], 'machine'],
  ['Good Morning', ['hamstrings', 'back'], 'barbell'],
  ['Nordic Hamstring Curl', ['hamstrings'], 'bodyweight', 'reps_only'],
  // Glutes
  ['Hip Thrust', ['glutes', 'hamstrings'], 'barbell'],
  ['Glute Bridge', ['glutes', 'hamstrings'], 'bodyweight', 'reps_only'],
  ['Sumo Deadlift', ['glutes', 'quads', 'hamstrings', 'back'], 'barbell'],
  ['Cable Kickback', ['glutes'], 'cable'],
  ['Hip Abduction', ['glutes'], 'machine'],
  // Calves
  ['Standing Calf Raise', ['calves'], 'machine'],
  ['Seated Calf Raise', ['calves'], 'machine'],
  ['Single-Leg Calf Raise', ['calves'], 'dumbbell'],
  // Full body & conditioning
  ['Kettlebell Swing', ['full_body', 'glutes', 'hamstrings'], 'kettlebell'],
  ['Turkish Get-Up', ['full_body', 'shoulders', 'core'], 'kettlebell'],
  ['Power Clean', ['full_body', 'back', 'quads'], 'barbell'],
  ['Thruster', ['full_body', 'quads', 'shoulders'], 'barbell'],
  ['Burpee', ['full_body'], 'bodyweight', 'reps_only'],
  ['Rowing Machine', ['full_body'], 'machine', 'duration'],
  ['Stationary Bike', ['quads'], 'machine', 'duration'],
  ['Jump Rope', ['calves', 'full_body'], 'other', 'duration'],
]

export function seedExerciseId(name: string): string {
  return 'ex-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

const SEED_DATE = '2026-01-01T00:00:00.000Z'

export const SEED_EXERCISES: Exercise[] = rows.map(([name, muscleGroups, equipment, tracking]) => ({
  id: seedExerciseId(name),
  name,
  muscleGroups,
  equipment,
  trackingType: tracking ?? 'weight_reps',
  note: '',
  isCustom: false,
  archived: false,
  createdAt: SEED_DATE,
  updatedAt: SEED_DATE,
}))
