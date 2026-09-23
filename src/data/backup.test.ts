import { beforeEach, describe, expect, it } from 'vitest'
import { addCompletedWorkout, done, doneTimed, makeExercise, makeSet, resetDb } from '../test/factories.ts'
import {
  backupFileName,
  BackupError,
  backupToCsv,
  deleteAllData,
  exportBackup,
  importBackup,
  parseBackup,
} from './backup.ts'
import { db } from './db.ts'
import { createCustomExercise, updateExercise } from './exercises.ts'
import { createRoutine, newRoutineExercise } from './routines.ts'
import { SEED_EXERCISES } from './seedExercises.ts'
import { getSettings, updateSettings } from './settings.ts'
import { getActiveWorkout, saveWorkout, startWorkout } from './workouts.ts'

beforeEach(resetDb)

async function seedData() {
  await updateSettings({ displayUnit: 'lb', defaultRestSec: 120 })
  await updateExercise('ex-leg-press', { note: 'Seat 5' })
  const custom = await createCustomExercise({ name: 'Sled Push', muscleGroups: ['quads'], equipment: 'other', trackingType: 'weight_reps' })
  await createRoutine('Legs', [newRoutineExercise(custom.id, 90), newRoutineExercise('ex-leg-press', 120)])
  await addCompletedWorkout('2026-09-01T17:00:00.000Z', [
    { ...makeExercise('ex-back-squat', [done(225, 5, 'lb'), makeSet({ weight: 1, reps: 1 })]), note: 'belt, "tight"' },
    makeExercise('ex-plank', [doneTimed(60)]),
  ], { name: 'Legs, heavy', note: 'good' })
  return custom
}

describe('backup', () => {
  it('round-trips everything through JSON, exactly', async () => {
    const custom = await seedData()
    const text = JSON.stringify(await exportBackup())
    await deleteAllData()
    expect(await db.workouts.count()).toBe(0)

    const result = await importBackup(parseBackup(text), 'replace')
    expect(result).toEqual({ workouts: 1, routines: 1, exercises: 1, skippedActive: false, keptNewer: 0 })
    expect(await getSettings()).toMatchObject({ displayUnit: 'lb', defaultRestSec: 120 })
    expect((await db.exercises.get('ex-leg-press'))?.note).toBe('Seat 5')
    expect(await db.exercises.get(custom.id)).toMatchObject({ name: 'Sled Push', isCustom: true })
    const [w] = await db.workouts.toArray()
    expect(w.exercises[0].sets[0]).toMatchObject({ weight: 225, weightUnit: 'lb', reps: 5, completed: true })
  })

  it('writes a spreadsheet with one row per ticked set, quoting where needed', async () => {
    await seedData()
    const csv = backupToCsv(await exportBackup())
    const lines = csv.trim().split('\r\n')
    expect(lines[0]).toBe('date,workout,exercise,set,weight,unit,reps,duration_sec,exercise_note,workout_note')
    expect(lines).toHaveLength(3) // two ticked sets; the unticked one is left out
    expect(lines[1]).toBe('2026-09-01T17:00:00.000Z,"Legs, heavy",Back Squat,1,225,lb,5,,"belt, ""tight""",good')
    expect(lines[2]).toBe('2026-09-01T17:00:00.000Z,"Legs, heavy",Plank,1,,,,60,,good')
  })

  it('merges without touching what is already here, and keeps one workout in progress', async () => {
    await seedData()
    const backup = await exportBackup()
    const inBackup = await startWorkout()
    const withActive = await exportBackup()
    await db.workouts.delete(inBackup.id)

    await deleteAllData()
    await addCompletedWorkout('2026-09-10T17:00:00.000Z', [makeExercise('ex-deadlift', [done(140, 5)])])
    const here = await startWorkout()
    const result = await importBackup(parseBackup(JSON.stringify(withActive)), 'merge')

    expect(result.skippedActive).toBe(true)
    expect(await db.workouts.where('status').equals('completed').count()).toBe(2)
    expect((await getActiveWorkout())?.id).toBe(here.id)
    expect(backup.workouts).toHaveLength(1)
  })

  it('rejects files that are not valid backups, changing nothing', async () => {
    await seedData()
    const good = await exportBackup()
    const cases: [string, string][] = [
      ['not json', 'valid JSON'],
      [JSON.stringify({ app: 'other' }), 'isn’t a Workout Tracker backup'],
      [JSON.stringify({ ...good, version: 99 }), 'newer version'],
      [JSON.stringify({ ...good, workouts: [{ ...good.workouts[0], status: 'weird' }] }), 'workouts are damaged'],
      [JSON.stringify({ ...good, exercises: good.exercises.filter((e) => e.id !== 'ex-back-squat') }), 'doesn’t contain'],
    ]
    for (const [text, message] of cases) {
      expect(() => parseBackup(text), message).toThrow(BackupError)
      expect(() => parseBackup(text)).toThrow(message)
    }
    expect(await db.workouts.count()).toBe(1)
  })

  it('rebuilds the exercise index of imported workouts', async () => {
    await seedData()
    const b = await exportBackup()
    b.workouts[0].exerciseIds = []
    const parsed = parseBackup(JSON.stringify(b))
    expect(parsed.workouts[0].exerciseIds).toEqual(['ex-back-squat', 'ex-plank'])
  })
})

