import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../data/db.ts'
import { createRoutine, getRoutine, newRoutineExercise } from '../data/index.ts'
import { addCompletedWorkout, done, makeExercise, resetDb } from '../test/factories.ts'
import { renderApp } from '../test/renderApp.tsx'

beforeEach(resetDb)

async function savedRoutine(name: string) {
  return db.routines.filter((r) => r.name === name).first()
}

async function addExercises(...names: string[]) {
  await userEvent.click(screen.getByRole('button', { name: 'Add exercises' }))
  const picker = await screen.findByRole('dialog', { name: 'Add exercises' })
  for (const name of names) {
    await userEvent.click(await within(picker).findByRole('button', { name: new RegExp(`^${name}`) }))
  }
  await userEvent.click(within(picker).getByRole('button', { name: `Add (${names.length})` }))
}

describe('routines list', () => {
  it('explains routines when there are none', async () => {
    renderApp('/routines')
    expect(await screen.findByText('No routines yet')).toBeInTheDocument()
  })

  it('shows exercise count and when each routine was last done', async () => {
    const r = await createRoutine('Push', [newRoutineExercise('ex-dip', 90), newRoutineExercise('ex-push-up', 60)])
    await addCompletedWorkout(new Date().toISOString(), [makeExercise('ex-dip', [done(0, 10)])], { routineId: r.id })
    renderApp('/routines')
    const list = await screen.findByRole('list', { name: 'Routines' })
    expect(await within(list).findByText('2 exercises · Last done: Today')).toBeInTheDocument()
  })

  it('duplicates and deletes from the ⋯ menu', async () => {
    await createRoutine('Legs')
    renderApp('/routines')
    await userEvent.click(await screen.findByRole('button', { name: 'More actions for Legs' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }))
    expect(await screen.findByText('Legs (copy)')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'More actions for Legs (copy)' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }))
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(screen.queryByText('Legs (copy)')).not.toBeInTheDocument())
    expect(screen.getByText('Legs')).toBeInTheDocument()
  })
})

