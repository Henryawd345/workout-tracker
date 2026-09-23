import type { RestTimer } from './types.ts'

// The rest timer is stored as an end time, not a countdown, so it stays right while the
// phone is locked or the app is closed. All functions are pure; `now` is epoch ms.

export function startRest(durationSec: number, now: number): RestTimer {
  return { durationSec, endsAt: new Date(now + durationSec * 1000).toISOString(), pausedRemainingSec: null }
}

/** Whole seconds left (rounded up, so it shows 1 until it really hits 0). */
export function restRemainingSec(timer: RestTimer, now: number): number {
  if (timer.pausedRemainingSec !== null) return timer.pausedRemainingSec
  if (!timer.endsAt) return 0
  return Math.max(0, Math.ceil((Date.parse(timer.endsAt) - now) / 1000))
}

export function isRestPaused(timer: RestTimer): boolean {
  return timer.pausedRemainingSec !== null
}

export function isRestOver(timer: RestTimer, now: number): boolean {
  return !isRestPaused(timer) && restRemainingSec(timer, now) === 0
}

export function pauseRest(timer: RestTimer, now: number): RestTimer {
  if (isRestPaused(timer)) return timer
  return { ...timer, endsAt: null, pausedRemainingSec: restRemainingSec(timer, now) }
}

export function resumeRest(timer: RestTimer, now: number): RestTimer {
  if (!isRestPaused(timer)) return timer
  return { ...timer, endsAt: new Date(now + timer.pausedRemainingSec! * 1000).toISOString(), pausedRemainingSec: null }
}

/** +15 / −15 seconds. Never below zero; the total grows too so the progress bar stays sensible. */
export function adjustRest(timer: RestTimer, deltaSec: number, now: number): RestTimer {
  const remaining = Math.max(0, restRemainingSec(timer, now) + deltaSec)
  const durationSec = Math.max(remaining, timer.durationSec + Math.max(0, deltaSec))
  return isRestPaused(timer)
    ? { ...timer, durationSec, pausedRemainingSec: remaining }
    : { ...timer, durationSec, endsAt: new Date(now + remaining * 1000).toISOString() }
}

/** 0 → just started, 1 → done. */
export function restProgress(timer: RestTimer, now: number): number {
  if (timer.durationSec <= 0) return 1
  return Math.min(1, Math.max(0, 1 - restRemainingSec(timer, now) / timer.durationSec))
}
