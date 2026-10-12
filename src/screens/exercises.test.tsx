import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../data/db.ts'
import { createCustomExercise } from '../data/index.ts'
import { addCompletedWorkout, done, makeExercise, resetDb } from '../test/factories.ts'
import { renderApp } from '../test/renderApp.tsx'

beforeEach(resetDb)

const allList = () => screen.findByRole('region', { name: /All exercises|Results/ })

describe('exercise library', () => {
  it('opens from the Routines tab and lists the built-in exercises', async () => {
    renderApp('/routines')
    await userEvent.click(await screen.findByRole('link', { name: 'Exercises' }))
    const list = await allList()
    expect(await within(list).findByText('Barbell Bench Press')).toBeInTheDocument()
    expect(within(list).getAllByRole('link').length).toBeGreaterThanOrEqual(80)
  })

  it('searches by name, muscle and equipment words', async () => {
    renderApp('/routines/exercises')
    await screen.findByText('Barbell Bench Press')
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search exercises' }), 'cable chest')
    const results = await screen.findByRole('region', { name: 'Results' })
    expect(within(results).getAllByRole('link').map((l) => l.textContent)).toEqual([
      expect.stringContaining('Cable Fly'),
    ])
    expect(screen.getByText('1 result')).toBeInTheDocument()
  })

  it('filters with the muscle and equipment chips', async () => {
    renderApp('/routines/exercises')
    await screen.findByText('Barbell Bench Press')
    const muscle = screen.getByRole('group', { name: 'Muscle group' })
    const equipment = screen.getByRole('group', { name: 'Equipment' })
    await userEvent.click(within(muscle).getByRole('button', { name: 'Hamstrings' }))
    await userEvent.click(within(equipment).getByRole('button', { name: 'Machine' }))
    expect(within(muscle).getByRole('button', { name: 'Hamstrings' })).toHaveAttribute('aria-pressed', 'true')
    const results = await screen.findByRole('region', { name: 'Results' })
    expect(within(results).getAllByRole('link')).toHaveLength(2)
    // tapping the chip again clears it
    await userEvent.click(within(muscle).getByRole('button', { name: 'Hamstrings' }))
    expect(within(muscle).getByRole('button', { name: 'All muscles' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('keeps the search when coming back from an exercise', async () => {
    renderApp('/routines/exercises')
    await screen.findByText('Barbell Bench Press')
    await userEvent.type(screen.getByRole('searchbox'), 'plank')
    await userEvent.click(await screen.findByRole('link', { name: /^Plank/ }))
    expect(await screen.findByRole('heading', { name: 'Plank' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Back to exercises' }))
    expect(await screen.findByRole('searchbox')).toHaveValue('plank')
  })

  it('offers to create an exercise when nothing matches, with the name filled in', async () => {
    renderApp('/routines/exercises')
    await screen.findByText('Barbell Bench Press')
    await userEvent.type(screen.getByRole('searchbox'), 'Landmine Press')
    await userEvent.click(await screen.findByRole('button', { name: 'Create “Landmine Press”' }))
    expect(await screen.findByRole('heading', { name: 'New exercise' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Landmine Press')
  })

  it('shows recently used exercises first', async () => {
    await addCompletedWorkout('2026-09-20T10:00:00Z', [makeExercise('ex-deadlift', [done(140, 5)])])
    renderApp('/routines/exercises')
    const recent = await screen.findByRole('region', { name: 'Recent' })
    expect(within(recent).getByText('Deadlift')).toBeInTheDocument()
  })

  it('hides archived exercises behind a toggle', async () => {
    const e = await createCustomExercise({
      name: 'Old Thing',
      muscleGroups: ['core'],
      equipment: 'other',
      trackingType: 'reps_only',
    })
    await db.exercises.update(e.id, { archived: true })
    renderApp('/routines/exercises')
    await screen.findByText('Barbell Bench Press')
    expect(screen.queryByText('Old Thing')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Show archived (1)' }))
    expect(screen.getByText('Old Thing')).toBeInTheDocument()
  })
})

describe('creating a custom exercise', () => {
  async function fillForm(name: string) {
    const nameField = await screen.findByRole('textbox', { name: 'Name' })
    await userEvent.clear(nameField)
    await userEvent.type(nameField, name)
    await userEvent.click(screen.getByRole('button', { name: 'Shoulders' }))
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Equipment' }), 'Barbell')
  }

  it('creates it and opens it', async () => {
    renderApp('/routines/exercises/new')
    await fillForm('Landmine Press')
    await userEvent.click(screen.getByRole('radio', { name: 'Reps only' }))
    await userEvent.click(screen.getByRole('button', { name: 'Create exercise' }))

    expect(await screen.findByRole('heading', { name: 'Landmine Press' })).toBeInTheDocument()
    const saved = await db.exercises.where('name').equals('Landmine Press').first()
    expect(saved).toMatchObject({ isCustom: true, muscleGroups: ['shoulders'], trackingType: 'reps_only' })
  })

  it('explains what is wrong instead of saving', async () => {
    renderApp('/routines/exercises/new')
    await userEvent.type(await screen.findByRole('textbox', { name: 'Name' }), 'Something')
    await userEvent.click(screen.getByRole('button', { name: 'Create exercise' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Pick at least one muscle group')

    await fillForm('Deadlift')
    await userEvent.click(screen.getByRole('button', { name: 'Create exercise' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('“Deadlift” already exists')

    await userEvent.clear(screen.getByRole('textbox', { name: 'Name' }))
    await userEvent.click(screen.getByRole('button', { name: 'Create exercise' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Exercise name is required')
  })
})

describe('exercise detail', () => {
  it('shows a built-in exercise read-only, with an editable note that auto-saves', async () => {
    renderApp('/routines/exercises/ex-leg-press')
    expect(await screen.findByRole('heading', { name: 'Leg Press' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Name' })).not.toBeInTheDocument()
    expect(screen.getByText('Quads, Glutes')).toBeInTheDocument()

    await userEvent.type(screen.getByRole('textbox', { name: 'Note' }), 'Seat 4')
    await userEvent.tab()
    await waitFor(async () => expect((await db.exercises.get('ex-leg-press'))?.note).toBe('Seat 4'))
  })

  it('saves the note when leaving the page mid-typing', async () => {
    const { router } = renderApp('/routines/exercises/ex-leg-press')
    await userEvent.type(await screen.findByRole('textbox', { name: 'Note' }), 'Feet high')
    await router.navigate('/routines/exercises')
    await waitFor(async () => expect((await db.exercises.get('ex-leg-press'))?.note).toBe('Feet high'))
  })

  it('edits a custom exercise, saving as you go', async () => {
    const e = await createCustomExercise({
      name: 'Landmine Press',
      muscleGroups: ['shoulders'],
      equipment: 'barbell',
      trackingType: 'weight_reps',
    })
    renderApp(`/routines/exercises/${e.id}`)
    const name = await screen.findByRole('textbox', { name: 'Name' })
    await userEvent.clear(name)
    await userEvent.type(name, 'Landmine Press (one arm){Enter}')
    await userEvent.click(screen.getByRole('button', { name: 'Chest' }))

    await waitFor(async () =>
      expect(await db.exercises.get(e.id)).toMatchObject({
        name: 'Landmine Press (one arm)',
        muscleGroups: ['shoulders', 'chest'],
      }),
    )
  })

  it('rejects a duplicate name and puts the old one back', async () => {
    const e = await createCustomExercise({
      name: 'Landmine Press',
      muscleGroups: ['shoulders'],
      equipment: 'barbell',
      trackingType: 'weight_reps',
    })
    renderApp(`/routines/exercises/${e.id}`)
    const name = await screen.findByRole('textbox', { name: 'Name' })
    await userEvent.clear(name)
    await userEvent.type(name, 'Deadlift{Enter}')
    expect(await screen.findByRole('alert')).toHaveTextContent('already exists')
    expect(name).toHaveValue('Landmine Press')
  })

  it('locks the tracking type once logged', async () => {
    const e = await createCustomExercise({
      name: 'Sled Push',
      muscleGroups: ['quads'],
      equipment: 'other',
      trackingType: 'weight_reps',
    })
    await addCompletedWorkout('2026-09-20T10:00:00Z', [makeExercise(e.id, [done(100, 10)])])
    renderApp(`/routines/exercises/${e.id}`)
    expect(await screen.findByText('Locked because this exercise has been logged.')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Time' })).toBeDisabled()
  })

  it('removes an unused custom exercise after confirming', async () => {
    const e = await createCustomExercise({ name: 'Temp', muscleGroups: ['core'], equipment: 'other', trackingType: 'reps_only' })
    renderApp(`/routines/exercises/${e.id}`)
    await userEvent.click(await screen.findByRole('button', { name: 'Remove exercise' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Remove Temp?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove' }))

    expect(await screen.findByRole('heading', { name: 'Exercises' })).toBeInTheDocument()
    expect(await db.exercises.get(e.id)).toBeUndefined()
  })

  it('cancelling the dialog keeps the exercise', async () => {
    const e = await createCustomExercise({ name: 'Temp', muscleGroups: ['core'], equipment: 'other', trackingType: 'reps_only' })
    renderApp(`/routines/exercises/${e.id}`)
    await userEvent.click(await screen.findByRole('button', { name: 'Remove exercise' }))
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(await db.exercises.get(e.id)).toBeDefined()
  })

  it('archives a used exercise instead, and can restore it', async () => {
    const e = await createCustomExercise({ name: 'Sled Push', muscleGroups: ['quads'], equipment: 'other', trackingType: 'weight_reps' })
    await addCompletedWorkout('2026-09-20T10:00:00Z', [makeExercise(e.id, [done(100, 10)])])
    renderApp(`/routines/exercises/${e.id}`)
    await userEvent.click(await screen.findByRole('button', { name: 'Remove exercise' }))
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove' }))

    expect(await screen.findByText(/Archived — hidden/)).toBeInTheDocument()
    expect((await db.exercises.get(e.id))?.archived).toBe(true)
    await userEvent.click(screen.getByRole('button', { name: 'Restore' }))
    await waitFor(async () => expect((await db.exercises.get(e.id))?.archived).toBe(false))
  })

  it('says so when the exercise does not exist', async () => {
    renderApp('/routines/exercises/nope')
    expect(await screen.findByText('Exercise not found')).toBeInTheDocument()
  })
})

describe('importing a list of exercises', () => {
  it('adds every new name with the chosen details and says how many', async () => {
    renderApp('/routines/exercises/new')
    await userEvent.click(await screen.findByRole('link', { name: /Import several at once/ }))
    const names = await screen.findByRole('textbox', { name: 'Exercise names' })
    await userEvent.type(names, '- Kelso Shrug{Enter}2. Meadows Row{Enter}Barbell Bench Press')

    const skipped = await screen.findByRole('region', { name: 'Skipped' })
    expect(within(skipped).getByText(/Barbell Bench Press — already in your library/)).toBeInTheDocument()

    // A muscle group is required
    await userEvent.click(screen.getByRole('button', { name: 'Import 2 exercises' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Pick at least one muscle group')

    await userEvent.click(within(screen.getByRole('group', { name: 'Muscle groups' })).getByRole('button', { name: 'Back' }))
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Equipment' }), 'Dumbbell')
    await userEvent.click(screen.getByRole('button', { name: 'Import 2 exercises' }))

    expect(await screen.findByText('2 exercises added')).toBeInTheDocument()
    const list = await allList()
    expect(await within(list).findByText('Kelso Shrug')).toBeInTheDocument()
    expect(within(list).getByText('Meadows Row')).toBeInTheDocument()
    const stored = await db.exercises.filter((e) => e.name === 'Meadows Row').first()
    expect(stored).toMatchObject({ muscleGroups: ['back'], equipment: 'dumbbell', isCustom: true })
  })

  it('opens from the exercise library', async () => {
    renderApp('/routines/exercises')
    await userEvent.click(await screen.findByRole('link', { name: 'Import a list of exercises' }))
    expect(await screen.findByRole('heading', { name: 'Import exercises' })).toBeInTheDocument()
  })
})
