import { useNavigate, useSearchParams } from 'react-router'
import { BackButton } from '../components/BackButton.tsx'
import { ExerciseForm } from '../components/exercises/ExerciseForm.tsx'
import { Screen } from '../components/Screen.tsx'

export function NewExerciseScreen() {
  const navigate = useNavigate()
  const [params] = useSearchParams()

  return (
    <Screen
      title="New exercise"
      leading={
        <BackButton fallback="/routines/exercises" label="Back to exercises" />
      }
    >
      <ExerciseForm
        initialName={params.get('name') ?? ''}
        onCreated={(e) => navigate(`/routines/exercises/${e.id}`, { replace: true })}
      />
    </Screen>
  )
}
