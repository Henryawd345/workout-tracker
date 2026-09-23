import styles from './Chips.module.css'

export interface ChipOption<T extends string> {
  value: T
  label: string
}

interface ChipFilterProps<T extends string> {
  /** Read by screen readers, e.g. "Muscle group". */
  label: string
  /** Text of the first chip, e.g. "All muscles". Leave out for a choice with no "all". */
  allLabel?: string
  options: ChipOption<T>[]
  value: T | null
  onChange: (value: T | null) => void
}

/** One-line, sideways-scrolling filter. The first chip clears it. */
export function ChipFilter<T extends string>({ label, allLabel, options, value, onChange }: ChipFilterProps<T>) {
  return (
    <div className={styles.scroller} role="group" aria-label={label}>
      {allLabel && (
        <button type="button" className={styles.chip} aria-pressed={value === null} onClick={() => onChange(null)}>
          {allLabel}
        </button>
      )}
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={styles.chip}
          aria-pressed={value === o.value}
          onClick={() => onChange(value === o.value && allLabel ? null : o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

interface ChipMultiSelectProps<T extends string> {
  label: string
  options: ChipOption<T>[]
  value: T[]
  onChange: (value: T[]) => void
}

/** Wrapping chips where several can be on. Keeps the order they were picked in. */
export function ChipMultiSelect<T extends string>({ label, options, value, onChange }: ChipMultiSelectProps<T>) {
  return (
    <div className={styles.wrap} role="group" aria-label={label}>
      {options.map((o) => {
        const on = value.includes(o.value)
        return (
          <button
            key={o.value}
            type="button"
            className={styles.chip}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
