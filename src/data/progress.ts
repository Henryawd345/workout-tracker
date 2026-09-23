import { sessionMetrics, type ExerciseSession } from './stats.ts'
import type { TrackingType, WeightUnit } from './types.ts'

// Numbers for the Progress tab. Pure functions; `now` is passed in so tests are stable.

export type ProgressMetric = 'topWeight' | 'bestReps' | 'volume' | 'longestDuration' | 'totalDuration'

/** Which measures make sense for an exercise, first = default. */
export function metricsFor(tracking: TrackingType): ProgressMetric[] {
  if (tracking === 'duration') return ['longestDuration', 'totalDuration']
  if (tracking === 'reps_only') return ['bestReps']
  return ['topWeight', 'bestReps', 'volume']
}

export interface ProgressPoint {
  date: string
  value: number
  workoutId: string
}

/** One point per session that has a value for the metric, oldest first. */
export function progressPoints(sessions: ExerciseSession[], metric: ProgressMetric, unit: WeightUnit): ProgressPoint[] {
  const points: ProgressPoint[] = []
  for (const s of [...sessions].sort((a, b) => a.date.localeCompare(b.date))) {
    const m = sessionMetrics(s.sets, unit)
    const done = s.sets.filter((x) => x.completed)
    // 0 is a real value (e.g. bodyweight at 0 kg); only "no such sets" means no point.
    const hasWeighted = done.some((x) => x.weight !== null && x.reps !== null)
    const hasTimed = done.some((x) => x.durationSec !== null)
    const value =
      metric === 'topWeight'
        ? m.topWeight
        : metric === 'bestReps'
          ? m.bestReps
          : metric === 'volume'
            ? hasWeighted ? m.volume : null
            : metric === 'longestDuration'
              ? m.longestDurationSec
              : hasTimed ? m.totalDurationSec : null
    if (value !== null) points.push({ date: s.date, value, workoutId: s.workoutId })
  }
  return points
}

export type TimeRange = '1m' | '3m' | '1y' | 'all'

const RANGE_DAYS: Record<Exclude<TimeRange, 'all'>, number> = { '1m': 31, '3m': 92, '1y': 366 }

/** Start of the range as ISO, or null for "all". */
export function rangeStart(range: TimeRange, now: Date): string | null {
  if (range === 'all') return null
  return new Date(now.getTime() - RANGE_DAYS[range] * 86_400_000).toISOString()
}

export function pointsInRange(points: ProgressPoint[], range: TimeRange, now: Date): ProgressPoint[] {
  const start = rangeStart(range, now)
  return start ? points.filter((p) => p.date >= start) : points
}

/** Change from the first to the last point in view (null with fewer than two points). */
export function change(points: ProgressPoint[]): number | null {
  if (points.length < 2) return null
  return points.at(-1)!.value - points[0].value
}

export interface WeekCount {
  /** Monday 00:00 local, ISO. */
  weekStart: string
  count: number
}

function mondayOf(d: Date): Date {
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7))
  return day
}

/** Workouts per week for the last `weeks` weeks (oldest first), including empty weeks. */
export function weeklyCounts(startedAts: string[], weeks: number, now: Date): WeekCount[] {
  const thisMonday = mondayOf(now)
  const result: WeekCount[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(thisMonday)
    start.setDate(start.getDate() - i * 7)
    result.push({ weekStart: start.toISOString(), count: 0 })
  }
  for (const iso of startedAts) {
    const key = mondayOf(new Date(iso)).toISOString()
    const week = result.find((w) => w.weekStart === key)
    if (week) week.count++
  }
  return result
}

/** "Nice" axis ticks covering [min, max]: 3–6 round numbers. Never below 0 for non-negative data. */
export function niceTicks(min: number, max: number, target = 4): number[] {
  const nonNegative = min >= 0
  if (min === max) {
    const pad = Math.max(1, Math.abs(min) * 0.1)
    min -= pad
    max += pad
  }
  if (nonNegative) min = Math.max(0, min)
  const rough = (max - min) / target
  const mag = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => rough <= s)!
  const start = Math.floor(min / step) * step
  const end = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000)
  return ticks
}
