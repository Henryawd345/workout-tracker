import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { listExercises, listRecentExerciseIds, type Exercise } from '../../data/index.ts'
import { Button } from '../Button.tsx'
import { Modal } from '../Modal.tsx'
import { ExerciseBrowser } from './ExerciseBrowser.tsx'
import { ExerciseForm } from './ExerciseForm.tsx'
import styles from './ExercisePicker.module.css'
import { ExerciseSelectRow } from './ExerciseRow.tsx'
import { EMPTY_FILTER, type BrowserFilter } from './options.ts'

interface ExercisePickerProps {
  /**
   * 'multi': tick several, then "Add (n)" — adding to a routine or workout.
   * 'single': the first tap chooses — replacing an exercise.
   */
  mode: 'single' | 'multi'
  title?: string
  onDone: (exercises: Exercise[]) => void
  onCancel: () => void
}

/** Full-screen exercise chooser. Also lets you create a custom exercise without leaving. */
export function ExercisePicker({ mode, title, onDone, onCancel }: ExercisePickerProps) {
  const exercises = useLiveQuery(() => listExercises(), [])
  const recentIds = useLiveQuery(() => listRecentExerciseIds(), [], [])
  const [filter, setFilter] = useState<BrowserFilter>(EMPTY_FILTER)
  const [selected, setSelected] = useState<Exercise[]>([])
  const [creatingName, setCreatingName] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  function toggle(exercise: Exercise) {
    if (mode === 'single') return onDone([exercise])
    setSelected((s) => (s.some((x) => x.id === exercise.id) ? s.filter((x) => x.id !== exercise.id) : [...s, exercise]))
  }

  function created(exercise: Exercise) {
    setCreatingName(null)
    setFilter(EMPTY_FILTER)
    if (mode === 'single') return onDone([exercise])
    setSelected((s) => [...s, exercise])
  }

  const heading = creatingName !== null ? 'New exercise' : (title ?? (mode === 'single' ? 'Choose exercise' : 'Add exercises'))

  return (
    <Modal className={styles.overlay} role="dialog" aria-modal="true" aria-label={heading}>
      <header className={styles.header}>
        <Button variant="ghost" onClick={creatingName !== null ? () => setCreatingName(null) : onCancel}>
          {creatingName !== null ? 'Back' : 'Cancel'}
        </Button>
        <h1 className={styles.title}>{heading}</h1>
        {mode === 'multi' && creatingName === null ? (
          <Button variant="primary" disabled={selected.length === 0} onClick={() => onDone(selected)}>
            {selected.length > 0 ? `Add (${selected.length})` : 'Add'}
          </Button>
        ) : (
          <span className={styles.spacer} />
        )}
      </header>

      <div className={styles.body}>
        {creatingName !== null ? (
          <ExerciseForm initialName={creatingName} onCreated={created} onCancel={() => setCreatingName(null)} />
        ) : (
          <>
            <ExerciseBrowser
              exercises={exercises}
              recentIds={recentIds}
              filter={filter}
              onFilterChange={setFilter}
              onCreate={setCreatingName}
              renderRow={(e) => (
                <ExerciseSelectRow exercise={e} selected={selected.some((s) => s.id === e.id)} onToggle={toggle} />
              )}
            />
            <Button block onClick={() => setCreatingName(filter.query.trim())}>
              Create custom exercise
            </Button>
          </>
        )}
      </div>
    </Modal>
  )
}
