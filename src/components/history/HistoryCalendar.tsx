import { useState, type ReactNode } from 'react'
import type { Workout } from '../../data/index.ts'
import { toDateInputValue } from '../format.ts'
import { IconButton } from '../IconButton.tsx'
import { BackIcon, ChevronRightIcon } from '../icons.tsx'
import styles from './HistoryCalendar.module.css'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface Props {
  workouts: Workout[]
  /** How to show the chosen day's workouts. */
  renderDay: (workouts: Workout[], dayLabel: string) => ReactNode
  today?: Date
}

/** Month grid with a dot on every day you trained. Tap a day to see its workouts. */
export function HistoryCalendar({ workouts, renderDay, today = new Date() }: Props) {
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selected, setSelected] = useState<string | null>(null)

  const byDay = new Map<string, Workout[]>()
  // Within a day, earliest first (morning session, then evening).
  for (const w of [...workouts].sort((a, b) => a.startedAt.localeCompare(b.startedAt))) {
    const key = toDateInputValue(w.startedAt)
    byDay.set(key, [...(byDay.get(key) ?? []), w])
  }

  const year = month.getFullYear()
  const m = month.getMonth()
  const daysInMonth = new Date(year, m + 1, 0).getDate()
  const leadingBlanks = (new Date(year, m, 1).getDay() + 6) % 7 // Monday first
  const todayKey = toDateInputValue(today.toISOString())
  const keyFor = (day: number) => `${year}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const monthCount = [...byDay.keys()].filter((k) => k.startsWith(`${year}-${String(m + 1).padStart(2, '0')}`)).reduce(
    (n, k) => n + byDay.get(k)!.length,
    0,
  )
  const monthName = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  function go(delta: number) {
    setMonth(new Date(year, m + delta, 1))
    setSelected(null)
  }

  return (
    <div className={styles.calendar}>
      <div className={styles.header}>
        <IconButton label="Previous month" onClick={() => go(-1)}>
          <BackIcon />
        </IconButton>
        <h2 className={styles.title} aria-live="polite">
          {monthName}
          <span className={styles.count}>
            {monthCount === 0 ? 'No workouts' : `${monthCount} workout${monthCount === 1 ? '' : 's'}`}
          </span>
        </h2>
        <IconButton label="Next month" onClick={() => go(1)}>
          <ChevronRightIcon />
        </IconButton>
      </div>

      <div className={styles.grid} role="group" aria-label={`Days in ${monthName}`}>
        {WEEKDAYS.map((d) => (
          <span key={d} className={styles.weekday} aria-hidden="true">
            {d.slice(0, 1)}
          </span>
        ))}
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <span key={`blank-${i}`} aria-hidden="true" />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1
          const key = keyFor(day)
          const count = byDay.get(key)?.length ?? 0
          const label = new Date(year, m, day).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
          return (
            <button
              key={key}
              type="button"
              className={[
                styles.day,
                count > 0 ? styles.trained : '',
                key === todayKey ? styles.today : '',
                key === selected ? styles.selected : '',
              ].join(' ')}
              aria-label={count > 0 ? `${label}, ${count} workout${count === 1 ? '' : 's'}` : label}
              aria-pressed={key === selected}
              onClick={() => setSelected(key === selected ? null : key)}
            >
              {day}
              {count > 0 && <span className={styles.dot} aria-hidden="true" />}
            </button>
          )
        })}
      </div>

      {selected &&
        renderDay(
          byDay.get(selected) ?? [],
          new Date(`${selected}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }),
        )}
    </div>
  )
}
