import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../data/db.ts'
import { getWorkout } from '../data/index.ts'
import { addCompletedWorkout, done, makeExercise, resetDb } from '../test/factories.ts'
import { renderApp } from '../test/renderApp.tsx'

beforeEach(resetDb)

/** A local-time ISO date in the current month, so the calendar opens on it. */
function thisMonth(day: number, hour = 18) {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), day, hour, 0).toISOString()
}

describe('history calendar', () => {
  it('marks training days and lists a tapped day’s workouts', async () => {
    await addCompletedWorkout(thisMonth(3), [makeExercise('ex-deadlift', [done(140, 5)])], { name: 'Pull' })
    await addCompletedWorkout(thisMonth(3, 7), [makeExercise('ex-plank', [done(0, 1)])], { name: 'Morning core' })
    await addCompletedWorkout(thisMonth(10), [makeExercise('ex-back-squat', [done(100, 5)])], { name: 'Legs' })
    renderApp('/history')
    await userEvent.click(await screen.findByRole('radio', { name: 'Calendar' }))

    expect(screen.getByText('3 workouts')).toBeInTheDocument()
    const day3 = screen.getByRole('button', { name: /, 2 workouts$/ })
    await userEvent.click(day3)
    const list = screen.getByRole('list', { name: /^Workouts on/ })
    expect(within(list).getAllByRole('link').map((l) => l.textContent)).toEqual([
      expect.stringContaining('Morning core'),
      expect.stringContaining('Pull'),
    ])

    await userEvent.click(screen.getByRole('button', { name: /, 1 workout$/ }))
    expect(within(screen.getByRole('list', { name: /^Workouts on/ })).getByText('Legs')).toBeInTheDocument()
  })

  it('shows rest days and moves between months', async () => {
    await addCompletedWorkout(thisMonth(10), [makeExercise('ex-back-squat', [done(100, 5)])])
    renderApp('/history?view=calendar')
    const days = await screen.findByRole('group', { name: /^Days in/ })
    await userEvent.click(within(days).getAllByRole('button')[0]) // the 1st: no workout
    expect(screen.getByText(/rest day\./)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(screen.getByText('No workouts')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Next month' }))
    expect(screen.getByText('1 workout')).toBeInTheDocument()
  })
})

describe('editing a past workout', () => {
  it('corrects sets, adds one, changes time and notes, and drops unticked sets on Done', async () => {
    const w = await addCompletedWorkout('2026-09-02T17:00:00.000Z', [makeExercise('ex-back-squat', [done(100, 5), done(100, 5)])], {
      name: 'Legs',
    })
    renderApp(`/history/${w.id}`)
    await userEvent.click(await screen.findByRole('button', { name: 'Workout actions' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Edit workout' }))

    const squat = within(await screen.findByRole('listitem', { name: 'Back Squat' }))
    const reps2 = squat.getByRole('textbox', { name: 'Set 2 reps' })
    await userEvent.clear(reps2)
    await userEvent.type(reps2, '4')

    await userEvent.click(squat.getByRole('button', { name: 'Add set' }))
    await userEvent.click(squat.getByRole('button', { name: 'Complete set 3' })) // suggested from the set above
    await userEvent.click(squat.getByRole('button', { name: 'Add set' })) // left unticked

    const minutes = screen.getByRole('textbox', { name: 'Duration in minutes' })
    await userEvent.clear(minutes)
    await userEvent.type(minutes, '45')
    await userEvent.type(screen.getByRole('textbox', { name: 'Note' }), 'Fixed typo')
    const name = screen.getByRole('textbox', { name: 'Name' })
    await userEvent.clear(name)
    await userEvent.type(name, 'Leg day')

    await userEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(await screen.findByRole('heading', { name: 'Leg day' })).toBeInTheDocument()

    const saved = (await getWorkout(w.id))!
    expect(saved.status).toBe('completed')
    expect(saved.note).toBe('Fixed typo')
    expect(saved.exercises[0].sets.map((s) => [s.weight, s.reps])).toEqual([
      [100, 5],
      [100, 4],
      [100, 4],
    ])
    expect(Date.parse(saved.endedAt!) - Date.parse(saved.startedAt)).toBe(45 * 60 * 1000)
  })

  it('offers to delete a workout edited down to nothing', async () => {
    const w = await addCompletedWorkout('2026-09-02T17:00:00.000Z', [makeExercise('ex-plank', [done(0, 1)])])
    renderApp(`/history/${w.id}/edit`)
    await userEvent.click(await screen.findByRole('button', { name: 'Set 1 done — tap to undo' }))
    await userEvent.click(screen.getByRole('button', { name: 'Done' }))
    const dialog = screen.getByRole('alertdialog', { name: 'No sets left' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete workout' }))
    expect(await screen.findByText('No workouts yet')).toBeInTheDocument()
    expect(await db.workouts.count()).toBe(0)
  })

  it('will not move a workout into the future', async () => {
    const w = await addCompletedWorkout('2026-09-02T17:00:00.000Z', [makeExercise('ex-plank', [done(0, 1)])])
    renderApp(`/history/${w.id}/edit`)
    const date = await screen.findByLabelText('Date')
    await userEvent.clear(date)
    await userEvent.type(date, `${new Date().getFullYear() + 1}-01-01`)
    expect(await screen.findByText('A past workout can’t start in the future.')).toBeInTheDocument()
    expect((await getWorkout(w.id))?.startedAt).toBe('2026-09-02T17:00:00.000Z')
  })

  it('hides exercises left without ticked sets after leaving the editor with Back', async () => {
    const w = await addCompletedWorkout('2026-09-02T17:00:00.000Z', [
      makeExercise('ex-plank', [done(0, 1)]),
      makeExercise('ex-deadlift', [{ ...done(100, 1), completed: false, completedAt: null }]),
    ])
    renderApp(`/history/${w.id}`)
    expect(await screen.findByRole('listitem', { name: 'Plank' })).toBeInTheDocument()
    expect(screen.queryByRole('listitem', { name: 'Deadlift' })).not.toBeInTheDocument()
  })

  it('suggests from the session before the edited one, not a later one', async () => {
    await addCompletedWorkout('2026-09-01T17:00:00.000Z', [makeExercise('ex-deadlift', [done(120, 5)])])
    const middle = await addCompletedWorkout('2026-09-05T17:00:00.000Z', [makeExercise('ex-deadlift', [done(130, 5)])])
    await addCompletedWorkout('2026-09-09T17:00:00.000Z', [makeExercise('ex-deadlift', [done(140, 5)])])
    renderApp(`/history/${middle.id}/edit`)
    expect(await screen.findByText(/Last time: 120 kg × 5/)).toBeInTheDocument()
  })
})

describe('deleting a past workout', () => {
  it('asks first, then removes it', async () => {
    const w = await addCompletedWorkout('2026-09-02T17:00:00.000Z', [makeExercise('ex-plank', [done(0, 1)])], { name: 'Core' })
    renderApp(`/history/${w.id}`)
    await userEvent.click(await screen.findByRole('button', { name: 'Workout actions' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete workout' }))
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }))
    expect(await getWorkout(w.id)).toBeDefined()

    await userEvent.click(screen.getByRole('button', { name: 'Workout actions' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete workout' }))
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('No workouts yet')).toBeInTheDocument()
    await waitFor(async () => expect(await getWorkout(w.id)).toBeUndefined())
  })
})
