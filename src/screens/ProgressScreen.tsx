import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Button } from '../components/Button.tsx'
import { LineChart } from '../components/charts/LineChart.tsx'
import { WeekBars } from '../components/charts/WeekBars.tsx'
import { ChipFilter } from '../components/Chips.tsx'
import { ExercisePicker } from '../components/exercises/ExercisePicker.tsx'
import { Segmented } from '../components/Fields.tsx'
import { formatDate } from '../components/format.ts'
import { EmptyState, Screen } from '../components/Screen.tsx'
import {
  change,
  DEFAULT_SETTINGS,
  formatDuration,
  formatNumber,
  getExerciseHistory,
  getSettings,
  listCompletedStartTimes,
  listExercises,
  listLoggedExercises,
  metricsFor,
  personalRecords,
  pointsInRange,
  progressPoints,
  weeklyCounts,
  type ProgressMetric,
  type TimeRange,
  type WeightUnit,
} from '../data/index.ts'
import styles from './ProgressScreen.module.css'

const QUICK_PICKS = 6
const WEEKS_SHOWN = 8

const METRIC_LABELS: Record<ProgressMetric, string> = {
  topWeight: 'Heaviest',
  bestReps: 'Best reps',
  volume: 'Volume',
  longestDuration: 'Longest',
  totalDuration: 'Total time',
}

const RANGES: { value: TimeRange; label: string }[] = [
  { value: '1m', label: '1M' },
  { value: '3m', label: '3M' },
  { value: '1y', label: '1Y' },
  { value: 'all', label: 'All' },
]

function formatter(metric: ProgressMetric, unit: WeightUnit) {
  if (metric === 'longestDuration' || metric === 'totalDuration') return { full: formatDuration, tick: formatDuration }
  if (metric === 'bestReps') return { full: (v: number) => `${formatNumber(v)} reps`, tick: formatNumber }
  const compact = (v: number) => (v >= 10_000 ? `${formatNumber(Math.round(v / 100) / 10)}k` : formatNumber(Math.round(v)))
  if (metric === 'volume') return { full: (v: number) => `${formatNumber(Math.round(v))} ${unit}`, tick: compact }
  return { full: (v: number) => `${formatNumber(v)} ${unit}`, tick: formatNumber }
}

