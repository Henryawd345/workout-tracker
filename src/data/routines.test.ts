import { beforeEach, describe, expect, it } from 'vitest'
import { resetDb } from '../test/factories.ts'
import { db } from './db.ts'
import {
  createRoutine,
  deleteRoutine,
  duplicateRoutine,
  getRoutine,
  listRoutines,
  newRoutineExercise,
  saveRoutine,
  StaleRoutineError,
} from './routines.ts'
import { finishWorkout, getActiveWorkout, saveWorkout, startWorkout } from './workouts.ts'

beforeEach(resetDb)

describe('routines', () => {
  it('are created with a name, defaulting when blank', async () => {
    expect((await createRoutine('  Push day ')).name).toBe('Push day')
    expect((await createRoutine('')).name).toBe('New routine')
  })

  it('save edits and list most recently changed first', async () => {
    const a = await createRoutine('A')
    await new Promise((r) => setTimeout(r, 5))
    await createRoutine('B')
    await new Promise((r) => setTimeout(r, 5))
    await saveRoutine({ ...a, exercises: [newRoutineExercise('ex-back-squat', 180, 5)] })

    const list = await listRoutines()
    expect(list.map((r) => r.name)).toEqual(['A', 'B'])
    expect(list[0].exercises[0].sets).toHaveLength(5)
  })

  it('will not bring back a deleted routine through a late save', async () => {
    const r = await createRoutine('Temp')
    await deleteRoutine(r.id)
    await expect(saveRoutine({ ...r, note: 'late' })).rejects.toBeInstanceOf(StaleRoutineError)
    expect(await getRoutine(r.id)).toBeUndefined()
  })

  it('saves a blank name as "Untitled routine"', async () => {
    const r = await createRoutine('Temp')
    expect((await saveRoutine({ ...r, name: '   ' })).name).toBe('Untitled routine')
  })

  it('duplicate into an independent copy', async () => {
    const original = await createRoutine('Legs', [newRoutineExercise('ex-back-squat', 180)])
    const copy = await duplicateRoutine(original.id)

    expect(copy.name).toBe('Legs (copy)')
    expect(copy.id).not.toBe(original.id)
    expect(copy.exercises[0].id).not.toBe(original.exercises[0].id)
    expect(copy.exercises[0].exerciseId).toBe('ex-back-squat')

    copy.exercises[0].sets.push({ targetReps: 5 })
    await saveRoutine(copy)
    expect((await getRoutine(original.id))!.exercises[0].sets).toHaveLength(3)
  })

  it('delete without touching past workouts', async () => {
    const routine = await createRoutine('Legs', [newRoutineExercise('ex-back-squat', 180, 1)])
    const w = await startWorkout({ routineId: routine.id })
    w.exercises[0].sets[0] = { ...w.exercises[0].sets[0], weight: 100, reps: 5, completed: true }
    await saveWorkout(w)
    await finishWorkout(w.id)

    await deleteRoutine(routine.id)
    expect(await getRoutine(routine.id)).toBeUndefined()
    const past = await db.workouts.get(w.id)
    expect(past).toMatchObject({ routineId: null, name: 'Legs', status: 'completed' })
    expect(past!.exercises[0].sets[0].weight).toBe(100)
  })

  it('delete while a workout from it is in progress, keeping that workout usable', async () => {
    const routine = await createRoutine('Legs', [newRoutineExercise('ex-back-squat', 180, 2)])
    const w = await startWorkout({ routineId: routine.id })

    await deleteRoutine(routine.id)

    const active = await getActiveWorkout()
    expect(active).toMatchObject({ id: w.id, status: 'active', routineId: null, name: 'Legs' })
    expect(active!.exercises[0].sets).toHaveLength(2)
    // …and it can still be auto-saved and finished
    active!.exercises[0].sets[0] = { ...active!.exercises[0].sets[0], weight: 100, reps: 5, completed: true }
    await saveWorkout(active!)
    await expect(finishWorkout(w.id)).resolves.toMatchObject({ status: 'completed' })
  })
})
