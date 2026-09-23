import { useState, type PointerEvent } from 'react'
import type { WeekCount } from '../../data/index.ts'
import styles from './Charts.module.css'

interface WeekBarsProps {
  weeks: WeekCount[]
  height?: number
}

const BAR_MAX = 24

function weekLabel(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/**
 * Workouts per week: columns from one baseline, ≤24px wide with rounded tops. Empty weeks
 * stay visible as gaps — rest is part of training. Tap a column for its week.
 */
export function WeekBars({ weeks, height = 140 }: WeekBarsProps) {
  const [active, setActive] = useState<number | null>(null)
  const max = Math.max(1, ...weeks.map((w) => w.count))
  const plotH = height - 24

  // Touch: drag across the columns to pick a week (columns are narrower than a fingertip).
  function scrub(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'mouse') return
    const box = e.currentTarget.getBoundingClientRect()
    const i = Math.floor(((e.clientX - box.left) / box.width) * weeks.length)
    setActive(Math.min(weeks.length - 1, Math.max(0, i)))
  }

  return (
    <div className={styles.bars} style={{ height }}>
      <div
        className={styles.barRow}
        role="group"
        aria-label="Workouts per week"
        onPointerDown={scrub}
        onPointerMove={(e) => e.buttons > 0 && scrub(e)}
      >
        {weeks.map((w, i) => {
          const h = w.count === 0 ? 0 : Math.max(6, (w.count / max) * plotH)
          const label = `Week of ${weekLabel(w.weekStart)}: ${w.count} workout${w.count === 1 ? '' : 's'}`
          return (
            <button
              key={w.weekStart}
              type="button"
              className={styles.barSlot}
              aria-label={label}
              aria-pressed={active === i}
              onClick={() => setActive(i)}
              onPointerEnter={(e) => e.pointerType === 'mouse' && setActive(i)}
              onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
            >
              {active === i && <span className={styles.barValue}>{w.count}</span>}
              <span
                className={active === i ? `${styles.bar} ${styles.barActive}` : styles.bar}
                style={{ height: h, maxWidth: BAR_MAX }}
              />
            </button>
          )
        })}
      </div>
      <div className={styles.barAxis} aria-hidden="true">
        <span>{weekLabel(weeks[0].weekStart)}</span>
        <span>This week</span>
      </div>
      {active !== null && (
        <p className={styles.barCaption} role="status">
          Week of {weekLabel(weeks[active].weekStart)}: {weeks[active].count} workout{weeks[active].count === 1 ? '' : 's'}
        </p>
      )}
    </div>
  )
}
