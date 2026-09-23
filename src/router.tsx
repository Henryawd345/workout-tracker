import { createHashRouter, Navigate, type RouteObject } from 'react-router'
import { AppShell } from './components/AppShell.tsx'
import { ExerciseDetailScreen } from './screens/ExerciseDetailScreen.tsx'
import { ExerciseLibraryScreen } from './screens/ExerciseLibraryScreen.tsx'
import { HistoryScreen } from './screens/HistoryScreen.tsx'
import { NewExerciseScreen } from './screens/NewExerciseScreen.tsx'
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
      { path: 'routines/exercises', element: <ExerciseLibraryScreen /> },
      { path: 'routines/exercises/new', element: <NewExerciseScreen /> },
      { path: 'routines/exercises/:id', element: <ExerciseDetailScreen /> },
      { path: 'history', element: <HistoryScreen /> },
      { path: 'progress', element: <ProgressScreen /> },
      { path: 'settings', element: <SettingsScreen /> },
      { path: '*', element: <Navigate to="/today" replace /> },
    ],
  },
]

// Hash-based URLs (#/today) work on any static host and from the iPhone Home Screen.
export const router = createHashRouter(routes)
