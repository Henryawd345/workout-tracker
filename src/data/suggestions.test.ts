import { describe, expect, it } from 'vitest'
import { done, makeSet } from '../test/factories.ts'
import { completeSet, missingFields, suggestSet, uncompleteSet } from './suggestions.ts'

const NOW = '2026-09-23T10:00:00.000Z'

describe('suggestSet', () => {
  const previous = [done(80, 8), done(80, 8), done(75, 7)]

  it('uses the same set from last session', () => {
    expect(suggestSet({ index: 0, previousSets: previous, plannedSets: [], unit: 'kg' })).toEqual({
      weight: 80,
      weightUnit: 'kg',
      reps: 8,
      durationSec: null,
    })
    expect(suggestSet({ index: 2, previousSets: previous, plannedSets: [], unit: 'kg' }).weight).toBe(75)
  })

  it('repeats the last set when doing more sets than last time', () => {
    const s = suggestSet({ index: 5, previousSets: previous, plannedSets: [], unit: 'kg' })
    expect(s).toMatchObject({ weight: 75, reps: 7 })
  })

  it('prefers last session over routine targets', () => {
    const s = suggestSet({ index: 0, previousSets: previous, plannedSets: [{ targetReps: 12 }], unit: 'kg' })
    expect(s.reps).toBe(8)
  })

  it('falls back to routine targets when there is no history', () => {
    const planned = [{ targetReps: 10, targetWeight: 60, targetWeightUnit: 'kg' as const }, { targetReps: 8 }]
    expect(suggestSet({ index: 0, previousSets: [], plannedSets: planned, unit: 'kg' })).toMatchObject({
      weight: 60,
      reps: 10,
    })
    expect(suggestSet({ index: 1, previousSets: [], plannedSets: planned, unit: 'kg' })).toMatchObject({
      weight: null,
      reps: 8,
    })
    expect(suggestSet({ index: 4, previousSets: [], plannedSets: planned, unit: 'kg' }).reps).toBe(8)
  })

  it('suggests nothing without history or plan', () => {
    expect(suggestSet({ index: 0, previousSets: [], plannedSets: [], unit: 'lb' })).toEqual({
      weight: null,
      weightUnit: 'lb',
      reps: null,
      durationSec: null,
    })
  })

  it('keeps last session’s weight in its original unit (the screen converts for display)', () => {
    const s = suggestSet({ index: 0, previousSets: [done(225, 5, 'lb')], plannedSets: [], unit: 'kg' })
    expect(s).toMatchObject({ weight: 225, weightUnit: 'lb', reps: 5 })
  })

  it('keeps a routine target in its own unit', () => {
    const planned = [{ targetWeight: 135, targetWeightUnit: 'lb' as const, targetReps: 5 }]
    expect(suggestSet({ index: 0, previousSets: [], plannedSets: planned, unit: 'kg' })).toMatchObject({
      weight: 135,
      weightUnit: 'lb',
    })
  })

  it('suggests durations for timed exercises', () => {
    const prev = [makeSet({ durationSec: 60, completed: true })]
    expect(suggestSet({ index: 0, previousSets: prev, plannedSets: [], unit: 'kg' }).durationSec).toBe(60)
    expect(
      suggestSet({ index: 0, previousSets: [], plannedSets: [{ targetDurationSec: 45 }], unit: 'kg' }).durationSec,
    ).toBe(45)
  })
})

describe('completeSet (the ✓ tap)', () => {
  const suggestion = { weight: 80, weightUnit: 'kg' as const, reps: 8, durationSec: null }

  it('confirms the suggestion in one tap', () => {
    const result = completeSet(makeSet(), suggestion, 'weight_reps', NOW)
    expect(result).toMatchObject({ weight: 80, reps: 8, completed: true, completedAt: NOW })
  })

  it('keeps values the user typed and fills only the empty ones', () => {
    const result = completeSet(makeSet({ reps: 6 }), suggestion, 'weight_reps', NOW)
    expect(result).toMatchObject({ weight: 80, reps: 6 })
  })

  it('stores an accepted suggestion exactly, with no conversion drift', () => {
    const lastTime = suggestSet({ index: 0, previousSets: [done(45, 10, 'lb')], plannedSets: [], unit: 'kg' })
    const result = completeSet(makeSet({ weightUnit: 'kg' }), lastTime, 'weight_reps', NOW)
    expect(result).toMatchObject({ weight: 45, weightUnit: 'lb', reps: 10 })
  })

  it('keeps a typed weight in its own unit', () => {
    const typed = makeSet({ weight: 180, weightUnit: 'lb' })
    expect(completeSet(typed, suggestion, 'weight_reps', NOW)).toMatchObject({ weight: 180, weightUnit: 'lb' })
  })

  it('refuses to complete when a required value is missing', () => {
    const empty = { weight: null, weightUnit: 'kg' as const, reps: null, durationSec: null }
    expect(completeSet(makeSet(), empty, 'weight_reps', NOW)).toBeNull()
    expect(completeSet(makeSet({ weight: 50 }), empty, 'weight_reps', NOW)).toBeNull()
    expect(completeSet(makeSet(), empty, 'duration', NOW)).toBeNull()
  })

  it('allows 0 kg (bodyweight) but not 0 reps', () => {
    const empty = { weight: null, weightUnit: 'kg' as const, reps: null, durationSec: null }
    expect(completeSet(makeSet({ weight: 0, reps: 10 }), empty, 'weight_reps', NOW)).not.toBeNull()
    expect(completeSet(makeSet({ weight: 50, reps: 0 }), empty, 'weight_reps', NOW)).toBeNull()
  })

  it('stores only the fields the exercise type uses', () => {
    const noisy = { weight: 20, weightUnit: 'kg' as const, reps: 10, durationSec: 30 }
    expect(completeSet(makeSet(), noisy, 'reps_only', NOW)).toMatchObject({ weight: null, reps: 10, durationSec: null })
    expect(completeSet(makeSet(), noisy, 'duration', NOW)).toMatchObject({ weight: null, reps: null, durationSec: 30 })
    expect(completeSet(makeSet(), noisy, 'weight_reps', NOW)).toMatchObject({ weight: 20, reps: 10, durationSec: null })
  })

  it('does not change the original set', () => {
    const set = makeSet()
    completeSet(set, suggestion, 'weight_reps', NOW)
    expect(set.completed).toBe(false)
    expect(set.weight).toBeNull()
  })

  it('can be undone, keeping the values', () => {
    const completed = completeSet(makeSet(), suggestion, 'weight_reps', NOW)!
    expect(uncompleteSet(completed)).toMatchObject({ weight: 80, reps: 8, completed: false, completedAt: null })
  })
})

describe('missingFields', () => {
  it('lists what still needs a value', () => {
    expect(missingFields({ weight: null, reps: null, durationSec: null }, 'weight_reps')).toEqual(['weight', 'reps'])
    expect(missingFields({ weight: null, reps: 5, durationSec: null }, 'reps_only')).toEqual([])
    expect(missingFields({ weight: null, reps: null, durationSec: 0 }, 'duration')).toEqual(['durationSec'])
  })
})
