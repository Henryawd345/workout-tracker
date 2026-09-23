import { describe, expect, it } from 'vitest'
import { done, makeExercise, makeSet } from '../test/factories.ts'
import { recordsSetBy } from './stats.ts'
import type { Workout } from './types.ts'
import {
  addWorkoutExercises,
  addWorkoutSet,
  insertWorkoutExercise,
  insertWorkoutSet,
  moveWorkoutExercise,
  occurrenceIndex,
  removeWorkoutExercise,
  removeWorkoutSet,
  replaceWorkoutExercise,
  restoreWorkoutExercise,
  setCounts,
  toggleWorkoutSet,
  updateWorkoutSet,
} from './workoutEditing.ts'

const NOW = '2026-09-23T10:30:00.000Z'

function workout(exercises = [makeExercise('ex-squat', [makeSet(), makeSet()])]): Workout {
  return {
    id: 'w',
    name: 'W',
    routineId: null,
    status: 'active',
    startedAt: '2026-09-23T10:00:00.000Z',
    endedAt: null,
    note: '',
    exercises,
    exerciseIds: [],
    restTimer: null,
    updatedAt: '2026-09-23T10:00:00.000Z',
  }
}

const suggestion = { weight: 100, weightUnit: 'kg' as const, reps: 5, durationSec: null }

