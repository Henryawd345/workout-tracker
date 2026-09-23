import { useState, type FormEvent } from 'react'
import {
  createCustomExercise,
  MAX_EXERCISE_NAME,
  type Equipment,
  type Exercise,
  type MuscleGroup,
  type TrackingType,
} from '../../data/index.ts'
import { Button } from '../Button.tsx'
import { ChipMultiSelect } from '../Chips.tsx'
import { GroupField, Segmented, SelectField, TextAreaField, TextField } from '../Fields.tsx'
import styles from './ExerciseForm.module.css'
import { equipmentOptions, muscleOptions, TRACKING_HINT, trackingOptions } from './options.ts'

interface ExerciseFormProps {
  initialName?: string
  onCreated: (exercise: Exercise) => void
  onCancel?: () => void
}

/** Create a custom exercise. */
export function ExerciseForm({ initialName = '', onCreated, onCancel }: ExerciseFormProps) {
  const [name, setName] = useState(initialName)
  const [muscles, setMuscles] = useState<MuscleGroup[]>([])
  const [equipment, setEquipment] = useState<Equipment>('barbell')
  const [tracking, setTracking] = useState<TrackingType>('weight_reps')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const exercise = await createCustomExercise({
        name,
        muscleGroups: muscles,
        equipment,
        trackingType: tracking,
        note,
      })
      onCreated(exercise)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the exercise')
      setSaving(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <TextField
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={MAX_EXERCISE_NAME}
        autoCapitalize="words"
        autoFocus={!initialName}
        enterKeyHint="done"
      />
      <GroupField label="Muscle groups" hint="Pick the main one first.">
        <ChipMultiSelect label="Muscle groups" options={muscleOptions} value={muscles} onChange={setMuscles} />
      </GroupField>
      <SelectField label="Equipment" value={equipment} options={equipmentOptions} onChange={setEquipment} />
      <Segmented label="Track by" value={tracking} options={trackingOptions} onChange={setTracking} hint={TRACKING_HINT} />
      <TextAreaField
        label="Note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Technique cues, machine settings…"
      />

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.actions}>
        {onCancel && <Button onClick={onCancel}>Cancel</Button>}
        <Button type="submit" variant="primary" disabled={saving} block={!onCancel}>
          Create exercise
        </Button>
      </div>
    </form>
  )
}
