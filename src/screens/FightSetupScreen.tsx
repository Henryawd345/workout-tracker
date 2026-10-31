import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { BackButton } from '../components/BackButton.tsx'
import { Button, ButtonLink } from '../components/Button.tsx'
import { unlockFightSound } from '../components/fight/coach.ts'
import { INTENSITY_LABELS, isSport, secLabel, SPORT_LABELS } from '../components/fight/labels.ts'
import { Segmented } from '../components/Fields.tsx'
import { Screen } from '../components/Screen.tsx'
import {
  ActiveFightSessionExistsError,
  formatDuration,
  INTENSITIES,
  lastFightPlan,
  listCombos,
  MAX_ROUNDS,
  READY_SEC,
  REST_SEC_OPTIONS,
  ROUND_SEC_OPTIONS,
  startFightSession,
  totalSec,
  type FightPlan,
  type Intensity,
  type Sport,
} from '../data/index.ts'
import styles from './FightSetupScreen.module.css'

const back = <BackButton fallback="/fight" label="Back to Fight" />

export function FightSetupScreen() {
  const { sport } = useParams()
  if (!isSport(sport)) return <Navigate to="/fight" replace />
  return <Setup key={sport} sport={sport} />
}

function Setup({ sport }: { sport: Sport }) {
  // Your last choices for this sport, else the defaults.
  const initial = useLiveQuery(() => lastFightPlan(sport), [sport])
  if (!initial) return <Screen title={SPORT_LABELS[sport]} leading={back}>{null}</Screen>
  return <SetupForm initial={initial} />
}

const INTENSITY_HINT: Record<'striking' | 'wrestling', string> = {
  striking: 'Easy: 1–2 punches, plenty of time. Medium: up to 4 moves with some defence. Hard: up to 6 moves with defence and kicks, fast.',
  wrestling: 'Easy: one call at a time. Medium: more moves. Hard: faster calls and chains like “sprawl, re-shot”.',
}

function SetupForm({ initial }: { initial: FightPlan }) {
  const navigate = useNavigate()
  const [plan, setPlan] = useState(initial)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (changes: Partial<FightPlan>) => setPlan((p) => ({ ...p, ...changes }))
  const comboCount = useLiveQuery(async () => (await listCombos(initial.sport)).length, [initial.sport], 0)

  async function start() {
    if (starting) return
    // iOS only allows sound and speech that start from a tap — this one.
    unlockFightSound()
    setStarting(true)
    try {
      await startFightSession(plan)
      navigate('/fight/session', { state: { starting: true } })
    } catch (err) {
      if (err instanceof ActiveFightSessionExistsError) navigate('/fight/session')
      else {
        setError(err instanceof Error ? err.message : 'Could not start the session')
        setStarting(false)
      }
    }
  }

  return (
    <Screen title={SPORT_LABELS[plan.sport]} leading={back}>
      <Segmented
        label="Round length"
        value={String(plan.roundSec)}
        options={ROUND_SEC_OPTIONS.map((s) => ({ value: String(s), label: secLabel(s) }))}
        onChange={(v) => set({ roundSec: Number(v) })}
      />

      <fieldset className={styles.stepper}>
        <legend className={styles.label}>Rounds</legend>
        <div className={styles.stepperRow}>
          <Button aria-label="Fewer rounds" disabled={plan.rounds <= 1} onClick={() => set({ rounds: plan.rounds - 1 })}>
            −
          </Button>
          <output className={styles.count} aria-live="polite">
            {plan.rounds}
          </output>
          <Button aria-label="More rounds" disabled={plan.rounds >= MAX_ROUNDS} onClick={() => set({ rounds: plan.rounds + 1 })}>
            +
          </Button>
        </div>
      </fieldset>

      <Segmented
        label="Rest between rounds"
        value={String(plan.restSec)}
        options={REST_SEC_OPTIONS.map((s) => ({ value: String(s), label: secLabel(s) }))}
        onChange={(v) => set({ restSec: Number(v) })}
      />

      <Segmented<Intensity>
        label="Intensity"
        value={plan.intensity}
        options={INTENSITIES.map((i) => ({ value: i, label: INTENSITY_LABELS[i] }))}
        onChange={(intensity) => set({ intensity })}
        hint={INTENSITY_HINT[plan.sport === 'wrestling' ? 'wrestling' : 'striking']}
      />

      <p className={styles.total}>
        Total {formatDuration(totalSec(plan))}, including {READY_SEC} seconds to get ready.
      </p>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <Button variant="primary" block disabled={starting} onClick={() => void start()}>
        Start
      </Button>
      <ButtonLink to={`/fight/${plan.sport}/combos`} variant="ghost" block>
        My combos{comboCount ? ` (${comboCount})` : ''}
      </ButtonLink>
    </Screen>
  )
}