describe('workout editing', () => {
  it('adds exercises with the requested number of empty sets (at least one)', () => {
    const w = addWorkoutExercises(
      workout([]),
      [
        { exerciseId: 'ex-a', restSec: 90, setCount: 3 },
        { exerciseId: 'ex-b', restSec: 60, setCount: 0 },
      ],
      'lb',
    )
    expect(w.exercises.map((e) => [e.exerciseId, e.sets.length, e.restSec])).toEqual([
      ['ex-a', 3, 90],
      ['ex-b', 1, 60],
    ])
    expect(w.exercises[0].sets[0]).toMatchObject({ weight: null, weightUnit: 'lb', completed: false })
  })

  it('completes a set from the suggestion in one tap, and un-completes it', () => {
    const w = workout()
    const [e] = w.exercises
    const once = toggleWorkoutSet(w, e.id, e.sets[0].id, suggestion, 'weight_reps', NOW)!
    expect(once.exercises[0].sets[0]).toMatchObject({ weight: 100, reps: 5, completed: true, completedAt: NOW })
    const twice = toggleWorkoutSet(once, e.id, e.sets[0].id, suggestion, 'weight_reps', NOW)!
    expect(twice.exercises[0].sets[0]).toMatchObject({ weight: 100, reps: 5, completed: false, completedAt: null })
  })

  it('refuses to complete without the needed values', () => {
    const w = workout()
    const empty = { weight: null, weightUnit: 'kg' as const, reps: null, durationSec: null }
    expect(toggleWorkoutSet(w, w.exercises[0].id, w.exercises[0].sets[0].id, empty, 'weight_reps')).toBeNull()
  })

  it('stores typed values in the unit typed', () => {
    const w = workout()
    const [e] = w.exercises
    const next = updateWorkoutSet(w, e.id, e.sets[1].id, { weight: 225, weightUnit: 'lb' })
    expect(next.exercises[0].sets[1]).toMatchObject({ weight: 225, weightUnit: 'lb' })
    expect(next.exercises[0].sets[0].weight).toBeNull()
  })

  it('adds and removes sets and exercises, and reorders', () => {
    let w = addWorkoutExercises(workout(), [{ exerciseId: 'ex-b', restSec: 60, setCount: 1 }], 'kg')
    const [a, b] = w.exercises
    w = addWorkoutSet(w, a.id, 'kg')
    expect(w.exercises[0].sets).toHaveLength(3)
    w = removeWorkoutSet(w, a.id, a.sets[0].id)
    expect(w.exercises[0].sets).toHaveLength(2)
    w = moveWorkoutExercise(w, 1, 0)
    expect(w.exercises.map((e) => e.id)).toEqual([b.id, a.id])
    w = removeWorkoutExercise(w, b.id)
    expect(w.exercises.map((e) => e.id)).toEqual([a.id])
  })

  it('replacing an exercise keeps the set count but clears values', () => {
    const w = workout([makeExercise('ex-squat', [done(100, 5), makeSet({ weight: 100 })])])
    const next = replaceWorkoutExercise(w, w.exercises[0].id, 'ex-leg-press', 'kg')
    expect(next.exercises[0].exerciseId).toBe('ex-leg-press')
    expect(next.exercises[0].sets).toHaveLength(2)
    expect(next.exercises[0].sets.every((s) => s.weight === null && !s.completed)).toBe(true)
  })

  it('undo puts back one thing without touching later changes', () => {
    const w = workout([makeExercise('ex-a', [makeSet({ reps: 1 }), makeSet({ reps: 2 }), makeSet({ reps: 3 })]), makeExercise('ex-b', [makeSet()])])
    const [a, b] = w.exercises
    const deleted = a.sets[1]

    // delete set 2, then tick another set, then undo the delete
    let next = removeWorkoutSet(w, a.id, deleted.id)
    next = toggleWorkoutSet(next, b.id, b.sets[0].id, suggestion, 'weight_reps', NOW)!
    next = insertWorkoutSet(next, a.id, deleted, 1)
    expect(next.exercises[0].sets.map((s) => s.reps)).toEqual([1, 2, 3])
    expect(next.exercises[1].sets[0].completed).toBe(true)

    // remove an exercise and put it back in place
    next = insertWorkoutExercise(removeWorkoutExercise(next, a.id), a, 0)
    expect(next.exercises.map((e) => e.id)).toEqual([a.id, b.id])

    // replace, then restore
    const replaced = replaceWorkoutExercise(next, b.id, 'ex-c', 'kg')
    expect(restoreWorkoutExercise(replaced, next.exercises[1])!.exercises[1]).toEqual(next.exercises[1])
  })

  it('will not undo a replace once sets were logged on the new exercise', () => {
    const w = workout([makeExercise('ex-a', [makeSet(), makeSet()])])
    const before = w.exercises[0]
    let next = replaceWorkoutExercise(w, before.id, 'ex-b', 'kg')
    next = updateWorkoutSet(next, before.id, next.exercises[0].sets[0].id, { reps: 10 })
    expect(restoreWorkoutExercise(next, before)).toBeNull()
  })

  it('counts sets and finds which appearance of an exercise a card is', () => {
    const w = workout([
      makeExercise('ex-a', [done(1, 1), makeSet()]),
      makeExercise('ex-b', [makeSet()]),
      makeExercise('ex-a', [done(1, 1)]),
    ])
    expect(setCounts(w)).toEqual({ completed: 2, total: 4 })
    expect(occurrenceIndex(w, w.exercises[0].id)).toBe(0)
    expect(occurrenceIndex(w, w.exercises[1].id)).toBe(0)
    expect(occurrenceIndex(w, w.exercises[2].id)).toBe(1)
  })
})

describe('recordsSetBy', () => {
  const history = [
    { workoutId: 'a', date: '2026-09-01T10:00:00Z', sets: [done(100, 5)] },
    { workoutId: 'b', date: '2026-09-08T10:00:00Z', sets: [done(105, 3), done(80, 12)] },
    { workoutId: 'c', date: '2026-09-15T10:00:00Z', sets: [done(105, 3)] },
  ]

  it('lists the records a workout beat', () => {
    expect(recordsSetBy(history, 'b', 'kg').sort()).toEqual(['bestVolume', 'heaviestWeight', 'mostReps'])
  })

  it('matching an old best is not a new record', () => {
    expect(recordsSetBy(history, 'c', 'kg')).toEqual([])
  })

  it('the first session ever sets no records', () => {
    expect(recordsSetBy(history, 'a', 'kg')).toEqual([])
  })

  it('ignores sessions after the workout (e.g. when editing an old one)', () => {
    const later = [...history, { workoutId: 'd', date: '2026-09-20T10:00:00Z', sets: [done(200, 1)] }]
    expect(recordsSetBy(later, 'b', 'kg')).toContain('heaviestWeight')
  })
})
