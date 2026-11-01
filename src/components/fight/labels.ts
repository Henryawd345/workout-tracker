import { fightPlanExtras, SPORTS, type FightPlan, type Intensity, type Sport } from '../../data/index.ts'

export const SPORT_LABELS: Record<Sport, string> = {
  boxing: 'Boxing',
  muay_thai: 'Muay Thai',
  kickboxing: 'Kickboxing',
  wrestling: 'Wrestling',
}

export const SPORT_BLURBS: Record<Sport, string> = {
  boxing: 'Punch combos with slips, rolls and ducks',
  muay_thai: 'Punches, kicks, knees, elbows and teeps',
  kickboxing: 'Punches and kicks',
  wrestling: 'Shots, sprawls and drill calls',
}

export const INTENSITY_LABELS: Record<Intensity, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
}

export function isSport(value: string | undefined): value is Sport {
  return SPORTS.includes(value as Sport)
}

/** 30 → "30 s", 180 → "3 min", 90 → "1:30" */
export function secLabel(sec: number): string {
  if (sec < 60) return `${sec} s`
  if (sec % 60 === 0) return `${sec / 60} min`
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

/** "Hard", or "Timer only" when the coach doesn't call combos. */
export function styleLabel(plan: FightPlan): string {
  return fightPlanExtras(plan).coachMode === 'timer' ? 'Timer only' : INTENSITY_LABELS[plan.intensity]
}

/** "3 × 3 min · Hard" */
export function planSummary(plan: FightPlan): string {
  return `${plan.rounds} × ${secLabel(plan.roundSec)} · ${styleLabel(plan)}`
}
