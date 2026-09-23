import { EmptyState, Screen } from '../components/Screen.tsx'

export function HistoryScreen() {
  return (
    <Screen title="History">
      <EmptyState title="No workouts yet">Finished workouts will appear here.</EmptyState>
    </Screen>
  )
}