describe('routine editor', () => {
  it('builds a routine from scratch, saving as it goes', async () => {
    renderApp('/routines')
    await userEvent.click(await screen.findByRole('button', { name: 'New routine' }))
    const name = await screen.findByRole('textbox', { name: 'Name' })
    expect(screen.getByRole('heading', { name: 'New routine' })).toBeInTheDocument()
    await userEvent.clear(name)
    await userEvent.type(name, 'Upper A')

    await addExercises('Barbell Bench Press', 'Plank', 'Pull-Up')
    const cards = await screen.findAllByRole('listitem')
    expect(cards.map((c) => c.getAttribute('aria-label'))).toEqual(['Barbell Bench Press', 'Plank', 'Pull-Up'])

    // Targets: weight & reps, time, reps only
    const bench = within(cards[0])
    await userEvent.type(bench.getByRole('textbox', { name: 'Set 1 target reps' }), '5')
    await userEvent.type(bench.getByRole('textbox', { name: 'Set 1 target weight (kg)' }), '62.5')
    const plank = within(cards[1])
    await userEvent.type(plank.getByRole('textbox', { name: 'Set 1 target time' }), '1:30')
    await userEvent.tab()
    expect(within(cards[2]).queryByRole('textbox', { name: /weight/ })).not.toBeInTheDocument()

    await waitFor(async () => {
      const r = await savedRoutine('Upper A')
      expect(r?.exercises.map((e) => e.exerciseId)).toEqual(['ex-barbell-bench-press', 'ex-plank', 'ex-pull-up'])
      expect(r?.exercises[0].sets[0]).toEqual({ targetReps: 5, targetWeight: 62.5, targetWeightUnit: 'kg' })
      expect(r?.exercises[1].sets[0]).toEqual({ targetDurationSec: 90 })
      expect(r?.exercises[0].restSec).toBe(90)
    })
  })

  it('adds and removes sets, copying targets and keeping at least one', async () => {
    const r = await createRoutine('A', [newRoutineExercise('ex-back-squat', 180, 1)])
    renderApp(`/routines/${r.id}`)
    const card = within(await screen.findByRole('listitem', { name: 'Back Squat' }))
    expect(card.getByRole('button', { name: 'Remove set 1' })).toBeDisabled()

    await userEvent.type(card.getByRole('textbox', { name: 'Set 1 target reps' }), '5')
    await userEvent.click(card.getByRole('button', { name: 'Add set' }))
    await userEvent.click(card.getByRole('button', { name: 'Add set' }))
    expect(card.getByRole('textbox', { name: 'Set 3 target reps' })).toHaveValue('5')

    await userEvent.click(card.getByRole('button', { name: 'Remove set 2' }))
    await waitFor(async () => expect((await getRoutine(r.id))?.exercises[0].sets).toHaveLength(2))
  })

  it('changes rest time, reorders and removes exercises from the ⋯ menu', async () => {
    const r = await createRoutine('A', [
      newRoutineExercise('ex-back-squat', 180),
      newRoutineExercise('ex-leg-press', 120),
      newRoutineExercise('ex-lying-leg-curl', 60),
    ])
    renderApp(`/routines/${r.id}`)
    const press = within(await screen.findByRole('listitem', { name: 'Leg Press' }))
    await userEvent.selectOptions(press.getByRole('combobox'), '1:30')

    await userEvent.click(press.getByRole('button', { name: 'More actions for Leg Press' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Move up' }))
    await userEvent.click(screen.getByRole('button', { name: 'More actions for Lying Leg Curl' }))
    expect(screen.getByRole('menuitem', { name: 'Move down' })).toBeDisabled()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Remove from routine' }))

    await waitFor(async () => {
      const saved = await getRoutine(r.id)
      expect(saved?.exercises.map((e) => [e.exerciseId, e.restSec])).toEqual([
        ['ex-leg-press', 90],
        ['ex-back-squat', 180],
      ])
    })
  })

  it('shows and edits weights in the display unit without changing other sets', async () => {
    await db.settings.put({ id: 'settings', displayUnit: 'lb', defaultRestSec: 90, autoStartRest: true })
    const r = await createRoutine('A', [newRoutineExercise('ex-deadlift', 180, 2)])
    await db.routines.update(r.id, {
      exercises: [
        {
          ...r.exercises[0],
          sets: [
            { targetReps: 5, targetWeight: 100, targetWeightUnit: 'kg' },
            { targetReps: 5, targetWeight: 100, targetWeightUnit: 'kg' },
          ],
        },
      ],
    })
    renderApp(`/routines/${r.id}`)
    const weight2 = await screen.findByRole('textbox', { name: 'Set 2 target weight (lb)' })
    expect(weight2).toHaveValue('220.5')
    await userEvent.clear(weight2)
    await userEvent.type(weight2, '225')

    await waitFor(async () => {
      const sets = (await getRoutine(r.id))!.exercises[0].sets
      expect(sets[0]).toEqual({ targetReps: 5, targetWeight: 100, targetWeightUnit: 'kg' })
      expect(sets[1]).toEqual({ targetReps: 5, targetWeight: 225, targetWeightUnit: 'lb' })
    })
  })

  it('deletes the routine from the editor without a late save bringing it back', async () => {
    const r = await createRoutine('Temp', [newRoutineExercise('ex-plank', 60)])
    renderApp(`/routines/${r.id}`)
    await userEvent.type(await screen.findByRole('textbox', { name: 'Name' }), ' edited')
    await userEvent.click(screen.getByRole('button', { name: 'Routine actions' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete routine' }))
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }))

    expect(await screen.findByRole('heading', { name: 'Routines' })).toBeInTheDocument()
    await new Promise((resolve) => setTimeout(resolve, 600))
    expect(await getRoutine(r.id)).toBeUndefined()
  })

  it('duplicates from the editor and opens the copy', async () => {
    const r = await createRoutine('Pull', [newRoutineExercise('ex-pull-up', 90)])
    renderApp(`/routines/${r.id}`)
    await userEvent.click(await screen.findByRole('button', { name: 'Routine actions' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }))
    expect(await screen.findByDisplayValue('Pull (copy)')).toBeInTheDocument()
  })

  it('saves the routine note', async () => {
    const r = await createRoutine('Push')
    renderApp(`/routines/${r.id}`)
    await userEvent.type(await screen.findByRole('textbox', { name: 'Note (optional)' }), 'Add 2.5 kg when all sets hit 8')
    await userEvent.tab()
    await waitFor(async () => expect((await getRoutine(r.id))?.note).toBe('Add 2.5 kg when all sets hit 8'))
  })

  it('tells you when a save fails, and recovers on the next change', async () => {
    const r = await createRoutine('Push')
    renderApp(`/routines/${r.id}`)
    const name = await screen.findByRole('textbox', { name: 'Name' })
    const put = vi.spyOn(db.routines, 'put').mockRejectedValueOnce(new Error('QuotaExceededError'))

    await userEvent.type(name, ' A')
    await userEvent.tab()
    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t save your last change')
    expect(name).toHaveValue('Push A') // edits kept on screen

    put.mockRestore()
    await userEvent.type(name, 'B')
    await userEvent.tab()
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    expect((await getRoutine(r.id))?.name).toBe('Push AB')
  })

  it('duplicate includes an edit made a moment before', async () => {
    const r = await createRoutine('Pull', [newRoutineExercise('ex-pull-up', 90)])
    renderApp(`/routines/${r.id}`)
    await userEvent.type(await screen.findByRole('textbox', { name: 'Note (optional)' }), 'fresh')
    await userEvent.click(screen.getByRole('button', { name: 'Routine actions' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }))
    expect(await screen.findByDisplayValue('Pull (copy)')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Note (optional)' })).toHaveValue('fresh')
  })

  it('says so when the routine does not exist', async () => {
    renderApp('/routines/nope')
    expect(await screen.findByText('Routine not found')).toBeInTheDocument()
  })
})

describe('pasting a list into a routine', () => {
  it('adds library matches and new exercises in the pasted order', async () => {
    const r = await createRoutine('Pull')
    renderApp(`/routines/${r.id}`)
    await userEvent.click(await screen.findByRole('button', { name: 'Paste a list of exercises' }))
    const sheet = await screen.findByRole('dialog', { name: 'Paste a list' })
    await userEvent.type(within(sheet).getByRole('textbox', { name: 'Exercise names' }), '1. pull up{Enter}2. Kelso Shrug')

    const preview = within(sheet).getByRole('region', { name: 'Preview' })
    expect(within(preview).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Pull-Up', 'Kelso ShrugNew'])

    // The new exercise needs a muscle group
    await userEvent.click(within(sheet).getByRole('button', { name: 'Add (2)' }))
    expect(await within(sheet).findByRole('alert')).toHaveTextContent('Pick at least one muscle group')
    await userEvent.click(within(within(sheet).getByRole('group', { name: 'Muscle groups' })).getByRole('button', { name: 'Back' }))
    await userEvent.click(within(sheet).getByRole('button', { name: 'Add (2)' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const list = screen.getByRole('list', { name: 'Exercises' })
    expect(await within(list).findByText('Kelso Shrug')).toBeInTheDocument()
    await waitFor(async () => {
      const saved = await getRoutine(r.id)
      expect(saved?.exercises.map((e) => e.exerciseId)[0]).toBe('ex-pull-up')
      expect(saved?.exercises).toHaveLength(2)
    })
    const shrug = await db.exercises.filter((e) => e.name === 'Kelso Shrug').first()
    expect(shrug).toMatchObject({ muscleGroups: ['back'], isCustom: true })
  })

  it('needs no setup when every name is already in the library', async () => {
    const r = await createRoutine('Pull')
    renderApp(`/routines/${r.id}`)
    await userEvent.click(await screen.findByRole('button', { name: 'Paste a list of exercises' }))
    const sheet = await screen.findByRole('dialog', { name: 'Paste a list' })
    await userEvent.type(within(sheet).getByRole('textbox', { name: 'Exercise names' }), 'Pull-Up')
    expect(within(sheet).queryByRole('group', { name: 'Muscle groups' })).not.toBeInTheDocument()
    await userEvent.click(within(sheet).getByRole('button', { name: 'Add (1)' }))
    await waitFor(async () => expect((await getRoutine(r.id))?.exercises).toHaveLength(1))
  })
})
