import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { ActionSheet } from '../components/ActionSheet.tsx'
import { BackButton } from '../components/BackButton.tsx'
import { Button } from '../components/Button.tsx'
import { ConfirmDialog } from '../components/ConfirmDialog.tsx'
import { ExercisePicker } from '../components/exercises/ExercisePicker.tsx'
import { TextAreaField, TextField } from '../components/Fields.tsx'
import { IconButton } from '../components/IconButton.tsx'
import { MoreIcon, PlusIcon } from '../components/icons.tsx'
import { RoutineExerciseCard } from '../components/routines/RoutineExerciseCard.tsx'
import { EmptyState, Screen } from '../components/Screen.tsx'
import {
  addPlannedSet,
  addRoutineExercises,
  DEFAULT_SETTINGS,
  deleteRoutine,
  duplicateRoutine,
  getRoutine,
  getSettings,
  listExercises,
  moveRoutineExercise,
  removePlannedSet,
  removeRoutineExercise,
  saveRoutine,
  setRoutineExerciseRest,
  StaleRoutineError,
  updatePlannedSet,
  type Routine,
} from '../data/index.ts'
import { useDebouncedSave } from '../hooks/useDebouncedSave.ts'
import styles from './RoutineEditorScreen.module.css'

const back = <BackButton fallback="/routines" label="Back to routines" />

export function RoutineEditorScreen() {
  const { id = '' } = useParams()
  // Loaded once; after that the editor owns the routine and saves it.
  const routine = useLiveQuery(async () => (await getRoutine(id)) ?? null, [id])

  if (routine === undefined) return <Screen title="" leading={back}>{null}</Screen>
  if (routine === null) {
    return (
      <Screen title="Routine" leading={back}>
        <EmptyState title="Routine not found">It may have been deleted.</EmptyState>
      </Screen>
    )
  }
  return <RoutineEditor key={routine.id} initial={routine} />
}