describe('damaged or hostile backups', () => {
  async function good() {
    await seedData()
    return exportBackup()
  }

  it('repairs harmless oddities instead of storing them', async () => {
    const b = await good()
    const w = b.workouts[0] as unknown as Record<string, unknown>
    w.note = { evil: true }
    w.extra = 'ignored'
    const parsed = parseBackup(JSON.stringify(b))
    expect(parsed.workouts[0].note).toBe('')
    expect('extra' in parsed.workouts[0]).toBe(false)
  })

  it('rejects values that would break screens or stats', async () => {
    const b = await good()
    const cases: [string, (x: typeof b) => void][] = [
      ['a routine set that is not an object', (x) => ((x.routines[0].exercises[0].sets as unknown[])[0] = null)],
      ['a negative weight', (x) => (x.workouts[0].exercises[0].sets[0].weight = -5)],
      ['a finished workout with no end time', (x) => (x.workouts[0].endedAt = null)],
      ['text where a number belongs', (x) => ((x.workouts[0].exercises[0].sets[0] as unknown as Record<string, unknown>).reps = 'five')],
    ]
    for (const [what, damage] of cases) {
      const copy = structuredClone(b)
      damage(copy)
      expect(() => parseBackup(JSON.stringify(copy)), what).toThrow(BackupError)
    }
  })

  it('drops a nonsensical rest timer rather than showing NaN', async () => {
    const b = await good()
    const w = await startWorkout()
    const active = { ...w, restTimer: { durationSec: 60, endsAt: 'soon', pausedRemainingSec: null } }
    const parsed = parseBackup(JSON.stringify({ ...b, workouts: [...b.workouts, active] }))
    expect(parsed.workouts.find((x) => x.status === 'active')?.restTimer).toBeNull()
  })

  it('keeps spreadsheet cells from running as formulas', async () => {
    await addCompletedWorkout('2026-09-01T17:00:00.000Z', [makeExercise('ex-plank', [doneTimed(30)])], {
      name: '=HYPERLINK("http://x")',
    })
    const csv = backupToCsv(await exportBackup())
    expect(csv).toContain(",\"'=HYPERLINK(\"\"http://x\"\")\",")
  })
})

describe('merging keeps the newer edit', () => {
  it('does not let an older backup overwrite newer changes here', async () => {
    const custom = await seedData()
    const old = await exportBackup()
    await new Promise((r) => setTimeout(r, 5))
    await updateExercise(custom.id, { note: 'newer note' })
    const result = await importBackup(parseBackup(JSON.stringify(old)), 'merge')
    expect(result.keptNewer).toBeGreaterThanOrEqual(1)
    expect((await db.exercises.get(custom.id))?.note).toBe('newer note')
    expect((await getSettings()).displayUnit).toBe('lb') // settings untouched by merge
  })
})

describe('delete all data', () => {
  it('removes everything and brings back a fresh exercise library', async () => {
    await seedData()
    const w = await startWorkout()
    await saveWorkout({ ...w, note: 'x' })
    await deleteAllData()
    expect(await db.workouts.count()).toBe(0)
    expect(await db.routines.count()).toBe(0)
    expect(await db.exercises.count()).toBe(SEED_EXERCISES.length)
    expect((await db.exercises.get('ex-leg-press'))?.note).toBe('')
    expect((await getSettings()).displayUnit).toBe('kg')
  })

  it('names files by date', () => {
    expect(backupFileName('json', new Date(2026, 8, 3))).toBe('workout-tracker-2026-09-03.json')
  })
})
