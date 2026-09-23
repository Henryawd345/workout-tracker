import { useEffect, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router'
import { ActionSheet } from '../components/ActionSheet.tsx'
import { Button, ButtonLink } from '../components/Button.tsx'
import { ConfirmDialog } from '../components/ConfirmDialog.tsx'
import { plural } from '../components/format.ts'
import { IconButton } from '../components/IconButton.tsx'
import { ChevronDownIcon, MoreIcon } from '../components/icons.tsx'
import { EmptyState, Screen } from '../components/Screen.tsx'
import { TextDialog } from '../components/TextDialog.tsx'
import { Toast } from '../components/Toast.tsx'
import { restOverAlert } from '../components/workout/alerts.ts'
import { RestTimerBar } from '../components/workout/RestTimerBar.tsx'
import { useWorkoutEditor } from '../components/workout/useWorkoutEditor.ts'
import { WorkoutExerciseList } from '../components/workout/WorkoutExerciseList.tsx'
import {
  discardWorkout,
  EmptyWorkoutError,
  finishWorkout,
  formatDuration,
  getActiveWorkout,
  getSettings,
  listExercises,
  renameWorkout,
  setCounts,
  setWorkoutNote,
  type Exercise,
  type Settings,
  type Workout,
} from '../data/index.ts'
import { useNow } from '../hooks/useNow.ts'
import styles from './ActiveWorkoutScreen.module.css'

export function ActiveWorkoutScreen() {
  // Loaded once. After that this screen owns the workout and saves every change.
  const [loaded, setLoaded] = useState<{ workout: Workout; settings: Settings; exercises: Exercise[] } | null | undefined>(undefined)
  useEffect(() => {
    let cancelled = false
    void Promise.all([getActiveWorkout(), getSettings(), listExercises()]).then(
      ([w, settings, exercises]) => !cancelled && setLoaded(w ? { workout: w, settings, exercises } : null),
    )
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
  return <WorkoutSession key={loaded.workout.id} initial={loaded.workout} settings={loaded.settings} exercises={loaded.exercises} />
}

type Dialog = 'finish-incomplete' | 'finish-empty' | 'discard' | null

function WorkoutSession({ initial, settings, exercises }: { initial: Workout; settings: Settings; exercises: Exercise[] }) {
  const navigate = useNavigate()
  const editor = useWorkoutEditor(initial, {
    // Finished or discarded somewhere else (another tab): nothing left to edit here.
    onStale: () => navigate('/today', { replace: true }),
    restTimer: true,
    settings,
    exercises,
  })
  const { workout, apply, latest } = editor
  const [dialog, setDialog] = useState<Dialog>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [editingNote, setEditingNote] = useState(false)

  async function finish() {
    const { completed, total } = setCounts(workout)
    if (completed === 0) return setDialog('finish-empty')
    if (completed < total) return setDialog('finish-incomplete')
    await doFinish()
  }

  async function doFinish() {
    setDialog(null)
    await editor.flush()
    try {
      await finishWorkout(workout.id)
      navigate(`/workouts/${workout.id}/summary`, { replace: true })
    } catch (err) {
      if (err instanceof EmptyWorkoutError) setDialog('finish-empty')
      else editor.setSaveFailed(true)
    }
  }

  async function doDiscard() {
    setDialog(null)
    editor.cancel()
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
        {editor.saveFailed && (
          <p className={styles.error} role="alert">
            Couldn’t save the last change. It’s still on screen — the next change will try again.
          </p>
        )}
        {workout.note && (
          <button type="button" className={styles.note} onClick={() => setEditingNote(true)}>
            <strong>Note:</strong> {workout.note}
          </button>
        )}
        <WorkoutExerciseList editor={editor} emptyTitle="Empty workout" emptyText="Add the exercises you’re doing today." />
      </main>

      {editingNote && (
        <TextDialog
          title="Workout note"
          initial={workout.note}
          placeholder="How did it feel? Sleep, energy, gym busy…"
          onCancel={() => setEditingNote(false)}
          onDone={(text) => {
            apply(setWorkoutNote(latest.current, text), { immediate: true })
            setEditingNote(false)
          }}
        />
      )}

      <ActionSheet
        open={menuOpen}
        title={workout.name}
        onClose={() => setMenuOpen(false)}
        actions={[
          { label: workout.note ? 'Edit workout note' : 'Add workout note', onSelect: () => setEditingNote(true) },
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
      <Toast toast={editor.toast} onDismiss={() => editor.setToast(null)} />
    </div>
  )
}

/** The only part that updates every second, so the rest of the screen doesn't redraw. */
function WorkoutClock({ startedAt }: { startedAt: string }) {
  const now = useNow(1000)
  return <>{formatDuration(Math.max(0, Math.round((now.getTime() - Date.parse(startedAt)) / 1000)))}</>
}
