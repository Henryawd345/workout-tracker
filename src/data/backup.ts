import { db, ensureSeedExercises } from './db.ts'
import { nowIso } from './ids.ts'
import { getSettings } from './settings.ts'
import {
  DEFAULT_SETTINGS,
  EQUIPMENT,
  MUSCLE_GROUPS,
  type Exercise,
  type PlannedSet,
  type RestTimer,
  type Routine,
  type SetEntry,
  type Settings,
  type WeightUnit,
  type Workout,
} from './types.ts'
import { formatNumber } from './units.ts'

export const BACKUP_APP = 'workout-tracker'
export const BACKUP_VERSION = 1

export interface Backup {
  app: typeof BACKUP_APP
  version: number
  exportedAt: string
  settings: Settings
  exercises: Exercise[]
  routines: Routine[]
  workouts: Workout[]
}

/** Everything, as one object. Includes built-in exercises so their notes come along. */
export async function exportBackup(now: string = nowIso()): Promise<Backup> {
  return db.transaction('r', db.exercises, db.routines, db.workouts, db.settings, async () => ({
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: now,
    settings: await getSettings(),
    exercises: await db.exercises.toArray(),
    routines: await db.routines.toArray(),
    workouts: await db.workouts.toArray(),
  }))
}

function csvCell(value: string | number | null): string {
  if (value === null) return ''
  let s = String(value)
  // Text starting with = + - @ would run as a formula in Excel/Sheets: make it plain text.
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** One row per completed set, for spreadsheets. Weights exactly as logged, with their unit. */
export function backupToCsv(backup: Pick<Backup, 'exercises' | 'workouts'>): string {
  const names = new Map(backup.exercises.map((e) => [e.id, e.name]))
  const rows: (string | number | null)[][] = [
    ['date', 'workout', 'exercise', 'set', 'weight', 'unit', 'reps', 'duration_sec', 'exercise_note', 'workout_note'],
  ]
  const finished = backup.workouts
    .filter((w) => w.status === 'completed')
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
  for (const w of finished) {
    for (const e of w.exercises) {
      e.sets
        .filter((s) => s.completed)
        .forEach((s, i) =>
          rows.push([
            w.startedAt,
            w.name,
            names.get(e.exerciseId) ?? e.exerciseId,
            i + 1,
            s.weight === null ? null : formatNumber(s.weight),
            s.weight === null ? null : s.weightUnit,
            s.reps,
            s.durationSec,
            e.note,
            w.note,
          ]),
        )
    }
  }
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

export class BackupError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BackupError'
  }
}

// ── Reading a backup ─────────────────────────────────────────────────────────
// Every record is rebuilt field by field: unknown fields are dropped, missing optional ones
// get safe defaults, and anything that can't be made valid rejects the whole file — before
// a single write. A damaged or hand-edited file can never crash a screen later.

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const isDate = (v: unknown): v is string => isStr(v) && !Number.isNaN(Date.parse(v))
const isUnit = (v: unknown): v is WeightUnit => v === 'kg' || v === 'lb'
const str = (v: unknown) => (isStr(v) ? v : '')
const date = (v: unknown, fallback: string) => (isDate(v) ? v : fallback)

/** Throws "the backup's <part> are damaged" unless `ok`. */
function need(ok: boolean, part: string): void {
  if (!ok) throw new BackupError(`The backup’s ${part} are damaged.`)
}

/** A number ≥ 0, or null when absent. Anything else (negative, text, NaN) is damage. */
function amount(v: unknown, part: string): number | null {
  if (v === null || v === undefined) return null
  need(typeof v === 'number' && Number.isFinite(v) && v >= 0, part)
  return v as number
}

function readExercise(e: unknown, now: string): Exercise {
  need(isObj(e), 'exercises')
  const x = e as Obj
  need(isStr(x.id) && isStr(x.name) && x.name.trim() !== '', 'exercises')
  need(
    Array.isArray(x.muscleGroups) &&
      x.muscleGroups.length > 0 &&
      x.muscleGroups.every((m) => (MUSCLE_GROUPS as readonly unknown[]).includes(m)),
    'exercises',
  )
  need((EQUIPMENT as readonly unknown[]).includes(x.equipment), 'exercises')
  need(['weight_reps', 'reps_only', 'duration'].includes(x.trackingType as string), 'exercises')
  return {
    id: x.id as string,
    name: x.name as string,
    muscleGroups: x.muscleGroups as Exercise['muscleGroups'],
    equipment: x.equipment as Exercise['equipment'],
    trackingType: x.trackingType as Exercise['trackingType'],
    note: str(x.note),
    isCustom: typeof x.isCustom === 'boolean' ? x.isCustom : true,
    archived: x.archived === true,
    createdAt: date(x.createdAt, now),
    updatedAt: date(x.updatedAt, now),
  }
}