export function ProgressScreen() {
  const [params, setParams] = useSearchParams()
  const settings = useLiveQuery(() => getSettings(), [], DEFAULT_SETTINGS)
  const unit = settings.displayUnit
  const logged = useLiveQuery(() => listLoggedExercises(), [])
  const exerciseList = useLiveQuery(() => listExercises(), [])
  const exercises = useMemo(() => new Map((exerciseList ?? []).map((e) => [e.id, e])), [exerciseList])
  const startTimes = useLiveQuery(() => listCompletedStartTimes(), [], [] as string[])
  const [picking, setPicking] = useState(false)
  const [asTable, setAsTable] = useState(false)

  // Choices live in the address, so they survive opening a workout and coming back.
  const exerciseId = params.get('exercise') ?? logged?.[0]?.[0] ?? null
  const exercise = exerciseId ? exercises.get(exerciseId) : undefined
  const range = (['1m', '3m', '1y', 'all'].includes(params.get('range') ?? '') ? params.get('range') : '3m') as TimeRange
  const metrics = metricsFor(exercise?.trackingType ?? 'weight_reps')
  const metric = metrics.includes(params.get('metric') as ProgressMetric) ? (params.get('metric') as ProgressMetric) : metrics[0]

  function set(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(changes)) {
      if (v === null) next.delete(k)
      else next.set(k, v)
    }
    setParams(next, { replace: true })
  }

  // Tagged with the exercise it belongs to: while switching exercises the previous result
  // lingers for a moment and must not be shown as the new one.
  const loaded = useLiveQuery(
    async () => ({ exerciseId, sessions: exerciseId ? await getExerciseHistory(exerciseId) : [] }),
    [exerciseId],
  )
  const history = loaded?.exerciseId === exerciseId ? loaded.sessions : undefined
  const now = new Date()
  const all = history ? progressPoints(history, metric, unit) : []
  const points = pointsInRange(all, range, now)
  const fmt = formatter(metric, unit)
  const delta = change(points)
  const records = history ? personalRecords(history, unit) : null

  if (logged === undefined || exerciseList === undefined) return <Screen title="Progress">{null}</Screen>
  if (logged.length === 0) {
    return (
      <Screen title="Progress">
        <EmptyState title="Nothing to chart yet">Finish a workout and your progress shows up here.</EmptyState>
      </Screen>
    )
  }

  const quick = logged.slice(0, QUICK_PICKS).map(([id]) => id)
  const chips = [...new Set([...(exerciseId && !quick.includes(exerciseId) ? [exerciseId] : []), ...quick])]
    .map((id) => ({ value: id, label: exercises.get(id)?.name ?? '…' }))

  return (
    <Screen title="Progress">
      <section aria-label="Exercise" className={styles.section}>
        <ChipFilter label="Exercise" options={chips} value={exerciseId} onChange={(id) => id && set({ exercise: id, metric: null })} />
        <Button variant="ghost" onClick={() => setPicking(true)}>
          Other exercise…
        </Button>
      </section>

      {exercise && (
        <section aria-label={`${exercise.name} progress`} className={styles.card}>
          <h2 className={styles.title}>{exercise.name}</h2>
          <div className={styles.filters}>
            <Segmented<TimeRange> label="Time range" value={range} options={RANGES} onChange={(r) => set({ range: r })} />
            {metrics.length > 1 && (
              <Segmented<ProgressMetric>
                label="Measure"
                value={metric}
                options={metrics.map((m) => ({ value: m, label: METRIC_LABELS[m] }))}
                onChange={(m) => set({ metric: m })}
              />
            )}
          </div>

          {history === undefined ? null : history.length === 0 ? (
            <EmptyState title="No sessions yet">Log {exercise.name} in a workout to see its progress.</EmptyState>
          ) : points.length === 0 ? (
            <EmptyState title="No sessions in this range">Try a longer time range.</EmptyState>
          ) : (
            <>
              <dl className={styles.stats}>
                <div>
                  <dt>Latest</dt>
                  <dd>{fmt.full(points.at(-1)!.value)}</dd>
                </div>
                <div>
                  <dt>Change</dt>
                  <dd>{delta === null ? '–' : delta === 0 ? 'No change' : `${delta > 0 ? '+' : '−'}${fmt.full(Math.abs(delta))}`}</dd>
                </div>
                <div>
                  <dt>Sessions</dt>
                  <dd>{points.length}</dd>
                </div>
              </dl>

              <LineChart
                points={points}
                format={fmt.full}
                formatTick={fmt.tick}
                label={`${METRIC_LABELS[metric]}, ${exercise.name}`}
              />

              <Button variant="ghost" aria-expanded={asTable} onClick={() => setAsTable((t) => !t)}>
                {asTable ? 'Hide table' : 'Show as table'}
              </Button>
              {asTable && (
                <table className={styles.table}>
                  <caption className={styles.srOnly}>{`${METRIC_LABELS[metric]} per session`}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">{METRIC_LABELS[metric]}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...points].reverse().map((p) => (
                      <tr key={p.workoutId}>
                        <td>
                          <Link to={`/history/${p.workoutId}`}>{formatDate(p.date)}</Link>
                        </td>
                        <td>{fmt.full(p.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}

          {records && Object.values(records).some(Boolean) && (
            <div className={styles.records} role="group" aria-label="Personal records">
              <h3>Personal records</h3>
              <ul>
                {records.heaviestWeight && (
                  <Record label="Heaviest" value={`${formatNumber(records.heaviestWeight.value)} ${unit} × ${records.heaviestWeight.reps}`} entry={records.heaviestWeight} />
                )}
                {records.mostReps && <Record label="Most reps" value={`${records.mostReps.value}`} entry={records.mostReps} />}
                {records.bestVolume && (
                  <Record label="Best volume" value={`${formatNumber(Math.round(records.bestVolume.value))} ${unit}`} entry={records.bestVolume} />
                )}
                {records.longestDuration && (
                  <Record label="Longest" value={formatDuration(records.longestDuration.value)} entry={records.longestDuration} />
                )}
              </ul>
            </div>
          )}
        </section>
      )}

      {startTimes.length > 0 && (
        <section aria-label="Workouts per week" className={styles.card}>
          <h2 className={styles.title}>Workouts per week</h2>
          <WeekBars weeks={weeklyCounts(startTimes, WEEKS_SHOWN, now)} />
        </section>
      )}

      {picking && (
        <ExercisePicker
          mode="single"
          title="Show progress for"
          onCancel={() => setPicking(false)}
          onDone={([e]) => {
            setPicking(false)
            set({ exercise: e.id, metric: null })
          }}
        />
      )}
    </Screen>
  )
}

function Record({ label, value, entry }: { label: string; value: string; entry: { workoutId: string; date: string } }) {
  return (
    <li>
      <Link
        to={`/history/${entry.workoutId}`}
        className={styles.record}
        aria-label={`${label}: ${value}, ${formatDate(entry.date)}`}
      >
        <span className={styles.recordLabel}>{label}</span>
        <span className={styles.recordValue}>{value}</span>
        <span className={styles.recordDate}>{formatDate(entry.date)}</span>
      </Link>
    </li>
  )
}
