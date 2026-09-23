import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ActionSheet } from '../components/ActionSheet.tsx'
import { Button, ButtonLink } from '../components/Button.tsx'
import { ConfirmDialog } from '../components/ConfirmDialog.tsx'
import { formatRelativeDay, plural } from '../components/format.ts'
import { IconButton } from '../components/IconButton.tsx'
import { MoreIcon, PlusIcon } from '../components/icons.tsx'
import { EmptyState, Screen } from '../components/Screen.tsx'
import {
  ActiveWorkoutExistsError,
  createRoutine,
  deleteRoutine,
  duplicateRoutine,
  getRoutinesLastPerformed,
  listRoutines,
  startWorkout,
  type Routine,
} from '../data/index.ts'
import styles from './RoutinesScreen.module.css'

export function RoutinesScreen() {
  const navigate = useNavigate()
  const routines = useLiveQuery(() => listRoutines(), [])
  const lastDone = useLiveQuery(() => getRoutinesLastPerformed(), [], {} as Record<string, string>)
  const [menuFor, setMenuFor] = useState<Routine | null>(null)
  const [deleting, setDeleting] = useState<Routine | null>(null)

  async function startFrom(routineId: string) {
    try {
      await startWorkout({ routineId })
    } catch (err) {
      // One workout at a time: resume the one in progress instead.
      if (!(err instanceof ActiveWorkoutExistsError)) throw err
    }
    navigate('/workout')
  }

  async function create() {
    const routine = await createRoutine('New routine')
    navigate(`/routines/${routine.id}?new=1`)
  }

  return (
    <Screen
      title="Routines"
      action={
        <ButtonLink to="/routines/exercises" variant="ghost">
          Exercises
        </ButtonLink>
      }
    >
      <Button variant="primary" block onClick={create}>
        <PlusIcon aria-hidden="true" /> New routine
      </Button>

      {routines?.length === 0 && (
        <EmptyState title="No routines yet">
          A routine is a saved workout plan — exercises in order, with sets, reps and rest times.
        </EmptyState>
      )}

      {routines && routines.length > 0 && (
        <ul className={styles.list} aria-label="Routines">
          {routines.map((r) => (
            <li key={r.id} className={styles.item}>
              <Link to={`/routines/${r.id}`} className={styles.link}>
                <span className={styles.name}>{r.name}</span>
                <span className={styles.meta}>
                  {plural(r.exercises.length, 'exercise')}
                  {lastDone[r.id] ? ` · Last done: ${formatRelativeDay(lastDone[r.id])}` : ''}
                </span>
              </Link>
              <IconButton label={`More actions for ${r.name}`} onClick={() => setMenuFor(r)}>
                <MoreIcon />
              </IconButton>
            </li>
          ))}
        </ul>
      )}

      <ActionSheet
        open={menuFor !== null}
        title={menuFor?.name}
        onClose={() => setMenuFor(null)}
        actions={
          menuFor
            ? [
                {
                  label: 'Start workout',
                  disabled: menuFor.exercises.length === 0,
                  onSelect: () => void startFrom(menuFor.id),
                },
                { label: 'Edit', onSelect: () => navigate(`/routines/${menuFor.id}`) },
                { label: 'Duplicate', onSelect: () => void duplicateRoutine(menuFor.id) },
                { label: 'Delete', destructive: true, onSelect: () => setDeleting(menuFor) },
              ]
            : []
        }
      />
      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleting?.name ?? 'routine'}?`}
        message="Past workouts from this routine stay in your history."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (deleting) void deleteRoutine(deleting.id)
          setDeleting(null)
        }}
        onCancel={() => setDeleting(null)}
      />
    </Screen>
  )
}
