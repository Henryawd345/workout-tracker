import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../data/db.ts'
import { exportBackup, getSettings } from '../data/index.ts'
import { addCompletedWorkout, done, makeExercise, resetDb } from '../test/factories.ts'
import { renderApp } from '../test/renderApp.tsx'

beforeEach(resetDb)
afterEach(() => vi.restoreAllMocks())

describe('settings', () => {
  it('changes units and rest timer settings, saving right away', async () => {
    renderApp('/settings')
    await userEvent.click(await screen.findByRole('radio', { name: 'Pounds (lb)' }))
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Pounds (lb)' })).toBeChecked())
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Default rest for new exercises' }), '2:00')
    await userEvent.click(screen.getByRole('switch', { name: /Start automatically/ }))
    await waitFor(async () =>
      expect(await getSettings()).toEqual({ displayUnit: 'lb', defaultRestSec: 120, autoStartRest: false }),
    )
  })

  it('saves a backup file', async () => {
    await addCompletedWorkout('2026-09-01T17:00:00.000Z', [makeExercise('ex-deadlift', [done(140, 5)])])
    const created: Blob[] = []
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
      created.push(b as Blob)
      return 'blob:x'
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    renderApp('/settings')
    await userEvent.click(await screen.findByRole('button', { name: 'Save a backup' }))
    expect(await screen.findByText('Backup saved')).toBeInTheDocument()
    expect(click).toHaveBeenCalled()
    const saved = JSON.parse(await created[0].text())
    expect(saved).toMatchObject({ app: 'workout-tracker', version: 1 })
    expect(saved.workouts).toHaveLength(1)
  })

  it('restores a backup, replacing everything', async () => {
    await addCompletedWorkout('2026-09-01T17:00:00.000Z', [makeExercise('ex-deadlift', [done(140, 5)])])
    const backup = JSON.stringify(await exportBackup())
    await db.workouts.clear()
    await addCompletedWorkout('2026-09-05T17:00:00.000Z', [makeExercise('ex-plank', [done(0, 1)])])

    renderApp('/settings')
    const file = new File([backup], 'b.json', { type: 'application/json' })
    await userEvent.upload(await screen.findByLabelText('Backup file'), file)
    const sheet = await screen.findByRole('menu', { name: /^Restore backup: 1 workout, 0 routines/ })
    await userEvent.click(within(sheet).getByRole('menuitem', { name: 'Replace everything' }))

    expect(await screen.findByText('Imported 1 workout and 0 routines')).toBeInTheDocument()
    const all = await db.workouts.toArray()
    expect(all.map((w) => w.exercises[0].exerciseId)).toEqual(['ex-deadlift'])
  })

  it('explains a bad file without changing anything', async () => {
    await addCompletedWorkout('2026-09-01T17:00:00.000Z', [makeExercise('ex-deadlift', [done(140, 5)])])
    renderApp('/settings')
    await userEvent.upload(await screen.findByLabelText('Backup file'), new File(['{"app":"nope"}'], 'x.json', { type: 'application/json' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('This isn’t a Workout Tracker backup.')
    expect(await db.workouts.count()).toBe(1)
  })

  it('deletes all data only after typing DELETE', async () => {
    await addCompletedWorkout('2026-09-01T17:00:00.000Z', [makeExercise('ex-deadlift', [done(140, 5)])])
    renderApp('/settings')
    await userEvent.click(await screen.findByRole('button', { name: 'Delete all data' }))
    const dialog = within(screen.getByRole('alertdialog', { name: 'Delete all data?' }))
    const confirm = dialog.getByRole('button', { name: 'Delete everything' })
    expect(confirm).toBeDisabled()
    await userEvent.type(dialog.getByRole('textbox', { name: 'Type DELETE to confirm' }), 'delete')
    expect(confirm).toBeEnabled()
    await userEvent.click(confirm)
    expect(await screen.findByText('All data deleted')).toBeInTheDocument()
    expect(await db.workouts.count()).toBe(0)
  })
})
