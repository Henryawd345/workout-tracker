import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { Navigate, useParams } from 'react-router'
import { BackButton } from '../components/BackButton.tsx'
import { Button } from '../components/Button.tsx'
import { speak } from '../components/fight/coach.ts'
import { isSport, SPORT_LABELS } from '../components/fight/labels.ts'
import { TextField } from '../components/Fields.tsx'
import { IconButton } from '../components/IconButton.tsx'
import { CloseIcon, SpeakerIcon } from '../components/icons.tsx'
import { EmptyState, Screen } from '../components/Screen.tsx'
import { Toast, type ToastMessage } from '../components/Toast.tsx'
import {
  addCombo,
  DEFAULT_SETTINGS,
  getSettings,
  listCombos,
  MAX_COMBO_LENGTH,
  removeCombo,
  restoreCombo,
  type CustomCombo,
  type Sport,
} from '../data/index.ts'
import styles from './CombosScreen.module.css'

const HINTS: Record<'striking' | 'wrestling', { hint: string; example: string }> = {
  striking: {
    hint: 'Numbers for punches (1 jab, 2 cross, 3 lead hook, 4 rear hook, 5 lead uppercut, 6 rear uppercut), words for the rest: slip left, roll right, left kick, right knee, teep…',
    example: 'e.g. 1 2 slip 2 3',
  },
  wrestling: { hint: 'Short calls, with commas between moves.', example: 'e.g. shot, sprawl, re-shot' },
}

export function CombosScreen() {
  const { sport } = useParams()
  if (!isSport(sport)) return <Navigate to="/fight" replace />
  return <Combos key={sport} sport={sport} />
}

function Combos({ sport }: { sport: Sport }) {
  const combos = useLiveQuery(() => listCombos(sport), [sport])
  const settings = useLiveQuery(() => getSettings(), [], DEFAULT_SETTINGS)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const { hint, example } = HINTS[sport === 'wrestling' ? 'wrestling' : 'striking']

  async function add(e: FormEvent) {
    e.preventDefault()
    try {
      await addCombo(sport, text)
      setText('')
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the combo')
    }
  }

  async function remove(combo: CustomCombo) {
    await removeCombo(combo.id)
    setToast({
      id: Date.now(),
      text: `“${combo.text}” deleted`,
      actionLabel: 'Undo',
      onAction: () => void restoreCombo(combo),
    })
  }

  return (
    <Screen
      title="My combos"
      leading={<BackButton fallback={`/fight/${sport}`} label={`Back to ${SPORT_LABELS[sport]}`} />}
    >
      <p className={styles.intro}>
        {SPORT_LABELS[sport]}: the coach mixes these in with random ones — about one call in three.
      </p>

      <form className={styles.form} onSubmit={add} noValidate>
        <TextField
          label="New combo"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setError(null)
          }}
          placeholder={example}
          maxLength={MAX_COMBO_LENGTH}
          autoCapitalize="none"
          autoComplete="off"
          enterKeyHint="done"
          hint={hint}
          error={error}
        />
        <Button type="submit" variant="primary" block disabled={!text.trim()}>
          Add combo
        </Button>
      </form>

      {combos?.length === 0 && (
        <EmptyState title="No combos yet">Until you add some, the coach calls random combos.</EmptyState>
      )}
      {combos && combos.length > 0 && (
        <ul className={styles.list} aria-label="Your combos">
          {combos.map((c) => (
            <li key={c.id} className={styles.row}>
              <span className={styles.text}>{c.text}</span>
              <IconButton
                label={`Hear “${c.text}”`}
                onClick={() => speak(c.text, { voiceURI: settings.coachVoice, rate: settings.coachRate })}
              >
                <SpeakerIcon />
              </IconButton>
              <IconButton label={`Delete “${c.text}”`} onClick={() => void remove(c)}>
                <CloseIcon />
              </IconButton>
            </li>
          ))}
        </ul>
      )}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </Screen>
  )
}
