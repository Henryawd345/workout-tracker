import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router'
import { ActionSheet } from '../components/ActionSheet.tsx'
import { Button, ButtonLink } from '../components/Button.tsx'
import { ConfirmDialog } from '../components/ConfirmDialog.tsx'
import { ExercisePicker } from '../components/exercises/ExercisePicker.tsx'
import { plural } from '../components/format.ts'
import { IconButton } from '../components/IconButton.tsx'
import { ChevronDownIcon, MoreIcon, PlusIcon } from '../components/icons.tsx'
import { EmptyState, Screen } from '../components/Screen.tsx'
import { TextDialog } from '../components/TextDialog.tsx'
import { Toast, type ToastMessage } from '../components/Toast.tsx'
import { restOverAlert, unlockAudio } from '../components/workout/alerts.ts'
import { RestTimerBar } from '../components/workout/RestTimerBar.tsx'
import { setFieldId } from '../components/workout/setFieldId.ts'
import { WorkoutExerciseCard } from '../components/workout/WorkoutExerciseCard.tsx'
import {
  addWorkoutExercises,
  addWorkoutSet,
  DEFAULT_SETTINGS,
  discardWorkout,
  EmptyWorkoutError,
  finishWorkout,
  formatDuration,
  getActiveWorkout,
  getLastPerformance,
  getRoutine,
  getSettings,
  insertWorkoutExercise,
  insertWorkoutSet,
  listExercises,
  missingFields,
  moveWorkoutExercise,
  occurrenceIndex,
  previousSetsFor,
  removeWorkoutExercise,
  removeWorkoutSet,
  renameWorkout,
  replaceWorkoutExercise,
  restoreWorkoutExercise,
  saveWorkout,
  setCounts,
  setWorkoutExerciseNote,
  setWorkoutExerciseRest,
  setWorkoutNote,
  StaleSaveError,
  startRest,
  suggestSet,
  toggleWorkoutSet,
  updateWorkoutSet,
  type ExerciseSession,
  type ID,
  type SetEntry,
  type Workout,
  type WorkoutExercise,
} from '../data/index.ts'
import { useDebouncedSave } from '../hooks/useDebouncedSave.ts'
import { useNow } from '../hooks/useNow.ts'
import styles from './ActiveWorkoutScreen.module.css'

const DEFAULT_NEW_SETS = 3

export function ActiveWorkoutScreen() {
  // Loaded once. After that this screen owns the workout and saves every change.
  const [loaded, setLoaded] = useState<Workout | null | undefined>(undefined)
  useEffect(() => {
    let cancelled = false
    void getActiveWorkout().then((w) => !cancelled && setLoaded(w ?? null))
    return () => {
      cancelled = true
    }
  }, [])

  if (loaded === undefined) return null
  if (loaded === null) {
    return (
      <Screen title="Workout">
        <EmptyState title="No workout in progress">Start one from the Today tab.</EmptyState>
        <ButtonLink to="/today" variant="primary" block>
          Go to Today
        </ButtonLink>
      </Screen>
    )
  }
  return <WorkoutSession key={loaded.id} initial={loaded} />
}

type Picking = { mode: 'add' } | { mode: 'replace'; item: WorkoutExercise }
type Dialog = 'finish-incomplete' | 'finish-empty' | 'discard' | null
type NoteTarget = { kind: 'workout' } | { kind: 'exercise'; item: WorkoutExercise }

