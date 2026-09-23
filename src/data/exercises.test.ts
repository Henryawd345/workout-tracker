import { beforeEach, describe, expect, it } from 'vitest'
import { addCompletedWorkout, done, makeExercise, resetDb } from '../test/factories.ts'
import { db, ensureSeedExercises } from './db.ts'
import {
  createCustomExercise,
  isExerciseLogged,
  listExercises,
  removeCustomExercise,
  restoreExercise,
  searchExercises,
  updateExercise,
} from './exercises.ts'
import { createRoutine, newRoutineExercise } from './routines.ts'
import { SEED_EXERCISES, seedExerciseId } from './seedExercises.ts'
import { EQUIPMENT, MUSCLE_GROUPS } from './types.ts'

beforeEach(resetDb)

describe('built-in library', () => {
  it('has around 80+ exercises with unique ids and names', () => {
    expect(SEED_EXERCISES.length).toBeGreaterThanOrEqual(80)
    expect(new Set(SEED_EXERCISES.map((e) => e.id)).size).toBe(SEED_EXERCISES.length)
    expect(new Set(SEED_EXERCISES.map((e) => e.name.toLowerCase())).size).toBe(SEED_EXERCISES.length)
  })

  it('uses only known muscle groups and equipment', () => {
    for (const e of SEED_EXERCISES) {
      expect(e.muscleGroups.length).toBeGreaterThan(0)
      for (const m of e.muscleGroups) expect(MUSCLE_GROUPS).toContain(m)
      expect(EQUIPMENT).toContain(e.equipment)
    }
  })

  it('has stable ids derived from the name', () => {
    expect(seedExerciseId('Barbell Bench Press')).toBe('ex-barbell-bench-press')
    expect(seedExerciseId("Farmer's Carry")).toBe('ex-farmer-s-carry')
  })

  it('is loaded into the database', async () => {
    expect(await db.exercises.count()).toBe(SEED_EXERCISES.length)
  })

  it('seeding again adds nothing and keeps user changes', async () => {
    await updateExercise('ex-leg-press', { note: 'seat 4' })
    await ensureSeedExercises()
    expect(await db.exercises.count()).toBe(SEED_EXERCISES.length)
    expect((await db.exercises.get('ex-leg-press'))?.note).toBe('seat 4')
  })
})

describe('searchExercises', () => {
  const all = SEED_EXERCISES

  it('matches every word in any order, ignoring case and punctuation', () => {
    const names = searchExercises(all, { query: 'PRESS dumbbell' }).map((e) => e.name)
    expect(names).toContain('Dumbbell Bench Press')
    expect(names).toContain('Incline Dumbbell Press')
    expect(names).not.toContain('Barbell Bench Press')
    expect(searchExercises(all, { query: 'pullup' }).length).toBe(0)
    expect(searchExercises(all, { query: 'pull-up' }).map((e) => e.name)).toContain('Pull-Up')
  })

  it('matches muscle and equipment words too', () => {
    const names = searchExercises(all, { query: 'cable chest' }).map((e) => e.name)
    expect(names).toEqual(['Cable Fly'])
  })

  it('filters by muscle group and equipment', () => {
    const result = searchExercises(all, { muscle: 'hamstrings', equipment: 'machine' })
    expect(result.map((e) => e.name)).toEqual(['Lying Leg Curl', 'Seated Leg Curl'])
  })

  it('sorts by name and hides archived exercises unless asked', () => {
    const list = [
      { ...all[0], name: 'B' },
      { ...all[1], name: 'A' },
      { ...all[2], name: 'C', archived: true },
    ]
    expect(searchExercises(list).map((e) => e.name)).toEqual(['A', 'B'])
    expect(searchExercises(list, { includeArchived: true })).toHaveLength(3)
  })
})

