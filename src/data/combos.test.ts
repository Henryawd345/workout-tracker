import { describe, expect, it } from 'vitest'
import { seeded } from '../test/factories.ts'
import { countMoves, CUSTOM_SHARE, isDefense, nextCall, sportMoves, type Call } from './combos.ts'
import { INTENSITIES, SPORTS, type Intensity, type Sport } from './types.ts'

function sample(sport: Sport, intensity: Intensity, n = 400, seed = 1): { call: Call; previous: string | null }[] {
  const rng = seeded(seed)
  const calls = []
  let previous: string | null = null
  for (let i = 0; i < n; i++) {
    const call = nextCall(sport, intensity, { previous, rng })
    calls.push({ call, previous })
    previous = call.text
  }
  return calls
}

const PUNCH = /^[1-6]$/

describe('combo generator', () => {
  it('uses only moves from the chosen sport', () => {
    for (const sport of SPORTS) {
      const moves = sportMoves(sport)
      for (const intensity of INTENSITIES) {
        for (const { call } of sample(sport, intensity)) {
          for (const m of call.moves) expect(moves, `${sport} ${intensity}`).toContain(m)
        }
      }
    }
    expect(sportMoves('boxing')).not.toContain('rear kick')
    expect(sportMoves('kickboxing')).not.toContain('teep')
    expect(sportMoves('muay_thai')).toEqual(expect.arrayContaining(['teep', 'lead knee', 'rear elbow', 'check']))
  })

  it('makes longer combos at higher intensity', () => {
    const lengths = (i: Intensity) => sample('boxing', i).map(({ call }) => call.moves.length)
    expect([Math.min(...lengths('easy')), Math.max(...lengths('easy'))]).toEqual([1, 2])
    expect([Math.min(...lengths('medium')), Math.max(...lengths('medium'))]).toEqual([2, 4])
    expect([Math.min(...lengths('hard')), Math.max(...lengths('hard'))]).toEqual([3, 6])
  })

  it('keeps easy to punches only and adds defence and kicks when harder', () => {
    for (const { call } of sample('muay_thai', 'easy')) for (const m of call.moves) expect(m).toMatch(PUNCH)
    const hard = sample('muay_thai', 'hard').flatMap(({ call }) => call.moves)
    expect(hard.some((m) => isDefense('muay_thai', m))).toBe(true)
    expect(hard.some((m) => /kick|knee|elbow|teep/.test(m))).toBe(true)
  })

  it('never starts with defence, doubles defence, or throws the same move 3 times running', () => {
    for (const sport of ['boxing', 'kickboxing', 'muay_thai'] as const) {
      for (const { call } of sample(sport, 'hard', 600)) {
        expect(isDefense(sport, call.moves[0])).toBe(false)
        call.moves.forEach((m, i) => {
          if (i > 0) expect(isDefense(sport, m) && isDefense(sport, call.moves[i - 1])).toBe(false)
          if (i > 1) expect(m === call.moves[i - 1] && m === call.moves[i - 2]).toBe(false)
        })
      }
    }
  })

  it('never repeats the previous call', () => {
    for (const sport of SPORTS) {
      for (const { call, previous } of sample(sport, 'easy')) expect(call.text).not.toBe(previous)
    }
  })

  it('leaves more time for longer combos and less at higher intensity', () => {
    const gap = (i: Intensity, len: number) =>
      sample('boxing', i).find(({ call }) => call.moves.length === len)!.call.gapSec
    expect(gap('hard', 6)).toBeGreaterThan(gap('hard', 3))
    expect(gap('easy', 2)).toBeGreaterThan(gap('medium', 2))
    expect(gap('easy', 2)).toBeCloseTo(4.1)
    expect(gap('hard', 3)).toBeCloseTo(2.4)
  })

  it('calls wrestling drills, with chains only when hard', () => {
    expect(sample('wrestling', 'easy').every(({ call }) => call.moves.length === 1 && !call.text.includes(','))).toBe(true)
    expect(sample('wrestling', 'hard').some(({ call }) => call.text.includes('re-shot'))).toBe(true)
  })

  it('mixes in your own combos about one call in three', () => {
    const rng = seeded(7)
    const custom = ['1 2 3 slip 2', 'jab teep']
    let previous: string | null = null
    let mine = 0
    for (let i = 0; i < 600; i++) {
      const call = nextCall('boxing', 'medium', { custom, previous, rng })
      if (call.custom) {
        mine++
        expect(custom).toContain(call.text)
      }
      previous = call.text
    }
    expect(mine / 600).toBeGreaterThan(CUSTOM_SHARE - 0.08)
    expect(mine / 600).toBeLessThan(CUSTOM_SHARE + 0.08)
  })

  it('still returns a call with a stuck random source', () => {
    expect(nextCall('wrestling', 'hard', { rng: () => 0 }).moves.length).toBeGreaterThan(0)
  })

  it('counts moves in a typed combo', () => {
    expect(countMoves('1 2 3 slip 2')).toBe(5)
    expect(countMoves('1 2 lead kick')).toBe(3)
    expect(countMoves('double leg, level change')).toBe(2)
    expect(countMoves('   ')).toBe(1)
  })
})
