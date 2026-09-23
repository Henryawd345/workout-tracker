import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { Exercise } from '../../data/index.ts'
import { CheckIcon, ChevronRightIcon } from '../icons.tsx'
import { exerciseSubtitle } from '../labels.ts'
import styles from './ExerciseRow.module.css'

function Content({ exercise }: { exercise: Exercise }) {
  return (
    <span className={styles.text}>
      <span className={styles.name}>{exercise.name}</span>
      <span className={styles.subtitle}>
        {exerciseSubtitle(exercise)}
        {exercise.isCustom && <span className={styles.badge}>Custom</span>}
        {exercise.archived && <span className={styles.badge}>Archived</span>}
      </span>
    </span>
  )
}

/** Rounded box that holds a list of rows. */
export function RowList({ children }: { children: ReactNode }) {
  return <div className={styles.list}>{children}</div>
}

/** Row that opens the exercise (library). */
export function ExerciseLinkRow({ exercise, to }: { exercise: Exercise; to: string }) {
  return (
    <Link to={to} className={styles.row}>
      <Content exercise={exercise} />
      <ChevronRightIcon className={styles.trailing} />
    </Link>
  )
}

interface SelectRowProps {
  exercise: Exercise
  selected: boolean
  onToggle: (exercise: Exercise) => void
}

/** Row that can be ticked (picker). */
export function ExerciseSelectRow({ exercise, selected, onToggle }: SelectRowProps) {
  return (
    <button type="button" className={styles.row} aria-pressed={selected} onClick={() => onToggle(exercise)}>
      <Content exercise={exercise} />
      <span className={styles.tick} aria-hidden="true">
        {selected && <CheckIcon />}
      </span>
    </button>
  )
}
