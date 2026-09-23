import { EmptyState, Screen } from '../components/Screen.tsx'

export function RoutinesScreen() {
  return (
    <Screen title="Routines">
      <EmptyState title="No routines yet">Creating routines arrives in phase 3.</EmptyState>
    </Screen>
  )
}
