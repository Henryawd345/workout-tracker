import { IconLink } from '../components/IconButton.tsx'
import { BackIcon } from '../components/icons.tsx'
import { EmptyState, Screen } from '../components/Screen.tsx'

export function SettingsScreen() {
  return (
    <Screen
      title="Settings"
      leading={
        <IconLink to="/today" label="Back">
          <BackIcon />
        </IconLink>
      }
    >
      <EmptyState title="Settings">Units, rest timer and data export arrive in phase 9.</EmptyState>
    </Screen>
  )
}
