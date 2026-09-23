import { useState } from 'react'
import {
  suggestSet,
  type Exercise,
  type PlannedSet,
  type SetEntry,
  type WeightUnit,
  type WorkoutExercise,
} from '../../data/index.ts'
import { ActionSheet } from '../ActionSheet.tsx'
import { Button } from '../Button.tsx'
import { formatSetsSummary } from '../format.ts'
import { IconButton } from '../IconButton.tsx'
import { MoreIcon, PlusIcon } from '../icons.tsx'
import { restOptions } from '../rest.ts'
import styles from './WorkoutExerciseCard.module.css'
import { SetRow, type SetChange } from './SetRow.tsx'

interface CardProps {
  item: WorkoutExercise
  exercise: Exercise | undefined
  index: number
  count: number
  unit: WeightUnit
  /** Completed sets from last time (for this appearance of the exercise). */
  previousSets: SetEntry[]
  plannedSets: PlannedSet[]
  onSetChange: (setId: string, changes: SetChange) => void
  onToggleSet: (set: SetEntry, suggestionIndex: number) => void
  onAddSet: () => void
  onRemoveSet: (setId: string, number: number) => void
  onRestChange: (restSec: number) => void
  onEditNote: () => void
  onReplace: () => void
  onMove: (to: number) => void
  onRemove: () => void
}

export function WorkoutExerciseCard(props: CardProps) {
  const { item, exercise, index, count, unit, previousSets, plannedSets } = props
  const [menuOpen, setMenuOpen] = useState(false)
  const [setMenu, setSetMenu] = useState<{ id: string; number: number } | null>(null)
  const name = exercise?.name ?? 'Unknown exercise'
  const tracking = exercise?.trackingType ?? 'weight_reps'
  const doneCount = item.sets.filter((s) => s.completed).length

  return (
    <li className={styles.card} aria-label={name}>
      <div className={styles.header}>
        <div className={styles.title}>
          <h2 className={styles.name}>{name}</h2>
          <p className={styles.meta}>
            {doneCount}/{item.sets.length} sets
            {previousSets.length > 0 && <> · Last time: {formatSetsSummary(previousSets, unit)}</>}
          </p>
        </div>
        <IconButton label={`More actions for ${name}`} onClick={() => setMenuOpen(true)}>
          <MoreIcon />
        </IconButton>
      </div>

      {exercise?.note && <p className={styles.cue}>{exercise.note}</p>}
      {item.note && (
        <button type="button" className={styles.sessionNote} onClick={props.onEditNote}>
          <strong>Today:</strong> {item.note}
        </button>
      )}

      <div className={styles.columns} data-tracking={tracking} aria-hidden="true">
        <span>Set</span>
        <span>Previous</span>
        {tracking === 'weight_reps' && <span>{unit}</span>}
        {tracking !== 'duration' && <span>Reps</span>}
        {tracking === 'duration' && <span>Time</span>}
        <span />
      </div>
      <ol className={styles.sets} aria-label={`${name} sets`}>
        {item.sets.map((set, i) => (
          <SetRow
            key={set.id}
            set={set}
            number={i + 1}
            tracking={tracking}
            unit={unit}
            previous={previousSets[i]}
            suggestion={suggestSet({ index: i, previousSets, plannedSets, unit, setsAbove: item.sets.slice(0, i) })}
            onChange={(changes) => props.onSetChange(set.id, changes)}
            onToggle={() => props.onToggleSet(set, i)}
            onOptions={() => setSetMenu({ id: set.id, number: i + 1 })}
          />
        ))}
      </ol>

      <div className={styles.footer}>
        <Button variant="ghost" onClick={props.onAddSet}>
          <PlusIcon aria-hidden="true" /> Add set
        </Button>
        <label className={styles.rest}>
          <span>Rest</span>
          <select value={String(item.restSec)} onChange={(e) => props.onRestChange(Number(e.target.value))}>
            {restOptions(item.restSec).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <ActionSheet
        open={menuOpen}
        title={name}
        onClose={() => setMenuOpen(false)}
        actions={[
          { label: item.note ? 'Edit note for today' : 'Add note for today', onSelect: props.onEditNote },
          { label: 'Replace exercise', onSelect: props.onReplace },
          { label: 'Move up', disabled: index === 0, onSelect: () => props.onMove(index - 1) },
          { label: 'Move down', disabled: index === count - 1, onSelect: () => props.onMove(index + 1) },
          { label: 'Remove exercise', destructive: true, onSelect: props.onRemove },
        ]}
      />
      <ActionSheet
        open={setMenu !== null}
        title={setMenu ? `${name} — set ${setMenu.number}` : undefined}
        onClose={() => setSetMenu(null)}
        actions={
          setMenu
            ? [{ label: 'Delete set', destructive: true, onSelect: () => props.onRemoveSet(setMenu.id, setMenu.number) }]
            : []
        }
      />
    </li>
  )
}
