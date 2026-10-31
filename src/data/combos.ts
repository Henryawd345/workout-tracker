import type { Intensity, Sport } from './types.ts'

// Random combos for the fight coach. Pure: pass `rng` (0 ≤ n < 1) to make results repeatable.

export type Rng = () => number

// Punches are called as numbers: 1 jab, 2 cross, 3 lead hook, 4 rear hook, 5 lead uppercut, 6 rear uppercut.
const PUNCHES = ['1', '2', '3', '4', '5', '6']
const BOXING_DEFENSE = ['slip', 'roll', 'duck', 'pull']
const KICKS = ['lead kick', 'rear kick', 'low kick', 'front kick']
const THAI_STRIKES = ['teep', 'lead kick', 'rear kick', 'low kick', 'lead knee', 'rear knee', 'lead elbow', 'rear elbow']

interface StrikingKit {
  defense: string[]
  /** Kicks, knees, elbows: mostly thrown at the end of a combo. */
  finishers: string[]
}

const STRIKING: Record<Exclude<Sport, 'wrestling'>, StrikingKit> = {
  boxing: { defense: BOXING_DEFENSE, finishers: [] },
  kickboxing: { defense: BOXING_DEFENSE, finishers: KICKS },
  muay_thai: { defense: [...BOXING_DEFENSE, 'check'], finishers: THAI_STRIKES },
}

const WRESTLING_BASIC = ['shot', 'sprawl', 'level change', 'circle', 'hand fight', 'stand up']
const WRESTLING_MORE = ['double leg', 'single leg', 'down block', 'snap down']
const WRESTLING_CHAINS = ['sprawl, re-shot', 'shot, finish', 'snap down, go behind', 'down block, re-shot']

interface Level {
  minMoves: number
  maxMoves: number
  defenseChance: number
  finisherAtEnd: number
  finisherMidway: number
  /** Seconds after the call to throw it: base + perMove × moves. */
  baseGapSec: number
  perMoveSec: number
}

const LEVELS: Record<Intensity, Level> = {
  easy: { minMoves: 1, maxMoves: 2, defenseChance: 0, finisherAtEnd: 0, finisherMidway: 0, baseGapSec: 2.5, perMoveSec: 0.8 },
  medium: { minMoves: 2, maxMoves: 4, defenseChance: 0.2, finisherAtEnd: 0.3, finisherMidway: 0, baseGapSec: 1.8, perMoveSec: 0.6 },
  hard: { minMoves: 3, maxMoves: 6, defenseChance: 0.3, finisherAtEnd: 0.5, finisherMidway: 0.15, baseGapSec: 1, perMoveSec: 0.45 },
}

const WRESTLING_MOVES: Record<Intensity, { min: number; max: number }> = {
  easy: { min: 1, max: 1 },
  medium: { min: 1, max: 2 },
  hard: { min: 1, max: 3 },
}

/** Every call the coach can make for a sport. */
export function sportMoves(sport: Sport): string[] {
  if (sport === 'wrestling') return [...WRESTLING_BASIC, ...WRESTLING_MORE, ...WRESTLING_CHAINS]
  const kit = STRIKING[sport]
  return [...new Set([...PUNCHES, ...kit.defense, ...kit.finishers])]
}

export function isDefense(sport: Sport, move: string): boolean {
  return sport !== 'wrestling' && STRIKING[sport].defense.includes(move)
}

export interface Call {
  /** What the coach says and the screen shows, e.g. "1 2 slip 3". */
  text: string
  moves: string[]
  /** Seconds to wait after saying it, so there's time to throw it. */
  gapSec: number
  custom: boolean
}

function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))]
}

function between(min: number, max: number, rng: Rng): number {
  return min + Math.min(max - min, Math.floor(rng() * (max - min + 1)))
}

function strikingCombo(sport: Exclude<Sport, 'wrestling'>, intensity: Intensity, rng: Rng): string[] {
  const kit = STRIKING[sport]
  const level = LEVELS[intensity]
  const count = between(level.minMoves, level.maxMoves, rng)
  const moves: string[] = []
  for (let i = 0; i < count; i++) {
    const last = moves.at(-1)
    const atEnd = i === count - 1
    let pool = PUNCHES
    if (last !== undefined && !kit.defense.includes(last) && rng() < level.defenseChance) pool = kit.defense
    else if (kit.finishers.length > 0 && rng() < (atEnd ? level.finisherAtEnd : level.finisherMidway)) pool = kit.finishers
    // At most two of the same move in a row ("1 1 2" yes, "1 1 1" no).
    let move = pick(pool, rng)
    for (let tries = 0; tries < 10 && moves.length >= 2 && moves.at(-1) === move && moves.at(-2) === move; tries++) {
      move = pick(pool, rng)
    }
    moves.push(move)
  }
  return moves
}

function wrestlingCalls(intensity: Intensity, rng: Rng): string[] {
  const { min, max } = WRESTLING_MOVES[intensity]
  const pool =
    intensity === 'easy'
      ? WRESTLING_BASIC
      : intensity === 'medium'
        ? [...WRESTLING_BASIC, ...WRESTLING_MORE]
        : [...WRESTLING_BASIC, ...WRESTLING_MORE, ...WRESTLING_CHAINS]
  const count = between(min, max, rng)
  const moves: string[] = []
  for (let tries = 0; moves.length < count && tries < 20; tries++) {
    const move = pick(pool, rng)
    if (move !== moves.at(-1)) moves.push(move)
  }
  if (moves.length === 0) moves.push(pool[0])
  return moves
}

function gapFor(intensity: Intensity, moveCount: number): number {
  const level = LEVELS[intensity]
  return Math.round((level.baseGapSec + level.perMoveSec * moveCount) * 10) / 10
}

const JOINERS = new Set(['lead', 'rear', 'low', 'front', 'level', 'double', 'single', 'down', 'snap', 'hand', 'stand', 'go'])

/** Rough move count of a typed combo, for its gap: "1 2 lead kick" → 3. */
export function countMoves(text: string): number {
  const words = text.split(/[\s,]+/).filter(Boolean)
  return Math.max(1, words.filter((w, i) => !(i < words.length - 1 && JOINERS.has(w.toLowerCase()))).length)
}

/** Share of calls taken from the user's own combos, when there are any. */
export const CUSTOM_SHARE = 1 / 3

/** The next thing the coach calls. Never the same text twice in a row, if it can help it. */
export function nextCall(
  sport: Sport,
  intensity: Intensity,
  options: { custom?: string[]; previous?: string | null; rng?: Rng } = {},
): Call {
  const { custom = [], previous = null, rng = Math.random } = options
  let call: Call | null = null
  for (let tries = 0; tries < 10 && (call === null || call.text === previous); tries++) {
    if (custom.length > 0 && rng() < CUSTOM_SHARE) {
      const text = pick(custom, rng)
      call = { text, moves: [text], gapSec: gapFor(intensity, countMoves(text)), custom: true }
    } else {
      const moves = sport === 'wrestling' ? wrestlingCalls(intensity, rng) : strikingCombo(sport, intensity, rng)
      const count = moves.reduce((n, m) => n + m.split(',').length, 0)
      call = { text: moves.join(sport === 'wrestling' ? ', ' : ' '), moves, gapSec: gapFor(intensity, count), custom: false }
    }
  }
  return call!
}
