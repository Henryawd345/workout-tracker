import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { niceTicks, type ProgressPoint } from '../../data/index.ts'
import styles from './Charts.module.css'

interface LineChartProps {
  points: ProgressPoint[]
  /** Formats a value for ticks, labels and the tooltip, e.g. "102.5 kg". */
  format: (value: number) => string
  /** Short tick format (no unit), e.g. "100". */
  formatTick: (value: number) => string
  /** Spoken name of the chart, e.g. "Heaviest weight, Back Squat". */
  label: string
  height?: number
}

const PAD = { top: 16, right: 16, bottom: 28, left: 40 }

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/** Width of the chart's box, following the screen (falls back when not measurable, e.g. tests). */
function useWidth(fallback = 340) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(fallback)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) => entry.contentRect.width > 0 && setWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return { ref, width }
}

/**
 * One series over calendar time: 2px line, 8px dots with a surface ring, hairline grid.
 * Touch/drag or hover snaps a crosshair to the nearest session; arrow keys do the same.
 */
export function LineChart({ points, format, formatTick, label, height = 220 }: LineChartProps) {
  const { ref, width } = useWidth()
  const [active, setActive] = useState<number | null>(null)

  if (points.length === 0) return null

  const times = points.map((p) => Date.parse(p.date))
  const t0 = Math.min(...times)
  const t1 = Math.max(...times)
  const ticks = niceTicks(Math.min(...points.map((p) => p.value)), Math.max(...points.map((p) => p.value)))
  const yMin = ticks[0]
  const yMax = ticks.at(-1)!
  const plotW = width - PAD.left - PAD.right
  const plotH = height - PAD.top - PAD.bottom
  // A single session sits in the middle.
  const x = (t: number) => PAD.left + (t1 === t0 ? plotW / 2 : ((t - t0) / (t1 - t0)) * plotW)
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * plotH
  const coords = points.map((p, i) => ({ x: x(times[i]), y: y(p.value) }))
  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')
  const last = points.length - 1

  function nearest(clientX: number, target: Element) {
    const box = target.getBoundingClientRect()
    const px = ((clientX - box.left) / box.width) * width
    let best = 0
    coords.forEach((c, i) => {
      if (Math.abs(c.x - px) < Math.abs(coords[best].x - px)) best = i
    })
    return best
  }

  function onPointer(e: PointerEvent<SVGSVGElement>) {
    // Keep receiving moves while a finger scrubs past the chart's edge.
    if (e.type === 'pointerdown' && e.pointerType !== 'mouse') e.currentTarget.setPointerCapture?.(e.pointerId)
    setActive(nearest(e.clientX, e.currentTarget))
  }

  function onKey(e: KeyboardEvent<SVGSVGElement>) {
    if (e.key === 'ArrowLeft') setActive((a) => Math.max(0, (a ?? last + 1) - 1))
    else if (e.key === 'ArrowRight') setActive((a) => Math.min(last, (a ?? -1) + 1))
    else if (e.key === 'Escape') setActive(null)
    else return
    e.preventDefault()
  }

  const shown = active ?? null
  const tip = shown !== null ? coords[shown] : null

  return (
    <div ref={ref} className={styles.chart}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`${label}. ${points.length} sessions, latest ${format(points[last].value)}.`}
        tabIndex={0}
        className={styles.svg}
        onPointerDown={onPointer}
        onPointerMove={onPointer}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line className={styles.grid} x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} />
            <text className={styles.tick} x={PAD.left - 6} y={y(t)} dy="0.32em" textAnchor="end">
              {formatTick(t)}
            </text>
          </g>
        ))}
        <text className={styles.tick} x={coords[0].x} y={height - 8} textAnchor={points.length === 1 ? 'middle' : 'start'}>
          {formatShortDate(points[0].date)}
        </text>
        {points.length > 1 && (
          <text className={styles.tick} x={coords[last].x} y={height - 8} textAnchor="end">
            {formatShortDate(points[last].date)}
          </text>
        )}

        {points.length > 1 && <path className={styles.line} d={path} />}
        {tip && <line className={styles.crosshair} x1={tip.x} x2={tip.x} y1={PAD.top} y2={PAD.top + plotH} />}
        {coords.map((c, i) => (
          <circle key={points[i].workoutId} className={styles.dot} cx={c.x} cy={c.y} r={i === shown ? 6 : 4} />
        ))}
      </svg>

      {tip && shown !== null && (
        <div
          className={styles.tooltip}
          style={{ left: Math.min(Math.max(tip.x, 70), width - 70), top: Math.max(tip.y - 60, 0) }}
          role="status"
        >
          <strong>{format(points[shown].value)}</strong>
          <span>{new Date(points[shown].date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
        </div>
      )}
    </div>
  )
}
