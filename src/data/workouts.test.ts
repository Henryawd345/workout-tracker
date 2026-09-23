import { beforeEach, describe, expect, it } from 'vitest'
import { addCompletedWorkout, done, makeExercise, makeSet, resetDb } from '../test/factories.ts'
import { db } from './db.ts'
import { createRoutine, newRoutineExercise } from './routines.ts'
import { updateSettings } from './settings.ts'
import {
  ActiveWorkoutExistsError,
  deleteWorkout,
  discardWorkout,
  EmptyWorkoutError,
  finishWorkout,
  getActiveWorkout,
  getExerciseHistory,
  getLastPerformance,
  listCompletedWorkouts,
  newWorkoutExercise,
  saveWorkout,
  StaleSaveError,
  startWorkout,
} from './workouts.ts'
import { previousSetsFor } from './stats.ts'

beforeEach(resetDb)

const T0 = '2026-09-23T10:00:00.000Z'
const T1 = '2026-09-23T11:00:00.000Z'

describe('starting a workout', () => {
  it('starts an empty workout', async () => {
    const w = await startWorkout({ now: T0 })
    expect(w).toMatchObject({ name: 'Workout', status: 'active', startedAt: T0, exercises: [], routineId: null })
    expect(await getActiveWorkout()).toEqual(w)
  })

  it('copies exercises, set counts and rest times from a routine, with empty values', async () => {
    await updateSettings({ displayUnit: 'lb' })
    const routine = await createRoutine('Push', [
      newRoutineExercise('ex-barbell-bench-press', 180, 4),
      newRoutineExercise('ex-lateral-raise', 60, 3),
    ])
    const w = await startWorkout({ routineId: routine.id })

    expect(w.name).toBe('Push')
    expect(w.routineId).toBe(routine.id)
    expect(w.exerciseIds).toEqual(['ex-barbell-bench-press', 'ex-lateral-raise'])
    expect(w.exercises.map((e) => [e.restSec, e.sets.length])).toEqual([
      [180, 4],
      [60, 3],
    ])
    const set = w.exercises[0].sets[0]
    expect(set).toMatchObject({ weight: null, reps: null, completed: false, weightUnit: 'lb' })
  })

  it('allows only one workout in progress', async () => {
    const first = await startWorkout()
    const error = await startWorkout().catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ActiveWorkoutExistsError)
    expect((error as ActiveWorkoutExistsError).workoutId).toBe(first.id)
  })

  it('fails for a missing routine', async () => {
    await expect(startWorkout({ routineId: 'nope' })).rejects.toThrow('Routine not found')
  })
})

describe('saving and recovering', () => {
  it('auto-saved changes survive closing and reopening the database', async () => {
    const w = await startWorkout()
    w.exercises.push(newWorkoutExercise('ex-deadlift', 120, 'kg', 2))
    w.exercises[0].sets[0] = { ...w.exercises[0].sets[0], weight: 140, reps: 5, completed: true }
    await saveWorkout(w)

    db.close()
    await db.open()

    const recovered = await getActiveWorkout()
    expect(recovered?.id).toBe(w.id)
    expect(recovered?.exercises[0].sets[0]).toMatchObject({ weight: 140, reps: 5, completed: true })
    expect(recovered?.exerciseIds).toEqual(['ex-deadlift'])
  })

  it('ignores a late auto-save after the workout was finished', async () => {
    const w = await startWorkout()
    w.exercises = [makeExercise('ex-back-squat', [done(100, 5), makeSet()])]
    await saveWorkout(w)
    const staleSnapshot = structuredClone(w)

    await finishWorkout(w.id)
    await expect(saveWorkout(staleSnapshot)).rejects.toBeInstanceOf(StaleSaveError)

    const stored = await db.workouts.get(w.id)
    expect(stored?.status).toBe('completed')
    expect(stored?.exercises[0].sets).toHaveLength(1)
    expect(await getActiveWorkout()).toBeUndefined()
  })

  it('ignores a late auto-save after the workout was discarded', async () => {
    const w = await startWorkout()
    await discardWorkout(w.id)
    await expect(saveWorkout(w)).rejects.toBeInstanceOf(StaleSaveError)
    expect(await db.workouts.count()).toBe(0)
  })

  it('applies saves in the order they were made', async () => {
    const w = await startWorkout()
    const saves = [1, 2, 3].map((n) => saveWorkout({ ...w, note: `note ${n}` }))
    await Promise.all(saves)
    expect((await getActiveWorkout())?.note).toBe('note 3')
  })

  it('saves edits to a finished workout (history correction)', async () => {
    const past = await addCompletedWorkout(T0, [makeExercise('ex-deadlift', [done(140, 5)])])
    past.exercises[0].sets[0].reps = 6
    await saveWorkout(past)
    expect((await db.workouts.get(past.id))?.exercises[0].sets[0].reps).toBe(6)
  })

  it('keeps exerciseIds in sync when exercises change', async () => {
    const w = await startWorkout()
    w.exercises = [
      newWorkoutExercise('ex-deadlift', 120, 'kg'),
      newWorkoutExercise('ex-plank', 60, 'kg'),
      newWorkoutExercise('ex-deadlift', 120, 'kg'),
    ]
    expect((await saveWorkout(w)).exerciseIds).toEqual(['ex-deadlift', 'ex-plank'])
    w.exercises = [w.exercises[1]]
    expect((await saveWorkout(w)).exerciseIds).toEqual(['ex-plank'])
  })
})

