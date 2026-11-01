import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useId, useRef, useState } from 'react'
import { ActionSheet } from '../components/ActionSheet.tsx'
import { BackButton } from '../components/BackButton.tsx'
import { Button } from '../components/Button.tsx'
import { englishVoices, onVoicesChanged, speak, speechSupported } from '../components/fight/coach.ts'
import { Segmented, SelectField, Switch } from '../components/Fields.tsx'
import { formatDate, plural } from '../components/format.ts'
import { Modal } from '../components/Modal.tsx'
import { restOptions } from '../components/rest.ts'
import { saveFile } from '../components/saveFile.ts'
import { Screen } from '../components/Screen.tsx'
import { Toast, type ToastMessage } from '../components/Toast.tsx'
import {
  backupFileName,
  BackupError,
  COACH_RATES,
  moveName,
  backupToCsv,
  DEFAULT_SETTINGS,
  deleteAllData,
  exportBackup,
  getSettings,
  importBackup,
  MAX_BACKUP_BYTES,
  parseBackup,
  updateSettings,
  type Backup,
  type Stance,
  type WeightUnit,
} from '../data/index.ts'
import styles from './SettingsScreen.module.css'

async function storageProtected(): Promise<boolean | null> {
  try {
    return navigator.storage?.persisted ? await navigator.storage.persisted() : null
  } catch {
    return null
  }
}