function WorkoutSession({ initial }: { initial: Workout }) {
  const navigate = useNavigate()
  const [workout, setWorkout] = useState(initial)
  // Always the newest workout, for callbacks (like Undo) that run after later changes.
  const latest = useRef(initial)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [picking, setPicking] = useState<Picking | null>(null)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [noteTarget, setNoteTarget] = useState<NoteTarget | null>(null)
  const [saveFailed, setSaveFailed] = useState(false)

  const settings = useLiveQuery(() => getSettings(), [], DEFAULT_SETTINGS)
  const unit = settings.displayUnit
  const exerciseList = useLiveQuery(() => listExercises(), [])
  const exercises = useMemo(() => new Map((exerciseList ?? []).map((e) => [e.id, e])), [exerciseList])
  const routine = useLiveQuery(
    async () => (workout.routineId ? ((await getRoutine(workout.routineId)) ?? null) : null),
    [workout.routineId],
  )

  // "Last time" for every exercise in the workout.
  const exerciseKey = [...new Set(workout.exercises.map((e) => e.exerciseId))].sort().join(',')
  const lastTime = useLiveQuery(
    async () => {
      const ids = exerciseKey ? exerciseKey.split(',') : []
      const sessions = await Promise.all(ids.map((id) => getLastPerformance(id, workout.startedAt)))
      return new Map(ids.map((id, i) => [id, sessions[i]]))
    },
    [exerciseKey, workout.startedAt],
    new Map<ID, ExerciseSession | null>(),
  )

  const { schedule, flush, cancel } = useDebouncedSave(
    (w: Workout) =>
      saveWorkout(w).then(
        () => setSaveFailed(false),
        (err: unknown) => {
          // Finished or discarded somewhere else (another tab): nothing left to edit here.
          if (err instanceof StaleSaveError) navigate('/today', { replace: true })
          else setSaveFailed(true)
        },
      ),
    300,
  )

  /** Every change goes through here: shown at once, saved right after. */
  function apply(next: Workout, options: { immediate?: boolean } = {}) {
    latest.current = next
    setWorkout(next)
    schedule(next)
    if (options.immediate) void flush()
  }

  /**
   * Offers Undo for one action. `reverse` puts back just that action, keeping any later
   * changes — or returns null when that's no longer possible without losing data.
   */
  function showUndo(text: string, reverse: (w: Workout) => Workout | null) {
    setToast({
      id: Date.now(),
      text,
      actionLabel: 'Undo',
      onAction: () => {
        const next = reverse(latest.current)
        if (next) apply(next, { immediate: true })
        else setToast({ id: Date.now(), text: 'Can’t undo — sets were already logged on it' })
      },
    })
  }

  const previousFor = (item: WorkoutExercise): SetEntry[] =>
    previousSetsFor(lastTime.get(item.exerciseId) ?? null, occurrenceIndex(workout, item.id))

  const plannedFor = (item: WorkoutExercise) => {
    if (!routine) return []
    const occurrence = occurrenceIndex(workout, item.id)
    return routine.exercises.filter((e) => e.exerciseId === item.exerciseId)[occurrence]?.sets ?? []
  }

  function toggleSet(item: WorkoutExercise, set: SetEntry, index: number) {
    const tracking = exercises.get(item.exerciseId)?.trackingType ?? 'weight_reps'
    const suggestion = suggestSet({
      index,
      previousSets: previousFor(item),
      plannedSets: plannedFor(item),
      unit,
      setsAbove: item.sets.slice(0, index),
    })
    unlockAudio() // iPhone only allows the end-of-rest beep after a tap
    const next = toggleWorkoutSet(workout, item.id, set.id, suggestion, tracking)
    if (next) {
      const startsRest = !set.completed && settings.autoStartRest && item.restSec > 0
      return apply(startsRest ? { ...next, restTimer: startRest(item.restSec, Date.now()) } : next, { immediate: true })
    }

    // Something is missing: point at it.
    const merged = {
      weight: set.weight ?? suggestion.weight,
      reps: set.reps ?? suggestion.reps,
      durationSec: set.durationSec ?? suggestion.durationSec,
    }
    const field = missingFields(merged, tracking)[0]
    if (field) document.getElementById(setFieldId(set.id, field))?.focus()
    setToast({ id: Date.now(), text: field === 'weight' ? 'Enter a weight first' : field === 'reps' ? 'Enter reps first' : 'Enter a time first' })
  }

  async function addExercises(ids: ID[]) {
    const sessions = await Promise.all(ids.map((id) => getLastPerformance(id, workout.startedAt)))
    const items = ids.map((exerciseId, i) => ({
      exerciseId,
      restSec: settings.defaultRestSec,
      setCount: sessions[i]?.occurrences?.[0]?.length ?? sessions[i]?.sets.length ?? DEFAULT_NEW_SETS,
    }))
    apply(addWorkoutExercises(latest.current, items, unit))
  }

  function nameOf(item: WorkoutExercise) {
    return exercises.get(item.exerciseId)?.name ?? 'exercise'
  }

  async function finish() {
    const { completed, total } = setCounts(workout)
    if (completed === 0) return setDialog('finish-empty')
    if (completed < total) return setDialog('finish-incomplete')
    await doFinish()
  }

  async function doFinish() {
    setDialog(null)
    await flush()
    try {
      await finishWorkout(workout.id)
      navigate(`/workouts/${workout.id}/summary`, { replace: true })
    } catch (err) {
      if (err instanceof EmptyWorkoutError) setDialog('finish-empty')
      else setSaveFailed(true)
    }
  }

  async function doDiscard() {
    setDialog(null)
    cancel()
    await discardWorkout(workout.id)
    navigate('/today', { replace: true })
  }

  const counts = setCounts(workout)
  const incomplete = counts.total - counts.completed

  return (
    <div
      className={styles.screen}
      // Lift the toast above the rest timer while it is showing.
      style={workout.restTimer ? ({ '--toast-offset': '96px' } as CSSProperties) : undefined}
    >
      <header className={styles.header}>
        <IconButton label="Minimise workout" onClick={() => navigate('/today')}>
          <ChevronDownIcon />
        </IconButton>
        <div className={styles.headerText}>
          <input
            className={styles.name}
            aria-label="Workout name"
            value={workout.name}
            maxLength={60}
            enterKeyHint="done"
            onChange={(e) => apply(renameWorkout(workout, e.target.value))}
            onBlur={() => {
              if (!workout.name.trim()) apply(renameWorkout(workout, 'Workout'))
            }}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
          <span className={styles.clock} aria-label="Elapsed time">
            <WorkoutClock startedAt={workout.startedAt} /> · {counts.completed}/{counts.total} sets
          </span>
        </div>
        <IconButton label="Workout actions" onClick={() => setMenuOpen(true)}>
          <MoreIcon />
        </IconButton>
        <Button variant="primary" onClick={() => void finish()}>
          Finish
        </Button>
      </header>

      <main className={styles.body}>
        {saveFailed && (
          <p className={styles.error} role="alert">
            Couldn’t save the last change. It’s still on screen — the next change will try again.
          </p>
        )}
        {workout.note && (
          <button type="button" className={styles.note} onClick={() => setNoteTarget({ kind: 'workout' })}>
            <strong>Note:</strong> {workout.note}
          </button>
        )}

        {workout.exercises.length === 0 ? (
          <EmptyState title="Empty workout">Add the exercises you’re doing today.</EmptyState>
        ) : (
          <ol className={styles.exercises} aria-label="Exercises">
            {workout.exercises.map((item, index) => (
              <WorkoutExerciseCard
                key={item.id}
                item={item}
                exercise={exercises.get(item.exerciseId)}
                index={index}
                count={workout.exercises.length}
                unit={unit}
                previousSets={previousFor(item)}
                plannedSets={plannedFor(item)}
                onSetChange={(setId, changes) => apply(updateWorkoutSet(workout, item.id, setId, changes))}
                onToggleSet={(set, i) => toggleSet(item, set, i)}
                onAddSet={() => apply(addWorkoutSet(workout, item.id, unit))}
                onRemoveSet={(setId, number) => {
                  const removed = item.sets.find((s) => s.id === setId)!
                  apply(removeWorkoutSet(workout, item.id, setId), { immediate: true })
                  showUndo(`Set ${number} deleted`, (w) => insertWorkoutSet(w, item.id, removed, number - 1))
                }}
                onRestChange={(sec) => apply(setWorkoutExerciseRest(workout, item.id, sec))}
                onEditNote={() => setNoteTarget({ kind: 'exercise', item })}
                onReplace={() => setPicking({ mode: 'replace', item })}
                onMove={(to) => apply(moveWorkoutExercise(workout, index, to))}
                onRemove={() => {
                  apply(removeWorkoutExercise(workout, item.id), { immediate: true })
                  showUndo(`${nameOf(item)} removed`, (w) => insertWorkoutExercise(w, item, index))
                }}
              />
            ))}
          </ol>
        )}

        <Button variant="secondary" block onClick={() => setPicking({ mode: 'add' })}>
          <PlusIcon aria-hidden="true" /> Add exercises
        </Button>
      </main>

      {picking && (
        <ExercisePicker
          mode={picking.mode === 'add' ? 'multi' : 'single'}
          title={picking.mode === 'replace' ? `Replace ${nameOf(picking.item)}` : undefined}
          onCancel={() => setPicking(null)}
          onDone={(picked) => {
            setPicking(null)
            if (picking.mode === 'add') return void addExercises(picked.map((e) => e.id))
            const before = picking.item
            apply(replaceWorkoutExercise(workout, before.id, picked[0].id, unit), { immediate: true })
            showUndo(`${nameOf(before)} replaced with ${picked[0].name}`, (w) => restoreWorkoutExercise(w, before))
          }}
        />
      )}

      {noteTarget && (
        <TextDialog
          title={noteTarget.kind === 'workout' ? 'Workout note' : `${nameOf(noteTarget.item)} — today`}
          initial={noteTarget.kind === 'workout' ? workout.note : noteTarget.item.note}
          placeholder={noteTarget.kind === 'workout' ? 'How did it feel? Sleep, energy, gym busy…' : 'Grip, tempo, felt heavy…'}
          onCancel={() => setNoteTarget(null)}
          onDone={(text) => {
            apply(
              noteTarget.kind === 'workout'
                ? setWorkoutNote(workout, text)
                : setWorkoutExerciseNote(workout, noteTarget.item.id, text),
              { immediate: true },
            )
            setNoteTarget(null)
          }}
        />
      )}

      <ActionSheet
        open={menuOpen}
        title={workout.name}
        onClose={() => setMenuOpen(false)}
        actions={[
          { label: workout.note ? 'Edit workout note' : 'Add workout note', onSelect: () => setNoteTarget({ kind: 'workout' }) },
          { label: 'Discard workout', destructive: true, onSelect: () => setDialog('discard') },
        ]}
      />
      <ConfirmDialog
        open={dialog === 'finish-incomplete'}
        title="Finish workout?"
        message={`${plural(incomplete, 'set')} not ticked off will be left out.`}
        confirmLabel="Finish"
        onConfirm={() => void doFinish()}
        onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === 'finish-empty'}
        title="No sets completed"
        message="Tick off at least one set to save this workout — or discard it."
        confirmLabel="Discard"
        destructive
        onConfirm={() => void doDiscard()}
        onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === 'discard'}
        title="Discard workout?"
        message="Everything logged in this workout will be deleted."
        confirmLabel="Discard"
        destructive
        onConfirm={() => void doDiscard()}
        onCancel={() => setDialog(null)}
      />
      {workout.restTimer && (
        <RestTimerBar
          timer={workout.restTimer}
          onChange={(restTimer) => apply({ ...latest.current, restTimer }, { immediate: true })}
          onOver={restOverAlert}
        />
      )}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}

/** The only part that updates every second, so the rest of the screen doesn't redraw. */
function WorkoutClock({ startedAt }: { startedAt: string }) {
  const now = useNow(1000)
  return <>{formatDuration(Math.max(0, Math.round((now.getTime() - Date.parse(startedAt)) / 1000)))}</>
}