describe('finishing a workout', () => {
  it('keeps completed sets only and drops exercises left empty', async () => {
    const w = await startWorkout({ now: T0 })
    w.exercises = [
      makeExercise('ex-back-squat', [done(100, 5), makeSet({ weight: 100, reps: 5 }), done(100, 4)]),
      makeExercise('ex-leg-press', [makeSet({ weight: 200, reps: 10 })]),
    ]
    await saveWorkout(w)

    const finished = await finishWorkout(w.id, T1)
    expect(finished).toMatchObject({ status: 'completed', endedAt: T1, restTimer: null })
    expect(finished.exercises).toHaveLength(1)
    expect(finished.exercises[0].sets.map((s) => s.reps)).toEqual([5, 4])
    expect(finished.exerciseIds).toEqual(['ex-back-squat'])
    expect(await getActiveWorkout()).toBeUndefined()
  })

  it('refuses to finish with no completed sets, leaving the workout active', async () => {
    const w = await startWorkout()
    w.exercises = [makeExercise('ex-back-squat', [makeSet({ weight: 100, reps: 5 })])]
    await saveWorkout(w)
    await expect(finishWorkout(w.id)).rejects.toBeInstanceOf(EmptyWorkoutError)
    expect((await getActiveWorkout())?.id).toBe(w.id)
  })

  it('cannot finish twice', async () => {
    const w = await startWorkout()
    w.exercises = [makeExercise('ex-back-squat', [done(100, 5)])]
    await saveWorkout(w)
    await finishWorkout(w.id)
    await expect(finishWorkout(w.id)).rejects.toThrow('already finished')
  })

  it('lets a new workout start afterwards', async () => {
    const w = await startWorkout()
    w.exercises = [makeExercise('ex-back-squat', [done(100, 5)])]
    await saveWorkout(w)
    await finishWorkout(w.id)
    await expect(startWorkout()).resolves.toMatchObject({ status: 'active' })
  })
})

describe('discarding and deleting', () => {
  it('discards the workout in progress', async () => {
    const w = await startWorkout()
    await discardWorkout(w.id)
    expect(await getActiveWorkout()).toBeUndefined()
  })

  it('will not discard a finished workout', async () => {
    const past = await addCompletedWorkout(T0, [makeExercise('ex-deadlift', [done(100, 5)])])
    await expect(discardWorkout(past.id)).rejects.toThrow()
    expect(await db.workouts.get(past.id)).toBeDefined()
  })

  it('deletes from history', async () => {
    const past = await addCompletedWorkout(T0, [makeExercise('ex-deadlift', [done(100, 5)])])
    await deleteWorkout(past.id)
    expect(await listCompletedWorkouts()).toEqual([])
  })

  it('will not delete the workout in progress through history', async () => {
    const w = await startWorkout()
    await expect(deleteWorkout(w.id)).rejects.toThrow()
    expect((await getActiveWorkout())?.id).toBe(w.id)
  })
})

describe('history lookups', () => {
  beforeEach(async () => {
    await addCompletedWorkout('2026-09-01T10:00:00Z', [makeExercise('ex-back-squat', [done(100, 5)])], { id: 'sep1' })
    await addCompletedWorkout('2026-09-08T10:00:00Z', [makeExercise('ex-back-squat', [done(105, 5), done(105, 4)])], {
      id: 'sep8',
    })
    await addCompletedWorkout('2026-09-04T10:00:00Z', [makeExercise('ex-deadlift', [done(140, 5)])], { id: 'sep4' })
  })

  it('lists finished workouts newest first, excluding the one in progress', async () => {
    await startWorkout()
    expect((await listCompletedWorkouts()).map((w) => w.id)).toEqual(['sep8', 'sep4', 'sep1'])
  })

  it('returns one exercise’s sessions oldest first', async () => {
    const history = await getExerciseHistory('ex-back-squat')
    expect(history.map((s) => s.workoutId)).toEqual(['sep1', 'sep8'])
    expect(history[1].sets).toHaveLength(2)
  })

  it('finds last time for an exercise', async () => {
    const last = await getLastPerformance('ex-back-squat', '2026-09-23T00:00:00Z')
    expect(last?.workoutId).toBe('sep8')
    expect(last?.sets.map((s) => s.weight)).toEqual([105, 105])
  })

  it('finds the session before an older workout being edited', async () => {
    const last = await getLastPerformance('ex-back-squat', '2026-09-08T10:00:00Z')
    expect(last?.workoutId).toBe('sep1')
  })

  it('returns null for an exercise never done', async () => {
    expect(await getLastPerformance('ex-plank')).toBeNull()
  })

  it('ignores the workout in progress', async () => {
    const w = await startWorkout()
    w.exercises = [makeExercise('ex-back-squat', [done(200, 1)])]
    await saveWorkout(w)
    expect((await getLastPerformance('ex-back-squat'))?.workoutId).toBe('sep8')
  })

  it('combines sets when an exercise appears twice in a workout', async () => {
    await addCompletedWorkout('2026-09-10T10:00:00Z', [
      makeExercise('ex-deadlift', [done(150, 3)]),
      makeExercise('ex-back-squat', [done(60, 10)]),
      makeExercise('ex-deadlift', [done(120, 8)]),
    ])
    const last = await getLastPerformance('ex-deadlift', '2026-09-23T00:00:00Z')
    expect(last?.sets.map((s) => s.weight)).toEqual([150, 120])
    // …while keeping each appearance separate for suggestions
    expect(last?.occurrences?.map((sets) => sets.map((s) => s.weight))).toEqual([[150], [120]])
    expect(previousSetsFor(last, 1).map((s) => s.weight)).toEqual([120])
    expect(previousSetsFor(last, 2).map((s) => s.weight)).toEqual([150, 120])
    expect(previousSetsFor(null, 0)).toEqual([])
  })
})
