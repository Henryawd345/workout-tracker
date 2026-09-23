import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import styles from './Fields.module.css'

interface FieldProps {
  label: string
  error?: string | null
  hint?: string
  children: (id: string, describedBy: string | undefined) => ReactNode
}

/** Label + control + error/hint text, wired up for screen readers. */
export function Field({ label, error, hint, children }: FieldProps) {
  const id = useId()
  const messageId = `${id}-msg`
  const message = error || hint
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {children(id, message ? messageId : undefined)}
      {message && (
        <p id={messageId} className={error ? styles.error : styles.hint} role={error ? 'alert' : undefined}>
          {message}
        </p>
      )}
    </div>
  )
}

interface GroupFieldProps {
  label: string
  hint?: string
  error?: string | null
  children: ReactNode
}

/** Label + hint around a control that is itself a labelled group (e.g. chips). */
export function GroupField({ label, hint, error, children }: GroupFieldProps) {
  const message = error || hint
  return (
    <div className={styles.field}>
      <span className={styles.label} aria-hidden="true">
        {label}
      </span>
      {children}
      {message && (
        <p className={error ? styles.error : styles.hint} role={error ? 'alert' : undefined}>
          {message}
        </p>
      )}
    </div>
  )
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string
  error?: string | null
  hint?: string
}

export function TextField({ label, error, hint, ...input }: TextFieldProps) {
  return (
    <Field label={label} error={error} hint={hint}>
      {(id, describedBy) => (
        <input id={id} className={styles.input} aria-invalid={!!error} aria-describedby={describedBy} {...input} />
      )}
    </Field>
  )
}

interface TextAreaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string
  hint?: string
}

export function TextAreaField({ label, hint, ...textarea }: TextAreaFieldProps) {
  return (
    <Field label={label} hint={hint}>
      {(id, describedBy) => (
        <textarea id={id} className={styles.textarea} aria-describedby={describedBy} rows={3} {...textarea} />
      )}
    </Field>
  )
}

interface SelectFieldProps<T extends string> {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  disabled?: boolean
  hint?: string
}

/** Native select — on iPhone this opens the familiar scroll wheel. */
export function SelectField<T extends string>({ label, value, options, onChange, disabled, hint }: SelectFieldProps<T>) {
  return (
    <Field label={label} hint={hint}>
      {(id, describedBy) => (
        <select
          id={id}
          className={styles.select}
          value={value}
          disabled={disabled}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value as T)}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  )
}

interface SwitchProps {
  label: string
  hint?: string
  checked: boolean
  onChange: (checked: boolean) => void
}

/** On/off setting (a checkbox that looks like an iPhone switch). */
export function Switch({ label, hint, checked, onChange }: SwitchProps) {
  const id = useId()
  return (
    <div className={styles.switchRow}>
      <label htmlFor={id} className={styles.switchText}>
        <span>{label}</span>
        {hint && <span className={styles.hint}>{hint}</span>}
      </label>
      <input
        id={id}
        type="checkbox"
        role="switch"
        className={styles.switch}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </div>
  )
}

interface SegmentedProps<T extends string> {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  disabled?: boolean
  hint?: string
}

/** A row of mutually exclusive options (radio buttons styled as one control). */
export function Segmented<T extends string>({ label, value, options, onChange, disabled, hint }: SegmentedProps<T>) {
  const name = useId()
  return (
    <fieldset className={styles.fieldset} disabled={disabled}>
      <legend className={styles.label}>{label}</legend>
      <div className={styles.segmented}>
        {options.map((o) => (
          <label key={o.value} className={styles.segment}>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
      {hint && <p className={styles.hint}>{hint}</p>}
    </fieldset>
  )
}
