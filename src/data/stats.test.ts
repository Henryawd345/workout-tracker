import { describe, expect, it } from 'vitest'
import { done, doneTimed, makeExercise, makeSet } from '../test/factories.ts'
import {
  personalRecords,
  sessionMetrics,
  setsVolume,
  workoutCompletedSetCount,
  workoutDurationSec,
  workoutVolume,
} from './stats.ts'
import type { Workout } from './types.ts'

function workout(partial: Partial<Workout>): Workout {
  return {
    id: 'w1',
    name: 'W',
    routineId: null,
    status: 'completed',
    startedAt: '2026-09-01T10:00:00.000Z',
    endedAt: '2026-09-01T11:05:30.000Z',
    note: '',
    exercises: [],
    exerciseIds: [],
    restTimer: null,
    updatedAt: '2026-09-01T11:05:30.000Z',
    ...partial,
  }
}

describe('volume', () => {
  it('sums weight × reps of completed sets only', () => {
    const sets = [done(100, 5), done(100, 5), makeSet({ weight: 100, reps: 5, completed: false })]
    expect(setsVolume(sets, 'kg')).toBe(1000)
  })

  it('converts mixed units into the display unit', () => {
    expect(setsVolume([done(100, 1, 'kg'), done(100, 1, 'lb')], 'kg')).toBe(145.4)
  })

  it('ignores bodyweight and timed sets', () => {
    const repsOnly = makeSet({ reps: 10, completed: true })
    expect(setsVolume([repsOnly, doneTimed(60)], 'kg')).toBe(0)
  })

  it('totals a whole workout', () => {
    const w = workout({ exercises: [makeExercise('a', [done(50, 10)]), makeExercise('b', [done(20, 10)])] })
    expect(workoutVolume(w, 'kg')).toBe(700)
    expect(workoutCompletedSetCount(w)).toBe(2)
  })
})

describe('workoutDurationSec', () => {
  it('measures start to end', () => {
    expect(workoutDurationSec(workout({}))).toBe(3930)
  })

  it('measures up to now while active', () => {
    const active = workout({ status: 'active', endedAt: null })
    expect(workoutDurationSec(active, '2026-09-01T10:30:00.000Z')).toBe(1800)
  })
})

describe('sessionMetrics', () => {
  it('finds the top set, best reps and volume', () => {
    const m = sessionMetrics([done(80, 8), done(85, 5), done(85, 6), done(60, 12)], 'kg')
    expect(m).toMatchObject({ topWeight: 85, topWeightReps: 6, bestReps: 12, volume: 2295, setCount: 4 })
  })

  it('reports durations for timed exercises', () => {
    const m = sessionMetrics([doneTimed(45), doneTimed(60), doneTimed(30)], 'kg')
    expect(m).toMatchObject({ topWeight: null, longestDurationSec: 60, totalDurationSec: 135, volume: 0 })
  })

  it('skips sets that were not completed', () => {
    const m = sessionMetrics([done(80, 8), makeSet({ weight: 200, reps: 1 })], 'kg')
    expect(m.topWeight).toBe(80)
    expect(m.setCount).toBe(1)
  })

  it('converts to the display unit', () => {
    expect(sessionMetrics([done(100, 5, 'kg')], 'lb').topWeight).toBe(220.5)
  })
})

describe('personalRecords', () => {
  const sessions = [
    { workoutId: 'w1', date: '2026-09-01T10:00:00Z', sets: [done(80, 8), done(80, 8)] },
    { workoutId: 'w3', date: '2026-09-10T10:00:00Z', sets: [done(90, 3), done(60, 15)] },
    { workoutId: 'w2', date: '2026-09-05T10:00:00Z', sets: [done(85, 5), done(85, 5), done(85, 5)] },
  ]

  it('finds each record and the workout it came from', () => {
    const r = personalRecords(sessions, 'kg')
    expect(r.heaviestWeight).toMatchObject({ value: 90, reps: 3, workoutId: 'w3' })
    expect(r.mostReps).toMatchObject({ value: 15, workoutId: 'w3' })
    expect(r.bestVolume).toMatchObject({ value: 1280, workoutId: 'w1' })
    expect(r.longestDuration).toBeNull()
  })

  it('keeps a record with the first session that reached it', () => {
    const r = personalRecords(
      [
        { workoutId: 'later', date: '2026-09-02T00:00:00Z', sets: [done(100, 1)] },
        { workoutId: 'first', date: '2026-09-01T00:00:00Z', sets: [done(100, 1)] },
      ],
      'kg',
    )
    expect(r.heaviestWeight?.workoutId).toBe('first')
  })

  it('returns no records without history', () => {
    expect(personalRecords([], 'kg')).toEqual({
      heaviestWeight: null,
      mostReps: null,
      bestVolume: null,
      longestDuration: null,
    })
  })

  it('tracks the longest hold for timed exercises', () => {
    const r = personalRecords(
      [
        { workoutId: 'a', date: '2026-09-01T00:00:00Z', sets: [doneTimed(60)] },
        { workoutId: 'b', date: '2026-09-03T00:00:00Z', sets: [doneTimed(90)] },
      ],
      'kg',
    )
    expect(r.longestDuration).toMatchObject({ value: 90, workoutId: 'b' })
  })
})
