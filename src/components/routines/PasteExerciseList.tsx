import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import {
  listExercises,
  planExerciseList,
  resolveExerciseList,
  type Equipment,
  type ID,
  type MuscleGroup,
  type TrackingType,
} from '../../data/index.ts'
import { Button } from '../Button.tsx'
import { ChipMultiSelect } from '../Chips.tsx'
import pickerStyles from '../exercises/ExercisePicker.module.css'
import { equipmentOptions, muscleOptions, TRACKING_HINT, trackingOptions } from '../exercises/options.ts'
import { GroupField, Segmented, SelectField, TextAreaField } from '../Fields.tsx'
import { plural } from '../format.ts'
import { Modal } from '../Modal.tsx'
import styles from './PasteExerciseList.module.css'

interface PasteExerciseListProps {
  /** Exercise ids in pasted order; new names have already been created. */
  onDone: (exerciseIds: ID[]) => void
  onCancel: () => void
}

/** Full-screen sheet: paste exercise names, one per line, to add them all to a routine. */
export function PasteExerciseList({ onDone, onCancel }: PasteExerciseListProps) {
  const exercises = useLiveQuery(() => listExercises(), [])
  const [text, setText] = useState('')
  const [muscles, setMuscles] = useState<MuscleGroup[]>([])
  const [equipment, setEquipment] = useState<Equipment>('barbell')
  const [tracking, setTracking] = useState<TrackingType>('weight_reps')
  const [muscleError, setMuscleError] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const plan = planExerciseList(text, exercises ?? [])

  async function add() {
    if (saving) return
    // Shown beside the chips, where it can't be missed.
    if (plan.newCount > 0 && muscles.length === 0) return setMuscleError(true)
    setSaving(true)
    setError(null)
    try {
      const { exerciseIds } = await resolveExerciseList(text, { muscleGroups: muscles, equipment, trackingType: tracking })
      onDone(exerciseIds)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the exercises')
      setSaving(false)
    }
  }

  return (
    <Modal className={pickerStyles.overlay} role="dialog" aria-modal="true" aria-label="Paste a list">
      <header className={pickerStyles.header}>
        <Button variant="ghost" disabled={saving} onClick={onCancel}>
          Cancel
        </Button>
        <h1 className={pickerStyles.title}>Paste a list</h1>
        <Button variant="primary" disabled={saving || !exercises || plan.items.length === 0} onClick={() => void add()}>
          Add ({plan.items.length})
        </Button>
      </header>

      <div className={pickerStyles.body}>
        <TextAreaField
          label="Exercise names"
          hint="One per line, in the order you do them."
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          autoCapitalize="words"
          autoFocus
        />

        {plan.items.length > 0 && (
          <section aria-label="Preview">
            <ol className={styles.preview}>
              {plan.items.map((item, i) => (
                <li key={i}>
                  {item.exercise ? item.exercise.name : item.name}
                  {!item.exercise && <span className={styles.badge}>New</span>}
                </li>
              ))}
            </ol>
          </section>
        )}
        {plan.tooLong.length > 0 && (
          <p className={styles.skipped}>
            Skipped {plural(plan.tooLong.length, 'name')} over 60 characters.
          </p>
        )}

        {plan.newCount > 0 && (
          <>
            <p className={styles.intro}>
              {plural(plan.newCount, 'name')} {plan.newCount === 1 ? 'isn’t' : 'aren’t'} in your library yet and
              will be created. Set them up — you can change each one later.
            </p>
            <GroupField
              label="Muscle groups"
              error={muscleError && muscles.length === 0 ? 'Pick at least one muscle group' : null}
            >
              <ChipMultiSelect label="Muscle groups" options={muscleOptions} value={muscles} onChange={setMuscles} />
            </GroupField>
            <SelectField label="Equipment" value={equipment} options={equipmentOptions} onChange={setEquipment} />
            <Segmented label="Track by" value={tracking} options={trackingOptions} onChange={setTracking} hint={TRACKING_HINT} />
          </>
        )}

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
