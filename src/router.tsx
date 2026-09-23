import { createHashRouter, Navigate, type RouteObject } from 'react-router'
import { AppShell } from './components/AppShell.tsx'
import { HistoryScreen } from './screens/HistoryScreen.tsx'
import { ProgressScreen } from './screens/ProgressScreen.tsx'
import { RoutinesScreen } from './screens/RoutinesScreen.tsx'
import { SettingsScreen } from './screens/SettingsScreen.tsx'
import { TodayScreen } from './screens/TodayScreen.tsx'

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/today" replace /> },
      { path: 'today', element: <TodayScreen /> },
      { path: 'routines', element: <RoutinesScreen /> },
      { path: 'history', element: <HistoryScreen /> },
      { path: 'progress', element: <ProgressScreen /> },
      { path: 'settings', element: <SettingsScreen /> },
      { path: '*', element: <Navigate to="/today" replace /> },
    ],
  },
]

// Hash-based URLs (#/today) work on any static host and from the iPhone Home Screen.
export const router = createHashRouter(routes)
