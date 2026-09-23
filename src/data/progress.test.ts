import { beforeEach, describe, expect, it } from 'vitest'
import { addCompletedWorkout, done, doneTimed, makeExercise, makeSet, resetDb } from '../test/factories.ts'
import {
  change,
  metricsFor,
  niceTicks,
  pointsInRange,
  progressPoints,
  weeklyCounts,
} from './progress.ts'
import { listCompletedStartTimes, listLoggedExercises } from './workouts.ts'

const sessions = [
  { workoutId: 'b', date: '2026-09-08T10:00:00Z', sets: [done(105, 3), done(80, 12)] },
  { workoutId: 'a', date: '2026-09-01T10:00:00Z', sets: [done(100, 5)] },
  { workoutId: 'c', date: '2026-06-01T10:00:00Z', sets: [done(90, 5, 'lb')] },
]

describe('progress points', () => {
  it('picks measures by exercise type', () => {
    expect(metricsFor('weight_reps')).toEqual(['topWeight', 'bestReps', 'volume'])
    expect(metricsFor('reps_only')).toEqual(['bestReps'])
    expect(metricsFor('duration')).toEqual(['longestDuration', 'totalDuration'])
  })

  it('gives one point per session, oldest first, in the display unit', () => {
    expect(progressPoints(sessions, 'topWeight', 'kg').map((p) => [p.workoutId, p.value])).toEqual([
      ['c', 40.8],
      ['a', 100],
      ['b', 105],
    ])
    expect(progressPoints(sessions, 'bestReps', 'kg').map((p) => p.value)).toEqual([5, 5, 12])
    expect(progressPoints(sessions, 'volume', 'kg').map((p) => p.value)).toEqual([204.1, 500, 1275])
  })

  it('keeps real zeros (bodyweight at 0 kg) as points', () => {
    const zero = [{ workoutId: 'z', date: '2026-09-01T10:00:00Z', sets: [done(0, 12)] }]
    expect(progressPoints(zero, 'volume', 'kg').map((p) => p.value)).toEqual([0])
    expect(niceTicks(0, 0)[0]).toBe(0)
  })

  it('handles timed sessions and skips sessions without the measure', () => {
    const timed = [
      { workoutId: 'x', date: '2026-09-01T10:00:00Z', sets: [doneTimed(60), doneTimed(45)] },
      { workoutId: 'y', date: '2026-09-02T10:00:00Z', sets: [makeSet({ reps: 10, completed: true })] },
    ]
    expect(progressPoints(timed, 'longestDuration', 'kg')).toEqual([{ date: '2026-09-01T10:00:00Z', value: 60, workoutId: 'x' }])
    expect(progressPoints(timed, 'totalDuration', 'kg').map((p) => p.value)).toEqual([105])
    expect(progressPoints(timed, 'topWeight', 'kg')).toEqual([])
  })

  it('filters by time range and reports the change', () => {
    const points = progressPoints(sessions, 'topWeight', 'kg')
    const now = new Date('2026-09-15T00:00:00Z')
    expect(pointsInRange(points, '1m', now).map((p) => p.workoutId)).toEqual(['a', 'b'])
    expect(pointsInRange(points, 'all', now)).toHaveLength(3)
    expect(change(pointsInRange(points, '1m', now))).toBe(5)
    expect(change(points.slice(0, 1))).toBeNull()
  })
})

describe('weeklyCounts', () => {
  it('counts workouts per Monday-to-Sunday week, keeping empty weeks', () => {
    const now = new Date(2026, 8, 23, 12) // Wed 23 Sep
    const times = [
      new Date(2026, 8, 21, 8).toISOString(), // Mon this week
      new Date(2026, 8, 23, 8).toISOString(), // Wed this week
      new Date(2026, 8, 13, 8).toISOString(), // Sun two weeks... last week's Sunday
      new Date(2025, 0, 1).toISOString(), // too old
    ]
    const weeks = weeklyCounts(times, 4, now)
    expect(weeks).toHaveLength(4)
    expect(weeks.map((w) => w.count)).toEqual([0, 1, 0, 2])
    expect(new Date(weeks[3].weekStart).getDay()).toBe(1)
  })
})

describe('niceTicks', () => {
  it('returns round numbers that cover the data', () => {
    expect(niceTicks(62.5, 102.5)).toEqual([60, 70, 80, 90, 100, 110])
    expect(niceTicks(0, 7)).toEqual([0, 2, 4, 6, 8])
    const flat = niceTicks(100, 100)
    expect(flat[0]).toBeLessThan(100)
    expect(flat.at(-1)).toBeGreaterThan(100)
  })
})

describe('logged exercises', () => {
  beforeEach(resetDb)

  it('lists exercises by number of sessions, ignoring ones with no ticked sets', async () => {
    await addCompletedWorkout('2026-09-01T10:00:00Z', [makeExercise('ex-deadlift', [done(1, 1)]), makeExercise('ex-plank', [done(0, 1)])])
    await addCompletedWorkout('2026-09-03T10:00:00Z', [
      makeExercise('ex-deadlift', [done(1, 1)]),
      makeExercise('ex-deadlift', [done(1, 1)]),
      makeExercise('ex-leg-press', [makeSet()]),
    ])
    expect(await listLoggedExercises()).toEqual([
      ['ex-deadlift', 2],
      ['ex-plank', 1],
    ])
    expect(await listCompletedStartTimes()).toHaveLength(2)
  })
})
