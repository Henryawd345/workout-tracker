import type { FightClock, FightPlan } from './types.ts'

// The fight clock stores how long the session has been running, and the phase is worked
// out from that. So it stays right while the phone is locked or the app is closed, like the
// rest timer. All functions are pure; `now` is epoch ms.

/** Countdown before round 1, to get your hands up. */
export const READY_SEC = 10

export type FightPhase = 'ready' | 'round' | 'rest' | 'done'

export interface ClockState {
  phase: FightPhase
  /** 1-based round number; during rest, the round just finished. 0 while getting ready. */
  round: number
  /** Whole seconds left in this phase (rounded up). */
  remainingSec: number
  /** Length of this phase. */
  phaseSec: number
  /** Full rounds finished so far. */
  completedRounds: number
  elapsedSec: number
  totalSec: number
  paused: boolean
}

type Plan = Pick<FightPlan, 'roundSec' | 'restSec' | 'rounds'>

interface Segment {
  phase: Exclude<FightPhase, 'done'>
  round: number
  sec: number
}

function schedule(plan: Plan): Segment[] {
  const segments: Segment[] = [{ phase: 'ready', round: 0, sec: READY_SEC }]
  for (let round = 1; round <= plan.rounds; round++) {
    segments.push({ phase: 'round', round, sec: plan.roundSec })
    if (round < plan.rounds && plan.restSec > 0) segments.push({ phase: 'rest', round, sec: plan.restSec })
  }
  return segments
}

export function totalSec(plan: Plan): number {
  return schedule(plan).reduce((sum, s) => sum + s.sec, 0)
}

export function startClock(now: number): FightClock {
  return { runningSince: new Date(now).toISOString(), elapsedBeforeSec: 0 }
}

export function clockElapsedSec(clock: FightClock, now: number): number {
  const running = clock.runningSince ? Math.max(0, (now - Date.parse(clock.runningSince)) / 1000) : 0
  return clock.elapsedBeforeSec + running
}

export function isClockPaused(clock: FightClock): boolean {
  return clock.runningSince === null
}

export function pauseClock(clock: FightClock, now: number): FightClock {
  if (isClockPaused(clock)) return clock
  return { runningSince: null, elapsedBeforeSec: clockElapsedSec(clock, now) }
}

export function resumeClock(clock: FightClock, now: number): FightClock {
  if (!isClockPaused(clock)) return clock
  return { ...clock, runningSince: new Date(now).toISOString() }
}

export function clockState(plan: Plan, clock: FightClock, now: number): ClockState {
  const segments = schedule(plan)
  const total = segments.reduce((sum, s) => sum + s.sec, 0)
  const elapsed = Math.min(total, clockElapsedSec(clock, now))
  const paused = isClockPaused(clock)

  let start = 0
  let completedRounds = 0
  for (const segment of segments) {
    const end = start + segment.sec
    if (elapsed < end) {
      return {
        phase: segment.phase,
        round: segment.round,
        remainingSec: Math.ceil(end - elapsed),
        phaseSec: segment.sec,
        completedRounds,
        elapsedSec: elapsed,
        totalSec: total,
        paused,
      }
    }
    if (segment.phase === 'round') completedRounds++
    start = end
  }
  return {
    phase: 'done',
    round: plan.rounds,
    remainingSec: 0,
    phaseSec: 0,
    completedRounds,
    elapsedSec: total,
    totalSec: total,
    paused,
  }
}
