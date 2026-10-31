import { db } from './db.ts'
import { clockElapsedSec, clockState, pauseClock, startClock, totalSec } from './fightClock.ts'
import { newId, nowIso } from './ids.ts'
import { INTENSITIES, SPORTS, type CustomCombo, type FightPlan, type FightSession, type ID, type Sport } from './types.ts'

// —— Plans ——

export const ROUND_SEC_OPTIONS = [60, 120, 180, 300]
export const REST_SEC_OPTIONS = [30, 60, 120]
export const MAX_ROUNDS = 12

export const DEFAULT_FIGHT_PLANS: Record<Sport, FightPlan> = {
  boxing: { sport: 'boxing', intensity: 'medium', roundSec: 180, restSec: 60, rounds: 3 },
  muay_thai: { sport: 'muay_thai', intensity: 'medium', roundSec: 180, restSec: 60, rounds: 3 },
  kickboxing: { sport: 'kickboxing', intensity: 'medium', roundSec: 180, restSec: 60, rounds: 3 },
  wrestling: { sport: 'wrestling', intensity: 'medium', roundSec: 120, restSec: 60, rounds: 3 },
}

function checkPlan(plan: FightPlan): void {
  const ok =
    SPORTS.includes(plan.sport) &&
    INTENSITIES.includes(plan.intensity) &&
    Number.isInteger(plan.rounds) &&
    plan.rounds >= 1 &&
    plan.rounds <= MAX_ROUNDS &&
    Number.isInteger(plan.roundSec) &&
    plan.roundSec >= 10 &&
    plan.roundSec <= 600 &&
    Number.isInteger(plan.restSec) &&
    plan.restSec >= 0 &&
    plan.restSec <= 300
  if (!ok) throw new Error('That session plan isn’t valid')
}

/** Your last choices for a sport (from its newest finished session), else the defaults. */
export async function lastFightPlan(sport: Sport): Promise<FightPlan> {
  const sessions = await listCompletedFightSessions()
  const last = sessions.find((s) => s.sport === sport)
  if (!last) return DEFAULT_FIGHT_PLANS[sport]
  const { intensity, roundSec, restSec, rounds } = last
  return { sport, intensity, roundSec, restSec, rounds }
}

// —— Sessions ——

export class ActiveFightSessionExistsError extends Error {
  readonly sessionId: ID
  constructor(sessionId: ID) {
    super('A fight session is already in progress')
    this.name = 'ActiveFightSessionExistsError'
    this.sessionId = sessionId
  }
}

export class StaleFightSaveError extends Error {
  constructor() {
    super('This session was finished, discarded or deleted — change not saved')
    this.name = 'StaleFightSaveError'
  }
}

export class EmptyFightSessionError extends Error {
  constructor() {
    super('No full rounds yet — discard the session instead')
    this.name = 'EmptyFightSessionError'
  }
}

export async function getActiveFightSession(): Promise<FightSession | undefined> {
  return db.fightSessions.where('status').equals('active').first()
}

export async function getFightSession(id: ID): Promise<FightSession | undefined> {
  return db.fightSessions.get(id)
}

/** Starts a session; its clock starts straight away. Only one can be in progress. */
export async function startFightSession(plan: FightPlan, now: number = Date.now()): Promise<FightSession> {
  checkPlan(plan)
  return db.transaction('rw', db.fightSessions, async () => {
    const active = await getActiveFightSession()
    if (active) throw new ActiveFightSessionExistsError(active.id)
    const iso = new Date(now).toISOString()
    const session: FightSession = {
      id: newId(),
      sport: plan.sport,
      intensity: plan.intensity,
      roundSec: plan.roundSec,
      restSec: plan.restSec,
      rounds: plan.rounds,
      status: 'active',
      startedAt: iso,
      endedAt: null,
      clock: startClock(now),
      completedRounds: 0,
      note: '',
      updatedAt: iso,
    }
    await db.fightSessions.add(session)
    return session
  })
}

/**
 * Saves what the screens change: the clock (pause, resume) while in progress, and the note.
 * Refuses (StaleFightSaveError) if the session is gone or its status changed, so a late save
 * never brings back a finished or discarded session.
 */
export async function saveFightSession(session: FightSession, now: string = nowIso()): Promise<FightSession> {
  return db.transaction('rw', db.fightSessions, async () => {
    const stored = await db.fightSessions.get(session.id)
    if (!stored || stored.status !== session.status) throw new StaleFightSaveError()
    const saved: FightSession = {
      ...stored,
      clock: stored.status === 'active' ? session.clock : stored.clock,
      note: session.note,
      updatedAt: now,
    }
    await db.fightSessions.put(saved)
    return saved
  })
}

