import { CloseIcon, SearchIcon } from './icons.tsx'
import styles from './SearchField.module.css'

interface SearchFieldProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoFocus?: boolean
}

export function SearchField({ value, onChange, placeholder = 'Search', autoFocus }: SearchFieldProps) {
  return (
    <div className={styles.field}>
      <SearchIcon className={styles.icon} />
      <input
        type="search"
        className={styles.input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        autoCorrect="off"
        enterKeyHint="search"
      />
      {value && (
        <button type="button" className={styles.clear} onClick={() => onChange('')} aria-label="Clear search">
          <CloseIcon />
        </button>
      )}
    </div>
  )
}