export function SettingsScreen() {
  const settings = useLiveQuery(() => getSettings(), [], DEFAULT_SETTINGS)
  // Not a database read, so not in useLiveQuery (which must only run Dexie queries).
  const [persisted, setPersisted] = useState<boolean | null>(null)
  useEffect(() => {
    void storageProtected().then(setPersisted)
  }, [])
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [pending, setPending] = useState<Backup | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const say = (text: string) => setToast({ id: Date.now(), text })

  async function exportJson() {
    const result = await saveFile(backupFileName('json'), JSON.stringify(await exportBackup(), null, 2), 'application/json')
    if (result !== 'cancelled') say('Backup saved')
  }

  async function exportCsv() {
    const result = await saveFile(backupFileName('csv'), backupToCsv(await exportBackup()), 'text/csv')
    if (result !== 'cancelled') say('Spreadsheet saved')
  }

  async function chooseFile(file: File | undefined) {
    setImportError(null)
    if (!file) return
    if (file.size > MAX_BACKUP_BYTES) return setImportError('This file is too large to be a backup.')
    try {
      setPending(parseBackup(await file.text()))
    } catch (err) {
      setImportError(err instanceof BackupError ? err.message : 'Couldn’t read that file.')
    } finally {
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function runImport(mode: 'replace' | 'merge') {
    if (!pending) return
    const backup = pending
    setPending(null)
    try {
      const r = await importBackup(backup, mode)
      say(
        `Imported ${plural(r.workouts, 'workout')}` +
          (r.fightSessions > 0 ? `, ${plural(r.fightSessions, 'fight session')}` : '') +
          ` and ${plural(r.routines, 'routine')}` +
          (r.skippedActive ? ' (kept what’s in progress on this phone)' : '') +
          (r.keptNewer > 0 ? `; kept ${plural(r.keptNewer, 'newer item')} from this phone` : ''),
      )
    } catch {
      setImportError('Import failed. Nothing was changed.')
    }
  }

  const pendingSummary = pending
    ? `${plural(pending.workouts.filter((w) => w.status === 'completed').length, 'workout')}, ${plural(pending.routines.length, 'routine')}` +
      (pending.exportedAt ? ` · saved ${formatDate(pending.exportedAt)}` : '')
    : ''

  return (
    <Screen title="Settings" leading={<BackButton fallback="/today" label="Back" />}>
      <section className={styles.section} aria-labelledby="units">
        <h2 id="units">Units</h2>
        <Segmented<WeightUnit>
          label="Show weights in"
          value={settings.displayUnit}
          options={[
            { value: 'kg', label: 'Kilograms (kg)' },
            { value: 'lb', label: 'Pounds (lb)' },
          ]}
          onChange={(displayUnit) => void updateSettings({ displayUnit })}
          hint="Only changes how weights are shown and entered. Numbers you’ve logged are never altered."
        />
      </section>

      <section className={styles.section} aria-labelledby="rest">
        <h2 id="rest">Rest timer</h2>
        <SelectField
          label="Default rest for new exercises"
          value={String(settings.defaultRestSec)}
          options={restOptions(settings.defaultRestSec)}
          onChange={(v) => void updateSettings({ defaultRestSec: Number(v) })}
        />
        <Switch
          label="Start automatically"
          hint="Starts the rest timer when you tick off a set."
          checked={settings.autoStartRest}
          onChange={(autoStartRest) => void updateSettings({ autoStartRest })}
        />
      </section>

      <CoachSettings voiceURI={settings.coachVoice} rate={settings.coachRate} stance={settings.stance} />

      <section className={styles.section} aria-labelledby="data">
        <h2 id="data">Your data</h2>
        <p className={styles.text}>
          Everything is stored only on this phone.{' '}
          {persisted === true
            ? 'It’s protected from automatic clearing.'
            : 'Add the app to your Home Screen so iOS keeps it, and save a backup now and then.'}
        </p>
        <Button block onClick={() => void exportJson()}>
          Save a backup
        </Button>
        <Button block onClick={() => void exportCsv()}>
          Export spreadsheet (CSV)
        </Button>
        <Button block onClick={() => fileInput.current?.click()}>
          Restore from a backup…
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className={styles.hiddenInput}
          aria-label="Backup file"
          onChange={(e) => void chooseFile(e.target.files?.[0])}
        />
        {importError && (
          <p className={styles.error} role="alert">
            {importError}
          </p>
        )}
      </section>

      <section className={styles.section} aria-labelledby="danger">
        <h2 id="danger">Delete</h2>
        <Button variant="danger" block onClick={() => setDeleting(true)}>
          Delete all data
        </Button>
      </section>

      <ActionSheet
        open={pending !== null}
        title={`Restore backup: ${pendingSummary}`}
        onClose={() => setPending(null)}
        actions={[
          { label: 'Add to what’s here', onSelect: () => void runImport('merge') },
          { label: 'Replace everything', destructive: true, onSelect: () => void runImport('replace') },
        ]}
      />
      {deleting && (
        <DeleteAllDialog
          onCancel={() => setDeleting(false)}
          onConfirm={async () => {
            setDeleting(false)
            await deleteAllData()
            say('All data deleted')
          }}
        />
      )}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </Screen>
  )
}

function DeleteAllDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const [typed, setTyped] = useState('')
  const titleId = useId()
  const inputId = useId()
  const ok = typed.trim().toUpperCase() === 'DELETE'
  return (
    <Modal className={styles.backdrop} onClick={onCancel}>
      <div role="alertdialog" aria-modal="true" aria-labelledby={titleId} className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <h2 id={titleId}>Delete all data?</h2>
        <p className={styles.text}>
          Every workout, routine, custom exercise, note and setting will be deleted from this phone. Save a backup first if
          you might want it back.
        </p>
        <label htmlFor={inputId} className={styles.text}>
          Type DELETE to confirm
        </label>
        <input
          id={inputId}
          className={styles.confirmInput}
          value={typed}
          autoCapitalize="characters"
          autoComplete="off"
          autoFocus
          onChange={(e) => setTyped(e.target.value)}
        />
        <div className={styles.actions}>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="danger" disabled={!ok} onClick={onConfirm}>
            Delete everything
          </Button>
        </div>
      </div>
    </Modal>
  )
}

const RATE_LABELS: Record<(typeof COACH_RATES)[number], string> = { 0.85: 'Slow', 1: 'Normal', 1.2: 'Fast' }

function CoachSettings({ voiceURI, rate, stance }: { voiceURI: string | null; rate: number; stance: Stance }) {
  // The phone loads its voices a moment after the page; refresh the list when it does.
  const [voices, setVoices] = useState(englishVoices)
  useEffect(() => onVoicesChanged(() => setVoices(englishVoices())), [])
  const supported = speechSupported()

  return (
    <section className={styles.section} aria-labelledby="coach">
      <h2 id="coach">Fight coach</h2>
      <Segmented<Stance>
        label="Stance"
        value={stance}
        options={[
          { value: 'orthodox', label: 'Orthodox' },
          { value: 'southpaw', label: 'Southpaw' },
        ]}
        onChange={(s) => void updateSettings({ stance: s })}
        hint="Orthodox: left foot forward. Southpaw: right foot forward. The coach says left and right to match."
      />
      {supported ? (
        <>
          <SelectField
            label="Voice"
            value={voiceURI ?? ''}
            options={[
              { value: '', label: 'Phone default' },
              ...voices.map((v) => ({ value: v.voiceURI, label: `${v.name} (${v.lang})` })),
            ]}
            onChange={(v) => void updateSettings({ coachVoice: v || null })}
            hint="More voices: iPhone Settings → Accessibility → Spoken Content → Voices."
          />
          <Segmented
            label="Speed"
            value={String(rate)}
            options={COACH_RATES.map((r) => ({ value: String(r), label: RATE_LABELS[r] }))}
            onChange={(v) => void updateSettings({ coachRate: Number(v) })}
          />
          <Button block onClick={() => speak(`1 2, ${moveName('slip lead', stance)}, 3. ${moveName('rear kick', stance)}.`, { voiceURI, rate })}>
            Test voice
          </Button>
        </>
      ) : (
        <p className={styles.text}>This browser can’t speak, so the coach shows combos on screen only.</p>
      )}
    </section>
  )
}
