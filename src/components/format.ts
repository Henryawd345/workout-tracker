import { displayWeight, formatDuration, formatNumber, type SetEntry, type WeightUnit } from '../data/index.ts'

// Wording shown on screen. `now` is a parameter so tests are stable.

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** Whole calendar days from `iso` to `now` (0 = same day). */
export function daysAgo(iso: string, now: Date = new Date()): number {
  return Math.round((startOfDay(now) - startOfDay(new Date(iso))) / 86_400_000)
}

/** Monday 00:00 (local time) of the week containing `now`, as ISO. */
export function startOfWeekIso(now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const daysSinceMonday = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - daysSinceMonday)
  return d.toISOString()
}

/** "Today", "Yesterday", "3 days ago", then "Mon 5 Sep" (plus the year if not this year). */
export function formatRelativeDay(iso: string, now: Date = new Date()): string {
  const days = daysAgo(iso, now)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days > 1 && days < 7) return `${days} days ago`
  return formatDate(iso, now)
}

/** "Mon 5 Sep", or "Mon 5 Sep 2025" for another year. */
export function formatDate(iso: string, now: Date = new Date()): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  })
}

/** "14:05" or "2:05 PM" depending on the phone's settings. */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

/** One set, short: "80×8", "12 reps", "1:00". Weight in the display unit, no unit label. */
export function formatSetShort(set: SetEntry, unit: WeightUnit): string {
  if (set.durationSec !== null && set.reps === null) return formatDuration(set.durationSec)
  if (set.weight !== null && set.reps !== null) {
    return `${formatNumber(displayWeight(set.weight, set.weightUnit, unit))}×${set.reps}`
  }
  if (set.reps !== null) return `${set.reps} reps`
  return '–'
}

/**
 * Several sets, e.g. the "Last time" line:
 * "80 kg × 8, 8, 7" when the weight didn't change, else "80×8, 85×5 kg";
 * "12, 10, 8 reps"; "1:00, 0:45".
 */
export function formatSetsSummary(sets: SetEntry[], unit: WeightUnit): string {
  if (sets.length === 0) return ''
  if (sets.every((s) => s.weight !== null && s.reps !== null)) {
    const weights = sets.map((s) => displayWeight(s.weight!, s.weightUnit, unit))
    if (weights.every((w) => w === weights[0])) {
      return `${formatNumber(weights[0])} ${unit} × ${sets.map((s) => s.reps).join(', ')}`
    }
    return `${sets.map((s) => formatSetShort(s, unit)).join(', ')} ${unit}`
  }
  if (sets.every((s) => s.durationSec !== null && s.reps === null)) {
    return sets.map((s) => formatDuration(s.durationSec!)).join(', ')
  }
  if (sets.every((s) => s.reps !== null && s.weight === null)) {
    return `${sets.map((s) => s.reps).join(', ')} reps`
  }
  return sets.map((s) => formatSetShort(s, unit)).join(', ')
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}
