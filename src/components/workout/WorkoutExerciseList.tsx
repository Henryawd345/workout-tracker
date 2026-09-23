import { useState } from 'react'
import {
  addWorkoutSet,
  insertWorkoutExercise,
  insertWorkoutSet,
  moveWorkoutExercise,
  removeWorkoutExercise,
  removeWorkoutSet,
  replaceWorkoutExercise,
  restoreWorkoutExercise,
  setWorkoutExerciseNote,
  setWorkoutExerciseRest,
  updateWorkoutSet,
  type WorkoutExercise,
} from '../../data/index.ts'
import { Button } from '../Button.tsx'
import { ExercisePicker } from '../exercises/ExercisePicker.tsx'
import { PlusIcon } from '../icons.tsx'
import { EmptyState } from '../Screen.tsx'
import { TextDialog } from '../TextDialog.tsx'
import type { WorkoutEditor } from './useWorkoutEditor.ts'
import { WorkoutExerciseCard } from './WorkoutExerciseCard.tsx'
import styles from './WorkoutExerciseList.module.css'

type Picking = { mode: 'add' } | { mode: 'replace'; item: WorkoutExercise }

interface Props {
  editor: WorkoutEditor
  emptyTitle: string
  emptyText: string
}

/** The exercise cards, "Add exercises", the exercise picker and per-exercise notes. */
export function WorkoutExerciseList({ editor, emptyTitle, emptyText }: Props) {
  const { workout, apply, showUndo, unit, exercises, nameOf } = editor
  const [picking, setPicking] = useState<Picking | null>(null)
  const [noteFor, setNoteFor] = useState<WorkoutExercise | null>(null)

  return (
    <>
      {workout.exercises.length === 0 ? (
        <EmptyState title={emptyTitle}>{emptyText}</EmptyState>
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
              previousSets={editor.previousFor(item)}
              plannedSets={editor.plannedFor(item)}
              onSetChange={(setId, changes) => apply(updateWorkoutSet(workout, item.id, setId, changes))}
              onToggleSet={(set, i) => editor.toggleSet(item, set, i)}
              onAddSet={() => apply(addWorkoutSet(workout, item.id, unit))}
              onRemoveSet={(setId, number) => {
                const removed = item.sets.find((s) => s.id === setId)!
                apply(removeWorkoutSet(workout, item.id, setId), { immediate: true })
                showUndo(`Set ${number} deleted`, (w) => insertWorkoutSet(w, item.id, removed, number - 1))
              }}
              onRestChange={(sec) => apply(setWorkoutExerciseRest(workout, item.id, sec))}
              onEditNote={() => setNoteFor(item)}
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

      {picking && (
        <ExercisePicker
          mode={picking.mode === 'add' ? 'multi' : 'single'}
          title={picking.mode === 'replace' ? `Replace ${nameOf(picking.item)}` : undefined}
          onCancel={() => setPicking(null)}
          onDone={(picked) => {
            setPicking(null)
            if (picking.mode === 'add') return void editor.addExercises(picked.map((e) => e.id))
            const before = picking.item
            apply(replaceWorkoutExercise(workout, before.id, picked[0].id, unit), { immediate: true })
            showUndo(`${nameOf(before)} replaced with ${picked[0].name}`, (w) => restoreWorkoutExercise(w, before))
          }}
        />
      )}

      {noteFor && (
        <TextDialog
          title={`${nameOf(noteFor)} — today`}
          initial={noteFor.note}
          placeholder="Grip, tempo, felt heavy…"
          onCancel={() => setNoteFor(null)}
          onDone={(text) => {
            apply(setWorkoutExerciseNote(editor.latest.current, noteFor.id, text), { immediate: true })
            setNoteFor(null)
          }}
        />
      )}
    </>
  )
}
