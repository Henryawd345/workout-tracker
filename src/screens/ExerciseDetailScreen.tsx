import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router'
import { BackButton } from '../components/BackButton.tsx'
import { Button } from '../components/Button.tsx'
import { ChipMultiSelect } from '../components/Chips.tsx'
import { ConfirmDialog } from '../components/ConfirmDialog.tsx'
import {
  equipmentOptions,
  muscleOptions,
  TRACKING_HINT,
  trackingOptions,
} from '../components/exercises/options.ts'
import { GroupField, Segmented, SelectField, TextAreaField, TextField } from '../components/Fields.tsx'
import { EQUIPMENT_LABELS, MUSCLE_LABELS, TRACKING_LABELS } from '../components/labels.ts'
import { EmptyState, Screen } from '../components/Screen.tsx'
import {
  getExercise,
  isExerciseLogged,
  MAX_EXERCISE_NAME,
  removeCustomExercise,
  restoreExercise,
  updateExercise,
  type Exercise,
} from '../data/index.ts'
import { useDebouncedSave } from '../hooks/useDebouncedSave.ts'
import styles from './ExerciseDetailScreen.module.css'

export function ExerciseDetailScreen() {
  const { id = '' } = useParams()
  // null = looked up and not found; undefined = still loading
  const exercise = useLiveQuery(async () => (await getExercise(id)) ?? null, [id])
  const logged = useLiveQuery(() => isExerciseLogged(id), [id], false)

  const back = (
    <BackButton fallback="/routines/exercises" label="Back to exercises" />
  )

  if (exercise === undefined) return <Screen title="" leading={back}>{null}</Screen>
  if (exercise === null) {
    return (
      <Screen title="Exercise" leading={back}>
        <EmptyState title="Exercise not found">It may have been deleted.</EmptyState>
      </Screen>
    )
  }
  // key: start with fresh form state if we navigate to another exercise
  return <ExerciseEditor key={exercise.id} exercise={exercise} logged={logged} back={back} />
}

interface EditorProps {
  exercise: Exercise
  logged: boolean
  back: ReactNode
}

function ExerciseEditor({ exercise, logged, back }: EditorProps) {
  const navigate = useNavigate()
  const [name, setName] = useState(exercise.name)
  const [error, setError] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)

  async function save(changes: Parameters<typeof updateExercise>[1]) {
    try {
      await updateExercise(exercise.id, changes)
      setError(null)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
      return false
    }
  }

  async function saveName() {
    if (name.trim() === exercise.name) return setName(exercise.name)
    if (!(await save({ name }))) setName(exercise.name)
  }

  async function remove() {
    setConfirmRemove(false)
    const result = await removeCustomExercise(exercise.id)
    if (result === 'deleted') navigate('/routines/exercises', { replace: true })
  }

  return (
    <Screen title={exercise.name} leading={back}>
      {exercise.archived && (
        <div className={styles.banner}>
          <p>Archived — hidden from the exercise list, but kept in your history.</p>
          <Button
            onClick={() =>
              restoreExercise(exercise.id).then(
                () => setError(null),
                (err: unknown) =>
                  setError(`Can’t restore: ${err instanceof Error ? err.message : 'unknown error'}. Rename it first.`),
              )
            }
          >
            Restore
          </Button>
        </div>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {exercise.isCustom ? (
        <div className={styles.fields}>
          <TextField
            label="Name"
            value={name}
            maxLength={MAX_EXERCISE_NAME}
            autoCapitalize="words"
            enterKeyHint="done"
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
          <GroupField label="Muscle groups" hint="The first one picked is the main muscle.">
            <ChipMultiSelect
              label="Muscle groups"
              options={muscleOptions}
              value={exercise.muscleGroups}
              onChange={(muscleGroups) =>
                muscleGroups.length === 0 ? setError('Keep at least one muscle group') : save({ muscleGroups })
              }
            />
          </GroupField>
          <SelectField
            label="Equipment"
            value={exercise.equipment}
            options={equipmentOptions}
            onChange={(equipment) => save({ equipment })}
          />
          <Segmented
            label="Track by"
            value={exercise.trackingType}
            options={trackingOptions}
            onChange={(trackingType) => save({ trackingType })}
            disabled={logged}
            hint={logged ? 'Locked because this exercise has been logged.' : TRACKING_HINT}
          />
        </div>
      ) : (
        <dl className={styles.facts}>
          <div>
            <dt>Muscles</dt>
            <dd>{exercise.muscleGroups.map((m) => MUSCLE_LABELS[m]).join(', ')}</dd>
          </div>
          <div>
            <dt>Equipment</dt>
            <dd>{EQUIPMENT_LABELS[exercise.equipment]}</dd>
          </div>
          <div>
            <dt>Track by</dt>
            <dd>{TRACKING_LABELS[exercise.trackingType]}</dd>
          </div>
        </dl>
      )}

      <NoteField exerciseId={exercise.id} initial={exercise.note} onError={setError} />
      <p className={styles.hint}>Changes save automatically.</p>

      {exercise.isCustom && !exercise.archived && (
        <>
          <Button variant="danger" block onClick={() => setConfirmRemove(true)}>
            Remove exercise
          </Button>
          <ConfirmDialog
            open={confirmRemove}
            title={`Remove ${exercise.name}?`}
            message="If it’s used in a routine or a past workout it will be archived instead: hidden from the list, but kept where it’s used."
            confirmLabel="Remove"
            destructive
            onConfirm={remove}
            onCancel={() => setConfirmRemove(false)}
          />
        </>
      )}
    </Screen>
  )
}

/** Note that saves shortly after you stop typing, when you leave the field, and when you leave the page. */
function NoteField({
  exerciseId,
  initial,
  onError,
}: {
  exerciseId: string
  initial: string
  onError: (message: string) => void
}) {
  const [note, setNote] = useState(initial)
  const { schedule, flush } = useDebouncedSave((value: string) =>
    updateExercise(exerciseId, { note: value }).catch(() => onError('Could not save the note')),
  )

  return (
    <TextAreaField
      label="Note"
      value={note}
      placeholder="Technique cues, seat height, grip…"
      onChange={(e) => {
        setNote(e.target.value)
        schedule(e.target.value)
      }}
      onBlur={flush}
    />
  )
}
