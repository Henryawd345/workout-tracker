import { describe, expect, it } from 'vitest'
import { seeded } from '../test/factories.ts'
import {
  classicCombos,
  countMoves,
  CUSTOM_SHARE,
  handOf,
  isDefense,
  isNaturalCombo,
  moveName,
  parseCombo,
  nextCall,
  sportMoves,
  type Call,
} from './combos.ts'
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
    expect(sportMoves('kickboxing')).not.toContain('lead teep')
    expect(sportMoves('muay_thai')).toEqual(expect.arrayContaining(['lead teep', 'lead knee', 'rear elbow', 'check', 'slip lead', 'roll rear']))
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

  describe('combos are natural to throw', () => {
    const STRIKING = ['boxing', 'kickboxing', 'muay_thai'] as const

    it('judges combos the way a coach would', () => {
      const ok = (text: string) => isNaturalCombo('muay_thai', parseCombo('muay_thai', text))
      for (const good of [
        '1 2', '1 1 2', '1 3 2', '5 3 2', '1 2 3 2', '1 2 slip rear 2', '1 slip lead 3', '1 2 3 rear kick',
        '2 lead kick', '2 lead teep', '1 2 roll lead', '1 2 duck 2', '1 2 duck 3',
      ])
        expect(ok(good), good).toBe(true)
      for (const bad of [
        '6 6', '2 2', '4 4', '3 3', '5 5', '5 1 5', '1 1 3', '2 6', '1 3 5', 'slip lead 2', '1 slip lead roll rear',
        '2 rear kick', '1 lead kick', '1 slip rear rear kick', '1 2 slip rear 3', '1 slip lead 2',
      ])
        expect(ok(bad), bad).toBe(false)
    })

    it('every generated combo is natural, at every intensity', () => {
      for (const sport of STRIKING) {
        for (const intensity of INTENSITIES) {
          for (const { call } of sample(sport, intensity, 1500, 3)) {
            expect(isNaturalCombo(sport, call.moves), `${sport} ${intensity}: ${call.text}`).toBe(true)
            expect(call.text).not.toMatch(/(^| )(2 2|3 3|4 4|5 5|6 6)( |$)/)
          }
        }
      }
    })

    it('every classic is natural, uses only that sport’s moves and suits its intensity', () => {
      for (const sport of STRIKING) {
        const vocab = sportMoves(sport)
        for (const intensity of INTENSITIES) {
          const classics = classicCombos(sport, intensity)
          expect(classics.length, `${sport} ${intensity}`).toBeGreaterThan(0)
          for (const moves of classics) {
            expect(isNaturalCombo(sport, moves), moves.join(' ')).toBe(true)
            for (const m of moves) expect(vocab).toContain(m)
          }
        }
      }
    })

    it('counters from the side you slipped or rolled to', () => {
      for (const { call } of sample('boxing', 'hard', 1500, 11)) {
        call.moves.forEach((m, i) => {
          const side = /^(slip|roll) (lead|rear)$/.exec(m)?.[2]
          if (side && i + 1 < call.moves.length) expect(handOf(call.moves[i + 1]), call.text).toBe(side)
        })
      }
    })

    it('says sides as left and right for your stance', () => {
      expect(moveName('lead kick')).toBe('left kick')
      expect(moveName('slip rear')).toBe('slip right')
      expect(moveName('lead kick', 'southpaw')).toBe('right kick')
      expect(moveName('rear low kick', 'southpaw')).toBe('left low kick')
      expect(moveName('3', 'southpaw')).toBe('3')
      const rng = seeded(4)
      const texts = Array.from({ length: 300 }, () => nextCall('muay_thai', 'hard', { rng, stance: 'southpaw' }).text)
      expect(texts.some((t) => /\b(left|right) (kick|knee|elbow|teep)\b/.test(t))).toBe(true)
      expect(texts.some((t) => /\b(lead|rear)\b/.test(t))).toBe(false)
    })

    it('kicks and knees come off the other side from the strike before', () => {
      for (const { call } of sample('muay_thai', 'hard', 1500, 5)) {
        call.moves.forEach((m, i) => {
          if (i > 0 && !/^[1-6]$/.test(m) && handOf(m) !== null) {
            expect(handOf(m), call.text).not.toBe(handOf(call.moves[i - 1]))
          }
        })
      }
    })

    it('mostly opens with a jab or cross, and about half the calls are classics', () => {
      const calls = sample('boxing', 'medium', 1000, 9).map(({ call }) => call.text)
      const openers = calls.filter((t) => /^[12]( |$)/.test(t)).length
      expect(openers / calls.length).toBeGreaterThan(0.8)
      const classics = new Set(classicCombos('boxing', 'medium').map((m) => m.join(' ')))
      const share = calls.filter((t) => classics.has(t)).length / calls.length
      expect(share).toBeGreaterThan(0.4)
      expect(share).toBeLessThan(0.75) // some generated ones happen to match a classic too
    })
  })

  it('counts moves in a typed combo', () => {
    expect(countMoves('1 2 3 slip 2')).toBe(5)
    expect(countMoves('1 2 lead kick')).toBe(3)
    expect(countMoves('1 2 slip left 2 right kick')).toBe(5)
    expect(countMoves('Roll Right 3')).toBe(2)
    expect(countMoves('1 2 slip lead 3')).toBe(4)
    expect(countMoves('snap down, go behind')).toBe(2)
    expect(countMoves('shot, sprawl, re-shot')).toBe(3)
    expect(countMoves('double leg, level change')).toBe(2)
    expect(countMoves('   ')).toBe(1)
  })
})
