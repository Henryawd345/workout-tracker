import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetDb } from '../test/factories.ts'
import { db } from './db.ts'
import {
  ActiveFightSessionExistsError,
  addCombo,
  countFightSessionsSince,
  DEFAULT_FIGHT_PLANS,
  deleteFightSession,
  discardFightSession,
  EmptyFightSessionError,
  fightSessionDurationSec,
  finishFightSession,
  getActiveFightSession,
  lastFightPlan,
  listCombos,
  listCompletedFightSessions,
  removeCombo,
  restoreCombo,
  saveFightSession,
  StaleFightSaveError,
  startFightSession,
} from './fight.ts'
import { pauseClock, READY_SEC } from './fightClock.ts'

beforeEach(resetDb)

const T = Date.parse('2026-10-31T10:00:00.000Z')
const at = (sec: number) => T + sec * 1000
const plan = { sport: 'boxing' as const, intensity: 'hard' as const, roundSec: 180, restSec: 60, rounds: 3 }

describe('fight sessions', () => {
  it('starts with a running clock, one at a time', async () => {
    const s = await startFightSession(plan, T)
    expect(s).toMatchObject({ ...plan, status: 'active', completedRounds: 0, endedAt: null })
    expect(s.clock.runningSince).toBe(new Date(T).toISOString())
    expect((await getActiveFightSession())?.id).toBe(s.id)
    await expect(startFightSession(plan, T)).rejects.toBeInstanceOf(ActiveFightSessionExistsError)
  })

  it('refuses a plan that makes no sense', async () => {
    await expect(startFightSession({ ...plan, rounds: 0 }, T)).rejects.toThrow('isn’t valid')
    await expect(startFightSession({ ...plan, roundSec: 2 }, T)).rejects.toThrow('isn’t valid')
    await expect(startFightSession({ ...plan, sport: 'karate' as never }, T)).rejects.toThrow('isn’t valid')
  })

  it('finishes counting full rounds only', async () => {
    const s = await startFightSession(plan, T)
    const done = await finishFightSession(s.id, at(READY_SEC + 180 + 60 + 100)) // part-way through round 2
    expect(done).toMatchObject({ status: 'completed', completedRounds: 1, clock: { runningSince: null } })
    expect(fightSessionDurationSec(done)).toBe(READY_SEC + 180 + 60 + 100)
    expect(await getActiveFightSession()).toBeUndefined()
  })

  it('needs at least one full round to finish', async () => {
    const s = await startFightSession(plan, T)
    await expect(finishFightSession(s.id, at(100))).rejects.toBeInstanceOf(EmptyFightSessionError)
    await discardFightSession(s.id)
    expect(await db.fightSessions.count()).toBe(0)
  })

  it('ends at the last bell, not when you came back to the app', async () => {
    const s = await startFightSession(plan, T)
    const total = READY_SEC + 3 * 180 + 2 * 60
    const done = await finishFightSession(s.id, at(total + 3600))
    expect(done.completedRounds).toBe(3)
    expect(done.endedAt).toBe(new Date(at(total)).toISOString())
    expect(fightSessionDurationSec(done)).toBe(total)
  })

  it('counts paused time out of the end time', async () => {
    let s = await startFightSession(plan, T)
    s = await saveFightSession({ ...s, clock: pauseClock(s.clock, at(250)) }) // paused at the end of the first rest
    const done = await finishFightSession(s.id, at(5000))
    expect(done.completedRounds).toBe(1)
    expect(fightSessionDurationSec(done)).toBe(250)
  })

  it('saves only the clock and note, and only the note once finished', async () => {
    const s = await startFightSession(plan, T)
    const saved = await saveFightSession({ ...s, rounds: 9, note: 'x', clock: pauseClock(s.clock, at(20)) })
    expect(saved).toMatchObject({ rounds: 3, note: 'x', clock: { runningSince: null, elapsedBeforeSec: 20 } })
  })

  it('ends at the pause when paused after the last bell', async () => {
    let s = await startFightSession(plan, T)
    const total = READY_SEC + 3 * 180 + 2 * 60
    s = await saveFightSession({ ...s, clock: pauseClock(s.clock, at(total + 50)) }, new Date(at(total + 50)).toISOString())
    const done = await finishFightSession(s.id, at(total + 3600))
    expect(done.endedAt).toBe(new Date(at(total + 50)).toISOString())
    expect(fightSessionDurationSec(done)).toBe(total)
  })

  it('refuses a late save after finishing or discarding', async () => {
    const s = await startFightSession(plan, T)
    await finishFightSession(s.id, at(READY_SEC + 180))
    await expect(saveFightSession(s)).rejects.toBeInstanceOf(StaleFightSaveError)
    const finished = (await listCompletedFightSessions())[0]
    await saveFightSession({ ...finished, note: 'sharp jab' })
    expect((await listCompletedFightSessions())[0].note).toBe('sharp jab')
  })

  it('lists, counts and deletes finished sessions', async () => {
    const a = await startFightSession(plan, at(0))
    await finishFightSession(a.id, at(READY_SEC + 180))
    const b = await startFightSession({ ...plan, sport: 'wrestling' }, at(10000))
    await finishFightSession(b.id, at(10000 + READY_SEC + 180))
    expect((await listCompletedFightSessions()).map((s) => s.sport)).toEqual(['wrestling', 'boxing'])
    expect(await countFightSessionsSince(new Date(at(5000)).toISOString())).toBe(1)
    await deleteFightSession(a.id)
    expect(await listCompletedFightSessions()).toHaveLength(1)
  })

  it('remembers your last choices for each sport', async () => {
    expect(await lastFightPlan('muay_thai')).toEqual(DEFAULT_FIGHT_PLANS.muay_thai)
    const s = await startFightSession({ ...plan, rounds: 5, roundSec: 120 }, T)
    await finishFightSession(s.id, at(READY_SEC + 120))
    expect(await lastFightPlan('boxing')).toEqual({ ...plan, rounds: 5, roundSec: 120 })
    expect(await lastFightPlan('wrestling')).toEqual(DEFAULT_FIGHT_PLANS.wrestling)
  })
})