function RoutineEditor({ initial }: { initial: Routine }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const isNew = params.get('new') === '1'
  const [routine, setRoutine] = useState(initial)
  const [picking, setPicking] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const exercises = useLiveQuery(() => listExercises(), [])
  const exerciseById = useMemo(() => new Map((exercises ?? []).map((e) => [e.id, e])), [exercises])
  const settings = useLiveQuery(() => getSettings(), [], DEFAULT_SETTINGS)

  const [saveFailed, setSaveFailed] = useState(false)
  const { schedule, flush, cancel } = useDebouncedSave(
    (r: Routine) =>
      saveRoutine(r).then(
        () => setSaveFailed(false),
        (err: unknown) => {
          // Deleted meanwhile: nothing to save. Anything else: tell the user, keep their edits.
          if (!(err instanceof StaleRoutineError)) setSaveFailed(true)
        },
      ),
    400,
  )

  function update(next: Routine) {
    setRoutine(next)
    schedule(next)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Spoken by VoiceOver while dragging — use exercise names, not internal ids.
  const nameOf = (id: string | number) => {
    const item = routine.exercises.find((e) => e.id === id)
    return (item && exerciseById.get(item.exerciseId)?.name) ?? 'exercise'
  }
  const positionOf = (id: string | number) => routine.exercises.findIndex((e) => e.id === id) + 1
  const accessibility = {
    screenReaderInstructions: {
      draggable: 'To reorder, press Space to pick up, use the arrow keys to move, then press Space to drop.',
    },
    announcements: {
      onDragStart: ({ active }: { active: { id: string | number } }) => `Picked up ${nameOf(active.id)}.`,
      onDragOver: ({ active, over }: { active: { id: string | number }; over: { id: string | number } | null }) =>
        over ? `${nameOf(active.id)} is now at position ${positionOf(over.id)}.` : undefined,
      onDragEnd: ({ active, over }: { active: { id: string | number }; over: { id: string | number } | null }) =>
        over ? `Dropped ${nameOf(active.id)} at position ${positionOf(over.id)}.` : `Dropped ${nameOf(active.id)}.`,
      onDragCancel: ({ active }: { active: { id: string | number } }) => `Cancelled moving ${nameOf(active.id)}.`,
    },
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const from = routine.exercises.findIndex((e) => e.id === active.id)
    const to = routine.exercises.findIndex((e) => e.id === over.id)
    update(moveRoutineExercise(routine, from, to))
  }

  async function duplicate() {
    await flush()
    const copy = await duplicateRoutine(routine.id)
    navigate(`/routines/${copy.id}`, { replace: true })
  }

  async function remove() {
    cancel()
    await deleteRoutine(routine.id)
    navigate('/routines', { replace: true })
  }

  return (
    <Screen
      title={isNew ? 'New routine' : 'Edit routine'}
      leading={back}
      action={
        <IconButton label="Routine actions" onClick={() => setMenuOpen(true)}>
          <MoreIcon />
        </IconButton>
      }
    >
      {saveFailed && (
        <p className={styles.error} role="alert">
          Couldn’t save your last change. It’s still here — keep editing to try again.
        </p>
      )}
      <TextField
        label="Name"
        value={routine.name}
        maxLength={60}
        autoCapitalize="words"
        enterKeyHint="done"
        autoFocus={isNew}
        onFocus={(e) => isNew && e.currentTarget.select()}
        onChange={(e) => update({ ...routine, name: e.target.value })}
        onBlur={flush}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
      <TextAreaField
        label="Note (optional)"
        value={routine.note}
        rows={2}
        placeholder="Goal, warm-up, how to progress…"
        onChange={(e) => update({ ...routine, note: e.target.value })}
        onBlur={flush}
      />

      {routine.exercises.length === 0 ? (
        <EmptyState title="No exercises yet">Add exercises to build this routine.</EmptyState>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
          accessibility={accessibility}
        >
          <SortableContext items={routine.exercises.map((e) => e.id)} strategy={verticalListSortingStrategy}>
            <ol className={styles.exercises} aria-label="Exercises">
              {routine.exercises.map((item, index) => (
                <RoutineExerciseCard
                  key={item.id}
                  item={item}
                  exercise={exerciseById.get(item.exerciseId)}
                  index={index}
                  count={routine.exercises.length}
                  unit={settings.displayUnit}
                  onSetChange={(i, changes) => update(updatePlannedSet(routine, item.id, i, changes))}
                  onAddSet={() => update(addPlannedSet(routine, item.id))}
                  onRemoveSet={(i) => update(removePlannedSet(routine, item.id, i))}
                  onRestChange={(sec) => update(setRoutineExerciseRest(routine, item.id, sec))}
                  onMove={(to) => update(moveRoutineExercise(routine, index, to))}
                  onRemove={() => update(removeRoutineExercise(routine, item.id))}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}

      <Button variant="primary" block onClick={() => setPicking(true)}>
        <PlusIcon aria-hidden="true" /> Add exercises
      </Button>
      <p className={styles.hint}>Changes save automatically. Targets are optional — last session’s numbers are suggested when you train.</p>

      {picking && (
        <ExercisePicker
          mode="multi"
          onCancel={() => setPicking(false)}
          onDone={(picked) => {
            setPicking(false)
            update(addRoutineExercises(routine, picked.map((e) => e.id), settings.defaultRestSec))
          }}
        />
      )}

      <ActionSheet
        open={menuOpen}
        title={routine.name}
        onClose={() => setMenuOpen(false)}
        actions={[
          { label: 'Duplicate', onSelect: () => void duplicate() },
          { label: 'Delete routine', destructive: true, onSelect: () => setConfirmDelete(true) },
        ]}
      />
      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${routine.name || 'routine'}?`}
        message="Past workouts from this routine stay in your history."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          setConfirmDelete(false)
          void remove()
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </Screen>
  )
}
