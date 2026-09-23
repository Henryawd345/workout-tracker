import {
  displayWeight,
  formatDuration,
  formatNumber,
  type SetEntry,
  type Suggestion,
  type TrackingType,
  type WeightUnit,
} from '../../data/index.ts'
import { formatSetShort } from '../format.ts'
import { CheckIcon } from '../icons.tsx'
import { DurationInput, NumberInput } from '../NumberInput.tsx'
import { setFieldId } from './setFieldId.ts'
import styles from './SetRow.module.css'

export type SetChange = Partial<Pick<SetEntry, 'weight' | 'weightUnit' | 'reps' | 'durationSec'>>

interface SetRowProps {
  set: SetEntry
  number: number
  tracking: TrackingType
  unit: WeightUnit
  /** Same set last time, for the "Previous" column. */
  previous: SetEntry | undefined
  suggestion: Suggestion
  onChange: (changes: SetChange) => void
  onToggle: () => void
  onOptions: () => void
}

export function SetRow({ set, number, tracking, unit, previous, suggestion, onChange, onToggle, onOptions }: SetRowProps) {
  const label = `Set ${number}`
  const suggestedWeight =
    suggestion.weight === null ? '' : formatNumber(displayWeight(suggestion.weight, suggestion.weightUnit, unit))

  return (
    <li className={set.completed ? `${styles.row} ${styles.done}` : styles.row} data-tracking={tracking}>
      <button type="button" className={styles.number} onClick={onOptions} aria-label={`${label} options`}>
        {number}
      </button>
      <span className={styles.previous} aria-label={previous ? `${label} last time ${formatSetShort(previous, unit)}` : undefined}>
        {previous ? formatSetShort(previous, unit) : '–'}
      </span>

      {tracking === 'weight_reps' && (
        <NumberInput
          id={setFieldId(set.id, 'weight')}
          label={`${label} weight (${unit})`}
          decimals
          placeholder={suggestedWeight}
          value={set.weight === null ? null : displayWeight(set.weight, set.weightUnit, unit)}
          onChange={(weight) => onChange({ weight, weightUnit: unit })}
        />
      )}
      {tracking !== 'duration' && (
        <NumberInput
          id={setFieldId(set.id, 'reps')}
          label={`${label} reps`}
          max={999}
          placeholder={suggestion.reps === null ? '' : String(suggestion.reps)}
          value={set.reps}
          onChange={(reps) => onChange({ reps })}
        />
      )}
      {tracking === 'duration' && (
        <DurationInput
          id={setFieldId(set.id, 'durationSec')}
          label={`${label} time`}
          placeholder={suggestion.durationSec === null ? 'm:ss' : formatDuration(suggestion.durationSec)}
          value={set.durationSec}
          onChange={(durationSec) => onChange({ durationSec })}
        />
      )}

      <button
        type="button"
        className={styles.check}
        aria-pressed={set.completed}
        aria-label={set.completed ? `${label} done — tap to undo` : `Complete ${label.toLowerCase()}`}
        onClick={onToggle}
      >
        <CheckIcon />
      </button>
    </li>
  )
}
