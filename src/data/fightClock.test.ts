import { describe, expect, it } from 'vitest'
import { clockState, pauseClock, READY_SEC, resumeClock, startClock, totalSec } from './fightClock.ts'

const plan = { roundSec: 180, restSec: 60, rounds: 3 }
const T = Date.parse('2026-10-31T10:00:00.000Z')
const at = (sec: number) => T + sec * 1000

describe('fight clock', () => {
  it('runs get ready → round → rest → … → last round → done', () => {
    const clock = startClock(T)
    expect(totalSec(plan)).toBe(READY_SEC + 3 * 180 + 2 * 60)
    expect(clockState(plan, clock, at(0))).toMatchObject({ phase: 'ready', round: 0, remainingSec: 10 })
    expect(clockState(plan, clock, at(10))).toMatchObject({ phase: 'round', round: 1, remainingSec: 180, phaseSec: 180 })
    expect(clockState(plan, clock, at(189.5))).toMatchObject({ phase: 'round', round: 1, remainingSec: 1 })
    expect(clockState(plan, clock, at(190))).toMatchObject({ phase: 'rest', round: 1, remainingSec: 60, completedRounds: 1 })
    expect(clockState(plan, clock, at(250))).toMatchObject({ phase: 'round', round: 2, completedRounds: 1 })
    expect(clockState(plan, clock, at(10 + 540 + 120))).toMatchObject({ phase: 'done', completedRounds: 3, remainingSec: 0 })
    expect(clockState(plan, clock, at(99999)).elapsedSec).toBe(totalSec(plan))
  })

  it('has no rest phase when rest is 0, and no rest after the last round', () => {
    const clock = startClock(T)
    const noRest = { roundSec: 60, restSec: 0, rounds: 2 }
    expect(clockState(noRest, clock, at(70))).toMatchObject({ phase: 'round', round: 2 })
    const one = { roundSec: 60, restSec: 60, rounds: 1 }
    expect(clockState(one, clock, at(70)).phase).toBe('done')
  })

  it('runs an optional warm-up, then the usual rest, before round 1', () => {
    const clock = startClock(T)
    const withWarmup = { ...plan, warmupSec: 120 }
    expect(totalSec(withWarmup)).toBe(totalSec(plan) + 120 + 60)
    expect(clockState(withWarmup, clock, at(10))).toMatchObject({ phase: 'warmup', round: 0, remainingSec: 120 })
    expect(clockState(withWarmup, clock, at(130))).toMatchObject({ phase: 'rest', round: 0, remainingSec: 60 })
    expect(clockState(withWarmup, clock, at(190))).toMatchObject({ phase: 'round', round: 1, completedRounds: 0 })
    // No rest after the warm-up when rest is 0.
    expect(clockState({ ...withWarmup, restSec: 0 }, clock, at(130))).toMatchObject({ phase: 'round', round: 1 })
  })

  it('pauses and resumes without losing time', () => {
    let clock = startClock(T)
    clock = pauseClock(clock, at(100))
    expect(clockState(plan, clock, at(5000))).toMatchObject({ phase: 'round', round: 1, remainingSec: 90, paused: true })
    expect(pauseClock(clock, at(6000))).toBe(clock)
    clock = resumeClock(clock, at(5000))
    expect(clockState(plan, clock, at(5030))).toMatchObject({ remainingSec: 60, paused: false })
    expect(resumeClock(clock, at(6000))).toBe(clock)
  })

  it('works out the right phase after a reload, from the stored clock alone', () => {
    const stored = JSON.parse(JSON.stringify(startClock(T)))
    expect(clockState(plan, stored, at(10 + 180 + 30))).toMatchObject({ phase: 'rest', remainingSec: 30 })
  })
})