function readPlannedSet(s: unknown): PlannedSet {
  need(isObj(s), 'routines')
  const x = s as Obj
  const out: PlannedSet = {}
  const reps = amount(x.targetReps, 'routines')
  const duration = amount(x.targetDurationSec, 'routines')
  const weight = amount(x.targetWeight, 'routines')
  if (reps !== null) out.targetReps = reps
  if (duration !== null) out.targetDurationSec = duration
  if (weight !== null) {
    out.targetWeight = weight
    out.targetWeightUnit = isUnit(x.targetWeightUnit) ? x.targetWeightUnit : 'kg'
  }
  return out
}

function readRoutine(r: unknown, now: string): Routine {
  need(isObj(r), 'routines')
  const x = r as Obj
  need(isStr(x.id) && isStr(x.name) && Array.isArray(x.exercises), 'routines')
  return {
    id: x.id as string,
    name: x.name as string,
    note: str(x.note),
    exercises: (x.exercises as unknown[]).map((e) => {
      need(isObj(e), 'routines')
      const y = e as Obj
      need(isStr(y.id) && isStr(y.exerciseId) && Array.isArray(y.sets), 'routines')
      return {
        id: y.id as string,
        exerciseId: y.exerciseId as string,
        sets: (y.sets as unknown[]).map(readPlannedSet),
        restSec: amount(y.restSec, 'routines') ?? DEFAULT_SETTINGS.defaultRestSec,
        note: str(y.note),
      }
    }),
    createdAt: date(x.createdAt, now),
    updatedAt: date(x.updatedAt, now),
  }
}

function readSet(s: unknown): SetEntry {
  need(isObj(s), 'workouts')
  const x = s as Obj
  need(isStr(x.id) && typeof x.completed === 'boolean', 'workouts')
  return {
    id: x.id as string,
    weight: amount(x.weight, 'workouts'),
    weightUnit: isUnit(x.weightUnit) ? x.weightUnit : 'kg',
    reps: amount(x.reps, 'workouts'),
    durationSec: amount(x.durationSec, 'workouts'),
    completed: x.completed as boolean,
    completedAt: isDate(x.completedAt) ? x.completedAt : null,
  }
}

/** A saved rest timer, or null if it's missing or doesn't make sense. */
function readRestTimer(t: unknown): RestTimer | null {
  if (!isObj(t)) return null
  const duration = typeof t.durationSec === 'number' && t.durationSec >= 0 ? t.durationSec : null
  const endsAt = isDate(t.endsAt) ? t.endsAt : null
  const paused = typeof t.pausedRemainingSec === 'number' && t.pausedRemainingSec >= 0 ? t.pausedRemainingSec : null
  // It must be either running (has an end time) or paused (has time left) — not both, not neither.
  if (duration === null || (endsAt === null) === (paused === null)) return null
  return { durationSec: duration, endsAt, pausedRemainingSec: paused }
}

function readWorkout(w: unknown, now: string): Workout {
  need(isObj(w), 'workouts')
  const x = w as Obj
  need(isStr(x.id) && isStr(x.name) && isDate(x.startedAt) && Array.isArray(x.exercises), 'workouts')
  need(x.status === 'active' || x.status === 'completed', 'workouts')
  const completed = x.status === 'completed'
  // A finished workout needs a real end time: its duration and stats depend on it.
  need(!completed || (isDate(x.endedAt) && Date.parse(x.endedAt) >= Date.parse(x.startedAt as string)), 'workouts')
  const exercises = (x.exercises as unknown[]).map((e) => {
    need(isObj(e), 'workouts')
    const y = e as Obj
    need(isStr(y.id) && isStr(y.exerciseId) && Array.isArray(y.sets), 'workouts')
    return {
      id: y.id as string,
      exerciseId: y.exerciseId as string,
      restSec: amount(y.restSec, 'workouts') ?? DEFAULT_SETTINGS.defaultRestSec,
      note: str(y.note),
      sets: (y.sets as unknown[]).map(readSet),
    }
  })
  return {
    id: x.id as string,
    name: x.name as string,
    routineId: isStr(x.routineId) ? x.routineId : null,
    status: x.status as Workout['status'],
    startedAt: x.startedAt as string,
    endedAt: completed ? (x.endedAt as string) : null,
    note: str(x.note),
    exercises,
    // Derived field rebuilt, so an edited file can't leave the index out of sync.
    exerciseIds: [...new Set(exercises.map((e) => e.exerciseId))],
    restTimer: completed ? null : readRestTimer(x.restTimer),
    updatedAt: date(x.updatedAt, now),
  }
}

/** Largest backup file accepted (years of daily workouts are far below this). */
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024

