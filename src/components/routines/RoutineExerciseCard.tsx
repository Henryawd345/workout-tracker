import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState } from 'react'
import {
  displayWeight,
  type Exercise,
  type PlannedSet,
  type RoutineExercise,
  type WeightUnit,
} from '../../data/index.ts'
import { ActionSheet } from '../ActionSheet.tsx'
import { Button } from '../Button.tsx'
import { IconButton } from '../IconButton.tsx'
import { CloseIcon, GripIcon, MoreIcon, PlusIcon } from '../icons.tsx'
import { exerciseSubtitle } from '../labels.ts'
import { DurationInput, NumberInput } from '../NumberInput.tsx'
import { restOptions } from '../rest.ts'
import styles from './RoutineExerciseCard.module.css'

interface CardProps {
  item: RoutineExercise
  exercise: Exercise | undefined
  index: number
  count: number
  unit: WeightUnit
  onSetChange: (setIndex: number, changes: Partial<PlannedSet>) => void
  onAddSet: () => void
  onRemoveSet: (setIndex: number) => void
  onRestChange: (restSec: number) => void
  onMove: (to: number) => void
  onRemove: () => void
}

export function RoutineExerciseCard({
  item,
  exercise,
  index,
  count,
  unit,
  onSetChange,
  onAddSet,
  onRemoveSet,
  onRestChange,
  onMove,
  onRemove,
}: CardProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })
  const [menuOpen, setMenuOpen] = useState(false)
  const name = exercise?.name ?? 'Unknown exercise'
  const tracking = exercise?.trackingType ?? 'weight_reps'

  return (
    <li
      ref={setNodeRef}
      className={isDragging ? `${styles.card} ${styles.dragging}` : styles.card}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      aria-label={name}
    >
      <div className={styles.header}>
        <button
          ref={setActivatorNodeRef}
          type="button"
          className={styles.handle}
          aria-label={`Reorder ${name}`}
          {...attributes}
          {...listeners}
        >
          <GripIcon />
        </button>
        <div className={styles.title}>
          <h2 className={styles.name}>{name}</h2>
          {exercise && <p className={styles.subtitle}>{exerciseSubtitle(exercise)}</p>}
        </div>
        <IconButton label={`More actions for ${name}`} onClick={() => setMenuOpen(true)}>
          <MoreIcon />
        </IconButton>
      </div>

      <table className={styles.sets}>
        <thead>
          <tr>
            <th scope="col">Set</th>
            {tracking === 'duration' ? (
              <th scope="col">Time</th>
            ) : (
              <>
                <th scope="col">Reps</th>
                {tracking === 'weight_reps' && <th scope="col">{unit}</th>}
              </>
            )}
            <th scope="col">
              <span className={styles.srOnly}>Remove</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {item.sets.map((set, i) => (
            <tr key={i}>
              <td className={styles.setNumber}>{i + 1}</td>
              {tracking === 'duration' ? (
                <td>
                  <DurationInput
                    label={`Set ${i + 1} target time`}
                    placeholder="–"
                    value={set.targetDurationSec ?? null}
                    onChange={(v) => onSetChange(i, { targetDurationSec: v ?? undefined })}
                  />
                </td>
              ) : (
                <>
                  <td>
                    <NumberInput
                      label={`Set ${i + 1} target reps`}
                      placeholder="–"
                      max={999}
                      value={set.targetReps ?? null}
                      onChange={(v) => onSetChange(i, { targetReps: v ?? undefined })}
                    />
                  </td>
                  {tracking === 'weight_reps' && (
                    <td>
                      <NumberInput
                        label={`Set ${i + 1} target weight (${unit})`}
                        placeholder="–"
                        decimals
                        value={
                          set.targetWeight === undefined
                            ? null
                            : displayWeight(set.targetWeight, set.targetWeightUnit ?? unit, unit)
                        }
                        onChange={(v) =>
                          onSetChange(i, {
                            targetWeight: v ?? undefined,
                            targetWeightUnit: v === null ? undefined : unit,
                          })
                        }
                      />
                    </td>
                  )}
                </>
              )}
              <td className={styles.removeCell}>
                <IconButton
                  label={`Remove set ${i + 1}`}
                  disabled={item.sets.length <= 1}
                  onClick={() => onRemoveSet(i)}
                >
                  <CloseIcon />
                </IconButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className={styles.footer}>
        <Button variant="ghost" onClick={onAddSet}>
          <PlusIcon aria-hidden="true" /> Add set
        </Button>
        <label className={styles.rest}>
          <span>Rest</span>
          <select value={String(item.restSec)} onChange={(e) => onRestChange(Number(e.target.value))}>
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
          { label: 'Move up', disabled: index === 0, onSelect: () => onMove(index - 1) },
          { label: 'Move down', disabled: index === count - 1, onSelect: () => onMove(index + 1) },
          { label: 'Remove from routine', destructive: true, onSelect: onRemove },
        ]}
      />
    </li>
  )
}