describe('your own combos', () => {
  it('adds, lists per sport, removes and restores', async () => {
    const a = await addCombo('boxing', '  1 2   3 slip 2 ')
    expect(a.text).toBe('1 2 3 slip 2')
    await addCombo('boxing', 'jab jab cross')
    await addCombo('muay_thai', '1 2 rear kick')
    expect((await listCombos('boxing')).map((c) => c.text)).toEqual(['1 2 3 slip 2', 'jab jab cross'])
    await removeCombo(a.id)
    expect(await listCombos('boxing')).toHaveLength(1)
    await restoreCombo(a)
    expect(await listCombos('boxing')).toHaveLength(2)
  })

  it('undo does not bring back a combo you have added again', async () => {
    const a = await addCombo('boxing', '1 2')
    await removeCombo(a.id)
    await addCombo('boxing', '1 2')
    await restoreCombo(a)
    expect(await listCombos('boxing')).toHaveLength(1)
  })

  it('keeps the order you added them, even within the same millisecond', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(T)
    for (const text of ['c', 'a', 'b', 'd']) await addCombo('boxing', text)
    vi.useRealTimers()
    expect((await listCombos('boxing')).map((c) => c.text)).toEqual(['c', 'a', 'b', 'd'])
  })

  it('refuses empty, too long and duplicate combos', async () => {
    await addCombo('boxing', '1 2')
    await expect(addCombo('boxing', '   ')).rejects.toThrow('Type a combo')
    await expect(addCombo('boxing', '1 '.repeat(40))).rejects.toThrow('under 60')
    await expect(addCombo('boxing', '1  2')).rejects.toThrow('already')
    await expect(addCombo('kickboxing', '1 2')).resolves.toBeTruthy()
  })
})
