import { describe, expect, it } from 'vitest'
import {
  addPlannedSet,
  addRoutineExercises,
  DEFAULT_ROUTINE_SETS,
  moveItem,
  moveRoutineExercise,
  removePlannedSet,
  removeRoutineExercise,
  setRoutineExerciseRest,
  updatePlannedSet,
} from './routineEditing.ts'
import type { Routine } from './types.ts'

const base: Routine = {
  id: 'r1',
  name: 'Push',
  note: '',
  exercises: [],
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
}

describe('moveItem', () => {
  it('moves forwards and backwards', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c'])
  })

  it('ignores out-of-range moves', () => {
    const items = ['a', 'b']
    expect(moveItem(items, 0, 5)).toBe(items)
    expect(moveItem(items, -1, 0)).toBe(items)
  })
})

describe('routine editing', () => {
  const withTwo = addRoutineExercises(base, ['ex-bench', 'ex-row'], 120)

  it('adds exercises with default sets and rest, keeping the original untouched', () => {
    expect(withTwo.exercises.map((e) => e.exerciseId)).toEqual(['ex-bench', 'ex-row'])
    expect(withTwo.exercises[0].sets).toHaveLength(DEFAULT_ROUTINE_SETS)
    expect(withTwo.exercises[0].restSec).toBe(120)
    expect(base.exercises).toHaveLength(0)
  })

  it('removes and reorders exercises', () => {
    const [a, b] = withTwo.exercises
    expect(moveRoutineExercise(withTwo, 1, 0).exercises.map((e) => e.id)).toEqual([b.id, a.id])
    expect(removeRoutineExercise(withTwo, a.id).exercises.map((e) => e.id)).toEqual([b.id])
  })

  it('sets rest time for one exercise only', () => {
    const [a, b] = withTwo.exercises
    const r = setRoutineExerciseRest(withTwo, a.id, 60)
    expect(r.exercises.find((e) => e.id === a.id)?.restSec).toBe(60)
    expect(r.exercises.find((e) => e.id === b.id)?.restSec).toBe(120)
  })

  it('adds a set copying the previous targets', () => {
    const id = withTwo.exercises[0].id
    let r = updatePlannedSet(withTwo, id, 2, { targetReps: 8, targetWeight: 60, targetWeightUnit: 'kg' })
    r = addPlannedSet(r, id)
    expect(r.exercises[0].sets).toHaveLength(4)
    expect(r.exercises[0].sets[3]).toEqual({ targetReps: 8, targetWeight: 60, targetWeightUnit: 'kg' })
  })

  it('removes a set but never the last one', () => {
    const id = withTwo.exercises[0].id
    let r = removePlannedSet(withTwo, id, 0)
    r = removePlannedSet(r, id, 0)
    expect(r.exercises[0].sets).toHaveLength(1)
    r = removePlannedSet(r, id, 0)
    expect(r.exercises[0].sets).toHaveLength(1)
  })

  it('clears a target when set to undefined, and the unit with the weight', () => {
    const id = withTwo.exercises[0].id
    let r = updatePlannedSet(withTwo, id, 0, { targetReps: 5, targetWeight: 100, targetWeightUnit: 'kg' })
    r = updatePlannedSet(r, id, 0, { targetWeight: undefined })
    expect(r.exercises[0].sets[0]).toEqual({ targetReps: 5 })
  })
})
