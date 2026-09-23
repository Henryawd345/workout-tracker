import { NavLink } from 'react-router'
import { HistoryIcon, ProgressIcon, RoutinesIcon, TodayIcon } from './icons.tsx'
import styles from './TabBar.module.css'

const tabs = [
  { to: '/today', label: 'Today', Icon: TodayIcon },
  { to: '/routines', label: 'Routines', Icon: RoutinesIcon },
  { to: '/history', label: 'History', Icon: HistoryIcon },
  { to: '/progress', label: 'Progress', Icon: ProgressIcon },
]

export function TabBar() {
  return (
    <nav className={styles.bar} aria-label="Main">
      {tabs.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => (isActive ? `${styles.tab} ${styles.active}` : styles.tab)}
        >
          <Icon />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
