import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useSearchParams } from 'react-router'
import { Segmented } from '../components/Fields.tsx'
import { formatDate, formatTime, plural } from '../components/format.ts'
import { planSummary, SPORT_LABELS } from '../components/fight/labels.ts'
import { HistoryCalendar } from '../components/history/HistoryCalendar.tsx'
import { ChevronRightIcon } from '../components/icons.tsx'
import { EmptyState, Screen } from '../components/Screen.tsx'
import {
  fightSessionDurationSec,
  formatDuration,
  listCompletedFightSessions,
  listCompletedWorkouts,
  workoutCompletedSetCount,
  workoutDurationSec,
  type FightSession,
  type Workout,
} from '../data/index.ts'
import styles from './HistoryScreen.module.css'

function monthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

/** A row in History: a lifting workout or a fight session. */
type Entry = { kind: 'workout'; id: string; startedAt: string; workout: Workout } | { kind: 'fight'; id: string; startedAt: string; session: FightSession }

function entries(workouts: Workout[], sessions: FightSession[]): Entry[] {
  return [
    ...workouts.map((w): Entry => ({ kind: 'workout', id: w.id, startedAt: w.startedAt, workout: w })),
    ...sessions.map((s): Entry => ({ kind: 'fight', id: s.id, startedAt: s.startedAt, session: s })),
  ]
}

/** Grouped by calendar month (local time), newest month and newest workout first. */
function groupByMonth(workouts: Entry[]): { label: string; workouts: Entry[] }[] {
  const byMonth = new Map<string, Entry[]>()
  for (const w of [...workouts].sort((a, b) => b.startedAt.localeCompare(a.startedAt))) {
    const d = new Date(w.startedAt)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    byMonth.set(key, [...(byMonth.get(key) ?? []), w])
  }
  return [...byMonth.values()].map((list) => ({ label: monthLabel(list[0].startedAt), workouts: list }))
}

function WorkoutRows({ workouts, label }: { workouts: Entry[]; label?: string }) {
  return (
    <ul className={styles.list} aria-label={label}>
      {workouts.map((entry) => (
        <li key={entry.id}>
          {entry.kind === 'workout' ? <WorkoutRow w={entry.workout} /> : <FightRow s={entry.session} />}
        </li>
      ))}
    </ul>
  )
}

function WorkoutRow({ w }: { w: Workout }) {
  return (
    <Link to={`/history/${w.id}`} className={styles.row}>
      <span className={styles.text}>
        <span className={styles.name}>{w.name}</span>
        <span className={styles.meta}>
          {formatDate(w.startedAt)}, {formatTime(w.startedAt)} · {formatDuration(workoutDurationSec(w))} ·{' '}
          {plural(w.exerciseIds.length, 'exercise')} · {plural(workoutCompletedSetCount(w), 'set')}
        </span>
      </span>
      <ChevronRightIcon className={styles.chevron} aria-hidden="true" />
    </Link>
  )
}

function FightRow({ s }: { s: FightSession }) {
  return (
    <Link to={`/history/fight/${s.id}`} className={styles.row}>
      <span className={styles.text}>
        <span className={styles.name}>{SPORT_LABELS[s.sport]}</span>
        <span className={styles.meta}>
          {formatDate(s.startedAt)}, {formatTime(s.startedAt)} · {formatDuration(fightSessionDurationSec(s))} ·{' '}
          {s.completedRounds < s.rounds ? `${s.completedRounds} of ` : ''}
          {planSummary({ ...s, rounds: s.rounds })}
        </span>
      </span>
      <ChevronRightIcon className={styles.chevron} aria-hidden="true" />
    </Link>
  )
}

type View = 'list' | 'calendar'

export function HistoryScreen() {
  const workouts = useLiveQuery(
    async () => entries(await listCompletedWorkouts(), await listCompletedFightSessions()),
    [],
  )
  // The chosen view lives in the address, so coming back from a workout keeps it.
  const [params, setParams] = useSearchParams()
  const view: View = params.get('view') === 'calendar' ? 'calendar' : 'list'

  return (
    <Screen title="History">
      {workouts?.length === 0 && (
        <EmptyState title="No workouts yet">Finished workouts and fight sessions will appear here.</EmptyState>
      )}
      {workouts && workouts.length > 0 && (
        <>
          <Segmented<View>
            label="Show as"
            value={view}
            options={[
              { value: 'list', label: 'List' },
              { value: 'calendar', label: 'Calendar' },
            ]}
            onChange={(v) => setParams(v === 'calendar' ? { view: 'calendar' } : {}, { replace: true })}
          />

          {view === 'calendar' ? (
            <HistoryCalendar
              workouts={workouts}
              renderDay={(dayWorkouts, dayLabel) =>
                dayWorkouts.length === 0 ? (
                  <p className={styles.restDay}>{dayLabel}: rest day.</p>
                ) : (
                  <WorkoutRows workouts={dayWorkouts} label={`Workouts on ${dayLabel}`} />
                )
              }
            />
          ) : (
            groupByMonth(workouts).map((group) => (
              <section key={group.label} aria-label={group.label} className={styles.month}>
                <h2 className={styles.monthLabel}>
                  {group.label} <span>· {plural(group.workouts.length, 'workout')}</span>
                </h2>
                <WorkoutRows workouts={group.workouts} />
              </section>
            ))
          )}
        </>
      )}
    </Screen>
  )
}