describe('custom exercises', () => {
  const input = {
    name: '  Landmine Press ',
    muscleGroups: ['shoulders' as const],
    equipment: 'barbell' as const,
    trackingType: 'weight_reps' as const,
  }

  it('can be created and appear in the list', async () => {
    const e = await createCustomExercise(input)
    expect(e).toMatchObject({ name: 'Landmine Press', isCustom: true, archived: false })
    expect((await listExercises()).map((x) => x.id)).toContain(e.id)
  })

  it('require a name and a muscle group', async () => {
    await expect(createCustomExercise({ ...input, name: '  ' })).rejects.toThrow('name')
    await expect(createCustomExercise({ ...input, muscleGroups: [] })).rejects.toThrow('muscle')
  })

  it('can be fully edited, while built-in exercises only take a note', async () => {
    const custom = await createCustomExercise(input)
    expect(await updateExercise(custom.id, { name: 'Landmine', equipment: 'other' })).toMatchObject({
      name: 'Landmine',
      equipment: 'other',
    })
    const builtIn = await updateExercise('ex-deadlift', { name: 'Hacked', note: 'mixed grip' })
    expect(builtIn).toMatchObject({ name: 'Deadlift', note: 'mixed grip' })
  })

  it('are deleted when unused', async () => {
    const e = await createCustomExercise(input)
    expect(await removeCustomExercise(e.id)).toBe('deleted')
    expect(await db.exercises.get(e.id)).toBeUndefined()
  })

  it('are archived (not deleted) when used in history', async () => {
    const e = await createCustomExercise(input)
    await addCompletedWorkout('2026-09-01T10:00:00Z', [makeExercise(e.id, [done(40, 10)])])
    expect(await removeCustomExercise(e.id)).toBe('archived')
    expect((await db.exercises.get(e.id))?.archived).toBe(true)
    await restoreExercise(e.id)
    expect((await db.exercises.get(e.id))?.archived).toBe(false)
  })

  it('are archived when used in a routine', async () => {
    const e = await createCustomExercise(input)
    await createRoutine('Push', [newRoutineExercise(e.id, 90)])
    expect(await removeCustomExercise(e.id)).toBe('archived')
  })

  it('cannot reuse the name of an existing exercise', async () => {
    await expect(createCustomExercise({ ...input, name: 'deadlift' })).rejects.toThrow('already exists')
    const e = await createCustomExercise(input)
    await expect(updateExercise(e.id, { name: 'Back Squat' })).rejects.toThrow('already exists')
    // Keeping its own name, or changing only the case, is fine
    await expect(updateExercise(e.id, { name: 'landmine press' })).resolves.toMatchObject({ name: 'landmine press' })
  })

  it('may reuse the name of an archived exercise', async () => {
    const old = await createCustomExercise(input)
    await addCompletedWorkout('2026-09-01T10:00:00Z', [makeExercise(old.id, [done(40, 10)])])
    await removeCustomExercise(old.id)
    await expect(createCustomExercise(input)).resolves.toMatchObject({ name: 'Landmine Press' })
  })

  it('will not restore an archived exercise whose name was taken meanwhile', async () => {
    const old = await createCustomExercise(input)
    await addCompletedWorkout('2026-09-01T10:00:00Z', [makeExercise(old.id, [done(40, 10)])])
    await removeCustomExercise(old.id)
    await createCustomExercise(input)

    await expect(restoreExercise(old.id)).rejects.toThrow('already exists')
    expect((await db.exercises.get(old.id))?.archived).toBe(true)

    // Renaming the archived one first makes restoring possible
    await updateExercise(old.id, { name: 'Landmine Press (old)' })
    await restoreExercise(old.id)
    expect((await db.exercises.get(old.id))?.archived).toBe(false)
  })

  it('rejects very long names and removing every muscle group', async () => {
    await expect(createCustomExercise({ ...input, name: 'x'.repeat(61) })).rejects.toThrow('under 60')
    const e = await createCustomExercise(input)
    await expect(updateExercise(e.id, { muscleGroups: [] })).rejects.toThrow('muscle')
  })

  it('locks the tracking type once the exercise has been logged', async () => {
    const e = await createCustomExercise(input)
    await expect(updateExercise(e.id, { trackingType: 'reps_only' })).resolves.toMatchObject({
      trackingType: 'reps_only',
    })
    await addCompletedWorkout('2026-09-01T10:00:00Z', [makeExercise(e.id, [done(40, 10)])])
    expect(await isExerciseLogged(e.id)).toBe(true)
    await expect(updateExercise(e.id, { trackingType: 'duration' })).rejects.toThrow('can’t change')
    await expect(updateExercise(e.id, { note: 'still editable' })).resolves.toMatchObject({ note: 'still editable' })
  })

  it('built-in exercises cannot be removed', async () => {
    await expect(removeCustomExercise('ex-deadlift')).rejects.toThrow('Built-in')
  })
})
