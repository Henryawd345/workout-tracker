import { formatDuration } from '../data/index.ts'

const COMMON_REST_SEC = [0, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300]

/** Rest-time choices for a select, always including the current value. */
export function restOptions(current: number) {
  const values = COMMON_REST_SEC.includes(current)
    ? COMMON_REST_SEC
    : [...COMMON_REST_SEC, current].sort((a, b) => a - b)
  return values.map((s) => ({ value: String(s), label: s === 0 ? 'No rest' : formatDuration(s) }))
}
