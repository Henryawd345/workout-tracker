import { Fragment, type ReactNode } from 'react'
import { searchExercises, type Exercise, type ID } from '../../data/index.ts'
import { Button } from '../Button.tsx'
import { ChipFilter } from '../Chips.tsx'
import { SearchField } from '../SearchField.tsx'
import styles from './ExerciseBrowser.module.css'
import { RowList } from './ExerciseRow.tsx'
import { equipmentOptions, muscleOptions, type BrowserFilter } from './options.ts'

interface ExerciseBrowserProps {
  /** undefined while loading. */
  exercises: Exercise[] | undefined
  recentIds?: ID[]
  filter: BrowserFilter
  onFilterChange: (filter: BrowserFilter) => void
  renderRow: (exercise: Exercise) => ReactNode
  /** Offered when nothing matches; receives the search text. */
  onCreate?: (name: string) => void
  autoFocusSearch?: boolean
}

/** Search box, muscle/equipment filters and the resulting list. Shared by the library and the picker. */
export function ExerciseBrowser({
  exercises,
  recentIds = [],
  filter,
  onFilterChange,
  renderRow,
  onCreate,
  autoFocusSearch,
}: ExerciseBrowserProps) {
  const filtering = filter.query.trim() !== '' || filter.muscle !== null || filter.equipment !== null
  const results = exercises
    ? searchExercises(exercises, {
        query: filter.query,
        muscle: filter.muscle ?? undefined,
        equipment: filter.equipment ?? undefined,
      })
    : []
  const byId = new Map(results.map((e) => [e.id, e]))
  const recent = filtering ? [] : recentIds.map((id) => byId.get(id)).filter((e) => e !== undefined)

  return (
    <div className={styles.browser}>
      <div className={styles.controls}>
        <SearchField
          value={filter.query}
          onChange={(query) => onFilterChange({ ...filter, query })}
          placeholder="Search exercises"
          autoFocus={autoFocusSearch}
        />
        <ChipFilter
          label="Muscle group"
          allLabel="All muscles"
          options={muscleOptions}
          value={filter.muscle}
          onChange={(muscle) => onFilterChange({ ...filter, muscle })}
        />
        <ChipFilter
          label="Equipment"
          allLabel="All equipment"
          options={equipmentOptions}
          value={filter.equipment}
          onChange={(equipment) => onFilterChange({ ...filter, equipment })}
        />
      </div>

      {exercises === undefined ? null : results.length === 0 ? (
        <div className={styles.none}>
          <p>No exercises match.</p>
          {onCreate && (
            <Button variant="primary" onClick={() => onCreate(filter.query.trim())}>
              {filter.query.trim() ? `Create “${filter.query.trim()}”` : 'Create exercise'}
            </Button>
          )}
        </div>
      ) : (
        <>
          {recent.length > 0 && (
            <section aria-label="Recent">
              <h2 className={styles.heading}>Recent</h2>
              <RowList>{recent.map((e) => <Fragment key={e.id}>{renderRow(e)}</Fragment>)}</RowList>
            </section>
          )}
          <section aria-label={filtering ? 'Results' : 'All exercises'}>
            <h2 className={styles.heading}>
              {filtering ? `${results.length} ${results.length === 1 ? 'result' : 'results'}` : 'All exercises'}
            </h2>
            <RowList>{results.map((e) => <Fragment key={e.id}>{renderRow(e)}</Fragment>)}</RowList>
          </section>
        </>
      )}
    </div>
  )
}
