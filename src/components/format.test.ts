import { describe, expect, it } from 'vitest'
import { done, doneTimed, makeSet } from '../test/factories.ts'
import { daysAgo, formatRelativeDay, formatSetShort, formatSetsSummary, plural } from './format.ts'

const now = new Date(2026, 8, 23, 9, 0) // Wed 23 Sep 2026, 09:00 local

describe('dates', () => {
  it('counts calendar days, not 24-hour periods', () => {
    expect(daysAgo(new Date(2026, 8, 22, 23, 30).toISOString(), now)).toBe(1)
    expect(daysAgo(new Date(2026, 8, 23, 0, 5).toISOString(), now)).toBe(0)
  })

  it('uses friendly words for the last week', () => {
    expect(formatRelativeDay(new Date(2026, 8, 23, 7).toISOString(), now)).toBe('Today')
    expect(formatRelativeDay(new Date(2026, 8, 22, 7).toISOString(), now)).toBe('Yesterday')
    expect(formatRelativeDay(new Date(2026, 8, 19, 7).toISOString(), now)).toBe('4 days ago')
    expect(formatRelativeDay(new Date(2026, 8, 1, 7).toISOString(), now)).toMatch(/1/)
  })

  it('summarises last time’s sets', () => {
    expect(formatSetsSummary([done(80, 8), done(80, 8), done(80, 7)], 'kg')).toBe('80 kg × 8, 8, 7')
    expect(formatSetsSummary([done(80, 8), done(85, 5)], 'kg')).toBe('80×8, 85×5 kg')
    expect(formatSetsSummary([done(100, 5, 'kg')], 'lb')).toBe('220.5 lb × 5')
    expect(formatSetsSummary([makeSet({ reps: 12 }), makeSet({ reps: 10 })], 'kg')).toBe('12, 10 reps')
    expect(formatSetsSummary([doneTimed(60), doneTimed(45)], 'kg')).toBe('1:00, 0:45')
    expect(formatSetsSummary([], 'kg')).toBe('')
  })

  it('shows a single set briefly', () => {
    expect(formatSetShort(done(62.5, 5), 'kg')).toBe('62.5×5')
    expect(formatSetShort(doneTimed(90), 'kg')).toBe('1:30')
    expect(formatSetShort(makeSet({ reps: 15 }), 'kg')).toBe('15 reps')
  })

  it('pluralises', () => {
    expect(plural(1, 'exercise')).toBe('1 exercise')
    expect(plural(3, 'exercise')).toBe('3 exercises')
  })
})
