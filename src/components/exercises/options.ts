import { EQUIPMENT, MUSCLE_GROUPS, type Equipment, type MuscleGroup } from '../../data/index.ts'
import { EQUIPMENT_LABELS, MUSCLE_LABELS, TRACKING_LABELS } from '../labels.ts'

export const muscleOptions = MUSCLE_GROUPS.map((m) => ({ value: m, label: MUSCLE_LABELS[m] }))
export const equipmentOptions = EQUIPMENT.map((e) => ({ value: e, label: EQUIPMENT_LABELS[e] }))
export const trackingOptions = (['weight_reps', 'reps_only', 'duration'] as const).map((t) => ({
  value: t,
  label: TRACKING_LABELS[t],
}))

export const TRACKING_HINT = 'Weight & reps: bench press. Reps only: pull-ups. Time: plank.'

export interface BrowserFilter {
  query: string
  muscle: MuscleGroup | null
  equipment: Equipment | null
}

export const EMPTY_FILTER: BrowserFilter = { query: '', muscle: null, equipment: null }
