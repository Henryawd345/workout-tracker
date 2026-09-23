import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { startWorkout } from '../data/index.ts'
import { addCompletedWorkout, done, doneTimed, makeExercise, resetDb } from '../test/factories.ts'
import { renderApp } from '../test/renderApp.tsx'

beforeEach(resetDb)

describe('history', () => {
  it('explains when there is nothing yet, and ignores the workout in progress', async () => {
    await startWorkout()
    renderApp('/history')
    expect(await screen.findByText('No workouts yet')).toBeInTheDocument()
  })

  it('lists finished workouts newest first, grouped by month', async () => {
    await addCompletedWorkout('2026-08-28T09:00:00Z', [makeExercise('ex-deadlift', [done(140, 5)])], { name: 'Pull' })
    await addCompletedWorkout('2026-09-02T09:00:00Z', [makeExercise('ex-back-squat', [done(100, 5), done(100, 5)])], {
      name: 'Legs',
    })
    await addCompletedWorkout('2026-09-05T09:00:00Z', [makeExercise('ex-plank', [doneTimed(60)])], { name: 'Core' })
    renderApp('/history')

    const sept = await screen.findByRole('region', { name: /September 2026/ })
    expect(within(sept).getAllByRole('link').map((l) => l.textContent)).toEqual([
      expect.stringContaining('Core'),
      expect.stringContaining('Legs'),
    ])
    expect(within(sept).getByRole('heading')).toHaveTextContent('2 workouts')
    expect(within(sept).getByText(/1:00:00 · 1 exercise · 2 sets/)).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /August 2026/ })).toHaveTextContent('Pull')
  })

  it('opens a workout with every set, note and total', async () => {
    const w = await addCompletedWorkout(
      '2026-09-02T09:00:00Z',
      [
        { ...makeExercise('ex-back-squat', [done(100, 5), done(105, 3)]), note: 'Belt on top set' },
        makeExercise('ex-plank', [doneTimed(75)]),
      ],
      { name: 'Legs', note: 'Slept badly' },
    )
    renderApp('/history')
    await userEvent.click(await screen.findByRole('link', { name: /Legs/ }))

    expect(await screen.findByRole('heading', { name: 'Legs' })).toBeInTheDocument()
    expect(screen.getByText('Slept badly')).toBeInTheDocument()
    const squat = within(await screen.findByRole('listitem', { name: 'Back Squat' }))
    expect(squat.getByText('Belt on top set')).toBeInTheDocument()
    expect(squat.getByText('100×5 kg')).toBeInTheDocument()
    expect(squat.getByText('105×3 kg')).toBeInTheDocument()
    expect(within(screen.getByRole('listitem', { name: 'Plank' })).getByText('1:15')).toBeInTheDocument()
    expect(screen.getByText('815')).toBeInTheDocument() // volume: 500 + 315
    expect(w.id).toBeTruthy()
  })

  it('shows only ticked sets', async () => {
    const w = await addCompletedWorkout('2026-09-02T09:00:00Z', [
      makeExercise('ex-back-squat', [done(100, 5), { ...done(100, 5), completed: false, completedAt: null }]),
    ])
    renderApp(`/history/${w.id}`)
    const squat = within(await screen.findByRole('listitem', { name: 'Back Squat' }))
    expect(squat.getByRole('list', { name: 'Back Squat: 1 set' })).toBeInTheDocument()
    expect(squat.getAllByText('100×5 kg')).toHaveLength(1)
  })

  it('says so for an unknown workout', async () => {
    renderApp('/history/nope')
    expect(await screen.findByText('Workout not found')).toBeInTheDocument()
  })
})
