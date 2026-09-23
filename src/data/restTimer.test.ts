import { describe, expect, it } from 'vitest'
import {
  adjustRest,
  isRestOver,
  isRestPaused,
  pauseRest,
  restProgress,
  restRemainingSec,
  resumeRest,
  startRest,
} from './restTimer.ts'

const T = Date.parse('2026-09-23T10:00:00.000Z')
const sec = (s: number) => T + s * 1000

describe('rest timer', () => {
  it('counts down from an end time, so a locked phone or closed app does not matter', () => {
    const t = startRest(90, T)
    expect(t.endsAt).toBe('2026-09-23T10:01:30.000Z')
    expect(restRemainingSec(t, T)).toBe(90)
    expect(restRemainingSec(t, sec(89.2))).toBe(1) // rounds up
    expect(restRemainingSec(t, sec(90))).toBe(0)
    expect(restRemainingSec(t, sec(600))).toBe(0) // came back much later
    expect(isRestOver(t, sec(90))).toBe(true)
  })

  it('pauses and resumes where it left off', () => {
    let t = pauseRest(startRest(60, T), sec(20))
    expect(isRestPaused(t)).toBe(true)
    expect(restRemainingSec(t, sec(500))).toBe(40) // frozen while paused
    expect(isRestOver(t, sec(500))).toBe(false)
    t = resumeRest(t, sec(500))
    expect(restRemainingSec(t, sec(510))).toBe(30)
  })

  it('adds and removes time, never below zero', () => {
    let t = startRest(60, T)
    t = adjustRest(t, 15, sec(10)) // 50 left → 65
    expect(restRemainingSec(t, sec(10))).toBe(65)
    expect(t.durationSec).toBe(75)
    t = adjustRest(t, -15, sec(10))
    expect(restRemainingSec(t, sec(10))).toBe(50)
    t = adjustRest(t, -120, sec(10))
    expect(restRemainingSec(t, sec(10))).toBe(0)
  })

  it('adjusts a paused timer without starting it', () => {
    const t = adjustRest(pauseRest(startRest(60, T), sec(30)), 15, sec(40))
    expect(isRestPaused(t)).toBe(true)
    expect(restRemainingSec(t, sec(999))).toBe(45)
  })

  it('reports progress for the bar', () => {
    const t = startRest(100, T)
    expect(restProgress(t, T)).toBe(0)
    expect(restProgress(t, sec(25))).toBe(0.25)
    expect(restProgress(t, sec(200))).toBe(1)
  })
})
