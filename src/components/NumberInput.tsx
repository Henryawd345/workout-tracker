import { useState, type InputHTMLAttributes } from 'react'
import { formatDuration, formatNumber, parseDuration } from '../data/index.ts'
import styles from './NumberInput.module.css'

type BaseProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'inputMode'>

interface NumberInputProps extends BaseProps {
  /** Read by screen readers, e.g. "Set 1 reps". */
  label: string
  value: number | null
  onChange: (value: number | null) => void
  /** Allow decimals (weights). Reps are whole numbers. */
  decimals?: boolean
  max?: number
}

function parse(text: string, decimals: boolean, max: number): number | null | 'invalid' {
  const t = text.trim().replace(',', '.')
  if (t === '') return null
  const ok = decimals ? /^\d*\.?\d*$/.test(t) : /^\d+$/.test(t)
  if (!ok || t === '.') return 'invalid'
  const n = Number(t)
  return Number.isFinite(n) && n <= max ? n : 'invalid'
}

/**
 * Compact numeric field that opens the number keypad on iPhone.
 * Keeps what you type (e.g. "62." on the way to "62.5") and reports valid numbers as you go.
 * Empty = null, so a placeholder (like a suggestion) can show through.
 */
export function NumberInput({
  label,
  value,
  onChange,
  decimals = false,
  max = 9999,
  className,
  ...rest
}: NumberInputProps) {
  const [text, setText] = useState(value === null ? '' : formatNumber(value))
  const [editing, setEditing] = useState(false)
  const shown = editing ? text : value === null ? '' : formatNumber(value)

  return (
    <input
      type="text"
      inputMode={decimals ? 'decimal' : 'numeric'}
      enterKeyHint="done"
      autoComplete="off"
      aria-label={label}
      className={`${styles.input} ${className ?? ''}`}
      value={shown}
      onFocus={(e) => {
        setText(value === null ? '' : formatNumber(value))
        setEditing(true)
        // Select so typing replaces the old value — saves a tap on the backspace key.
        e.currentTarget.select()
      }}
      onBlur={() => setEditing(false)}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      onChange={(e) => {
        const parsed = parse(e.target.value, decimals, max)
        if (parsed === 'invalid') return
        setText(e.target.value)
        onChange(parsed)
      }}
      {...rest}
    />
  )
}

interface DurationInputProps extends BaseProps {
  label: string
  value: number | null
  onChange: (value: number | null) => void
}

/** Time field: type "90" or "1:30"; shows 1:30. Saves when you leave the field. */
export function DurationInput({ label, value, onChange, className, ...rest }: DurationInputProps) {
  const [text, setText] = useState('')
  const [editing, setEditing] = useState(false)
  const shown = editing ? text : value === null ? '' : formatDuration(value)

  function commit() {
    setEditing(false)
    const parsed = parseDuration(text)
    if (text.trim() === '') onChange(null)
    else if (parsed !== null) onChange(parsed)
    // invalid text: keep the old value
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      enterKeyHint="done"
      autoComplete="off"
      aria-label={label}
      className={`${styles.input} ${className ?? ''}`}
      value={shown}
      onFocus={(e) => {
        setText(value === null ? '' : formatDuration(value))
        setEditing(true)
        e.currentTarget.select()
      }}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      onChange={(e) => /^[\d:]*$/.test(e.target.value) && setText(e.target.value)}
      {...rest}
    />
  )
}
