import { Outlet } from 'react-router'
import styles from './AppShell.module.css'
import { TabBar } from './TabBar.tsx'

export function AppShell() {
  return (
    <div className={styles.shell}>
      <main className={styles.main}>
        <Outlet />
      </main>
      <TabBar />
    </div>
  )
}
