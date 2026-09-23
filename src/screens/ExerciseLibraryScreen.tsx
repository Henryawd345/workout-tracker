import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Button } from '../components/Button.tsx'
import { ExerciseBrowser } from '../components/exercises/ExerciseBrowser.tsx'
import type { BrowserFilter } from '../components/exercises/options.ts'
import { ExerciseLinkRow, RowList } from '../components/exercises/ExerciseRow.tsx'
import { IconLink } from '../components/IconButton.tsx'
import { BackIcon, PlusIcon } from '../components/icons.tsx'
import { Screen } from '../components/Screen.tsx'
import {
  EQUIPMENT,
  listExercises,
  listRecentExerciseIds,
  MUSCLE_GROUPS,
  type Equipment,
  type MuscleGroup,
} from '../data/index.ts'

function readFilter(params: URLSearchParams): BrowserFilter {
  const muscle = params.get('muscle')
  const equipment = params.get('equipment')
  return {
    query: params.get('q') ?? '',
    muscle: MUSCLE_GROUPS.includes(muscle as MuscleGroup) ? (muscle as MuscleGroup) : null,
    equipment: EQUIPMENT.includes(equipment as Equipment) ? (equipment as Equipment) : null,
  }
}

export function ExerciseLibraryScreen() {
  const navigate = useNavigate()
  // The search lives in the address, so it's still there after opening an exercise and coming back.
  const [params, setParams] = useSearchParams()
  const filter = readFilter(params)
  const exercises = useLiveQuery(() => listExercises(), [])
  const recentIds = useLiveQuery(() => listRecentExerciseIds(), [], [])
  const [showArchived, setShowArchived] = useState(false)

  const active = exercises?.filter((e) => !e.archived)
  const archived = exercises?.filter((e) => e.archived) ?? []

  function setFilter(next: BrowserFilter) {
    const p = new URLSearchParams()
    if (next.query) p.set('q', next.query)
    if (next.muscle) p.set('muscle', next.muscle)
    if (next.equipment) p.set('equipment', next.equipment)
    setParams(p, { replace: true })
  }

  function create(name: string) {
    navigate(name ? `/routines/exercises/new?name=${encodeURIComponent(name)}` : '/routines/exercises/new')
  }

  return (
    <Screen
      title="Exercises"
      leading={
        <IconLink to="/routines" label="Back to routines">
          <BackIcon />
        </IconLink>
      }
      action={
        <IconLink to="/routines/exercises/new" label="New exercise">
          <PlusIcon />
        </IconLink>
      }
    >
      <ExerciseBrowser
        exercises={active}
        recentIds={recentIds}
        filter={filter}
        onFilterChange={setFilter}
        onCreate={create}
        renderRow={(e) => <ExerciseLinkRow exercise={e} to={`/routines/exercises/${e.id}`} />}
      />

      {archived.length > 0 && (
        <section aria-label="Archived exercises">
          <Button variant="ghost" onClick={() => setShowArchived((s) => !s)} aria-expanded={showArchived}>
            {showArchived ? 'Hide archived' : `Show archived (${archived.length})`}
          </Button>
          {showArchived && (
            <RowList>
              {archived.map((e) => (
                <ExerciseLinkRow key={e.id} exercise={e} to={`/routines/exercises/${e.id}`} />
              ))}
            </RowList>
          )}
        </section>
      )}
    </Screen>
  )
}
