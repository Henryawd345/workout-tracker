// Date and time wording shown on screen. `now` is a parameter so tests are stable.

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** Whole calendar days from `iso` to `now` (0 = same day). */
export function daysAgo(iso: string, now: Date = new Date()): number {
  return Math.round((startOfDay(now) - startOfDay(new Date(iso))) / 86_400_000)
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

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}
