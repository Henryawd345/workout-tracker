import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { BackButton } from '../components/BackButton.tsx'
import { Button } from '../components/Button.tsx'
import { ChipMultiSelect } from '../components/Chips.tsx'
import { GroupField, Segmented, SelectField, TextAreaField } from '../components/Fields.tsx'
import { plural } from '../components/format.ts'
import styles from '../components/exercises/ExerciseForm.module.css'
import { equipmentOptions, muscleOptions, TRACKING_HINT, trackingOptions } from '../components/exercises/options.ts'
import { Screen } from '../components/Screen.tsx'
import {
  importExercises,
  listExercises,
  MAX_EXERCISE_NAME,
  planExerciseImport,
  type Equipment,
  type ExerciseImportPlan,
  type MuscleGroup,
  type TrackingType,
} from '../data/index.ts'

const SKIP_REASONS: Record<ExerciseImportPlan['skipped'][number]['reason'], string> = {
  exists: 'already in your library',
  duplicate: 'listed twice',
  too_long: `over ${MAX_EXERCISE_NAME} characters`,
}

/** Paste a list of names (one per line) to create many custom exercises at once. */
export function ExerciseImportScreen() {
  const navigate = useNavigate()
  const exercises = useLiveQuery(() => listExercises(), [])
  const [text, setText] = useState('')
  const [muscles, setMuscles] = useState<MuscleGroup[]>([])
  const [equipment, setEquipment] = useState<Equipment>('barbell')
  const [tracking, setTracking] = useState<TrackingType>('weight_reps')
  const [error, setError] = useState<string | null>(null)
  const [muscleError, setMuscleError] = useState(false)
  const [saving, setSaving] = useState(false)

  const plan = planExerciseImport(text, exercises ?? [])
  const count = plan.toAdd.length

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (saving) return
    // Shown beside the chips, not at the bottom of the form where it may be off-screen.
    if (muscles.length === 0) return setMuscleError(true)
    setSaving(true)
    setError(null)
    try {
      const { added } = await importExercises(text, { muscleGroups: muscles, equipment, trackingType: tracking })
      navigate('/routines/exercises', { replace: true, state: { imported: added.length } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import the exercises')
      setSaving(false)
    }
  }

  return (
    <Screen title="Import exercises" leading={<BackButton fallback="/routines/exercises" label="Back to exercises" />}>
      <form className={styles.form} onSubmit={submit} noValidate>
        <TextAreaField
          label="Exercise names"
          hint="One per line. Paste from Notes or a spreadsheet column."
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          autoCapitalize="words"
          autoFocus
        />
        <GroupField
          label="Muscle groups"
          hint="Used for every exercise in the list — you can change each one later."
          error={muscleError && muscles.length === 0 ? 'Pick at least one muscle group' : null}
        >
          <ChipMultiSelect label="Muscle groups" options={muscleOptions} value={muscles} onChange={setMuscles} />
        </GroupField>
        <SelectField label="Equipment" value={equipment} options={equipmentOptions} onChange={setEquipment} />
        <Segmented label="Track by" value={tracking} options={trackingOptions} onChange={setTracking} hint={TRACKING_HINT} />

        {plan.skipped.length > 0 && (
          <section aria-label="Skipped">
            <p>{plural(plan.skipped.length, 'name')} will be skipped:</p>
            <ul style={{ overflowWrap: 'anywhere' }}>
              {plan.skipped.map((s, i) => (
                <li key={i}>
                  {s.name.length > MAX_EXERCISE_NAME ? `${s.name.slice(0, MAX_EXERCISE_NAME)}…` : s.name} —{' '}
                  {SKIP_REASONS[s.reason]}
                </li>
              ))}
            </ul>
          </section>
        )}

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" disabled={saving || !exercises || count === 0} block>
          {count === 0 ? 'Import exercises' : `Import ${plural(count, 'exercise')}`}
        </Button>
      </form>
    </Screen>
  )
}
