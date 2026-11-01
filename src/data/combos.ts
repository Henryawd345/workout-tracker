import type { Intensity, Sport, Stance } from './types.ts'

// Random combos for the fight coach. Pure: pass `rng` (0 ≤ n < 1) to make results repeatable.

export type Rng = () => number

// Punches are called as numbers: 1 jab, 2 cross, 3 lead hook, 4 rear hook, 5 lead uppercut, 6 rear uppercut.
// Everything else is stored by side (lead/rear) and said as left/right for your stance — see moveName().
const PUNCHES = ['1', '2', '3', '4', '5', '6']
const BOXING_DEFENSE = ['slip lead', 'slip rear', 'roll lead', 'roll rear', 'duck', 'pull']
const KICKS = ['lead kick', 'rear kick', 'rear low kick', 'lead front kick']
const THAI_STRIKES = ['lead teep', 'lead kick', 'rear kick', 'rear low kick', 'lead knee', 'rear knee', 'lead elbow', 'rear elbow']

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
  if (move.startsWith('lead ')) return 'lead'
  if (move.startsWith('rear ')) return 'rear'
  return null
}

/** The side a slip or roll moves you to (you counter from that side); null for other moves. */
export function defenceSide(move: string): Hand | null {
  const m = /^(slip|roll) (lead|rear)$/.exec(move)
  return m ? (m[2] as Hand) : null
}

/** "lead kick" → "left kick" (orthodox) or "right kick" (southpaw). Numbers stay numbers. */
export function moveName(move: string, stance: Stance = 'orthodox'): string {
  const lead = stance === 'southpaw' ? 'right' : 'left'
  const rear = stance === 'southpaw' ? 'left' : 'right'
  return move
    .split(' ')
    .map((w) => (w === 'lead' ? lead : w === 'rear' ? rear : w))
    .join(' ')
}

/** "1 2 slip rear 2" → ["1", "2", "slip rear", "2"], matching the longest known move at each step. */
export function parseCombo(sport: Sport, text: string): string[] {
  const vocab = sportMoves(sport)
  const words = text.split(' ').filter(Boolean)
  const moves: string[] = []
  for (let i = 0; i < words.length; ) {
    let n = Math.min(3, words.length - i)
    while (n > 1 && !vocab.includes(words.slice(i, i + n).join(' '))) n--
    moves.push(words.slice(i, i + n).join(' '))
    i += n
  }
  return moves
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
 *   straight after defence (after a slip or roll you counter with a punch — from the side
 *   you slipped or rolled to).
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
      const side = defenceSide(prev)
      if (side !== null && side !== hand) return false // …from the side you moved to
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
  '1 2 3 2', '1 6 3 2', '1 2 5 2', '5 2 3 2', '1 1 2 3', '1 2 slip rear 2', '1 2 roll rear 2', '1 2 3 roll lead',
  '1 slip lead 3 2', '1 2 3 6 3 2', '1 2 slip rear 2 3 2', '1 6 3 2 roll lead 3', '1 2 5 2 3 2',
]
const KICK_CLASSICS = [
  '1 2 3 rear low kick', '1 2 lead kick', '1 rear kick', '2 3 rear kick', '1 2 3 2 lead kick', '1 2 slip rear 2 lead kick',
]
const THAI_CLASSICS = ['1 2 3 rear knee', '2 lead teep', '1 2 lead knee', '1 rear elbow', '2 lead elbow', '1 2 3 rear elbow']

const CLASSICS: Record<Exclude<Sport, 'wrestling'>, string[][]> = {
  boxing: BOXING_CLASSICS.map((c) => parseCombo('boxing', c)),
  kickboxing: [...BOXING_CLASSICS, ...KICK_CLASSICS].map((c) => parseCombo('kickboxing', c)),
  muay_thai: [...BOXING_CLASSICS, ...KICK_CLASSICS, ...THAI_CLASSICS].map((c) => parseCombo('muay_thai', c)),
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

/** Words that belong to the next word ("left kick", "double leg"). */
const JOINERS = new Set([
  'lead', 'rear', 'left', 'right', 'low', 'front',
  'level', 'double', 'single', 'down', 'snap', 'hand', 'stand', 'go',
])

const SIDES = new Set(['left', 'right', 'lead', 'rear'])

/**
 * Rough move count of a typed combo, for its gap: "1 2 left kick" → 3, "1 slip left 2" → 3,
 * "snap down, go behind" → 2 (commas always separate moves).
 */
export function countMoves(text: string): number {
  const chunks = text.toLowerCase().split(',').map((c) => c.split(/\s+/).filter(Boolean)).filter((c) => c.length > 0)
  const total = chunks.reduce((sum, words) => {
    const counted = words.filter((w, i) => {
      if (SIDES.has(w) && (words[i - 1] === 'slip' || words[i - 1] === 'roll')) return false
      return !(i < words.length - 1 && JOINERS.has(w) && !/^[1-6]$/.test(words[i + 1]))
    })
    return sum + Math.max(1, counted.length)
  }, 0)
  return Math.max(1, total)
}

/** Share of calls taken from the user's own combos, when there are any. */
export const CUSTOM_SHARE = 1 / 3

/** The next thing the coach calls. Never the same text twice in a row, if it can help it. */
export function nextCall(
  sport: Sport,
  intensity: Intensity,
  options: { custom?: string[]; previous?: string | null; rng?: Rng; stance?: Stance } = {},
): Call {
  const { custom = [], previous = null, rng = Math.random, stance = 'orthodox' } = options
  let call: Call | null = null
  for (let tries = 0; tries < 10 && (call === null || call.text === previous); tries++) {
    if (custom.length > 0 && rng() < CUSTOM_SHARE) {
      const text = pick(custom, rng)
      call = { text, moves: [text], gapSec: gapFor(intensity, countMoves(text)), custom: true }
    } else {
      const moves = sport === 'wrestling' ? wrestlingCalls(intensity, rng) : strikingCombo(sport, intensity, rng)
      const count = moves.reduce((n, m) => n + m.split(',').length, 0)
      const text = sport === 'wrestling' ? moves.join(', ') : moves.map((m) => moveName(m, stance)).join(' ')
      call = { text, moves, gapSec: gapFor(intensity, count), custom: false }
    }
  }
  return call!
}
