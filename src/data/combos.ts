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

// —— What makes a combo natural to throw ——

export type Hand = 'lead' | 'rear'

/** Which side a strike comes from; null for defence. Odd punches are lead hand, even are rear. */
export function handOf(move: string): Hand | null {
  if (/^[135]$/.test(move)) return 'lead'
  if (/^[246]$/.test(move)) return 'rear'
  if (move.startsWith('lead ') || move === 'teep' || move === 'front kick') return 'lead'
  if (move.startsWith('rear ') || move === 'low kick') return 'rear'
  return null
}

const isPunch = (move: string) => /^[1-6]$/.test(move)

/** The only same-hand punches in a row that flow: double jab, jab–hook, uppercut–hook. */
const SAME_HAND_OK = new Set(['1 1', '1 3', '5 3'])

/**
 * True if every step of the combo is natural to throw:
 * - it starts with a punch, and never has two defence moves in a row;
 * - hands mostly alternate: two punches from the same hand only as 1 1, 1 3 or 5 3, and
 *   never three strikes in a row from the same side;
 * - a kick, knee or elbow comes off the other side from the strike before it, and not
 *   straight after defence (after a slip or roll you counter with a punch).
 * The rules only look at neighbours, so a combo is natural if each of its starts is.
 */
export function isNaturalCombo(sport: Sport, moves: string[]): boolean {
  if (sport === 'wrestling') return true
  if (moves.length === 0) return true
  if (!isPunch(moves[0])) return false
  let run = 1
  for (let i = 1; i < moves.length; i++) {
    const prev = moves[i - 1]
    const move = moves[i]
    const hand = handOf(move)
    const prevHand = handOf(prev)
    if (hand === null) {
      if (prevHand === null) return false // two defence moves in a row
      run = 0
      continue
    }
    if (prevHand === null) {
      if (!isPunch(move)) return false // counter after defence with a punch
      run = 1
      continue
    }
    if (hand === prevHand) {
      if (!isPunch(move) || !isPunch(prev) || !SAME_HAND_OK.has(`${prev} ${move}`)) return false
      run++
      if (run > 2) return false
    } else run = 1
  }
  return true
}

/**
 * Well-known combos, so you drill the ones coaches use. About half the calls come from here
 * (those that fit the intensity), the rest are generated with the same rules.
 */
const BOXING_CLASSICS = [
  '1', '2', '1 1', '1 2',
  '1 1 2', '1 2 3', '2 3 2', '1 2 1', '1 6 3', '3 2 3',
  '1 2 3 2', '1 6 3 2', '1 2 5 2', '5 2 3 2', '1 1 2 3', '1 2 slip 2', '1 2 roll 2', '1 2 3 roll',
  '1 2 3 6 3 2', '1 2 slip 2 3 2', '1 6 3 2 roll 2', '1 2 5 2 3 2',
]
const KICK_CLASSICS = ['1 2 3 low kick', '1 2 lead kick', '1 rear kick', '2 3 rear kick', '1 2 3 2 lead kick', '1 2 slip 2 lead kick']
const THAI_CLASSICS = ['1 2 3 rear knee', '2 teep', '1 2 lead knee', '1 rear elbow', '2 lead elbow', '1 2 3 rear elbow']

const CLASSICS: Record<Exclude<Sport, 'wrestling'>, string[][]> = {
  boxing: BOXING_CLASSICS.map((c) => c.split(' ')),
  kickboxing: [...BOXING_CLASSICS, ...KICK_CLASSICS].map(splitMoves),
  muay_thai: [...BOXING_CLASSICS, ...KICK_CLASSICS, ...THAI_CLASSICS].map(splitMoves),
}

/** "1 2 lead kick" → ["1", "2", "lead kick"] */
function splitMoves(text: string): string[] {
  return text.split(' ').reduce<string[]>((moves, word) => {
    if (['kick', 'knee', 'elbow'].includes(word)) moves[moves.length - 1] += ` ${word}`
    else moves.push(word)
    return moves
  }, [])
}

/** The classics that suit this intensity: right length; easy is punches only; medium kicks only at the end. */
export function classicCombos(sport: Exclude<Sport, 'wrestling'>, intensity: Intensity): string[][] {
  const level = LEVELS[intensity]
  return CLASSICS[sport].filter((moves) => {
    if (moves.length < level.minMoves || moves.length > level.maxMoves) return false
    if (intensity === 'easy') return moves.every(isPunch)
    if (intensity === 'medium') return moves.slice(0, -1).every((m) => handOf(m) === null || isPunch(m))
    return true
  })
}

export const CLASSIC_SHARE = 0.5

/** First punch: mostly a jab or cross; on harder levels sometimes a lead hook or uppercut. */
function opener(intensity: Intensity, rng: Rng): string {
  const r = rng()
  if (intensity === 'easy') return r < 0.7 ? '1' : '2'
  if (intensity === 'medium') return r < 0.6 ? '1' : r < 0.9 ? '2' : '3'
  return r < 0.5 ? '1' : r < 0.8 ? '2' : r < 0.9 ? '3' : '5'
}

function strikingCombo(sport: Exclude<Sport, 'wrestling'>, intensity: Intensity, rng: Rng): string[] {
  const classics = classicCombos(sport, intensity)
  if (classics.length > 0 && rng() < CLASSIC_SHARE) return [...pick(classics, rng)]

  const kit = STRIKING[sport]
  const level = LEVELS[intensity]
  const count = between(level.minMoves, level.maxMoves, rng)
  const moves: string[] = [opener(intensity, rng)]
  while (moves.length < count) {
    const last = moves.at(-1)!
    const atEnd = moves.length === count - 1
    let pool = PUNCHES
    if (handOf(last) !== null && rng() < level.defenseChance) pool = kit.defense
    else if (kit.finishers.length > 0 && rng() < (atEnd ? level.finisherAtEnd : level.finisherMidway)) pool = kit.finishers
    // Only moves that keep the combo natural; if none fit, a punch always does (the other hand).
    let options = pool.filter((m) => isNaturalCombo(sport, [...moves, m]))
    if (options.length === 0) options = PUNCHES.filter((m) => isNaturalCombo(sport, [...moves, m]))
    moves.push(pick(options, rng))
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
