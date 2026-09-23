import { ButtonLink } from '../components/Button.tsx'
import { EmptyState, Screen } from '../components/Screen.tsx'

export function RoutinesScreen() {
  return (
    <Screen
      title="Routines"
      action={
        <ButtonLink to="/routines/exercises" variant="ghost">
          Exercises
        </ButtonLink>
      }
    >
      <EmptyState title="No routines yet">Creating routines arrives in phase 3.</EmptyState>
    </Screen>
  )
}
