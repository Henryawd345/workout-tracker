import type { WeightUnit } from './types.ts'

/** Exact, by international definition. */
export const KG_PER_LB = 0.45359237

/** Converts without rounding. Stored values are never converted — only what is shown. */
export function convertWeight(value: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return value
  return from === 'lb' ? value * KG_PER_LB : value / KG_PER_LB
}

/** Rounds to 1 decimal place, avoiding float noise like 20.400000000000002. */
export function round1(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10
}

/** Converts for display: e.g. (100, 'lb', 'kg') → 45.4. */
export function displayWeight(value: number, from: WeightUnit, displayUnit: WeightUnit): number {
  return round1(convertWeight(value, from, displayUnit))
}

/** "102.5", "100" — no trailing ".0". */
export function formatNumber(value: number): string {
  return String(round1(value))
}

/** "45.4 kg" */
export function formatWeight(value: number, from: WeightUnit, displayUnit: WeightUnit): string {
  return `${formatNumber(displayWeight(value, from, displayUnit))} ${displayUnit}`
}

/**
 * Reads a time typed by the user: "90" (seconds), "1:30", "1:02:03".
 * Returns null for empty or invalid input.
 */
export function parseDuration(text: string): number | null {
  const t = text.trim()
  if (!t) return null
  if (!/^\d+(:\d{1,2}){0,2}$/.test(t)) return null
  const parts = t.split(':').map(Number)
  if (parts.slice(1).some((p) => p >= 60)) return null
  const total = parts.reduce((sum, p) => sum * 60 + p, 0)
  return total > 0 ? total : null
}

/** 75 → "1:15", 3600 → "1:00:00" */
export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}