/**
 * Moves the session to history. Only full rounds count; with none, throws
 * EmptyFightSessionError (discard instead). If every round ran out while the app was
 * closed, the end time is when the last round ended, not when you came back.
 */
export async function finishFightSession(id: ID, now: number = Date.now()): Promise<FightSession> {
  return db.transaction('rw', db.fightSessions, async () => {
    const session = await db.fightSessions.get(id)
    if (!session) throw new Error('Session not found')
    if (session.status !== 'active') throw new Error('Session is already finished')

    const state = clockState(session, session.clock, now)
    if (state.completedRounds === 0) throw new EmptyFightSessionError()

    const total = totalSec(session)
    let endedAt = now
    if (state.phase === 'done') {
      endedAt = session.clock.runningSince
        ? Math.min(now, Date.parse(session.clock.runningSince) + (total - session.clock.elapsedBeforeSec) * 1000)
        : Math.min(now, Date.parse(session.updatedAt)) // paused after the last bell
    }
    const clock = pauseClock(session.clock, endedAt)
    const finished: FightSession = {
      ...session,
      status: 'completed',
      endedAt: new Date(endedAt).toISOString(),
      clock: { runningSince: null, elapsedBeforeSec: Math.min(total, clock.elapsedBeforeSec) },
      completedRounds: state.completedRounds,
      updatedAt: new Date(now).toISOString(),
    }
    await db.fightSessions.put(finished)
    return finished
  })
}

/** Throws away the session in progress. */
export async function discardFightSession(id: ID): Promise<void> {
  await db.transaction('rw', db.fightSessions, async () => {
    const session = await db.fightSessions.get(id)
    if (session?.status !== 'active') throw new Error('Only a session in progress can be discarded')
    await db.fightSessions.delete(id)
  })
}

/** Deletes a finished session from history. */
export async function deleteFightSession(id: ID): Promise<void> {
  await db.transaction('rw', db.fightSessions, async () => {
    const session = await db.fightSessions.get(id)
    if (session?.status !== 'completed') throw new Error('Only finished sessions can be deleted')
    await db.fightSessions.delete(id)
  })
}

/** Finished sessions, newest first. */
export async function listCompletedFightSessions(): Promise<FightSession[]> {
  const sessions = await db.fightSessions.where('status').equals('completed').sortBy('startedAt')
  return sessions.reverse()
}

/** Number of finished sessions that started at or after `sinceIso`. */
export async function countFightSessionsSince(sinceIso: string): Promise<number> {
  return db.fightSessions
    .where('startedAt')
    .aboveOrEqual(sinceIso)
    .filter((s) => s.status === 'completed')
    .count()
}

/** Time the session ran, pauses not included. */
export function fightSessionDurationSec(session: FightSession, now: number = Date.now()): number {
  return Math.round(Math.min(totalSec(session), clockElapsedSec(session.clock, now)))
}

// —— Your own combos ——

export const MAX_COMBO_LENGTH = 60

export async function listCombos(sport: Sport): Promise<CustomCombo[]> {
  return db.combos.where('sport').equals(sport).sortBy('createdAt')
}

/** Adds a combo like "1 2 3 slip 2". Throws a user-readable error if empty, too long or already there. */
export async function addCombo(sport: Sport, text: string): Promise<CustomCombo> {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) throw new Error('Type a combo first')
  if (clean.length > MAX_COMBO_LENGTH) throw new Error(`Keep it under ${MAX_COMBO_LENGTH} characters`)
  return db.transaction('rw', db.combos, async () => {
    const lower = clean.toLowerCase()
    const clash = await db.combos
      .where('sport')
      .equals(sport)
      .filter((c) => c.text.toLowerCase() === lower)
      .first()
    if (clash) throw new Error(`“${clash.text}” is already in your combos`)
    const now = nowIso()
    const combo: CustomCombo = { id: newId(), sport, text: clean, createdAt: now, updatedAt: now }
    await db.combos.add(combo)
    return combo
  })
}

export async function removeCombo(id: ID): Promise<void> {
  await db.combos.delete(id)
}

/** Puts back a removed combo (Undo). */
export async function restoreCombo(combo: CustomCombo): Promise<void> {
  await db.combos.put(combo)
}
