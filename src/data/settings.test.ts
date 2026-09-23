import { beforeEach, describe, expect, it } from 'vitest'
import { resetDb } from '../test/factories.ts'
import { db } from './db.ts'
import { getSettings, updateSettings } from './settings.ts'
import { DEFAULT_SETTINGS } from './types.ts'

beforeEach(resetDb)

describe('settings', () => {
  it('start with defaults', async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('save partial changes', async () => {
    await updateSettings({ displayUnit: 'lb' })
    await updateSettings({ defaultRestSec: 120 })
    expect(await getSettings()).toEqual({ ...DEFAULT_SETTINGS, displayUnit: 'lb', defaultRestSec: 120 })
  })

  it('fill in settings added in a later version', async () => {
    await db.settings.put({ id: 'settings', displayUnit: 'lb' } as never)
    expect(await getSettings()).toEqual({ ...DEFAULT_SETTINGS, displayUnit: 'lb' })
  })
})
