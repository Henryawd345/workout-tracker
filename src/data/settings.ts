import { db } from './db.ts'
import { DEFAULT_SETTINGS, type Settings } from './types.ts'

export async function getSettings(): Promise<Settings> {
  const stored = await db.settings.get('settings')
  if (!stored) return { ...DEFAULT_SETTINGS }
  const { id: _id, ...settings } = stored
  // Fill in any setting added after this record was saved.
  return { ...DEFAULT_SETTINGS, ...settings }
}

export async function updateSettings(changes: Partial<Settings>): Promise<Settings> {
  return db.transaction('rw', db.settings, async () => {
    const next = { ...(await getSettings()), ...changes }
    await db.settings.put({ id: 'settings', ...next })
    return next
  })
}
