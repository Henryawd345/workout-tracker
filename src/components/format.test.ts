import { describe, expect, it } from 'vitest'
import { daysAgo, formatRelativeDay, plural } from './format.ts'

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

  it('pluralises', () => {
    expect(plural(1, 'exercise')).toBe('1 exercise')
    expect(plural(3, 'exercise')).toBe('3 exercises')
  })
})