/** Reads and checks a backup file's text. Throws BackupError with a readable reason. */
export function parseBackup(text: string, now: string = nowIso()): Backup {
  if (text.length > MAX_BACKUP_BYTES) throw new BackupError('This file is too large to be a backup.')
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new BackupError('This isn’t a backup file (it isn’t valid JSON).')
  }
  if (!isObj(data) || data.app !== BACKUP_APP) throw new BackupError('This isn’t a Workout Tracker backup.')
  if (typeof data.version !== 'number' || data.version > BACKUP_VERSION) {
    throw new BackupError('This backup is from a newer version of the app. Update the app first.')
  }
  need(Array.isArray(data.exercises), 'exercises')
  need(Array.isArray(data.routines), 'routines')
  need(Array.isArray(data.workouts), 'workouts')
  const exercises = (data.exercises as unknown[]).map((e) => readExercise(e, now))
  const routines = (data.routines as unknown[]).map((r) => readRoutine(r, now))
  const workouts = (data.workouts as unknown[]).map((w) => readWorkout(w, now))

  const known = new Set(exercises.map((e) => e.id))
  const missing = [...workouts.flatMap((w) => w.exercises), ...routines.flatMap((r) => r.exercises)].find(
    (e) => !known.has(e.exerciseId),
  )
  if (missing) throw new BackupError('The backup refers to an exercise it doesn’t contain.')
  if (workouts.filter((w) => w.status === 'active').length > 1) throw new BackupError('The backup has two workouts in progress.')

  const settings = isObj(data.settings) ? data.settings : {}
  return {
    app: BACKUP_APP,
    version: data.version,
    exportedAt: isStr(data.exportedAt) ? data.exportedAt : '',
    settings: {
      displayUnit: isUnit(settings.displayUnit) ? settings.displayUnit : DEFAULT_SETTINGS.displayUnit,
      defaultRestSec:
        typeof settings.defaultRestSec === 'number' && settings.defaultRestSec >= 0
          ? settings.defaultRestSec
          : DEFAULT_SETTINGS.defaultRestSec,
      autoStartRest: typeof settings.autoStartRest === 'boolean' ? settings.autoStartRest : DEFAULT_SETTINGS.autoStartRest,
    },
    exercises,
    routines,
    workouts,
  }
}

export interface ImportResult {
  workouts: number
  routines: number
  exercises: number
  skippedActive: boolean
  /** Merge only: records already here that were newer than the backup's copy, so kept. */
  keptNewer: number
}

/** Merge rule: an incoming record replaces one with the same id only if it isn't older. */
function newerThanHere<T extends { id: string; updatedAt: string }>(incoming: T[], here: (T | undefined)[]): T[] {
  return incoming.filter((r, i) => !here[i] || here[i]!.updatedAt <= r.updatedAt)
}

/**
 * Loads a checked backup, in one transaction (all or nothing).
 * 'replace': the app ends up exactly like the backup.
 * 'merge': adds the backup's records; where both have the same record, the newer edit wins,
 * and your settings stay as they are. A workout in progress in the backup is skipped if one
 * is already in progress here — there can only be one.
 */
export async function importBackup(backup: Backup, mode: 'replace' | 'merge'): Promise<ImportResult> {
  const result = await db.transaction('rw', db.exercises, db.routines, db.workouts, db.settings, async () => {
    let { exercises, routines, workouts } = backup
    let skippedActive = false
    let keptNewer = 0
    if (mode === 'replace') {
      await Promise.all([db.exercises.clear(), db.routines.clear(), db.workouts.clear(), db.settings.clear()])
      await db.settings.put({ id: 'settings', ...backup.settings })
    } else {
      const active = await db.workouts.where('status').equals('active').first()
      if (active) {
        const before = workouts.length
        workouts = workouts.filter((w) => w.status !== 'active' || w.id === active.id)
        skippedActive = workouts.length < before
      }
      const total = exercises.length + routines.length + workouts.length
      exercises = newerThanHere(exercises, await db.exercises.bulkGet(exercises.map((e) => e.id)))
      routines = newerThanHere(routines, await db.routines.bulkGet(routines.map((r) => r.id)))
      workouts = newerThanHere(workouts, await db.workouts.bulkGet(workouts.map((w) => w.id)))
      keptNewer = total - exercises.length - routines.length - workouts.length
    }
    await db.exercises.bulkPut(exercises)
    await db.routines.bulkPut(routines)
    await db.workouts.bulkPut(workouts)
    return {
      workouts: workouts.filter((w) => w.status === 'completed').length,
      routines: routines.length,
      exercises: exercises.filter((e) => e.isCustom).length,
      skippedActive,
      keptNewer,
    }
  })
  await ensureSeedExercises()
  return result
}

/** Deletes every workout, routine, custom exercise, note and setting. Built-in exercises come back fresh. */
export async function deleteAllData(): Promise<void> {
  await db.transaction('rw', db.exercises, db.routines, db.workouts, db.settings, async () => {
    await Promise.all([db.exercises.clear(), db.routines.clear(), db.workouts.clear(), db.settings.clear()])
  })
  await ensureSeedExercises()
}

/** "workout-tracker-2026-09-23.json" */
export function backupFileName(ext: 'json' | 'csv', now: Date = new Date()): string {
  const d = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return `workout-tracker-${d}.${ext}`
}
