import { IconLink } from '../components/IconButton.tsx'
import { SettingsIcon } from '../components/icons.tsx'
import { EmptyState, Screen } from '../components/Screen.tsx'

export function TodayScreen() {
  return (
    <Screen
      title="Today"
      action={
        <IconLink to="/settings" label="Settings">
          <SettingsIcon />
        </IconLink>
      }
    >
      <EmptyState title="No workout in progress">
        Starting and resuming workouts arrives in phase 4.
      </EmptyState>
    </Screen>
  )
}
