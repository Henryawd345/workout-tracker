import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../data/db.ts'
import { createRoutine, getActiveWorkout, newRoutineExercise, startWorkout } from '../data/index.ts'
import { addCompletedWorkout, done, makeExercise, resetDb } from '../test/factories.ts'
import { renderApp } from '../test/renderApp.tsx'

beforeEach(resetDb)

const card = (name: string) => screen.findByRole('listitem', { name })

async function addExercises(...names: string[]) {
  await userEvent.click(await screen.findByRole('button', { name: 'Add exercises' }))
  const picker = await screen.findByRole('dialog', { name: 'Add exercises' })
  for (const name of names) {
    await userEvent.type(within(picker).getByRole('searchbox'), `{Control>}a{/Control}${name}`)
    await userEvent.click(await within(picker).findByRole('button', { name: new RegExp(`^${name}`) }))
  }
  await userEvent.click(within(picker).getByRole('button', { name: `Add (${names.length})` }))
}

async function stored() {
  return (await getActiveWorkout())!
}

describe('starting and finishing', () => {
  it('logs an empty workout from start to summary', async () => {
    renderApp('/today')
    await userEvent.click(await screen.findByRole('button', { name: 'Start empty workout' }))
    expect(await screen.findByText('Empty workout')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument()

    await addExercises('Back Squat')
    const squat = within(await card('Back Squat'))
    expect(squat.getAllByRole('button', { name: /^Complete set/ })).toHaveLength(3)

    await userEvent.type(squat.getByRole('textbox', { name: 'Set 1 weight (kg)' }), '100')
    await userEvent.type(squat.getByRole('textbox', { name: 'Set 1 reps' }), '5')
    await userEvent.click(squat.getByRole('button', { name: 'Complete set 1' }))
    expect(squat.getByRole('button', { name: 'Set 1 done — tap to undo' })).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(screen.getByRole('button', { name: 'Finish' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Finish workout?' })
    expect(dialog).toHaveTextContent('2 sets not ticked off will be left out.')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Finish' }))

    expect(await screen.findByRole('heading', { name: 'Workout complete' })).toBeInTheDocument()
    expect(screen.getByText('100 kg × 5')).toBeInTheDocument()
    expect(screen.getByText('500')).toBeInTheDocument() // volume

    await userEvent.type(screen.getByRole('textbox', { name: 'How did it feel?' }), 'Strong')
    await userEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(await screen.findByText('1 workout this week.')).toBeInTheDocument()
    const saved = await db.workouts.toArray()
    expect(saved).toHaveLength(1)
    expect(saved[0]).toMatchObject({ status: 'completed', note: 'Strong' })
    expect(saved[0].exercises[0].sets).toHaveLength(1)
  })

  it('refuses to finish with nothing ticked, offering to discard', async () => {
    await startWorkout()
    renderApp('/workout')
    await addExercises('Plank')
    await userEvent.click(screen.getByRole('button', { name: 'Finish' }))
    const dialog = screen.getByRole('alertdialog', { name: 'No sets completed' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Discard' }))
    expect(await screen.findByRole('button', { name: 'Start empty workout' })).toBeInTheDocument()
    expect(await db.workouts.count()).toBe(0)
  })

  it('discards from the ⋯ menu after confirming', async () => {
    await startWorkout()
    renderApp('/workout')
    await userEvent.click(await screen.findByRole('button', { name: 'Workout actions' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Discard workout' }))
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Discard' }))
    expect(await screen.findByRole('button', { name: 'Start empty workout' })).toBeInTheDocument()
  })
})

describe('logging with suggestions', () => {
  beforeEach(async () => {
    const routine = await createRoutine('Legs', [newRoutineExercise('ex-back-squat', 180, 3)])
    await addCompletedWorkout('2026-09-20T10:00:00Z', [makeExercise('ex-back-squat', [done(100, 5), done(100, 5), done(95, 6)])], {
      routineId: routine.id,
    })
  })

  it('starts a routine from Today and shows last time', async () => {
    renderApp('/today')
    await userEvent.click(await screen.findByRole('button', { name: 'Start Legs' }))
    const squat = within(await card('Back Squat'))
    expect(await squat.findByText(/Last time: 100×5, 100×5, 95×6 kg/)).toBeInTheDocument()
    expect(squat.getByRole('textbox', { name: 'Set 3 weight (kg)' })).toHaveAttribute('placeholder', '95')
    expect(squat.getByRole('textbox', { name: 'Set 3 reps' })).toHaveAttribute('placeholder', '6')
  })

  it('one tap on ✓ confirms the suggestion; typed values win', async () => {
    const routine = (await db.routines.toArray())[0]
    await startWorkout({ routineId: routine.id })
    renderApp('/workout')
    const squat = within(await card('Back Squat'))
    await squat.findByText(/Last time/)

    await userEvent.click(squat.getByRole('button', { name: 'Complete set 1' }))
    await userEvent.type(squat.getByRole('textbox', { name: 'Set 2 reps' }), '7')
    await userEvent.click(squat.getByRole('button', { name: 'Complete set 2' }))

    await waitFor(async () => {
      const sets = (await stored()).exercises[0].sets
      expect(sets[0]).toMatchObject({ weight: 100, reps: 5, completed: true })
      expect(sets[1]).toMatchObject({ weight: 100, reps: 7, completed: true })
      expect(sets[2]).toMatchObject({ weight: null, reps: null, completed: false })
    })
  })

  it('shows last time in lb but stores the accepted kg value unchanged', async () => {
    await db.settings.put({ id: 'settings', displayUnit: 'lb', defaultRestSec: 90, autoStartRest: true })
    const routine = (await db.routines.toArray())[0]
    await startWorkout({ routineId: routine.id })
    renderApp('/workout')
    const squat = within(await card('Back Squat'))
    await squat.findByText(/Last time/)
    expect(squat.getByRole('textbox', { name: 'Set 1 weight (lb)' })).toHaveAttribute('placeholder', '220.5')
    await userEvent.click(squat.getByRole('button', { name: 'Complete set 1' }))
    await waitFor(async () =>
      expect((await stored()).exercises[0].sets[0]).toMatchObject({ weight: 100, weightUnit: 'kg', completed: true }),
    )
  })

  it('points at the missing value when there is nothing to suggest', async () => {
    await startWorkout()
    renderApp('/workout')
    await addExercises('Leg Press')
    const press = within(await card('Leg Press'))
    await userEvent.click(press.getByRole('button', { name: 'Complete set 1' }))
    expect(await screen.findByText('Enter a weight first')).toBeInTheDocument()
    expect(press.getByRole('textbox', { name: 'Set 1 weight (kg)' })).toHaveFocus()
    expect(press.getByRole('button', { name: 'Complete set 1' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('tapping ✓ again un-completes the set', async () => {
    const routine = (await db.routines.toArray())[0]
    await startWorkout({ routineId: routine.id })
    renderApp('/workout')
    const squat = within(await card('Back Squat'))
    await squat.findByText(/Last time/)
    await userEvent.click(squat.getByRole('button', { name: 'Complete set 1' }))
    await userEvent.click(squat.getByRole('button', { name: 'Set 1 done — tap to undo' }))
    await waitFor(async () => expect((await stored()).exercises[0].sets[0].completed).toBe(false))
  })
})

describe('editing during a workout', () => {
  beforeEach(async () => {
    await startWorkout()
  })

  it('deletes a set and undoes it, keeping later changes', async () => {
    renderApp('/workout')
    await addExercises('Plank', 'Deadlift')
    const deadlift = within(await card('Deadlift'))
    await userEvent.click(deadlift.getByRole('button', { name: 'Set 2 options' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete set' }))
    expect(deadlift.getAllByRole('button', { name: /^Complete set/ })).toHaveLength(2)

    // A later change that Undo must not wipe out
    const plank = within(await card('Plank'))
    await userEvent.type(plank.getByRole('textbox', { name: 'Set 1 time' }), '45')
    await userEvent.click(plank.getByRole('button', { name: 'Complete set 1' }))

    await userEvent.click(await screen.findByRole('button', { name: 'Undo' }))
    expect(deadlift.getAllByRole('button', { name: /^Complete set/ })).toHaveLength(3)
    await waitFor(async () => {
      const w = await stored()
      expect(w.exercises[1].sets).toHaveLength(3)
      expect(w.exercises[0].sets[0]).toMatchObject({ durationSec: 45, completed: true })
    })
  })

  it('replaces an exercise and can undo it', async () => {
    renderApp('/workout')
    await addExercises('Leg Press')
    await userEvent.click(await screen.findByRole('button', { name: 'More actions for Leg Press' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Replace exercise' }))
    const picker = await screen.findByRole('dialog', { name: 'Replace Leg Press' })
    await userEvent.type(within(picker).getByRole('searchbox'), 'hack')
    await userEvent.click(await within(picker).findByRole('button', { name: /^Hack Squat/ }))

    expect(await card('Hack Squat')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(await card('Leg Press')).toBeInTheDocument()
  })

  it('will not undo a replace after sets were logged on the new exercise', async () => {
    renderApp('/workout')
    await addExercises('Leg Press')
    await userEvent.click(await screen.findByRole('button', { name: 'More actions for Leg Press' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Replace exercise' }))
    const picker = await screen.findByRole('dialog', { name: 'Replace Leg Press' })
    await userEvent.type(within(picker).getByRole('searchbox'), 'hack')
    await userEvent.click(await within(picker).findByRole('button', { name: /^Hack Squat/ }))

    const hack = within(await card('Hack Squat'))
    await userEvent.type(hack.getByRole('textbox', { name: 'Set 1 reps' }), '10')
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(await screen.findByText('Can’t undo — sets were already logged on it')).toBeInTheDocument()
    expect(hack.getByRole('textbox', { name: 'Set 1 reps' })).toHaveValue('10')
  })

  it('removes an exercise with undo, and reorders from the menu', async () => {
    renderApp('/workout')
    await addExercises('Leg Press', 'Plank')
    await userEvent.click(await screen.findByRole('button', { name: 'More actions for Plank' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Move up' }))
    const names = () => screen.getAllByRole('listitem').filter((li) => li.getAttribute('aria-label')).map((li) => li.getAttribute('aria-label'))
    expect(names()).toEqual(['Plank', 'Leg Press'])

    await userEvent.click(screen.getByRole('button', { name: 'More actions for Plank' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Remove exercise' }))
    expect(names()).toEqual(['Leg Press'])
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(names()).toEqual(['Plank', 'Leg Press'])
  })

  it('saves workout and exercise notes, and renames the workout', async () => {
    renderApp('/workout')
    await addExercises('Leg Press')
    await userEvent.click(screen.getByRole('button', { name: 'Workout actions' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Add workout note' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Workout note' }), 'Gym was busy')
    await userEvent.click(screen.getByRole('button', { name: 'Done' }))

    await userEvent.click(screen.getByRole('button', { name: 'More actions for Leg Press' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Add note for today' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Leg Press — today' }), 'Seat 5')
    await userEvent.click(screen.getByRole('button', { name: 'Done' }))

    const name = screen.getByRole('textbox', { name: 'Workout name' })
    await userEvent.clear(name)
    await userEvent.type(name, 'Leg day')

    await waitFor(async () => {
      const w = await stored()
      expect(w).toMatchObject({ note: 'Gym was busy', name: 'Leg day' })
      expect(w.exercises[0].note).toBe('Seat 5')
    })
    expect(screen.getByText('Seat 5')).toBeInTheDocument()
  })

  it('survives leaving and coming back (auto-save + resume)', async () => {
    renderApp('/workout')
    await addExercises('Leg Press')
    const press = within(await card('Leg Press'))
    await userEvent.type(press.getByRole('textbox', { name: 'Set 1 weight (kg)' }), '140')
    await userEvent.type(press.getByRole('textbox', { name: 'Set 1 reps' }), '12')
    await userEvent.click(press.getByRole('button', { name: 'Complete set 1' }))

    cleanup() // like closing the app
    renderApp('/today')
    expect(await screen.findByRole('region', { name: 'Workout in progress' })).toHaveTextContent('1/3 sets done')
    await userEvent.click(screen.getByRole('link', { name: 'Resume workout' }))
    const again = within(await card('Leg Press'))
    expect(again.getByRole('textbox', { name: 'Set 1 weight (kg)' })).toHaveValue('140')
    expect(again.getByRole('button', { name: 'Set 1 done — tap to undo' })).toBeInTheDocument()
  })

  it('minimising shows the in-progress bar on other tabs', async () => {
    renderApp('/workout')
    await userEvent.click(await screen.findByRole('button', { name: 'Minimise workout' }))
    await userEvent.click(await screen.findByRole('link', { name: 'History' }))
    expect(await screen.findByRole('link', { name: /Workout · .*Resume/ })).toBeInTheDocument()
  })
})

describe('summary', () => {
  it('celebrates new personal records', async () => {
    await addCompletedWorkout('2026-09-10T10:00:00Z', [makeExercise('ex-deadlift', [done(140, 5)])])
    const w = await startWorkout()
    renderApp('/workout')
    await addExercises('Deadlift')
    const deadlift = within(await card('Deadlift'))
    await userEvent.type(deadlift.getByRole('textbox', { name: 'Set 1 weight (kg)' }), '150')
    await userEvent.click(deadlift.getByRole('button', { name: 'Complete set 1' }))
    // Every set is ticked, so Finish goes straight to the summary (no dialog).
    await userEvent.click(screen.getByRole('button', { name: 'Finish' }))

    const records = await screen.findByRole('region', { name: 'New personal records' })
    expect(records).toHaveTextContent('Deadlift — heaviest weight')
    expect((await db.workouts.get(w.id))?.status).toBe('completed')
  })
})
