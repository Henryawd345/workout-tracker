import { EmptyState, Screen } from '../components/Screen.tsx'

export function ProgressScreen() {
  return (
    <Screen title="Progress">
      <EmptyState title="Nothing to chart yet">Log a few workouts to see your trends.</EmptyState>
    </Screen>
  )
}
