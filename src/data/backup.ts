import { db, ensureSeedExercises } from './db.ts'
import { WARMUP_SEC_OPTIONS } from './fight.ts'
import { nowIso } from './ids.ts'
import { getSettings } from './settings.ts'
import {
  COACH_RATES,
  DEFAULT_SETTINGS,
  EQUIPMENT,
  INTENSITIES,
  MUSCLE_GROUPS,
  SPORTS,
  type CustomCombo,
  type Exercise,
  type FightSession,
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
export const BACKUP_VERSION = 2

export interface Backup {
  app: typeof BACKUP_APP
  version: number
  exportedAt: string
  settings: Settings
  exercises: Exercise[]
  routines: Routine[]
  workouts: Workout[]
  /** Added in version 2; empty when reading a version 1 file. */
  fightSessions: FightSession[]
  combos: CustomCombo[]
}

/** Everything, as one object. Includes built-in exercises so their notes come along. */
export async function exportBackup(now: string = nowIso()): Promise<Backup> {
  return db.transaction('r', [db.exercises, db.routines, db.workouts, db.settings, db.fightSessions, db.combos], async () => ({
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: now,
    settings: await getSettings(),
    exercises: await db.exercises.toArray(),
    routines: await db.routines.toArray(),
    workouts: await db.workouts.toArray(),
    fightSessions: await db.fightSessions.toArray(),
    combos: await db.combos.toArray(),
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

const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max

function readFightSession(f: unknown, now: string): FightSession {
  need(isObj(f), 'fight sessions')
  const x = f as Obj
  need(isStr(x.id) && isDate(x.startedAt), 'fight sessions')
  need(SPORTS.includes(x.sport as never) && INTENSITIES.includes(x.intensity as never), 'fight sessions')
  need(isInt(x.rounds, 1, 12) && isInt(x.roundSec, 10, 600) && isInt(x.restSec, 0, 300), 'fight sessions')
  need(x.status === 'active' || x.status === 'completed', 'fight sessions')
  const completed = x.status === 'completed'
  need(!completed || (isDate(x.endedAt) && Date.parse(x.endedAt) >= Date.parse(x.startedAt as string)), 'fight sessions')
  need(!completed || isInt(x.completedRounds, 1, x.rounds as number), 'fight sessions')
  need(isObj(x.clock), 'fight sessions')
  const clock = x.clock as Obj
  const elapsed = amount(clock.elapsedBeforeSec, 'fight sessions') ?? 0
  const runningSince = isDate(clock.runningSince) && !completed ? clock.runningSince : null
  return {
    id: x.id as string,
    sport: x.sport as FightSession['sport'],
    intensity: x.intensity as FightSession['intensity'],
    roundSec: x.roundSec as number,
    restSec: x.restSec as number,
    rounds: x.rounds as number,
    coachMode: x.coachMode === 'timer' ? 'timer' : 'combos',
    burst: typeof x.burst === 'boolean' ? x.burst : true,
    warmupSec: WARMUP_SEC_OPTIONS.includes(x.warmupSec as number) ? (x.warmupSec as number) : 0,
    status: x.status as FightSession['status'],
    startedAt: x.startedAt as string,
    endedAt: completed ? (x.endedAt as string) : null,
    clock: { runningSince, elapsedBeforeSec: elapsed },
    completedRounds: completed ? (x.completedRounds as number) : 0,
    note: str(x.note),
    updatedAt: date(x.updatedAt, now),
  }
}

function readCombo(c: unknown, now: string): CustomCombo {
  need(isObj(c), 'combos')
  const x = c as Obj
  need(isStr(x.id) && SPORTS.includes(x.sport as never) && isStr(x.text), 'combos')
  const text = (x.text as string).replace(/\s+/g, ' ').trim()
  need(text !== '' && text.length <= 60, 'combos')
  return {
    id: x.id as string,
    sport: x.sport as CustomCombo['sport'],
    text,
    createdAt: date(x.createdAt, now),
    updatedAt: date(x.updatedAt, now),
  }
}

/** A version 2 list, or empty when a version 1 file doesn't have it. */
function optionalList(v: unknown, part: string): unknown[] {
  if (v === undefined) return []
  need(Array.isArray(v), part)
  return v as unknown[]
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
  const fightSessions = optionalList(data.fightSessions, 'fight sessions').map((f) => readFightSession(f, now))
  const combos = optionalList(data.combos, 'combos').map((c) => readCombo(c, now))

  const known = new Set(exercises.map((e) => e.id))
  const missing = [...workouts.flatMap((w) => w.exercises), ...routines.flatMap((r) => r.exercises)].find(
    (e) => !known.has(e.exerciseId),
  )
  if (missing) throw new BackupError('The backup refers to an exercise it doesn’t contain.')
  if (workouts.filter((w) => w.status === 'active').length > 1) throw new BackupError('The backup has two workouts in progress.')
  if (fightSessions.filter((f) => f.status === 'active').length > 1) {
    throw new BackupError('The backup has two fight sessions in progress.')
  }

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
      coachVoice: isStr(settings.coachVoice) ? settings.coachVoice : DEFAULT_SETTINGS.coachVoice,
      coachRate:
        typeof settings.coachRate === 'number' && Number.isFinite(settings.coachRate)
          ? COACH_RATES.reduce((best, r) =>
              Math.abs(r - (settings.coachRate as number)) < Math.abs(best - (settings.coachRate as number)) ? r : best,
            )
          : DEFAULT_SETTINGS.coachRate,
      stance: settings.stance === 'southpaw' ? 'southpaw' : 'orthodox',
    },
    exercises,
    routines,
    workouts,
    fightSessions,
    combos,
  }
}

export interface ImportResult {
  workouts: number
  fightSessions: number
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
  const tables = [db.exercises, db.routines, db.workouts, db.settings, db.fightSessions, db.combos]
  const result = await db.transaction('rw', tables, async () => {
    let { exercises, routines, workouts, fightSessions, combos } = backup
    let skippedActive = false
    let keptNewer = 0
    if (mode === 'replace') {
      // A version 1 file has no fight data, so keep what's here rather than wiping it.
      const cleared = backup.version < 2 ? tables.filter((t) => t !== db.fightSessions && t !== db.combos) : tables
      await Promise.all(cleared.map((t) => t.clear()))
      await db.settings.put({ id: 'settings', ...backup.settings })
    } else {
      const active = await db.workouts.where('status').equals('active').first()
      if (active) {
        const before = workouts.length
        workouts = workouts.filter((w) => w.status !== 'active' || w.id === active.id)
        skippedActive = workouts.length < before
      }
      const activeFight = await db.fightSessions.where('status').equals('active').first()
      if (activeFight) {
        const before = fightSessions.length
        fightSessions = fightSessions.filter((f) => f.status !== 'active' || f.id === activeFight.id)
        skippedActive ||= fightSessions.length < before
      }
      const total = exercises.length + routines.length + workouts.length + fightSessions.length + combos.length
      exercises = newerThanHere(exercises, await db.exercises.bulkGet(exercises.map((e) => e.id)))
      routines = newerThanHere(routines, await db.routines.bulkGet(routines.map((r) => r.id)))
      workouts = newerThanHere(workouts, await db.workouts.bulkGet(workouts.map((w) => w.id)))
      fightSessions = newerThanHere(fightSessions, await db.fightSessions.bulkGet(fightSessions.map((f) => f.id)))
      combos = newerThanHere(combos, await db.combos.bulkGet(combos.map((c) => c.id)))
      const hereCombos = await db.combos.toArray()
      combos = combos.filter(
        (c) => !hereCombos.some((h) => h.id !== c.id && h.sport === c.sport && h.text.toLowerCase() === c.text.toLowerCase()),
      )
      keptNewer = total - exercises.length - routines.length - workouts.length - fightSessions.length - combos.length
    }
    await db.exercises.bulkPut(exercises)
    await db.routines.bulkPut(routines)
    await db.workouts.bulkPut(workouts)
    await db.fightSessions.bulkPut(fightSessions)
    await db.combos.bulkPut(combos)
    return {
      workouts: workouts.filter((w) => w.status === 'completed').length,
      fightSessions: fightSessions.filter((f) => f.status === 'completed').length,
      routines: routines.length,
      exercises: exercises.filter((e) => e.isCustom).length,
      skippedActive,
      keptNewer,
    }
  })
  await ensureSeedExercises()
  return result
}

/**
 * Deletes every workout, fight session, combo, routine, custom exercise, note and setting.
 * Built-in exercises come back fresh.
 */
export async function deleteAllData(): Promise<void> {
  const tables = [db.exercises, db.routines, db.workouts, db.settings, db.fightSessions, db.combos]
  await db.transaction('rw', tables, async () => {
    await Promise.all(tables.map((t) => t.clear()))
  })
  await ensureSeedExercises()
}

/** "workout-tracker-2026-09-23.json" */
export function backupFileName(ext: 'json' | 'csv', now: Date = new Date()): string {
  const d = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return `workout-tracker-${d}.${ext}`
}
