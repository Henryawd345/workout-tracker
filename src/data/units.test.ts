import { describe, expect, it } from 'vitest'
import {
  convertWeight,
  displayWeight,
  formatDuration,
  formatNumber,
  formatWeight,
  KG_PER_LB,
  parseDuration,
  round1,
} from './units.ts'

describe('weight conversion', () => {
  it('uses the exact definition of a pound', () => {
    expect(KG_PER_LB).toBe(0.45359237)
    expect(convertWeight(1, 'lb', 'kg')).toBe(0.45359237)
  })

  it('leaves values alone when the unit is the same', () => {
    expect(convertWeight(102.5, 'kg', 'kg')).toBe(102.5)
    expect(convertWeight(45, 'lb', 'lb')).toBe(45)
  })

  it('converts common gym weights for display', () => {
    expect(displayWeight(100, 'kg', 'lb')).toBe(220.5)
    expect(displayWeight(45, 'lb', 'kg')).toBe(20.4)
    expect(displayWeight(225, 'lb', 'kg')).toBe(102.1)
    expect(displayWeight(20, 'kg', 'lb')).toBe(44.1)
  })

  it('round-trips without drift when unrounded', () => {
    for (const w of [2.5, 45, 135, 225, 315, 405]) {
      expect(convertWeight(convertWeight(w, 'lb', 'kg'), 'kg', 'lb')).toBeCloseTo(w, 10)
    }
  })

  it('handles zero (bodyweight)', () => {
    expect(displayWeight(0, 'lb', 'kg')).toBe(0)
  })
})

describe('parseDuration', () => {
  it('reads seconds, m:ss and h:mm:ss', () => {
    expect(parseDuration('90')).toBe(90)
    expect(parseDuration('1:30')).toBe(90)
    expect(parseDuration(' 0:45 ')).toBe(45)
    expect(parseDuration('1:02:03')).toBe(3723)
  })

  it('rejects empty, zero and malformed input', () => {
    for (const bad of ['', '  ', '0', '0:00', 'abc', '1:75', '1:2:3:4', '-5', '1.5']) {
      expect(parseDuration(bad), bad).toBeNull()
    }
  })
})

describe('formatting', () => {
  it('rounds to one decimal without float noise', () => {
    expect(round1(20.400000000000002)).toBe(20.4)
    expect(round1(0.05)).toBe(0.1)
    expect(round1(1.005)).toBe(1)
  })

  it('drops a trailing .0', () => {
    expect(formatNumber(100)).toBe('100')
    expect(formatNumber(102.5)).toBe('102.5')
  })

  it('formats weights with the display unit', () => {
    expect(formatWeight(100, 'lb', 'kg')).toBe('45.4 kg')
    expect(formatWeight(60, 'kg', 'kg')).toBe('60 kg')
  })

  it('formats durations', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(45)).toBe('0:45')
    expect(formatDuration(75)).toBe('1:15')
    expect(formatDuration(3600)).toBe('1:00:00')
    expect(formatDuration(3725)).toBe('1:02:05')
    expect(formatDuration(-5)).toBe('0:00')
  })
})
